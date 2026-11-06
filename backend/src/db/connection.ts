import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';

// Ensure uploads and database directory exist
const dbDir = path.dirname(CONFIG.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
  fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
}

export interface StatementResult {
  lastInsertRowid: number | bigint;
  changes: number | bigint;
}

export interface PreparedStatement {
  run(...params: any[]): StatementResult;
  get(...params: any[]): any;
  all(...params: any[]): any[];
}

export interface IDatabase {
  exec(sql: string): void;
  prepare(sql: string): PreparedStatement;
  pragma(sql: string): void;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
}

class SQLiteDatabase implements IDatabase {
  private rawDb: any;

  constructor(filePath: string) {
    try {
      // Use built-in node:sqlite (Node 22+)
      const { DatabaseSync } = require('node:sqlite');
      this.rawDb = new DatabaseSync(filePath);
      this.rawDb.exec('PRAGMA foreign_keys = ON;');
      this.rawDb.exec('PRAGMA journal_mode = WAL;');
    } catch (e) {
      try {
        const BetterSqlite3 = require('better-sqlite3');
        this.rawDb = new BetterSqlite3(filePath);
        this.rawDb.pragma('journal_mode = WAL');
        this.rawDb.pragma('foreign_keys = ON');
      } catch (err) {
        throw new Error('Could not load SQLite engine: ' + err);
      }
    }
  }

  exec(sql: string): void {
    this.rawDb.exec(sql);
  }

  pragma(sql: string): void {
    if (typeof this.rawDb.pragma === 'function') {
      this.rawDb.pragma(sql);
    } else {
      this.rawDb.exec(`PRAGMA ${sql};`);
    }
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.rawDb.prepare(sql);
    return {
      run: (...params: any[]) => {
        return stmt.run(...params);
      },
      get: (...params: any[]) => {
        return stmt.get(...params);
      },
      all: (...params: any[]) => {
        return stmt.all(...params);
      }
    };
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    if (typeof this.rawDb.transaction === 'function') {
      return this.rawDb.transaction(fn);
    }
    return ((...args: any[]) => {
      this.rawDb.exec('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        this.rawDb.exec('COMMIT');
        return result;
      } catch (err) {
        this.rawDb.exec('ROLLBACK');
        throw err;
      }
    }) as T;
  }
}

export const db: IDatabase = new SQLiteDatabase(CONFIG.DB_PATH);

const EMBEDDED_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  fullName TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'leader_mbf', 'officer_mbf', 'officer_ward')) NOT NULL,
  unit TEXT,
  isActive INTEGER DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_objects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('enterprise', 'household', 'individual')) NOT NULL,
  taxCode TEXT,
  idNumber TEXT,
  name TEXT NOT NULL,
  representative TEXT,
  address TEXT NOT NULL,
  ward TEXT NOT NULL,
  status TEXT CHECK(status IN ('active', 'suspended')) DEFAULT 'active',
  lastCheckedYear INTEGER,
  planId INTEGER,
  createdBy INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (createdBy) REFERENCES users(id),
  FOREIGN KEY (planId) REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS quota_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ward TEXT NOT NULL,
  quarter TEXT NOT NULL,
  minCount INTEGER NOT NULL,
  maxCount INTEGER NOT NULL,
  UNIQUE(ward, quarter)
);

CREATE TABLE IF NOT EXISTS cutoff_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quarter TEXT UNIQUE NOT NULL,
  cutoffDateTime TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quarter TEXT NOT NULL,
  year INTEGER NOT NULL,
  ward TEXT NOT NULL,
  status TEXT CHECK(status IN ('draft', 'pending', 'approved', 'rejected')) DEFAULT 'draft',
  rejectReason TEXT,
  signedDocumentUrl TEXT,
  signedDocumentUploadedAt DATETIME,
  dueDate DATETIME,
  isOverdue INTEGER DEFAULT 0,
  submittedBy INTEGER,
  submittedAt DATETIME,
  approvedBy INTEGER,
  approvedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submittedBy) REFERENCES users(id),
  FOREIGN KEY (approvedBy) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS digital_signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  planId INTEGER NOT NULL,
  signedByUserId INTEGER NOT NULL,
  signedByRole TEXT NOT NULL,
  signatureType TEXT CHECK(signatureType IN ('scan', 'digital_token')) NOT NULL,
  signatureImageUrl TEXT,
  certificateInfo TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (planId) REFERENCES plans(id),
  FOREIGN KEY (signedByUserId) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS plan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  planId INTEGER NOT NULL,
  objectId INTEGER NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (planId) REFERENCES plans(id) ON DELETE CASCADE,
  FOREIGN KEY (objectId) REFERENCES business_objects(id)
);

CREATE TABLE IF NOT EXISTS inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  objectId INTEGER NOT NULL,
  planId INTEGER,
  checklist TEXT,
  violationCodes TEXT,
  evidenceFiles TEXT,
  recommendationNote TEXT,
  recommendationTags TEXT,
  status TEXT CHECK(status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
  lat REAL,
  lng REAL,
  ward TEXT NOT NULL,
  severity INTEGER DEFAULT 1,
  completedAt DATETIME,
  dueDate DATETIME,
  isOverdue INTEGER DEFAULT 0,
  isLocked INTEGER DEFAULT 0,
  isAdhoc INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (objectId) REFERENCES business_objects(id),
  FOREIGN KEY (planId) REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS adhoc_inspection_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  objectId INTEGER NOT NULL,
  wardRequestedBy TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) NOT NULL DEFAULT 'pending',
  rejectReason TEXT,
  requestedBy INTEGER NOT NULL,
  requestedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  approvedBy INTEGER,
  approvedAt DATETIME,
  relatedQuarter TEXT NOT NULL,
  relatedYear INTEGER NOT NULL,
  inspectionId INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (objectId) REFERENCES business_objects(id),
  FOREIGN KEY (requestedBy) REFERENCES users(id),
  FOREIGN KEY (approvedBy) REFERENCES users(id),
  FOREIGN KEY (inspectionId) REFERENCES inspections(id)
);

