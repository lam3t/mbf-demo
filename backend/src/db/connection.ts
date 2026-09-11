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
  role TEXT CHECK(role IN ('admin', 'leader_tnt', 'officer_tnt', 'officer_ward')) NOT NULL,
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
    console.log('✅ Migration verified: plans schema, digital_signatures & ward performance indexes ensured.');
  } catch (migErr) {
    console.warn('⚠️ Post-migration note:', migErr);
  }

  // Auto seed initial demo dataset if database is freshly created
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
}

export default db;