CREATE TABLE IF NOT EXISTS violation_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recommendation_tag_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_configs (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('overdue_inspection', 'overdue_plan', 'quota_below', 'quota_above', 'notice_letter_pending')) NOT NULL,
  relatedEntityType TEXT NOT NULL,
  relatedEntityId INTEGER NOT NULL,
  ward TEXT,
  message TEXT NOT NULL,
  severity TEXT CHECK(severity IN ('info', 'warning', 'critical')) NOT NULL,
  isRead INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspectionId INTEGER NOT NULL,
  objectId INTEGER NOT NULL,
  sentByUserId INTEGER,
  method TEXT CHECK(method IN ('van_ban_giay', 'khac')) NOT NULL DEFAULT 'van_ban_giay',
  sentAt TEXT NOT NULL,
  note TEXT,
  fileUrl TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inspectionId) REFERENCES inspections(id) ON DELETE CASCADE,
  FOREIGN KEY (objectId) REFERENCES business_objects(id),
  FOREIGN KEY (sentByUserId) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_business_notices_inspectionId ON business_notices(inspectionId);
CREATE INDEX IF NOT EXISTS idx_business_notices_objectId ON business_notices(objectId);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId INTEGER,
  ward TEXT,
  beforeData TEXT,
  afterData TEXT,
  ipAddress TEXT,
  detail TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_objects_ward ON business_objects(ward);
CREATE INDEX IF NOT EXISTS idx_objects_taxcode ON business_objects(taxCode);
CREATE INDEX IF NOT EXISTS idx_objects_idnumber ON business_objects(idNumber);
CREATE INDEX IF NOT EXISTS idx_plans_quarter_ward ON plans(quarter, ward);
CREATE INDEX IF NOT EXISTS idx_plans_ward_quarter ON plans(ward, quarter);
CREATE INDEX IF NOT EXISTS idx_plans_year ON plans(year);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_planId ON digital_signatures(planId);
CREATE INDEX IF NOT EXISTS idx_inspections_plan ON inspections(planId);
CREATE INDEX IF NOT EXISTS idx_inspections_object ON inspections(objectId);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_ward ON inspections(ward);
CREATE INDEX IF NOT EXISTS idx_inspections_ward_status ON inspections(ward, status);
CREATE INDEX IF NOT EXISTS idx_alerts_isRead ON alerts(isRead);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_ward ON alerts(ward);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(userId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ward ON audit_logs(ward);
CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt ON audit_logs(createdAt);
`;

export function initDatabase(): void {
  // 1. Pre-migration: Ensure plans, inspections, digital_signatures, system_configs, alerts schemas
  try {
    const plansCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plans'").get();
    if (plansCheck) {
      const tableInfo = db.prepare("PRAGMA table_info(plans)").all() as Array<{ name: string }>;
      const hasYear = tableInfo.some(col => col.name === 'year');
      if (!hasYear) {
        console.log('🔄 Migrating plans table: Adding year column...');
        db.exec('ALTER TABLE plans ADD COLUMN year INTEGER;');
      }
      const hasSignedDoc = tableInfo.some(col => col.name === 'signedDocumentUrl');
      if (!hasSignedDoc) {
        console.log('🔄 Migrating plans table: Adding signedDocumentUrl and signedDocumentUploadedAt columns...');
        db.exec('ALTER TABLE plans ADD COLUMN signedDocumentUrl TEXT;');
        db.exec('ALTER TABLE plans ADD COLUMN signedDocumentUploadedAt DATETIME;');
      }
      const hasDueDate = tableInfo.some(col => col.name === 'dueDate');
      if (!hasDueDate) {
        console.log('🔄 Migrating plans table: Adding dueDate and isOverdue columns...');
        db.exec('ALTER TABLE plans ADD COLUMN dueDate DATETIME;');
        db.exec('ALTER TABLE plans ADD COLUMN isOverdue INTEGER DEFAULT 0;');
      }
      db.exec(`
        UPDATE plans 
        SET year = CASE 
          WHEN quarter LIKE '%/%' THEN CAST(SUBSTR(quarter, INSTR(quarter, '/') + 1) AS INTEGER)
          ELSE CAST(strftime('%Y', 'now') AS INTEGER)
        END
        WHERE year IS NULL;
      `);
    }

    const inspectionsCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='inspections'").get();
    if (inspectionsCheck) {
      const inspTableInfo = db.prepare("PRAGMA table_info(inspections)").all() as Array<{ name: string; notnull?: number }>;
      const hasInspDueDate = inspTableInfo.some(col => col.name === 'dueDate');
      if (!hasInspDueDate) {
        console.log('🔄 Migrating inspections table: Adding dueDate and isOverdue columns...');
        db.exec('ALTER TABLE inspections ADD COLUMN dueDate DATETIME;');
        db.exec('ALTER TABLE inspections ADD COLUMN isOverdue INTEGER DEFAULT 0;');
      }
      const hasIsAdhoc = inspTableInfo.some(col => col.name === 'isAdhoc');
      if (!hasIsAdhoc) {
        console.log('🔄 Migrating inspections table: Adding isAdhoc column...');
        db.exec('ALTER TABLE inspections ADD COLUMN isAdhoc INTEGER DEFAULT 0;');
      }
      const planIdCol = inspTableInfo.find(col => col.name === 'planId');
      if (planIdCol && planIdCol.notnull === 1) {
        console.log('🔄 Migrating inspections table: making planId nullable for ad-hoc inspections...');
        db.exec(`
          PRAGMA foreign_keys = OFF;
          CREATE TABLE inspections_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            objectId INTEGER NOT NULL,
            planId INTEGER,
            checklist TEXT,
            violationCodes TEXT,
            evidenceFiles TEXT,
            recommendationNote TEXT,
            recommendationTags TEXT,
            status TEXT CHECK(status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
            lat REAL,
            lng REAL,
            ward TEXT NOT NULL,
            severity INTEGER DEFAULT 1,
            completedAt DATETIME,
            dueDate DATETIME,
            isOverdue INTEGER DEFAULT 0,
            isLocked INTEGER DEFAULT 0,
            isAdhoc INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (objectId) REFERENCES business_objects(id),
            FOREIGN KEY (planId) REFERENCES plans(id)
          );
          INSERT INTO inspections_new (id, objectId, planId, checklist, violationCodes, evidenceFiles, recommendationNote, recommendationTags, status, lat, lng, ward, severity, completedAt, dueDate, isOverdue, isLocked, isAdhoc, createdAt)
          SELECT id, objectId, planId, checklist, violationCodes, evidenceFiles, recommendationNote, recommendationTags, status, lat, lng, ward, severity, completedAt, dueDate, isOverdue, isLocked, isAdhoc, createdAt FROM inspections;
          DROP TABLE inspections;
          ALTER TABLE inspections_new RENAME TO inspections;
          CREATE INDEX IF NOT EXISTS idx_inspections_plan ON inspections(planId);
          CREATE INDEX IF NOT EXISTS idx_inspections_object ON inspections(objectId);
          CREATE INDEX IF NOT EXISTS idx_inspections_ward ON inspections(ward);
          PRAGMA foreign_keys = ON;
        `);
      }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS digital_signatures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        planId INTEGER NOT NULL,
        signedByUserId INTEGER NOT NULL,
        signedByRole TEXT NOT NULL,
        signatureType TEXT CHECK(signatureType IN ('scan', 'digital_token')) NOT NULL,
        signatureImageUrl TEXT,
        certificateInfo TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (planId) REFERENCES plans(id),
        FOREIGN KEY (signedByUserId) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_digital_signatures_planId ON digital_signatures(planId);

      CREATE TABLE IF NOT EXISTS adhoc_inspection_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        objectId INTEGER NOT NULL,
        wardRequestedBy TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) NOT NULL DEFAULT 'pending',
        rejectReason TEXT,
        requestedBy INTEGER NOT NULL,
        requestedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        approvedBy INTEGER,
        approvedAt DATETIME,
        relatedQuarter TEXT NOT NULL,
        relatedYear INTEGER NOT NULL,
        inspectionId INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (objectId) REFERENCES business_objects(id),
        FOREIGN KEY (requestedBy) REFERENCES users(id),
        FOREIGN KEY (approvedBy) REFERENCES users(id),
        FOREIGN KEY (inspectionId) REFERENCES inspections(id)
      );
      CREATE INDEX IF NOT EXISTS idx_adhoc_status ON adhoc_inspection_requests(status);
      CREATE INDEX IF NOT EXISTS idx_adhoc_ward ON adhoc_inspection_requests(wardRequestedBy);
      CREATE INDEX IF NOT EXISTS idx_adhoc_object ON adhoc_inspection_requests(objectId);
      CREATE INDEX IF NOT EXISTS idx_adhoc_year ON adhoc_inspection_requests(relatedYear);

      CREATE TABLE IF NOT EXISTS system_configs (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT OR IGNORE INTO system_configs (key, value) VALUES ('inspectionDeadlineDays', '30');

      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        relatedEntityType TEXT NOT NULL,
        relatedEntityId INTEGER NOT NULL,
        ward TEXT,
        message TEXT NOT NULL,
        severity TEXT CHECK(severity IN ('info', 'warning', 'critical')) NOT NULL,
        isRead INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_alerts_isRead ON alerts(isRead);
      CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
      CREATE INDEX IF NOT EXISTS idx_alerts_ward ON alerts(ward);
    `);

    // Migrate alerts table check constraint if old constraint present
    try {
      const alertsTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='alerts'").get() as { sql: string } | undefined;
      if (alertsTableSql && alertsTableSql.sql && alertsTableSql.sql.includes("type IN ('overdue_inspection'")) {
        console.log('🔄 Migrating alerts table: removing restrictive check constraint to support notice_letter_pending...');
        db.exec(`
          CREATE TABLE alerts_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            relatedEntityType TEXT NOT NULL,
            relatedEntityId INTEGER NOT NULL,
            ward TEXT,
            message TEXT NOT NULL,
            severity TEXT CHECK(severity IN ('info', 'warning', 'critical')) NOT NULL,
            isRead INTEGER DEFAULT 0,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO alerts_new (id, type, relatedEntityType, relatedEntityId, ward, message, severity, isRead, createdAt)
          SELECT id, type, relatedEntityType, relatedEntityId, ward, message, severity, isRead, createdAt FROM alerts;
          DROP TABLE alerts;
          ALTER TABLE alerts_new RENAME TO alerts;
          CREATE INDEX IF NOT EXISTS idx_alerts_isRead ON alerts(isRead);
          CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
          CREATE INDEX IF NOT EXISTS idx_alerts_ward ON alerts(ward);
        `);
      }
    } catch (e) {
      console.warn('⚠️ Alerts migration note:', e);
    }

    db.exec(`

      CREATE TABLE IF NOT EXISTS inspection_domains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        icon TEXT,
        color TEXT
      );

      INSERT OR IGNORE INTO inspection_domains (id, code, name, icon, color) VALUES
        (1, 'PCCC', 'Phòng cháy chữa cháy', 'local_fire_department', '#ef4444'),
        (2, 'ATTP', 'An toàn thực phẩm', 'restaurant', '#f59e0b'),
        (3, 'MOI_TRUONG', 'Bảo vệ môi trường', 'eco', '#10b981'),
        (4, 'TTDT', 'Trật tự đô thị', 'location_city', '#3b82f6'),
        (5, 'THUE', 'Thuế & Nghĩa vụ tài chính', 'receipt_long', '#8b5cf6');

      CREATE TABLE IF NOT EXISTS inspection_checklist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspectionId INTEGER NOT NULL,
        domainId INTEGER NOT NULL,
        criteriaCode TEXT NOT NULL,
        criteriaName TEXT NOT NULL,
        result TEXT CHECK(result IN ('pass', 'fail')) NOT NULL DEFAULT 'pass',
        violationCodeId INTEGER,
        notes TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inspectionId) REFERENCES inspections(id) ON DELETE CASCADE,
        FOREIGN KEY (domainId) REFERENCES inspection_domains(id),
        FOREIGN KEY (violationCodeId) REFERENCES violation_catalog(id)
      );
      CREATE INDEX IF NOT EXISTS idx_checklist_inspection ON inspection_checklist_items(inspectionId);
      CREATE INDEX IF NOT EXISTS idx_checklist_domain ON inspection_checklist_items(domainId);
      CREATE INDEX IF NOT EXISTS idx_checklist_result ON inspection_checklist_items(result);

      CREATE TABLE IF NOT EXISTS business_notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inspectionId INTEGER NOT NULL,
        objectId INTEGER NOT NULL,
        sentByUserId INTEGER,
        method TEXT CHECK(method IN ('van_ban_giay', 'khac')) NOT NULL DEFAULT 'van_ban_giay',
        sentAt TEXT NOT NULL,
        note TEXT,
        fileUrl TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inspectionId) REFERENCES inspections(id) ON DELETE CASCADE,
        FOREIGN KEY (objectId) REFERENCES business_objects(id),
        FOREIGN KEY (sentByUserId) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_business_notices_inspectionId ON business_notices(inspectionId);
      CREATE INDEX IF NOT EXISTS idx_business_notices_objectId ON business_notices(objectId);
    `);

    // Migrate existing JSON checklists to inspection_checklist_items if empty
    const checklistCount = db.prepare('SELECT COUNT(*) as count FROM inspection_checklist_items').get() as { count: number };
    if (checklistCount.count === 0) {
      const allInspections = db.prepare('SELECT id, checklist FROM inspections').all() as Array<{ id: number; checklist?: string }>;
      if (allInspections.length > 0) {
        console.log(`🔄 Migrating ${allInspections.length} inspection checklists to inspection_checklist_items...`);
        const insertItem = db.prepare(`
          INSERT INTO inspection_checklist_items (inspectionId, domainId, criteriaCode, criteriaName, result, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        db.transaction(() => {
          for (const insp of allInspections) {
            let chkObj: Record<string, boolean> = { dkkd: true, pccc: true, location: true, price_tag: true, hygiene: true };
            if (insp.checklist) {
              try {
                const parsed = JSON.parse(insp.checklist);
                if (Array.isArray(parsed)) {
                  parsed.forEach((item: any) => {
                    if (item.id) chkObj[item.id] = item.passed !== false;
                  });
                } else if (typeof parsed === 'object') {
                  chkObj = { ...chkObj, ...parsed };
                }
              } catch (e) {
                // ignore parse err
              }
            }

            const pcccPass = chkObj['pccc'] !== false ? 'pass' : 'fail';
            const attpPass = chkObj['hygiene'] !== false ? 'pass' : 'fail';
            const envPass = chkObj['hygiene'] !== false ? 'pass' : 'fail';
            const ttdtPass = chkObj['location'] !== false ? 'pass' : 'fail';
            const taxPass = (chkObj['price_tag'] !== false && chkObj['dkkd'] !== false) ? 'pass' : 'fail';

            // PCCC
            insertItem.run(insp.id, 1, 'pccc_1', 'Trang bị bình chữa cháy còn hạn & tiêu lệnh PCCC', pcccPass, '');
            insertItem.run(insp.id, 1, 'pccc_2', 'Lối thoát nạn & hành lang thoát hiểm thông thoáng', pcccPass, '');

            // ATTP
            insertItem.run(insp.id, 2, 'attp_1', 'Giấy chứng nhận cơ sở đủ điều kiện ATTP / Cam kết ATTP', attpPass, '');
            insertItem.run(insp.id, 2, 'attp_2', 'Nguồn gốc nguyên liệu & điều kiện vệ sinh bảo quản', attpPass, '');

            // MOI_TRUONG
            insertItem.run(insp.id, 3, 'env_1', 'Thu gom, phân loại & xử lý rác thải / nước thải đúng quy định', envPass, '');
            insertItem.run(insp.id, 3, 'env_2', 'Không gây ô nhiễm tiếng ồn, khói bụi vượt quy chuẩn', 'pass', '');

            // TTDT
            insertItem.run(insp.id, 4, 'ttdt_1', 'Không lấn chiếm lòng lề đường, vỉa hè, hành lang an toàn', ttdtPass, '');
            insertItem.run(insp.id, 4, 'ttdt_2', 'Biển hiệu, bảng quảng cáo đúng quy chuẩn cấp phép', 'pass', '');

            // THUE
            insertItem.run(insp.id, 5, 'tax_1', 'Đăng ký kinh doanh & niêm yết giá công khai', taxPass, '');
            insertItem.run(insp.id, 5, 'tax_2', 'Kê khai & thực hiện đầy đủ nghĩa vụ thuế / hóa đơn', chkObj['dkkd'] !== false ? 'pass' : 'fail', '');
          }
        })();
      }
    }

    // Migrate audit_logs table schema (add ward, beforeData, afterData, ipAddress)
    try {
      const auditTableInfo = db.prepare("PRAGMA table_info(audit_logs)").all() as Array<{ name: string }>;
      const hasWard = auditTableInfo.some(col => col.name === 'ward');
      if (!hasWard) {
        console.log('🔄 Migrating audit_logs table: Adding ward column...');
        db.exec('ALTER TABLE audit_logs ADD COLUMN ward TEXT;');
      }
      const hasBeforeData = auditTableInfo.some(col => col.name === 'beforeData');
      if (!hasBeforeData) {
        console.log('🔄 Migrating audit_logs table: Adding beforeData column...');
        db.exec('ALTER TABLE audit_logs ADD COLUMN beforeData TEXT;');
      }
      const hasAfterData = auditTableInfo.some(col => col.name === 'afterData');
      if (!hasAfterData) {
        console.log('🔄 Migrating audit_logs table: Adding afterData column...');
        db.exec('ALTER TABLE audit_logs ADD COLUMN afterData TEXT;');
      }
      const hasIpAddress = auditTableInfo.some(col => col.name === 'ipAddress');
      if (!hasIpAddress) {
        console.log('🔄 Migrating audit_logs table: Adding ipAddress column...');
        db.exec('ALTER TABLE audit_logs ADD COLUMN ipAddress TEXT;');
      }
    } catch (auditMigErr) {
      console.warn('⚠️ Audit logs migration note:', auditMigErr);
    }

    // Migrate Customer Feedback Enhancements (Locations, Foreign Elements, Plan Adjustments, 3 Inspection Types, Teams, Uninspected Explanations, Workflows & Result Acceptance)
    try {
      const addColumnIfNotExists = (table: string, colName: string, colDef: string) => {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
        if (cols.length > 0 && !cols.some(c => c.name === colName)) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN ${colName} ${colDef};`);
        }
      };

      // 1. business_objects columns
      addColumnIfNotExists('business_objects', 'field', 'TEXT');
      addColumnIfNotExists('business_objects', 'hasForeignElement', 'INTEGER NOT NULL DEFAULT 0');
      addColumnIfNotExists('business_objects', 'foreignElementDetail', 'TEXT');

      // 2. plans columns
      addColumnIfNotExists('plans', 'inspectionType', "TEXT NOT NULL DEFAULT 'planned'");
      addColumnIfNotExists('plans', 'scheduledStartDate', 'TEXT');
      addColumnIfNotExists('plans', 'scheduledEndDate', 'TEXT');
      addColumnIfNotExists('plans', 'inspectionLocation', 'TEXT');
      addColumnIfNotExists('plans', 'inspectionContent', 'TEXT');
      addColumnIfNotExists('plans', 'adjustmentNote', 'TEXT');
      addColumnIfNotExists('plans', 'adjustedAt', 'DATETIME');
      addColumnIfNotExists('plans', 'adjustedBy', 'INTEGER');

      // 3. plan_items columns
      addColumnIfNotExists('plan_items', 'locationId', 'INTEGER');
      addColumnIfNotExists('plan_items', 'scheduledDate', 'TEXT');
      addColumnIfNotExists('plan_items', 'inspectionContent', 'TEXT');

      // 4. inspections columns
      addColumnIfNotExists('inspections', 'locationId', 'INTEGER');
      addColumnIfNotExists('inspections', 'locationName', 'TEXT');
      addColumnIfNotExists('inspections', 'locationAddress', 'TEXT');
      addColumnIfNotExists('inspections', 'inspectionType', "TEXT NOT NULL DEFAULT 'planned'");
      addColumnIfNotExists('inspections', 'teamId', 'INTEGER');
      addColumnIfNotExists('inspections', 'teamName', 'TEXT');
      addColumnIfNotExists('inspections', 'inspectingUnit', 'TEXT');
      addColumnIfNotExists('inspections', 'scheduledDate', 'TEXT');
      addColumnIfNotExists('inspections', 'inspectionContent', 'TEXT');
      addColumnIfNotExists('inspections', 'workflowCode', "TEXT DEFAULT 'WF_STANDARD'");
      addColumnIfNotExists('inspections', 'workflowStepsStatusJson', "TEXT DEFAULT '[]'");
      addColumnIfNotExists('inspections', 'uninspectedReason', 'TEXT');
      addColumnIfNotExists('inspections', 'explanationContent', 'TEXT');
      addColumnIfNotExists('inspections', 'explanationStatus', "TEXT NOT NULL DEFAULT 'none'");
      addColumnIfNotExists('inspections', 'explainedBy', 'INTEGER');
      addColumnIfNotExists('inspections', 'explainedByName', 'TEXT');
      addColumnIfNotExists('inspections', 'explainedAt', 'DATETIME');
      addColumnIfNotExists('inspections', 'explanationReviewNote', 'TEXT');
      addColumnIfNotExists('inspections', 'acceptanceStatus', "TEXT NOT NULL DEFAULT 'pending'");
      addColumnIfNotExists('inspections', 'acceptedBy', 'INTEGER');
      addColumnIfNotExists('inspections', 'acceptedByName', 'TEXT');
      addColumnIfNotExists('inspections', 'acceptedAt', 'DATETIME');
      addColumnIfNotExists('inspections', 'acceptanceNote', 'TEXT');

      // 5. adhoc_inspection_requests columns
      addColumnIfNotExists('adhoc_inspection_requests', 'locationId', 'INTEGER');
      addColumnIfNotExists('adhoc_inspection_requests', 'locationName', 'TEXT');
      addColumnIfNotExists('adhoc_inspection_requests', 'inspectionType', "TEXT NOT NULL DEFAULT 'adhoc'");
      addColumnIfNotExists('adhoc_inspection_requests', 'inspectionContent', 'TEXT');
      addColumnIfNotExists('adhoc_inspection_requests', 'scheduledDate', 'TEXT');

      // 6. New tables: business_locations, inspection_teams, unit_workflows
      db.exec(`
        CREATE TABLE IF NOT EXISTS business_locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          objectId INTEGER NOT NULL,
          locationType TEXT NOT NULL DEFAULT 'branch',
          locationCode TEXT,
          name TEXT NOT NULL,
          address TEXT NOT NULL,
          ward TEXT NOT NULL,
          contactPerson TEXT,
          phone TEXT,
          hasForeignElement INTEGER NOT NULL DEFAULT 0,
          foreignElementDetail TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          lat REAL,
          lng REAL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (objectId) REFERENCES business_objects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_locations_object ON business_locations(objectId);
        CREATE INDEX IF NOT EXISTS idx_locations_ward ON business_locations(ward);

        CREATE TABLE IF NOT EXISTS inspection_teams (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          teamType TEXT NOT NULL DEFAULT 'unit',
          inspectionType TEXT NOT NULL DEFAULT 'planned',
          leadUnit TEXT NOT NULL,
          participatingUnits TEXT DEFAULT '[]',
          ward TEXT,
          planId INTEGER,
          decisionNumber TEXT,
          leaderName TEXT NOT NULL,
          membersJson TEXT NOT NULL DEFAULT '[]',
          scheduleStart TEXT,
          scheduleEnd TEXT,
          inspectionContent TEXT,
          workflowCode TEXT DEFAULT 'WF_STANDARD',
          status TEXT NOT NULL DEFAULT 'active',
          adjustmentHistoryJson TEXT DEFAULT '[]',
          establishedBy INTEGER,
          establishedByName TEXT,
          establishedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS unit_workflows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          unitName TEXT NOT NULL,
          inspectionType TEXT NOT NULL DEFAULT 'planned',
          stepsJson TEXT NOT NULL DEFAULT '[]',
          planApprovalRole TEXT NOT NULL DEFAULT 'leader_mbf',
          teamEstablishRole TEXT NOT NULL DEFAULT 'leader_mbf',
          resultAcceptanceRole TEXT NOT NULL DEFAULT 'leader_mbf',
          description TEXT,
          isActive INTEGER NOT NULL DEFAULT 1,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (custMigErr) {
      console.warn('⚠️ Customer feedback schema migration note:', custMigErr);
    }

  } catch (migErr) {
    console.warn('⚠️ Pre-migration note:', migErr);
  }

  const possiblePaths = [
    path.resolve(__dirname, 'schema.sql'),
    path.resolve(__dirname, '../../src/db/schema.sql'),
    path.resolve(__dirname, '../src/db/schema.sql'),
    path.resolve(process.cwd(), 'src/db/schema.sql'),
    path.resolve(process.cwd(), 'backend/src/db/schema.sql')
  ];
  const schemaPath = possiblePaths.find(p => fs.existsSync(p));
  if (schemaPath) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
    console.log('✅ SQLite Schema initialized successfully from:', schemaPath);
  } else {
    console.log('ℹ️ Using embedded SQLite schema...');
    db.exec(EMBEDDED_SCHEMA);
  }

  // 2. Post-migration: Populate missing years and create indexes
  try {
    db.exec(`
      UPDATE plans 
      SET year = CASE 
        WHEN quarter LIKE '%/%' THEN CAST(SUBSTR(quarter, INSTR(quarter, '/') + 1) AS INTEGER)
        ELSE CAST(strftime('%Y', 'now') AS INTEGER)
      END
      WHERE year IS NULL;
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_plans_year ON plans(year);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_plans_ward_quarter ON plans(ward, quarter);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_objects_ward ON business_objects(ward);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_inspections_ward_status ON inspections(ward, status);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_ward ON audit_logs(ward);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt ON audit_logs(createdAt);');
    db.exec('CREATE INDEX IF NOT EXISTS idx_digital_signatures_planId ON digital_signatures(planId);');

    // Auto seed initial demo dataset if database is freshly created (e.g. Vercel serverless cold start)
    try {
      const userCheck = db.prepare("SELECT count(*) as count FROM users").get() as { count: number } | undefined;
      if (!userCheck || userCheck.count === 0) {
        console.log('📦 Database is empty, auto-running seed data...');
        const { runSeed } = require('./seed');
        runSeed(true);
      }
    } catch (err) {
      console.warn('⚠️ Auto-seed check skipped or failed:', err);
    }

    // Auto-populate default unit_workflows if empty
    const wfCount = db.prepare('SELECT COUNT(*) as count FROM unit_workflows').get() as { count: number };
    if (wfCount.count === 0) {
      const insertWf = db.prepare(`
        INSERT OR IGNORE INTO unit_workflows (code, name, unitName, inspectionType, stepsJson, planApprovalRole, teamEstablishRole, resultAcceptanceRole, description, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      insertWf.run(
        'WF_STANDARD',
        'Quy trình Kiểm tra Định kỳ Chuẩn (UBND / Công an Phường)',
        'Công an / UBND Phường',
        'planned',
        JSON.stringify([
          '1. Lập kế hoạch & cảnh báo trùng lặp',
          '2. Phê duyệt kế hoạch & Thành lập đoàn kiểm tra',
          '3. Gửi thông báo kiểm tra trước cho doanh nghiệp/cơ sở',
          '4. Kiểm tra thực tế tại cơ sở & Chấm Checklist số',
          '5. Lập biên bản, ký xác nhận & Nghiệm thu kết quả'
        ]),
        'leader_mbf',
        'leader_mbf',
        'leader_mbf',
        'Quy trình chuẩn áp dụng cho kiểm tra định kỳ theo kế hoạch Quý tại các Phường.'
      );
      insertWf.run(
        'WF_PA04_FOREIGN',
        'Quy trình Nghiệp vụ Đặc thù PA04 (An ninh Kinh tế & Yếu tố Nước ngoài)',
        'Phòng An ninh Kinh tế (PA04)',
        'professional_request',
        JSON.stringify([
          '1. Tiếp nhận yêu cầu nghiệp vụ / Rà soát yếu tố nước ngoài (FDI, lao động, dịch vụ xuyên biên giới)',
          '2. Thẩm định hồ sơ pháp lý & Quyết định thành lập đoàn chuyên đề',
          '3. Kiểm tra trực tiếp tại trụ sở chính và các chi nhánh/địa điểm hoạt động',
          '4. Đối chiếu chấp hành quy định an ninh kinh tế & Lập biên bản',
          '5. Báo cáo lãnh đạo PA04 nghiệm thu kết quả & Lưu hồ sơ nghiệp vụ'
        ]),
        'leader_mbf',
        'leader_mbf',
        'leader_mbf',
        'Quy trình đặc thù của PA04 đối với doanh nghiệp có yếu tố nước ngoài hoặc theo yêu cầu nghiệp vụ chuyên sâu.'
      );
      insertWf.run(
        'WF_INTER_AGENCY',
        'Quy trình Kiểm tra Liên ngành (PA04 - QLTT - PCCC - Y tế - Phường)',
        'Đoàn Kiểm tra Liên ngành TP / Quận',
        'planned',
        JSON.stringify([
          '1. Rà soát danh sách cơ sở liên quan nhiều lĩnh vực / địa bàn',
          '2. Ban hành quyết định thành lập Đoàn kiểm tra liên ngành (nhiều đơn vị)',
          '3. Điều phối lịch kiểm tra chung & Phân công nhiệm vụ từng đơn vị thành viên',
          '4. Kiểm tra đồng bộ các chuyên đề (PCCC, ATTP, Thuế, ANTT) tại địa điểm kinh doanh',
          '5. Tổng hợp biên bản liên ngành & Nghiệm thu kết quả xử lý'
        ]),
        'leader_mbf',
        'leader_mbf',
        'leader_mbf',
        'Quy trình phối hợp liên ngành giữa nhiều đơn vị chức năng cùng tham gia đoàn kiểm tra.'
      );
      insertWf.run(
        'WF_ADHOC_FAST',
        'Quy trình Kiểm tra Đột xuất (Phản ứng nhanh)',
        'Đội Kiểm tra Chuyên ngành / Công an Phường',
        'adhoc',
        JSON.stringify([
          '1. Tiếp nhận tin báo / Phát hiện dấu hiệu vi phạm đột xuất',
          '2. Phê duyệt nhanh đề xuất kiểm tra đột xuất (không báo trước)',
          '3. Kiểm tra hiện trường, thu thập bằng chứng số & Lập biên bản vi phạm',
          '4. Nghiệm thu kết quả & Theo dõi khắc phục sau vi phạm'
        ]),
        'leader_mbf',
        'officer_mbf',
        'leader_mbf',
        'Quy trình rút gọn phục vụ kiểm tra đột xuất khi phát hiện dấu hiệu vi phạm.'
      );
    }

    // Auto-populate default business_locations & foreign element flags if empty
    const locCount = db.prepare('SELECT COUNT(*) as count FROM business_locations').get() as { count: number };
    if (locCount.count === 0) {
      const allObjs = db.prepare('SELECT * FROM business_objects ORDER BY id ASC').all() as any[];
      if (allObjs.length > 0) {
        const insertLoc = db.prepare(`
          INSERT INTO business_locations (objectId, locationType, locationCode, name, address, ward, contactPerson, phone, hasForeignElement, foreignElementDetail, status, lat, lng)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const updateObjForeign = db.prepare(`
          UPDATE business_objects SET hasForeignElement = ?, foreignElementDetail = ?, field = ? WHERE id = ?
        `);

        const wardCoords: Record<string, [number, number]> = {
          'Phường Hoàn Kiếm': [21.0285, 105.8520],
          'Phường Ba Đình': [21.0340, 105.8200],
          'Phường Đống Đa': [21.0150, 105.8280],
          'Phường Hai Bà Trưng': [21.0090, 105.8530],
          'Phường Cầu Giấy': [21.0330, 105.7900]
        };

        db.transaction(() => {
          allObjs.forEach((obj, idx) => {
            const isForeign = (obj.type === 'enterprise' && idx % 3 === 0) ? 1 : 0;
            const foreignDetail = isForeign
              ? (idx % 2 === 0 ? 'Vốn đầu tư FDI (Hàn Quốc - 65%), có chuyên gia nước ngoài làm việc' : 'Liên doanh Nhật Bản - Singapore, cung cấp dịch vụ thương mại xuyên biên giới')
              : null;
            const field = obj.type === 'enterprise'
              ? (isForeign ? 'Thương mại quốc tế, Dịch vụ Công nghệ & Logistics' : 'Thương mại dịch vụ, Nhà hàng & Khách sạn')
              : (obj.type === 'household' ? 'Kinh doanh dịch vụ ăn uống, Bán lẻ' : 'Dịch vụ lưu trú & Tiêu dùng');

            updateObjForeign.run(isForeign, foreignDetail, field, obj.id);

            const baseCoord = wardCoords[obj.ward] || [21.0285, 105.8520];
            // 1. Main Headquarters / Primary Facility
            const res1 = insertLoc.run(
              obj.id,
              obj.type === 'enterprise' ? 'headquarters' : 'facility',
              `CS-${obj.id}-01`,
              obj.type === 'enterprise' ? `Trụ sở chính - ${obj.name}` : `Cơ sở chính - ${obj.name}`,
              obj.address,
              obj.ward,
              obj.representative || 'Người đại diện',
              `09${String(10000000 + obj.id * 137).slice(0, 8)}`,
              isForeign,
              foreignDetail,
              obj.status || 'active',
              baseCoord[0] + (idx % 5) * 0.0012,
              baseCoord[1] + (idx % 4) * 0.0012
            );

            // 2. For enterprises, add 1-2 additional branches / business locations across wards
            if (obj.type === 'enterprise') {
              const wardsList = Object.keys(wardCoords);
              const branchWard = wardsList[(idx + 1) % wardsList.length];
              const branchCoord = wardCoords[branchWard] || baseCoord;
              insertLoc.run(
                obj.id,
                'branch',
                `CN-${obj.id}-02`,
                `Chi nhánh số 1 - ${obj.name}`,
                `Số ${18 + idx * 3} Phố Trung Tâm, ${branchWard}`,
                branchWard,
                `Trần Quản Lý CN (${obj.representative || ''})`,
                `09${String(20000000 + obj.id * 251).slice(0, 8)}`,
                isForeign,
                foreignDetail,
                'active',
                branchCoord[0] - 0.0015,
                branchCoord[1] + 0.0018
              );

              if (idx < 8) {
                const locWard = wardsList[(idx + 2) % wardsList.length];
                const locCoord = wardCoords[locWard] || baseCoord;
                insertLoc.run(
                  obj.id,
                  'business_location',
                  `DDKD-${obj.id}-03`,
                  `Địa điểm kinh doanh & Kho vận - ${obj.name}`,
                  `Tầng 2, Tòa nhà Thương mại số ${45 + idx}, ${locWard}`,
                  locWard,
                  `Lê Phụ Trách Cơ Sở`,
                  `09${String(30000000 + obj.id * 319).slice(0, 8)}`,
                  isForeign,
                  foreignDetail,
                  'active',
                  locCoord[0] + 0.0020,
                  locCoord[1] - 0.0014
                );
              }
            }

            // Link existing inspections of this object to its primary location if not yet linked
            const firstLocId = Number(res1.lastInsertRowid);
            db.prepare(`
              UPDATE inspections
              SET locationId = ?, locationName = ?, locationAddress = ?
              WHERE objectId = ? AND locationId IS NULL
            `).run(
              firstLocId,
              obj.type === 'enterprise' ? `Trụ sở chính - ${obj.name}` : `Cơ sở chính - ${obj.name}`,
              obj.address,
              obj.id
            );
          });
        })();
      }
    }

    // Auto-populate default inspection_teams if empty
    const teamCount = db.prepare('SELECT COUNT(*) as count FROM inspection_teams').get() as { count: number };
    if (teamCount.count === 0) {
      const insertTeam = db.prepare(`
        INSERT OR IGNORE INTO inspection_teams (
          code, name, teamType, inspectionType, leadUnit, participatingUnits, ward, decisionNumber,
          leaderName, membersJson, scheduleStart, scheduleEnd, inspectionContent, workflowCode, status, establishedByName
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertTeam.run(
        'DKT-2026-LN01',
        'Đoàn Kiểm tra Liên ngành An ninh Kinh tế & Thương mại Điện tử (Đợt 1/2026)',
        'inter_agency',
        'planned',
        'Phòng An ninh Kinh tế (PA04)',
        JSON.stringify(['Phòng An ninh Kinh tế (PA04)', 'Đội Quản lý Thị trường số 1', 'Phòng Cảnh sát PCCC & CNCH', 'UBND Phường Hoàn Kiếm', 'Chi cục Thuế Khu vực']),
        'Phường Hoàn Kiếm',
        'QĐ-142/PA04-LN',
        'Thượng tá Nguyễn Hoàng Nam (PA04)',
        JSON.stringify([
          { fullName: 'Thượng tá Nguyễn Hoàng Nam', role: 'Trưởng đoàn', unit: 'Phòng An ninh Kinh tế (PA04)', phone: '0912345111' },
          { fullName: 'Thiếu tá Lê Văn Cường', role: 'Phó trưởng đoàn', unit: 'Công an Phường Hoàn Kiếm', phone: '0912345222' },
          { fullName: 'Ông Trần Minh Đức', role: 'Thành viên', unit: 'Đội Quản lý Thị trường số 1', phone: '0912345333' },
          { fullName: 'Đại úy Phạm Quốc Bảo', role: 'Thành viên', unit: 'Cảnh sát PCCC & CNCH', phone: '0912345444' },
          { fullName: 'Bà Vũ Thị Thu Hà', role: 'Thư ký đoàn', unit: 'UBND Phường Hoàn Kiếm', phone: '0912345555' }
        ]),
        '2026-04-05',
        '2026-06-25',
        'Kiểm tra liên ngành việc chấp hành pháp luật về ĐKKD, PCCC, ATTP và hoạt động thương mại có yếu tố nước ngoài.',
        'WF_INTER_AGENCY',
        'active',
        'Đại tá Trần Quốc Tuấn (Lãnh đạo PA04)'
      );
      insertTeam.run(
        'DKT-2026-NV02',
        'Đoàn Kiểm tra Chuyên đề Doanh nghiệp FDI & Dịch vụ Nước ngoài',
        'inter_agency',
        'professional_request',
        'Phòng An ninh Kinh tế (PA04)',
        JSON.stringify(['Phòng An ninh Kinh tế (PA04)', 'Phòng Quản lý Xuất nhập cảnh (PA08)', 'Sở Kế hoạch & Đầu tư', 'Công an Phường Ba Đình']),
        'Phường Ba Đình',
        'QĐ-189/PA04-NV',
        'Trung tá Đỗ Quang Huy (PA04)',
        JSON.stringify([
          { fullName: 'Trung tá Đỗ Quang Huy', role: 'Trưởng đoàn', unit: 'Phòng An ninh Kinh tế (PA04)', phone: '0988111222' },
          { fullName: 'Thiếu tá Hoàng Thanh Tùng', role: 'Phó trưởng đoàn', unit: 'Phòng Quản lý XNC (PA08)', phone: '0988111333' },
          { fullName: 'Ông Nguyễn Thành Long', role: 'Thành viên', unit: 'Sở Kế hoạch & Đầu tư', phone: '0988111444' },
          { fullName: 'Đại úy Bùi Văn Kiên', role: 'Thành viên', unit: 'Công an Phường Ba Đình', phone: '0988111555' }
        ]),
        '2026-04-10',
        '2026-05-30',
        'Kiểm tra theo yêu cầu nghiệp vụ đối với các doanh nghiệp, chi nhánh có vốn đầu tư nước ngoài và sử dụng lao động nước ngoài.',
        'WF_PA04_FOREIGN',
        'active',
        'Đại tá Trần Quốc Tuấn (Lãnh đạo PA04)'
      );
      insertTeam.run(
        'DKT-2026-DX03',
        'Tổ Công tác Kiểm tra Đột xuất ANTT - PCCC Địa bàn Đống Đa & Cầu Giấy',
        'unit',
        'adhoc',
        'Công an Phường Đống Đa',
        JSON.stringify(['Công an Phường Đống Đa', 'UBND Phường Đống Đa']),
        'Phường Đống Đa',
        'QĐ-75/CAĐĐ-KT',
        'Thiếu tá Phạm Văn Hùng',
        JSON.stringify([
          { fullName: 'Thiếu tá Phạm Văn Hùng', role: 'Trưởng đoàn', unit: 'Công an Phường Đống Đa', phone: '0904555666' },
          { fullName: 'Thượng úy Ngô Minh Tuấn', role: 'Thành viên', unit: 'Công an Phường Đống Đa', phone: '0904555777' },
          { fullName: 'Ông Lê Hoàng Nam', role: 'Thành viên', unit: 'Cán bộ Đô thị Phường Đống Đa', phone: '0904555888' }
        ]),
        '2026-04-12',
        '2026-06-30',
        'Kiểm tra đột xuất các cơ sở kinh doanh có điều kiện về ANTT, PCCC khi có phản ánh hoặc dấu hiệu vi phạm.',
        'WF_ADHOC_FAST',
        'active',
        'Thượng tá Nguyễn Hoàng Nam (PA04)'
      );
    }

    // Ensure existing inspections have rich metadata (inspectionType, teamName, uninspected explanations, acceptance status)
    try {
      db.exec(`
        UPDATE inspections SET
          inspectionType = CASE
            WHEN isAdhoc = 1 THEN 'adhoc'
            WHEN id % 5 = 0 THEN 'professional_request'
            ELSE 'planned'
          END,
          teamId = CASE
            WHEN isAdhoc = 1 THEN 3
            WHEN id % 5 = 0 THEN 2
            ELSE 1
          END,
          teamName = CASE
            WHEN isAdhoc = 1 THEN 'Tổ Công tác Kiểm tra Đột xuất ANTT - PCCC'
            WHEN id % 5 = 0 THEN 'Đoàn Kiểm tra Chuyên đề Doanh nghiệp FDI & Dịch vụ Nước ngoài'
            ELSE 'Đoàn Kiểm tra Liên ngành An ninh Kinh tế & Thương mại Điện tử (Đợt 1/2026)'
          END,
          inspectingUnit = CASE
            WHEN id % 5 = 0 THEN 'Phòng An ninh Kinh tế (PA04)'
            ELSE ward
          END,
          scheduledDate = COALESCE(scheduledDate, '2026-05-15'),
          inspectionContent = COALESCE(inspectionContent, 'Kiểm tra việc chấp hành quy định pháp luật về ĐKKD, PCCC, ATTP, ANTT và nghĩa vụ thuế tại cơ sở.'),
          workflowCode = CASE
            WHEN isAdhoc = 1 THEN 'WF_ADHOC_FAST'
            WHEN id % 5 = 0 THEN 'WF_PA04_FOREIGN'
            ELSE 'WF_INTER_AGENCY'
          END
        WHERE teamName IS NULL;

        UPDATE inspections SET
          acceptanceStatus = 'accepted',
          acceptedByName = 'Đại tá Trần Quốc Tuấn (Lãnh đạo PA04)',
          acceptedAt = completedAt,
          acceptanceNote = 'Hồ sơ biên bản đầy đủ chữ ký, bằng chứng hiện trường hợp lệ. Đồng ý nghiệm thu kết quả kiểm tra.'
        WHERE status = 'completed' AND acceptanceStatus = 'pending' AND id % 2 = 0;

        UPDATE inspections SET
          uninspectedReason = 'Cơ sở đang tạm đóng cửa sửa chữa mặt bằng kinh doanh',
          explanationContent = 'Đoàn kiểm tra đã xuống hiện trường ngày 20/04/2026 nhưng cơ sở đang tạm ngừng đón khách để cải tạo hệ thống PCCC, có đơn xin gia hạn sang tháng 05/2026.',
          explanationStatus = 'pending_review',
          explainedByName = 'Thiếu tá Lê Văn Cường (Cán bộ Phường)',
          explainedAt = '2026-04-21 10:30:00'
        WHERE status = 'not_started' AND explanationStatus = 'none' AND id % 2 = 0;

        UPDATE inspections SET
          uninspectedReason = 'Chờ lịch phối hợp Đoàn kiểm tra liên ngành cấp Thành phố',
          explanationContent = 'Doanh nghiệp có nhiều chi nhánh và yếu tố nước ngoài, đơn vị đã báo cáo PA04 để gộp chung vào lịch kiểm tra liên ngành đợt 2.',
          explanationStatus = 'accepted',
          explainedByName = 'Đại úy Bùi Văn Kiên (Cán bộ Phường)',
          explainedAt = '2026-04-19 15:15:00',
          explanationReviewNote = 'Chấp thuận giải trình, chuyển lịch sang đợt liên ngành tháng 05/2026.'
        WHERE status = 'not_started' AND explanationStatus = 'none' AND id % 2 = 1;
      `);
    } catch (e) {
      console.warn('⚠️ Enrich inspections metadata note:', e);
    }

    console.log('✅ Migration verified: plans schema, digital_signatures & ward performance indexes ensured.');
  } catch (migErr) {
    console.warn('⚠️ Post-migration note:', migErr);
  }
}

export default db;
