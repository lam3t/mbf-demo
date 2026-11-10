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
  permissions TEXT DEFAULT '[]',
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
  hasForeignElement INTEGER DEFAULT 0,
  foreignElementDetail TEXT,
  lastCheckedYear INTEGER,
  planId INTEGER,
  createdBy INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (createdBy) REFERENCES users(id),
  FOREIGN KEY (planId) REFERENCES plans(id)
);

CREATE TABLE IF NOT EXISTS business_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  objectId INTEGER NOT NULL,
  locationType TEXT CHECK(locationType IN ('headquarters', 'branch', 'facility', 'business_site')) DEFAULT 'facility',
  code TEXT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  ward TEXT NOT NULL,
  managerName TEXT,
  phone TEXT,
  hasForeignElement INTEGER DEFAULT 0,
  foreignElementDetail TEXT,
  status TEXT CHECK(status IN ('active', 'suspended', 'closed')) DEFAULT 'active',
  lat REAL,
  lng REAL,
  notes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (objectId) REFERENCES business_objects(id) ON DELETE CASCADE
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
  unitName TEXT DEFAULT 'Công an Phường / Đơn vị nghiệp vụ',
  workflowCode TEXT DEFAULT 'WF_STANDARD',
  workflowName TEXT,
  approvingDept TEXT,
  assignedApproverName TEXT,
  inspectionType TEXT DEFAULT 'planned',
  scheduledStartDate TEXT,
  scheduledEndDate TEXT,
  inspectionLocation TEXT,
  inspectionContent TEXT,
  adjustmentNote TEXT,
  adjustedAt DATETIME,
  adjustedBy INTEGER,
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
  locationId INTEGER,
  scheduledDate TEXT,
  inspectionContent TEXT,
  uninspectedReason TEXT,
  explanationContent TEXT,
  handlingStatus TEXT DEFAULT 'none',
  explainedBy TEXT,
  explainedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (planId) REFERENCES plans(id) ON DELETE CASCADE,
  FOREIGN KEY (objectId) REFERENCES business_objects(id)
);

CREATE TABLE IF NOT EXISTS inspection_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  teamType TEXT DEFAULT 'inter_agency',
  inspectionType TEXT DEFAULT 'planned',
  leadUnit TEXT NOT NULL,
  participatingUnits TEXT DEFAULT '[]',
  ward TEXT,
  planId INTEGER,
  decisionNumber TEXT,
  leaderName TEXT NOT NULL,
  membersJson TEXT DEFAULT '[]',
  scheduleStart TEXT,
  scheduleEnd TEXT,
  inspectionContent TEXT,
  workflowCode TEXT DEFAULT 'WF_STANDARD',
  status TEXT DEFAULT 'active',
  adjustmentHistoryJson TEXT DEFAULT '[]',
  establishedBy INTEGER,
  establishedByName TEXT,
  establishedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unit_workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unitCode TEXT DEFAULT 'PC07',
  unitName TEXT NOT NULL,
  inspectionType TEXT DEFAULT 'all',
  stepsJson TEXT NOT NULL DEFAULT '[]',
  approvalAuthority TEXT,
  planApprovalDept TEXT,
  planApproverName TEXT,
  planApprovalRole TEXT DEFAULT 'leader_mbf',
  teamEstablishDept TEXT,
  teamApproverName TEXT,
  teamEstablishRole TEXT DEFAULT 'leader_mbf',
  teamAuthority TEXT,
  resultAcceptanceDept TEXT,
  resultApproverName TEXT,
  resultAcceptanceRole TEXT DEFAULT 'leader_mbf',
  acceptanceAuthority TEXT,
  description TEXT,
  isActive INTEGER DEFAULT 1,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  objectId INTEGER NOT NULL,
  locationId INTEGER,
  locationName TEXT,
  locationAddress TEXT,
  planId INTEGER,
  teamId INTEGER,
  teamName TEXT,
  inspectingUnit TEXT,
  inspectionType TEXT DEFAULT 'planned',
  workflowCode TEXT DEFAULT 'WF_STANDARD',
  workflowStepsStatusJson TEXT DEFAULT '[]',
  scheduledDate TEXT,
  inspectionContent TEXT,
  uninspectedReason TEXT,
  explanationContent TEXT,
  explanationStatus TEXT DEFAULT 'none',
  explainedBy TEXT,
  explainedByName TEXT,
  explainedAt DATETIME,
  explanationReviewNote TEXT,
  acceptanceStatus TEXT DEFAULT 'pending',
  acceptedBy TEXT,
  acceptedByName TEXT,
  acceptedAt DATETIME,
  acceptanceNote TEXT,
  penaltyAmount REAL DEFAULT 0,
  penaltyDecisionNo TEXT,
  complianceStatus TEXT DEFAULT 'compliant',
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

CREATE TABLE IF NOT EXISTS inspection_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sortOrder INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inspection_checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspectionId INTEGER NOT NULL,
  domainId INTEGER NOT NULL,
  criteriaCode TEXT NOT NULL,
  criteriaName TEXT NOT NULL,
  result TEXT CHECK(result IN ('pass', 'fail', 'na')) DEFAULT 'pass',
  notes TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inspectionId) REFERENCES inspections(id) ON DELETE CASCADE,
  FOREIGN KEY (domainId) REFERENCES inspection_domains(id)
);

CREATE TABLE IF NOT EXISTS adhoc_inspection_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  objectId INTEGER NOT NULL,
  locationId INTEGER,
  locationName TEXT,
  inspectionType TEXT DEFAULT 'adhoc',
  unitName TEXT DEFAULT 'Công an Phường / Đơn vị nghiệp vụ',
  workflowCode TEXT DEFAULT 'WF_PC07_ADHOC',
  workflowName TEXT,
  approvingDept TEXT,
  assignedApproverName TEXT,
  wardRequestedBy TEXT NOT NULL,
  reason TEXT NOT NULL,
  inspectionContent TEXT,
  scheduledDate TEXT,
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
  type TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_locations_object ON business_locations(objectId);
CREATE INDEX IF NOT EXISTS idx_plans_quarter_ward ON plans(quarter, ward);
CREATE INDEX IF NOT EXISTS idx_plans_ward_quarter ON plans(ward, quarter);
CREATE INDEX IF NOT EXISTS idx_plans_year ON plans(year);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_planId ON digital_signatures(planId);
CREATE INDEX IF NOT EXISTS idx_inspections_plan ON inspections(planId);
CREATE INDEX IF NOT EXISTS idx_inspections_object ON inspections(objectId);
CREATE INDEX IF NOT EXISTS idx_inspections_location ON inspections(locationId);
CREATE INDEX IF NOT EXISTS idx_inspections_team ON inspections(teamId);
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
  // 0. Initialize base schema FIRST so fresh databases (e.g. /tmp/mbf.db on Vercel cold start) have all tables before migrations run
  try {
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
  } catch (initSchemaErr) {
    console.warn('⚠️ Initial schema exec note:', initSchemaErr);
  }

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
    try {
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
    } catch (chkMigErr) {
      console.warn('⚠️ Checklist migration note:', chkMigErr);
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
          unitCode TEXT DEFAULT 'PC07',
          unitName TEXT NOT NULL,
          inspectionType TEXT NOT NULL DEFAULT 'planned',
          stepsJson TEXT NOT NULL DEFAULT '[]',
          planApprovalDept TEXT,
          planApproverName TEXT,
          planApprovalRole TEXT NOT NULL DEFAULT 'leader_mbf',
          teamEstablishDept TEXT,
          teamApproverName TEXT,
          teamEstablishRole TEXT NOT NULL DEFAULT 'leader_mbf',
          resultAcceptanceDept TEXT,
          resultApproverName TEXT,
          resultAcceptanceRole TEXT NOT NULL DEFAULT 'leader_mbf',
          description TEXT,
          isActive INTEGER NOT NULL DEFAULT 1,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Add dynamic workflow columns to unit_workflows, plans, and adhoc_inspection_requests if missing
      const wfCols = (db.prepare("PRAGMA table_info(unit_workflows)").all() as Array<{ name: string }>).map(c => c.name);
      const addWfCol = (col: string, def: string) => {
        if (!wfCols.includes(col)) db.exec(`ALTER TABLE unit_workflows ADD COLUMN ${col} ${def};`);
      };
      addWfCol('unitCode', "TEXT DEFAULT 'PC07'");
      addWfCol('planApprovalDept', 'TEXT');
      addWfCol('planApproverName', 'TEXT');
      addWfCol('teamEstablishDept', 'TEXT');
      addWfCol('teamApproverName', 'TEXT');
      addWfCol('resultAcceptanceDept', 'TEXT');
      addWfCol('resultApproverName', 'TEXT');

      const planCols2 = (db.prepare("PRAGMA table_info(plans)").all() as Array<{ name: string }>).map(c => c.name);
      const addPlanCol2 = (col: string, def: string) => {
        if (!planCols2.includes(col)) db.exec(`ALTER TABLE plans ADD COLUMN ${col} ${def};`);
      };
      addPlanCol2('unitName', 'TEXT');
      addPlanCol2('workflowCode', 'TEXT');
      addPlanCol2('workflowName', 'TEXT');
      addPlanCol2('approvingDept', 'TEXT');
      addPlanCol2('assignedApproverName', 'TEXT');

      const adhocCols2 = (db.prepare("PRAGMA table_info(adhoc_inspection_requests)").all() as Array<{ name: string }>).map(c => c.name);
      const addAdhocCol2 = (col: string, def: string) => {
        if (!adhocCols2.includes(col)) db.exec(`ALTER TABLE adhoc_inspection_requests ADD COLUMN ${col} ${def};`);
      };
      addAdhocCol2('unitName', 'TEXT');
      addAdhocCol2('workflowCode', 'TEXT');
      addAdhocCol2('workflowName', 'TEXT');
      addAdhocCol2('approvingDept', 'TEXT');
      addAdhocCol2('assignedApproverName', 'TEXT');
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

    // Auto-populate / upgrade dynamic unit_workflows (PC07, PC04/PA04, PC06, Công an Phường, Liên ngành - each with multiple workflows for Planned / Adhoc / Professional Request)
    const pc07Check = db.prepare("SELECT COUNT(*) as count FROM unit_workflows WHERE code = 'WF_PC07_PLANNED'").get() as { count: number };
    if (pc07Check.count === 0) {
      // Remove legacy 4 placeholder rows if they lacked structured approverDept/approverName
      db.exec("DELETE FROM unit_workflows WHERE planApprovalDept IS NULL;");

      const insertWf = db.prepare(`
        INSERT OR REPLACE INTO unit_workflows (
          code, name, unitCode, unitName, inspectionType, stepsJson,
          planApprovalDept, planApproverName, planApprovalRole,
          teamEstablishDept, teamApproverName, teamEstablishRole,
          resultAcceptanceDept, resultApproverName, resultAcceptanceRole,
          description, isActive
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      // 1. PC07 - Quy trình Kiểm tra Định kỳ PCCC
      insertWf.run(
        'WF_PC07_PLANNED',
        'Quy trình Kiểm tra Định kỳ An toàn PCCC & CNCH (PC07)',
        'PC07',
        'Phòng Cảnh sát PCCC & CNCH (PC07)',
        'planned',
        JSON.stringify([
          { step: 1, stepType: 'create', name: 'Rà soát danh mục cơ sở nguy cơ cháy nổ & Lập dự thảo kế hoạch Quý', approvingDept: 'Đội Công tác Phòng cháy - Phòng PC07', approverName: 'Thiếu tá Hoàng Văn Sơn (Đội trưởng Đội Phòng cháy)', role: 'Đội trưởng Đội Phòng cháy', slaHours: 24, required: true },
          { step: 2, stepType: 'review', name: 'Thẩm định danh sách cơ sở, đối chiếu trùng lặp & Hồ sơ thẩm duyệt PCCC', approvingDept: 'Đội Tham mưu & Pháp chế - Phòng PC07', approverName: 'Trung tá Nguyễn Thị Mai (Đội trưởng Đội Tham mưu PC07)', role: 'Trưởng bộ phận Tham mưu', slaHours: 24, required: true },
          { step: 3, stepType: 'approve_plan', name: 'Phê duyệt Kế hoạch Kiểm tra Định kỳ PCCC của đơn vị', approvingDept: 'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)', approverName: 'Đại tá Lê Minh Hải (Trưởng phòng PC07)', role: 'Trưởng phòng PC07', slaHours: 16, required: true },
          { step: 4, stepType: 'establish_team', name: 'Ban hành Quyết định Thành lập Đoàn kiểm tra PCCC & Gửi thông báo cơ sở', approvingDept: 'Ban Chỉ huy Phòng PC07 & Đội Công tác Phòng cháy', approverName: 'Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng PC07)', role: 'Phó Trưởng phòng PC07', slaHours: 16, required: true },
          { step: 5, stepType: 'inspect', name: 'Kiểm tra hệ thống PCCC tại cơ sở, đo kiểm kỹ thuật & Lập biên bản', approvingDept: 'Đoàn Kiểm tra Chuyên ngành PCCC (PC07)', approverName: 'Thiếu tá Hoàng Văn Sơn (Trưởng đoàn Kiểm tra PC07)', role: 'Trưởng đoàn kiểm tra', slaHours: 72, required: true },
          { step: 6, stepType: 'accept_result', name: 'Nghiệm thu kết quả kiểm tra, duyệt quyết định xử phạt / hậu kiểm PCCC', approvingDept: 'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)', approverName: 'Đại tá Lê Minh Hải (Trưởng phòng PC07)', role: 'Trưởng phòng PC07', slaHours: 24, required: true }
        ]),
        'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)',
        'Đại tá Lê Minh Hải (Trưởng phòng PC07)',
        'Trưởng phòng PC07',
        'Ban Chỉ huy Phòng PC07 & Đội Tham mưu',
        'Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng PC07)',
        'Phó Trưởng phòng PC07',
        'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)',
        'Đại tá Lê Minh Hải (Trưởng phòng PC07)',
        'Trưởng phòng PC07',
        'Quy trình riêng của Phòng PC07 áp dụng cho kế hoạch kiểm tra định kỳ an toàn PCCC & CNCH.'
      );

      // 2. PC07 - Quy trình Kiểm tra Đột xuất PCCC
      insertWf.run(
        'WF_PC07_ADHOC',
        'Quy trình Kiểm tra Đột xuất Nguy cơ Cháy nổ Cao / Phản ánh Vi phạm (PC07)',
        'PC07',
        'Phòng Cảnh sát PCCC & CNCH (PC07)',
        'adhoc',
        JSON.stringify([
          { step: 1, stepType: 'create', name: 'Tiếp nhận tin báo / Phát hiện nguy cơ mất an toàn PCCC nghiêm trọng & Đề xuất kiểm tra đột xuất', approvingDept: 'Đội Kiểm tra An toàn PCCC - Phòng PC07', approverName: 'Thiếu tá Hoàng Văn Sơn (Đội trưởng Đội Phòng cháy)', role: 'Đội trưởng đề xuất', slaHours: 2, required: true },
          { step: 2, stepType: 'approve_plan', name: 'Phê duyệt khẩn Kế hoạch / Đề xuất Kiểm tra Đột xuất & Cử Tổ công tác', approvingDept: 'Trực ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)', approverName: 'Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng trực chỉ huy PC07)', role: 'Lãnh đạo trực chỉ huy PC07', slaHours: 4, required: true },
          { step: 3, stepType: 'inspect', name: 'Kiểm tra đột xuất tại hiện trường (không báo trước), lập biên bản & đình chỉ tạm thời nếu nguy hiểm', approvingDept: 'Tổ Công tác Kiểm tra Đột xuất PC07', approverName: 'Thiếu tá Hoàng Văn Sơn (Tổ trưởng Tổ Kiểm tra PC07)', role: 'Tổ trưởng kiểm tra', slaHours: 24, required: true },
          { step: 4, stepType: 'accept_result', name: 'Nghiệm thu hồ sơ xử lý vi phạm đột xuất & Báo cáo Trưởng phòng PC07', approvingDept: 'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)', approverName: 'Đại tá Lê Minh Hải (Trưởng phòng PC07)', role: 'Trưởng phòng PC07', slaHours: 12, required: true }
        ]),
        'Trực ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)',
        'Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng PC07)',
        'Phó Trưởng phòng PC07',
        'Trực ban Chỉ huy Phòng PC07',
        'Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng PC07)',
        'Phó Trưởng phòng PC07',
        'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)',
        'Đại tá Lê Minh Hải (Trưởng phòng PC07)',
        'Trưởng phòng PC07',
        'Quy trình rút gọn phản ứng nhanh của Phòng PC07 cho các kế hoạch/đề xuất kiểm tra đột xuất về PCCC.'
      );

      // 3. PC04 / PA04 - Quy trình Kiểm tra Định kỳ Kinh tế
      insertWf.run(
        'WF_PC04_PLANNED',
        'Quy trình Kiểm tra Định kỳ Chấp hành Pháp luật Kinh tế & Thương mại (PC04)',
        'PC04',
        'Phòng Cảnh sát Kinh tế / An ninh Kinh tế (PC04 / PA04)',
        'planned',
        JSON.stringify([
          { step: 1, stepType: 'create', name: 'Tổng hợp danh sách doanh nghiệp, chi nhánh & Lập kế hoạch kiểm tra định kỳ', approvingDept: 'Đội Nghiệp vụ Kinh tế Thương mại - Phòng PC04', approverName: 'Trung tá Đỗ Quang Huy (Đội trưởng Đội Nghiệp vụ 1 - PC04)', role: 'Đội trưởng Nghiệp vụ PC04', slaHours: 24, required: true },
          { step: 2, stepType: 'review', name: 'Thẩm định pháp lý, rà soát lịch sử vi phạm & Hồ sơ thuế/hải quan', approvingDept: 'Đội Tham mưu Tổng hợp - Phòng PC04', approverName: 'Trung tá Phạm Thanh Tùng (Đội trưởng Tham mưu PC04)', role: 'Đội trưởng Tham mưu PC04', slaHours: 24, required: true },
          { step: 3, stepType: 'approve_plan', name: 'Phê duyệt Kế hoạch Kiểm tra Định kỳ của Phòng PC04', approvingDept: 'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)', approverName: 'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)', role: 'Trưởng phòng PC04', slaHours: 16, required: true },
          { step: 4, stepType: 'establish_team', name: 'Quyết định thành lập Đoàn kiểm tra & Phân công kiểm tra từng Trụ sở/Chi nhánh', approvingDept: 'Ban Chỉ huy Phòng PC04', approverName: 'Thượng tá Vũ Minh Đức (Phó Trưởng phòng PC04)', role: 'Phó Trưởng phòng PC04', slaHours: 16, required: true },
          { step: 5, stepType: 'inspect', name: 'Kiểm tra hồ sơ sổ sách, kho hàng, nguồn gốc hàng hóa & Lập biên bản', approvingDept: 'Đoàn Kiểm tra Nghiệp vụ Phòng PC04', approverName: 'Trung tá Đỗ Quang Huy (Trưởng đoàn Kiểm tra PC04)', role: 'Trưởng đoàn kiểm tra', slaHours: 72, required: true },
          { step: 6, stepType: 'accept_result', name: 'Nghiệm thu kết luận kiểm tra & Phê duyệt phương án xử lý sau kiểm tra', approvingDept: 'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)', approverName: 'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)', role: 'Trưởng phòng PC04', slaHours: 24, required: true }
        ]),
        'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)',
        'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)',
        'Trưởng phòng PC04',
        'Ban Chỉ huy Phòng PC04',
        'Thượng tá Vũ Minh Đức (Phó Trưởng phòng PC04)',
        'Phó Trưởng phòng PC04',
        'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)',
        'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)',
        'Trưởng phòng PC04',
        'Quy trình kiểm tra định kỳ riêng của Phòng PC04 đối với các doanh nghiệp, cơ sở kinh doanh thương mại.'
      );

      // 4. PC04 / PA04 - Quy trình Kiểm tra Đột xuất Kinh tế
      insertWf.run(
        'WF_PC04_ADHOC',
        'Quy trình Kiểm tra Đột xuất Dấu hiệu Vi phạm Kinh tế, Hàng giả & Buôn lậu (PC04)',
        'PC04',
        'Phòng Cảnh sát Kinh tế / An ninh Kinh tế (PC04 / PA04)',
        'adhoc',
        JSON.stringify([
          { step: 1, stepType: 'create', name: 'Báo cáo trinh sát / Tin báo dấu hiệu vi phạm kinh tế & Lập đề xuất kiểm tra đột xuất', approvingDept: 'Đội Chống buôn lậu & Gian lận thương mại - Phòng PC04', approverName: 'Trung tá Đỗ Quang Huy (Đội trưởng Đội Nghiệp vụ - PC04)', role: 'Đội trưởng đề xuất', slaHours: 2, required: true },
          { step: 2, stepType: 'approve_plan', name: 'Phê duyệt nhanh Phương án Kiểm tra Đột xuất & Ký Quyết định kiểm tra', approvingDept: 'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)', approverName: 'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)', role: 'Trưởng phòng PC04', slaHours: 4, required: true },
          { step: 3, stepType: 'inspect', name: 'Kiểm tra đột xuất kho bãi/địa điểm kinh doanh, niêm phong tang vật & Lập biên bản', approvingDept: 'Đoàn Kiểm tra Đột xuất Phòng PC04 & Quản lý Thị trường', approverName: 'Thượng tá Vũ Minh Đức (Phó Trưởng phòng - Trưởng đoàn)', role: 'Trưởng đoàn kiểm tra', slaHours: 24, required: true },
          { step: 4, stepType: 'accept_result', name: 'Nghiệm thu kết quả kiểm tra đột xuất & Quyết định xử lý vi phạm', approvingDept: 'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)', approverName: 'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)', role: 'Trưởng phòng PC04', slaHours: 16, required: true }
        ]),
        'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)',
        'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)',
        'Trưởng phòng PC04',
        'Ban Chỉ huy Phòng PC04',
        'Thượng tá Vũ Minh Đức (Phó Trưởng phòng PC04)',
        'Phó Trưởng phòng PC04',
        'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)',
        'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)',
        'Trưởng phòng PC04',
        'Quy trình kiểm tra đột xuất riêng của Phòng PC04 khi phát hiện dấu hiệu vi phạm pháp luật kinh tế.'
      );

      // 5. PC04 / PA04 - Quy trình Kiểm tra Theo Yêu cầu Nghiệp vụ / Yếu tố Nước ngoài
      insertWf.run(
        'WF_PA04_FOREIGN',
        'Quy trình Kiểm tra Theo Yêu cầu Nghiệp vụ Doanh nghiệp FDI & Yếu tố Nước ngoài (PC04 / PA04)',
        'PC04',
        'Phòng Cảnh sát Kinh tế / An ninh Kinh tế (PC04 / PA04)',
        'professional_request',
        JSON.stringify([
          { step: 1, stepType: 'create', name: 'Tiếp nhận yêu cầu nghiệp vụ & Rà soát hồ sơ FDI / Lao động nước ngoài', approvingDept: 'Đội An ninh Kinh tế Đối ngoại - Phòng PA04/PC04', approverName: 'Trung tá Đỗ Quang Huy (Đội trưởng Nghiệp vụ)', role: 'Đội trưởng Nghiệp vụ', slaHours: 16, required: true },
          { step: 2, stepType: 'review', name: 'Phối hợp thẩm định thông tin với Phòng Quản lý Xuất nhập cảnh (PA08)', approvingDept: 'Đội Tham mưu PA04/PC04 & Phòng PA08', approverName: 'Thiếu tá Hoàng Thanh Tùng (Phó Đội trưởng PA08)', role: 'Cán bộ thẩm định liên đơn vị', slaHours: 16, required: true },
          { step: 3, stepType: 'approve_plan', name: 'Phê duyệt Kế hoạch Kiểm tra theo Yêu cầu Nghiệp vụ (Cho phép kiểm tra lại cơ sở)', approvingDept: 'Ban Chỉ huy Phòng PC04 / PA04', approverName: 'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04/PA04)', role: 'Trưởng phòng PC04/PA04', slaHours: 12, required: true },
          { step: 4, stepType: 'establish_team', name: 'Thành lập Đoàn kiểm tra liên đơn vị (PC04/PA04 - PA08 - Sở KH&ĐT)', approvingDept: 'Ban Chỉ huy Phòng PC04 / PA04', approverName: 'Thượng tá Vũ Minh Đức (Phó Trưởng phòng PC04/PA04)', role: 'Phó Trưởng phòng', slaHours: 12, required: true },
          { step: 5, stepType: 'inspect', name: 'Kiểm tra tại trụ sở chính và các chi nhánh hoạt động có yếu tố nước ngoài', approvingDept: 'Đoàn Kiểm tra Chuyên đề FDI (PC04/PA04)', approverName: 'Trung tá Đỗ Quang Huy (Trưởng đoàn Kiểm tra)', role: 'Trưởng đoàn kiểm tra', slaHours: 48, required: true },
          { step: 6, stepType: 'accept_result', name: 'Nghiệm thu báo cáo kết quả kiểm tra nghiệp vụ & Lưu hồ sơ chuyên đề', approvingDept: 'Ban Chỉ huy Phòng PC04 / PA04', approverName: 'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04/PA04)', role: 'Trưởng phòng PC04/PA04', slaHours: 24, required: true }
        ]),
        'Ban Chỉ huy Phòng PC04 / PA04',
        'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04/PA04)',
        'Trưởng phòng PC04/PA04',
        'Ban Chỉ huy Phòng PC04 / PA04',
        'Thượng tá Vũ Minh Đức (Phó Trưởng phòng PC04/PA04)',
        'Phó Trưởng phòng PC04/PA04',
        'Ban Chỉ huy Phòng PC04 / PA04',
        'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04/PA04)',
        'Trưởng phòng PC04/PA04',
        'Quy trình kiểm tra theo yêu cầu nghiệp vụ chuyên sâu đối với doanh nghiệp có yếu tố nước ngoài (cho phép kiểm tra lại cơ sở đã được đơn vị khác kiểm tra).'
      );

      // 6. PC06 - Quy trình Kiểm tra Định kỳ Ngành nghề Kinh doanh có điều kiện ANTT
      insertWf.run(
        'WF_PC06_PLANNED',
        'Quy trình Kiểm tra Định kỳ Cơ sở Kinh doanh có Điều kiện về ANTT (PC06)',
        'PC06',
        'Phòng Cảnh sát QLHC về TTXH (PC06)',
        'planned',
        JSON.stringify([
          { step: 1, stepType: 'create', name: 'Lập danh sách cơ sở lưu trú, karaoke, cầm đồ & Dự thảo kế hoạch Quý', approvingDept: 'Đội Quản lý Ngành nghề KD có điều kiện - Phòng PC06', approverName: 'Thiếu tá Ngô Quốc Khánh (Đội trưởng Đội 3 - PC06)', role: 'Đội trưởng Đội 3 - PC06', slaHours: 24, required: true },
          { step: 2, stepType: 'approve_plan', name: 'Thẩm định & Phê duyệt Kế hoạch Kiểm tra Định kỳ ANTT', approvingDept: 'Ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)', approverName: 'Đại tá Phạm Hồng Quân (Trưởng phòng PC06)', role: 'Trưởng phòng PC06', slaHours: 24, required: true },
          { step: 3, stepType: 'establish_team', name: 'Thành lập Đoàn kiểm tra PC06 phối hợp Công an Phường sở tại', approvingDept: 'Ban Chỉ huy Phòng PC06', approverName: 'Thượng tá Đặng Văn Hòa (Phó Trưởng phòng PC06)', role: 'Phó Trưởng phòng PC06', slaHours: 16, required: true },
          { step: 4, stepType: 'inspect', name: 'Kiểm tra Giấy chứng nhận đủ điều kiện ANTT, khai báo lưu trú & Lập biên bản', approvingDept: 'Đoàn Kiểm tra Phòng PC06 & Công an Phường', approverName: 'Thiếu tá Ngô Quốc Khánh (Trưởng đoàn Kiểm tra PC06)', role: 'Trưởng đoàn kiểm tra', slaHours: 48, required: true },
          { step: 5, stepType: 'accept_result', name: 'Nghiệm thu kết quả kiểm tra & Xử lý thu hồi giấy phép ANTT (nếu vi phạm)', approvingDept: 'Ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)', approverName: 'Đại tá Phạm Hồng Quân (Trưởng phòng PC06)', role: 'Trưởng phòng PC06', slaHours: 24, required: true }
        ]),
        'Ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)',
        'Đại tá Phạm Hồng Quân (Trưởng phòng PC06)',
        'Trưởng phòng PC06',
        'Ban Chỉ huy Phòng PC06',
        'Thượng tá Đặng Văn Hòa (Phó Trưởng phòng PC06)',
        'Phó Trưởng phòng PC06',
        'Ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)',
        'Đại tá Phạm Hồng Quân (Trưởng phòng PC06)',
        'Trưởng phòng PC06',
        'Quy trình kiểm tra định kỳ riêng của Phòng PC06 đối với các cơ sở kinh doanh có điều kiện về ANTT.'
      );

      // 7. PC06 - Quy trình Kiểm tra Đột xuất Đêm / Cơ sở Nhạy cảm ANTT
      insertWf.run(
        'WF_PC06_ADHOC',
        'Quy trình Kiểm tra Đột xuất Cơ sở Lưu trú, Karaoke, Bar/Vũ trường (PC06)',
        'PC06',
        'Phòng Cảnh sát QLHC về TTXH (PC06)',
        'adhoc',
        JSON.stringify([
          { step: 1, stepType: 'create', name: 'Đề xuất kiểm tra hành chính đột xuất ban đêm đối với cơ sở nhạy cảm về ANTT', approvingDept: 'Đội Quản lý Ngành nghề KD có điều kiện - Phòng PC06', approverName: 'Thiếu tá Ngô Quốc Khánh (Đội trưởng Đội 3 - PC06)', role: 'Đội trưởng đề xuất', slaHours: 2, required: true },
          { step: 2, stepType: 'approve_plan', name: 'Phê duyệt lệnh kiểm tra hành chính đột xuất & Thành lập Tổ kiểm tra', approvingDept: 'Trực ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)', approverName: 'Thượng tá Đặng Văn Hòa (Phó Trưởng phòng trực chỉ huy PC06)', role: 'Lãnh đạo trực chỉ huy PC06', slaHours: 2, required: true },
          { step: 3, stepType: 'inspect', name: 'Kiểm tra đột xuất tại cơ sở, kiểm tra cư trú/nhân thân & Lập biên bản hiện trường', approvingDept: 'Tổ Kiểm tra Hành chính Đột xuất PC06', approverName: 'Thiếu tá Ngô Quốc Khánh (Tổ trưởng Tổ Kiểm tra)', role: 'Tổ trưởng kiểm tra', slaHours: 12, required: true },
          { step: 4, stepType: 'accept_result', name: 'Nghiệm thu kết quả kiểm tra & Bàn giao xử lý theo thẩm quyền', approvingDept: 'Ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)', approverName: 'Đại tá Phạm Hồng Quân (Trưởng phòng PC06)', role: 'Trưởng phòng PC06', slaHours: 12, required: true }
        ]),
        'Trực ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)',
        'Thượng tá Đặng Văn Hòa (Phó Trưởng phòng PC06)',
        'Phó Trưởng phòng PC06',
        'Trực ban Chỉ huy Phòng PC06',
        'Thượng tá Đặng Văn Hòa (Phó Trưởng phòng PC06)',
        'Phó Trưởng phòng PC06',
        'Ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)',
        'Đại tá Phạm Hồng Quân (Trưởng phòng PC06)',
        'Trưởng phòng PC06',
        'Quy trình kiểm tra hành chính đột xuất riêng của Phòng PC06.'
      );

      // 8. Công an Phường (CAP) - Quy trình Kiểm tra Định kỳ Địa bàn Phường
      insertWf.run(
        'WF_STANDARD',
        'Quy trình Kiểm tra Định kỳ Địa bàn Phường (Công an / UBND Phường)',
        'CAP',
        'Công an / UBND Phường',
        'planned',
        JSON.stringify([
          { step: 1, stepType: 'create', name: 'Cảnh sát khu vực / Tổ Tổng hợp rà soát địa bàn & Lập kế hoạch kiểm tra Quý', approvingDept: 'Tổ Cảnh sát Khu vực & Trật tự - Công an Phường', approverName: 'Đại úy Bùi Văn Kiên (Cán bộ Công an Phường)', role: 'Cán bộ lập kế hoạch', slaHours: 24, required: true },
          { step: 2, stepType: 'approve_plan', name: 'Thẩm định & Phê duyệt Kế hoạch Kiểm tra Định kỳ của Phường', approvingDept: 'Ban Chỉ huy Công an Phường / Lãnh đạo UBND Phường', approverName: 'Trung tá Nguyễn Hoàng Nam (Trưởng Công an Phường)', role: 'Trưởng Công an Phường', slaHours: 24, required: true },
          { step: 3, stepType: 'establish_team', name: 'Thành lập Tổ kiểm tra Phường & Gửi thông báo kiểm tra cho cơ sở', approvingDept: 'Ban Chỉ huy Công an Phường', approverName: 'Thiếu tá Lê Văn Cường (Phó Trưởng Công an Phường)', role: 'Phó Trưởng Công an Phường', slaHours: 16, required: true },
          { step: 4, stepType: 'inspect', name: 'Kiểm tra thực tế tại cơ sở kinh doanh & Chấm Checklist điện tử', approvingDept: 'Tổ Kiểm tra Địa bàn Phường', approverName: 'Thiếu tá Lê Văn Cường (Tổ trưởng Tổ Kiểm tra Phường)', role: 'Tổ trưởng kiểm tra', slaHours: 48, required: true },
          { step: 5, stepType: 'accept_result', name: 'Nghiệm thu biên bản kiểm tra & Duyệt báo cáo giải trình cơ sở chưa kiểm tra', approvingDept: 'Ban Chỉ huy Công an Phường', approverName: 'Trung tá Nguyễn Hoàng Nam (Trưởng Công an Phường)', role: 'Trưởng Công an Phường', slaHours: 24, required: true }
        ]),
        'Ban Chỉ huy Công an Phường / Lãnh đạo UBND Phường',
        'Trung tá Nguyễn Hoàng Nam (Trưởng Công an Phường)',
        'Trưởng Công an Phường',
        'Ban Chỉ huy Công an Phường',
        'Thiếu tá Lê Văn Cường (Phó Trưởng Công an Phường)',
        'Phó Trưởng Công an Phường',
        'Ban Chỉ huy Công an Phường',
        'Trung tá Nguyễn Hoàng Nam (Trưởng Công an Phường)',
        'Trưởng Công an Phường',
        'Quy trình chuẩn áp dụng cho kế hoạch kiểm tra định kỳ theo Quý tại các Phường.'
      );

      // 9. Công an Phường (CAP) - Quy trình Kiểm tra Đột xuất Địa bàn Phường
      insertWf.run(
        'WF_ADHOC_FAST',
        'Quy trình Kiểm tra Đột xuất ANTT, PCCC Cơ sở & Trật tự Đô thị (Công an Phường)',
        'CAP',
        'Công an / UBND Phường',
        'adhoc',
        JSON.stringify([
          { step: 1, stepType: 'create', name: 'Tiếp nhận phản ánh của người dân / Phát hiện vi phạm trên địa bàn Phường', approvingDept: 'Trực ban Công an Phường', approverName: 'Đại úy Bùi Văn Kiên (Cán bộ trực ban Phường)', role: 'Cán bộ đề xuất', slaHours: 2, required: true },
          { step: 2, stepType: 'approve_plan', name: 'Phê duyệt nhanh đề xuất kiểm tra đột xuất & Phân công Tổ công tác Phường', approvingDept: 'Ban Chỉ huy Công an Phường', approverName: 'Trung tá Nguyễn Hoàng Nam (Trưởng Công an Phường)', role: 'Trưởng Công an Phường', slaHours: 4, required: true },
          { step: 3, stepType: 'inspect', name: 'Kiểm tra đột xuất tại cơ sở, thu thập bằng chứng & Lập biên bản hiện trường', approvingDept: 'Tổ Kiểm tra Cơ động Công an Phường', approverName: 'Thiếu tá Lê Văn Cường (Phó Trưởng CAP - Tổ trưởng)', role: 'Tổ trưởng kiểm tra', slaHours: 16, required: true },
          { step: 4, stepType: 'accept_result', name: 'Nghiệm thu kết quả kiểm tra đột xuất & Trình UBND Phường xử phạt', approvingDept: 'Ban Chỉ huy Công an Phường & UBND Phường', approverName: 'Trung tá Nguyễn Hoàng Nam (Trưởng Công an Phường)', role: 'Trưởng Công an Phường', slaHours: 12, required: true }
        ]),
        'Ban Chỉ huy Công an Phường',
        'Trung tá Nguyễn Hoàng Nam (Trưởng Công an Phường)',
        'Trưởng Công an Phường',
        'Ban Chỉ huy Công an Phường',
        'Thiếu tá Lê Văn Cường (Phó Trưởng Công an Phường)',
        'Phó Trưởng Công an Phường',
        'Ban Chỉ huy Công an Phường & UBND Phường',
        'Trung tá Nguyễn Hoàng Nam (Trưởng Công an Phường)',
        'Trưởng Công an Phường',
        'Quy trình kiểm tra đột xuất của Công an Phường khi có phản ánh hoặc phát hiện vi phạm tại địa bàn.'
      );

      // 10. Đoàn Liên ngành - Quy trình Kiểm tra Liên ngành
      insertWf.run(
        'WF_INTER_AGENCY',
        'Quy trình Kiểm tra Liên ngành (PC07 - PC04 - PC06 - QLTT - UBND Phường)',
        'LIEN_NGANH',
        'Ban Chỉ đạo / Đoàn Kiểm tra Liên ngành',
        'planned',
        JSON.stringify([
          { step: 1, stepType: 'create', name: 'Tổng hợp danh sách cơ sở liên quan nhiều lĩnh vực (PCCC, Kinh tế, ANTT, Thuế)', approvingDept: 'Thường trực Ban Chỉ đạo Liên ngành (Phòng PC04 chủ trì)', approverName: 'Trung tá Đỗ Quang Huy (Ủy viên Thường trực)', role: 'Đơn vị chủ trì lập KH', slaHours: 24, required: true },
          { step: 2, stepType: 'approve_plan', name: 'Hội đồng / Lãnh đạo Liên ngành phê duyệt Kế hoạch Kiểm tra Liên ngành', approvingDept: 'Lãnh đạo Ban Chỉ đạo Kiểm tra Liên ngành (PC04 - PC07 - PC06)', approverName: 'Đại tá Trần Quốc Tuấn (Trưởng Ban Chỉ đạo Liên ngành)', role: 'Trưởng Ban Chỉ đạo', slaHours: 24, required: true },
          { step: 3, stepType: 'establish_team', name: 'Ban hành Quyết định thành lập Đoàn kiểm tra Liên ngành & Trưng tập cán bộ các đơn vị', approvingDept: 'Ban Chỉ đạo Kiểm tra Liên ngành', approverName: 'Đại tá Lê Minh Hải (Phó Trưởng Ban Chỉ đạo - Trưởng phòng PC07)', role: 'Lãnh đạo ký QĐ lập đoàn', slaHours: 24, required: true },
          { step: 4, stepType: 'inspect', name: 'Kiểm tra đồng bộ các chuyên đề tại cơ sở & Lập biên bản liên ngành', approvingDept: 'Đoàn Kiểm tra Liên ngành (PC04, PC07, PC06, QLTT, Phường)', approverName: 'Thượng tá Nguyễn Văn Bình (Trưởng đoàn Liên ngành)', role: 'Trưởng đoàn Liên ngành', slaHours: 72, required: true },
          { step: 5, stepType: 'accept_result', name: 'Họp nghiệm thu kết quả kiểm tra liên ngành & Chuyển hồ sơ xử lý theo thẩm quyền từng ngành', approvingDept: 'Lãnh đạo Ban Chỉ đạo Kiểm tra Liên ngành', approverName: 'Đại tá Trần Quốc Tuấn (Trưởng Ban Chỉ đạo Liên ngành)', role: 'Trưởng Ban Chỉ đạo', slaHours: 24, required: true }
        ]),
        'Lãnh đạo Ban Chỉ đạo Kiểm tra Liên ngành (PC04 - PC07 - PC06)',
        'Đại tá Trần Quốc Tuấn (Trưởng Ban Chỉ đạo Liên ngành)',
        'Trưởng Ban Chỉ đạo Liên ngành',
        'Ban Chỉ đạo Kiểm tra Liên ngành',
        'Đại tá Lê Minh Hải (Phó Trưởng Ban Chỉ đạo - Trưởng phòng PC07)',
        'Phó Trưởng Ban Chỉ đạo',
        'Lãnh đạo Ban Chỉ đạo Kiểm tra Liên ngành',
        'Đại tá Trần Quốc Tuấn (Trưởng Ban Chỉ đạo Liên ngành)',
        'Trưởng Ban Chỉ đạo Liên ngành',
        'Quy trình phối hợp liên ngành giữa PC07, PC04, PC06, Quản lý thị trường và UBND Phường.'
      );
    }

    // Enrich existing plans and adhoc requests with dynamic workflow assignment (unitName, workflowCode, workflowName, approvingDept, assignedApproverName)
    try {
      db.exec(`
        UPDATE plans SET
          unitName = CASE
            WHEN id % 3 = 1 THEN 'Phòng Cảnh sát PCCC & CNCH (PC07)'
            WHEN id % 3 = 2 THEN 'Phòng Cảnh sát Kinh tế / An ninh Kinh tế (PC04 / PA04)'
            ELSE 'Công an / UBND Phường'
          END,
          workflowCode = CASE
            WHEN id % 3 = 1 THEN 'WF_PC07_PLANNED'
            WHEN id % 3 = 2 THEN 'WF_PC04_PLANNED'
            ELSE 'WF_STANDARD'
          END,
          workflowName = CASE
            WHEN id % 3 = 1 THEN 'Quy trình Kiểm tra Định kỳ An toàn PCCC & CNCH (PC07)'
            WHEN id % 3 = 2 THEN 'Quy trình Kiểm tra Định kỳ Chấp hành Pháp luật Kinh tế & Thương mại (PC04)'
            ELSE 'Quy trình Kiểm tra Định kỳ Địa bàn Phường (Công an / UBND Phường)'
          END,
          approvingDept = CASE
            WHEN id % 3 = 1 THEN 'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)'
            WHEN id % 3 = 2 THEN 'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)'
            ELSE 'Ban Chỉ huy Công an Phường / Lãnh đạo UBND Phường'
          END,
          assignedApproverName = CASE
            WHEN id % 3 = 1 THEN 'Đại tá Lê Minh Hải (Trưởng phòng PC07)'
            WHEN id % 3 = 2 THEN 'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)'
            ELSE 'Trung tá Nguyễn Hoàng Nam (Trưởng Công an Phường)'
          END
        WHERE workflowCode IS NULL;

        UPDATE adhoc_inspection_requests SET
          unitName = CASE
            WHEN inspectionType = 'professional_request' THEN 'Phòng Cảnh sát Kinh tế / An ninh Kinh tế (PC04 / PA04)'
            WHEN id % 2 = 1 THEN 'Phòng Cảnh sát PCCC & CNCH (PC07)'
            ELSE 'Phòng Cảnh sát Kinh tế / An ninh Kinh tế (PC04 / PA04)'
          END,
          workflowCode = CASE
            WHEN inspectionType = 'professional_request' THEN 'WF_PA04_FOREIGN'
            WHEN id % 2 = 1 THEN 'WF_PC07_ADHOC'
            ELSE 'WF_PC04_ADHOC'
          END,
          workflowName = CASE
            WHEN inspectionType = 'professional_request' THEN 'Quy trình Kiểm tra Theo Yêu cầu Nghiệp vụ Doanh nghiệp FDI & Yếu tố Nước ngoài (PC04 / PA04)'
            WHEN id % 2 = 1 THEN 'Quy trình Kiểm tra Đột xuất Nguy cơ Cháy nổ Cao / Phản ánh Vi phạm (PC07)'
            ELSE 'Quy trình Kiểm tra Đột xuất Dấu hiệu Vi phạm Kinh tế, Hàng giả & Buôn lậu (PC04)'
          END,
          approvingDept = CASE
            WHEN inspectionType = 'professional_request' THEN 'Ban Chỉ huy Phòng PC04 / PA04'
            WHEN id % 2 = 1 THEN 'Trực ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)'
            ELSE 'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)'
          END,
          assignedApproverName = CASE
            WHEN inspectionType = 'professional_request' THEN 'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04/PA04)'
            WHEN id % 2 = 1 THEN 'Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng PC07)'
            ELSE 'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)'
          END
        WHERE workflowCode IS NULL;
      `);
    } catch (e) {
      console.warn('⚠️ Enrich plans workflow note:', e);
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
            const isForeign = (obj.type === 'enterprise' && (idx % 3 === 0 || obj.taxCode === '0109999002' || obj.taxCode === '0109999001')) ? 1 : 0;
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

            // 2. For enterprises, always add 2 additional branches / business locations across wards (total 3 locations)
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

              const locWard = wardsList[(idx + 2) % wardsList.length];
              const locCoord = wardCoords[locWard] || baseCoord;
              insertLoc.run(
                obj.id,
                'business_location',
                `DDKD-${obj.id}-03`,
                `Địa điểm kinh doanh & Kho vận số 2 - ${obj.name}`,
                `Tầng 1-2, Tòa nhà Thương mại số ${45 + idx}, ${locWard}`,
                locWard,
                `Lê Phụ Trách Cơ Sở (${locWard})`,
                `09${String(30000000 + obj.id * 319).slice(0, 8)}`,
                isForeign,
                foreignDetail,
                'active',
                locCoord[0] + 0.0020,
                locCoord[1] - 0.0014
              );
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

    // Ensure target object MST 0109999002 (and MST 0109999001) has 3 locations AND 2-3 violation records per location + plan history across 2025 & 2026
    try {
      const targetObj = db.prepare("SELECT * FROM business_objects WHERE taxCode = '0109999002'").get() as any;
      if (targetObj) {
        let objLocs = db.prepare('SELECT * FROM business_locations WHERE objectId = ? ORDER BY id ASC').all(targetObj.id) as any[];
        if (objLocs.length < 3) {
          const insLoc = db.prepare(`
            INSERT INTO business_locations (objectId, locationType, locationCode, name, address, ward, contactPerson, phone, hasForeignElement, foreignElementDetail, status, lat, lng)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'Liên doanh thương mại & chuỗi bán lẻ có yếu tố nước ngoài', 'active', ?, ?)
          `);
          if (objLocs.length === 0) {
            insLoc.run(targetObj.id, 'headquarters', `CS-${targetObj.id}-01`, 'Trụ sở chính - Trung tâm Thương mại & DVTH Lê Duẩn', 'Số 334 Lê Duẩn (Khu vực giáp ranh)', 'Phường Đống Đa', 'Lê Minh Quân (Giám đốc)', '0912334001', 21.0155, 105.8410);
          }
          if (objLocs.length <= 1) {
            insLoc.run(targetObj.id, 'branch', `CN-${targetObj.id}-02`, 'Chi nhánh số 1 - Siêu thị & Kho vận Bạch Mai', 'Số 168 Bạch Mai, Phường Hai Bà Trưng', 'Phường Hai Bà Trưng', 'Nguyễn Hoàng Hải (Giám đốc CN1)', '0912334002', 21.0038, 105.8515);
          }
          if (objLocs.length <= 2) {
            insLoc.run(targetObj.id, 'business_location', `DDKD-${targetObj.id}-03`, 'Địa điểm kinh doanh số 2 - Tổ hợp Dịch vụ & Ẩm thực Thái Hà', 'Tầng 1-2 Tòa nhà 125 Thái Hà, Phường Đống Đa', 'Phường Đống Đa', 'Trần Thị Thu Trang (Cửa hàng trưởng CS2)', '0912334003', 21.0122, 105.8218);
          }
          objLocs = db.prepare('SELECT * FROM business_locations WHERE objectId = ? ORDER BY id ASC').all(targetObj.id) as any[];
        } else {
          // Update names to be clean and realistic for demo
          db.prepare("UPDATE business_locations SET name = 'Trụ sở chính - Trung tâm Thương mại & DVTH Lê Duẩn', address = 'Số 334 Lê Duẩn (Khu vực giáp ranh)', ward = 'Phường Đống Đa' WHERE id = ?").run(objLocs[0].id);
          db.prepare("UPDATE business_locations SET name = 'Chi nhánh số 1 - Siêu thị & Kho vận Bạch Mai', address = 'Số 168 Bạch Mai, Phường Hai Bà Trưng', ward = 'Phường Hai Bà Trưng' WHERE id = ?").run(objLocs[1].id);
          db.prepare("UPDATE business_locations SET name = 'Địa điểm kinh doanh số 2 - Tổ hợp Dịch vụ & Ẩm thực Thái Hà', address = 'Tầng 1-2 Tòa nhà 125 Thái Hà, Phường Đống Đa', ward = 'Phường Đống Đa' WHERE id = ?").run(objLocs[2].id);
          objLocs = db.prepare('SELECT * FROM business_locations WHERE objectId = ? ORDER BY id ASC').all(targetObj.id) as any[];
        }

        // Check how many violation inspections exist for targetObj
        const existingViolCount = db.prepare("SELECT COUNT(*) as cnt FROM inspections WHERE objectId = ? AND violationCodes IS NOT NULL AND violationCodes != '[]' AND violationCodes != ''").get(targetObj.id) as { cnt: number };
        if (existingViolCount.cnt < 6 && objLocs.length >= 3) {
          // Ensure historical 2025 plans exist so year filter (2026 vs 2025 vs All) works richly
          db.exec(`
            INSERT OR IGNORE INTO plans (id, quarter, year, ward, unitName, workflowCode, workflowName, approvingDept, assignedApproverName, inspectionType, status, submittedBy, submittedAt, approvedBy, approvedAt, dueDate, createdAt)
            VALUES
              (101, 'Q3/2025', 2025, 'Phường Đống Đa', 'Phòng Cảnh sát PCCC & CNCH (PC07)', 'WF_PC07_PLANNED', 'Quy trình Kiểm tra Định kỳ An toàn PCCC & CNCH (PC07)', 'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)', 'Đại tá Lê Minh Hải (Trưởng phòng PC07)', 'planned', 'approved', 3, '2025-07-05 09:00:00', 2, '2025-07-06 14:00:00', '2025-09-30 17:00:00', '2025-07-01 08:00:00'),
              (102, 'Q4/2025', 2025, 'Phường Hai Bà Trưng', 'Phòng Cảnh sát Kinh tế / An ninh Kinh tế (PC04 / PA04)', 'WF_PC04_PLANNED', 'Quy trình Kiểm tra Định kỳ Chấp hành Pháp luật Kinh tế & Thương mại (PC04)', 'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)', 'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)', 'planned', 'approved', 3, '2025-10-05 09:00:00', 2, '2025-10-06 14:00:00', '2025-12-30 17:00:00', '2025-10-01 08:00:00'),
              (103, 'Q1/2026', 2026, 'Phường Đống Đa', 'Phòng Cảnh sát QLHC về TTXH (PC06)', 'WF_PC06_PLANNED', 'Quy trình Kiểm tra Định kỳ Cơ sở Kinh doanh có Điều kiện về ANTT (PC06)', 'Ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)', 'Đại tá Phạm Hồng Quân (Trưởng phòng PC06)', 'planned', 'approved', 3, '2026-01-10 09:00:00', 2, '2026-01-12 14:00:00', '2026-03-30 17:00:00', '2026-01-05 08:00:00');
          `);

          // Remove old incomplete inspections for targetObj to seed clean 7 inspections across 3 locations
          db.prepare('DELETE FROM inspections WHERE objectId = ?').run(targetObj.id);
          db.prepare('DELETE FROM plan_items WHERE objectId = ?').run(targetObj.id);

          const insPlanItem = db.prepare(`
            INSERT INTO plan_items (planId, objectId, locationId, scheduledDate, inspectionContent, createdAt)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          const insInsp = db.prepare(`
            INSERT INTO inspections (
              objectId, locationId, locationName, locationAddress, planId, inspectionType,
              teamId, teamName, inspectingUnit, scheduledDate, inspectionContent, workflowCode,
              violationCodes, recommendationNote, recommendationTags, status, ward, lat, lng,
              severity, completedAt, dueDate, isOverdue, isLocked, isAdhoc, acceptanceStatus, acceptedByName, acceptedAt, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, 0, 1, ?, 'accepted', 'Đại tá Trần Quốc Tuấn (Lãnh đạo PA04)', ?, ?)
          `);

          const loc1 = objLocs[0]; // Trụ sở chính - Số 334 Lê Duẩn
          const loc2 = objLocs[1]; // Chi nhánh số 1 - Số 168 Bạch Mai
          const loc3 = objLocs[2]; // Địa điểm KD số 2 - 125 Thái Hà

          // --- LOCATION 1 (Trụ sở chính - 3 vi phạm) ---
          insPlanItem.run(3, targetObj.id, loc1.id, '2026-04-12', 'Kiểm tra định kỳ Q2/2026 về PCCC, ANTT và ĐKKD tại Trụ sở chính', '2026-04-05 09:00:00');
          insInsp.run(
            targetObj.id, loc1.id, loc1.name, loc1.address, 3, 'planned',
            1, 'Đoàn Kiểm tra Liên ngành An ninh Kinh tế & Thương mại Điện tử (Đợt 1/2026)', 'Phòng Cảnh sát PCCC & CNCH (PC07)', '2026-04-12',
            'Kiểm tra điều kiện an toàn PCCC, lối thoát nạn và giấy phép kinh doanh tại Trụ sở chính 334 Lê Duẩn', 'WF_PC07_PLANNED',
            JSON.stringify(['L02', 'L04']),
            'Yêu cầu bổ sung 08 bình chữa cháy CO2 tại tầng hầm, khắc phục hệ thống đèn chỉ dẫn thoát nạn và niêm yết giá dịch vụ tại sảnh chính trong 07 ngày.',
            JSON.stringify(['PCCC', 'THUE']),
            loc1.ward, 21.0155, 105.8410, 4, '2026-04-12 15:30:00', '2026-05-15 17:00:00', 0, '2026-04-12 16:00:00', '2026-04-06 08:00:00'
          );

          insPlanItem.run(103, targetObj.id, loc1.id, '2026-02-18', 'Kiểm tra chuyên đề đầu năm Q1/2026 tại Trụ sở chính', '2026-01-10 09:00:00');
          insInsp.run(
            targetObj.id, loc1.id, loc1.name, loc1.address, 103, 'professional_request',
            2, 'Đoàn Kiểm tra Chuyên đề Doanh nghiệp FDI & Dịch vụ Nước ngoài', 'Phòng An ninh Kinh tế (PA04)', '2026-02-18',
            'Kiểm tra theo yêu cầu nghiệp vụ về hồ sơ pháp lý liên doanh và quản lý lao động nước ngoài tại Trụ sở chính', 'WF_PA04_FOREIGN',
            JSON.stringify(['L01', 'L03']),
            'Cơ sở chưa cập nhật kịp thời giấy phép thay đổi nội dung đăng ký hoạt động thương mại; để phương tiện lấn chiếm hành lang an toàn trước mặt tiền.',
            JSON.stringify(['ANTT', 'THUE']),
            loc1.ward, 21.0155, 105.8410, 3, '2026-02-18 11:20:00', '2026-03-15 17:00:00', 0, '2026-02-18 14:00:00', '2026-02-01 08:00:00'
          );

          insPlanItem.run(101, targetObj.id, loc1.id, '2025-08-20', 'Kiểm tra định kỳ Q3/2025 tại Trụ sở chính', '2025-07-05 09:00:00');
          insInsp.run(
            targetObj.id, loc1.id, loc1.name, loc1.address, 101, 'planned',
            1, 'Đoàn Kiểm tra Liên ngành Quận Đống Đa', 'Công an Phường Đống Đa', '2025-08-20',
            'Kiểm tra định kỳ năm 2025 về trật tự đô thị và môi trường tại Trụ sở chính 334 Lê Duẩn', 'WF_STANDARD',
            JSON.stringify(['L03', 'L06']),
            'Nhắc nhở và xử phạt hành chính hành vi tập kết hàng hóa trên vỉa hè giờ cao điểm và hệ thống thông gió khu kỹ thuật gây tiếng ồn.',
            JSON.stringify(['ANTT', 'MOI_TRUONG']),
            loc1.ward, 21.0155, 105.8410, 3, '2025-08-20 16:10:00', '2025-09-15 17:00:00', 0, '2025-08-20 17:00:00', '2025-08-01 08:00:00'
          );

          // --- LOCATION 2 (Chi nhánh số 1 - Siêu thị & Kho vận Bạch Mai - 2 vi phạm) ---
          insPlanItem.run(4, targetObj.id, loc2.id, '2026-04-16', 'Kiểm tra định kỳ Q2/2026 tại Chi nhánh số 1 Bạch Mai', '2026-04-06 09:00:00');
          insInsp.run(
            targetObj.id, loc2.id, loc2.name, loc2.address, 4, 'planned',
            2, 'Đoàn Kiểm tra Chuyên đề Kinh tế & Thương mại (PC04)', 'Phòng Cảnh sát Kinh tế (PC04)', '2026-04-16',
            'Kiểm tra nguồn gốc hàng hóa, niêm yết giá và an toàn PCCC kho vận tại Chi nhánh số 1 (168 Bạch Mai)', 'WF_PC04_PLANNED',
            JSON.stringify(['L02', 'L04', 'L05']),
            'Kho hàng tầng 2 xếp hàng hóa che khuất tủ cứu hỏa nội bộ; một số mặt hàng thực phẩm nhập khẩu thiếu tem nhãn phụ tiếng Việt và chưa niêm yết giá.',
            JSON.stringify(['PCCC', 'ATTP', 'THUE']),
            loc2.ward, 21.0038, 105.8515, 4, '2026-04-16 14:45:00', '2026-05-20 17:00:00', 0, '2026-04-16 16:00:00', '2026-04-08 08:00:00'
          );

          insPlanItem.run(102, targetObj.id, loc2.id, '2025-11-12', 'Kiểm tra định kỳ Q4/2025 tại Chi nhánh số 1 Bạch Mai', '2025-10-05 09:00:00');
          insInsp.run(
            targetObj.id, loc2.id, loc2.name, loc2.address, 102, 'adhoc',
            3, 'Tổ Công tác Kiểm tra Đột xuất ANTT - PCCC', 'Phòng Cảnh sát PCCC & CNCH (PC07)', '2025-11-12',
            'Kiểm tra đột xuất công tác phòng chống cháy nổ mùa hanh khô tại Kho vận Chi nhánh 1 Bạch Mai', 'WF_PC07_ADHOC',
            JSON.stringify(['L02', 'L03']),
            'Lối thoát hiểm phía sau kho bị khóa chốt trong giờ làm việc; xe tải bốc dỡ hàng hóa dừng đỗ lấn chiếm lòng đường Bạch Mai.',
            JSON.stringify(['PCCC', 'ANTT']),
            loc2.ward, 21.0038, 105.8515, 4, '2025-11-12 10:30:00', '2025-11-30 17:00:00', 1, '2025-11-12 11:30:00', '2025-11-05 08:00:00'
          );

          // --- LOCATION 3 (Địa điểm kinh doanh số 2 - Tổ hợp Dịch vụ & Ẩm thực Thái Hà - 2 vi phạm) ---
          insPlanItem.run(103, targetObj.id, loc3.id, '2026-03-08', 'Kiểm tra ATTP & Môi trường Q1/2026 tại Địa điểm KD số 2 Thái Hà', '2026-01-12 09:00:00');
          insInsp.run(
            targetObj.id, loc3.id, loc3.name, loc3.address, 103, 'adhoc',
            3, 'Tổ Công tác Kiểm tra Đột xuất ANTT - PCCC Địa bàn Đống Đa & Cầu Giấy', 'Công an Phường Đống Đa', '2026-03-08',
            'Kiểm tra đột xuất vệ sinh an toàn thực phẩm, xử lý nước thải và trật tự đô thị tại Tổ hợp Ẩm thực 125 Thái Hà', 'WF_ADHOC_FAST',
            JSON.stringify(['L05', 'L06']),
            'Khu bếp chế biến chưa xuất trình đầy đủ sổ lưu mẫu thức ăn 24h; bể tách mỡ nước thải chưa được vệ sinh định kỳ gây mùi.',
            JSON.stringify(['ATTP', 'MOI_TRUONG']),
            loc3.ward, 21.0122, 105.8218, 4, '2026-03-08 17:15:00', '2026-03-25 17:00:00', 1, '2026-03-08 18:00:00', '2026-03-01 08:00:00'
          );

          insPlanItem.run(101, targetObj.id, loc3.id, '2025-09-14', 'Kiểm tra theo yêu cầu nghiệp vụ Q3/2025 tại Địa điểm KD số 2 Thái Hà', '2025-07-10 09:00:00');
          insInsp.run(
            targetObj.id, loc3.id, loc3.name, loc3.address, 101, 'professional_request',
            1, 'Đoàn Kiểm tra Liên ngành An ninh Kinh tế & Thương mại Điện tử', 'Phòng Cảnh sát QLHC về TTXH (PC06)', '2025-09-14',
            'Kiểm tra việc chấp hành quy định biển hiệu quảng cáo, niêm yết giá và điều kiện ANTT tại Địa điểm KD số 2 Thái Hà', 'WF_PC06_PLANNED',
            JSON.stringify(['L01', 'L04']),
            'Biển hiệu quảng cáo lắp đặt vượt kích thước quy định; khu vực quầy bar tầng 2 chưa niêm yết giá đồ uống rõ ràng.',
            JSON.stringify(['ANTT', 'THUE']),
            loc3.ward, 21.0122, 105.8218, 3, '2025-09-14 15:00:00', '2025-09-30 17:00:00', 0, '2025-09-14 16:00:00', '2025-09-01 08:00:00'
          );

          db.prepare('UPDATE business_objects SET lastCheckedYear = 2026 WHERE id = ?').run(targetObj.id);
        }
      }
    } catch (mstErr) {
      console.warn('⚠️ Enrich MST 0109999002 note:', mstErr);
    }

    // Ensure cutoff_configs never blocks plan submission during demos & draft plans have a default scan document ready
    try {
      db.exec(`
        INSERT OR REPLACE INTO cutoff_configs (id, quarter, cutoffDateTime) VALUES
          (1, 'Q2/2026', '2027-12-31 23:59:59'),
          (2, 'Q3/2026', '2027-12-31 23:59:59'),
          (3, 'Q4/2026', '2027-12-31 23:59:59');
        UPDATE plans SET signedDocumentUrl = '/uploads/Van_ban_trinh_duyet_ke_hoach_Q2_2026.pdf' WHERE signedDocumentUrl IS NULL;
      `);
    } catch (cutErr) {
      console.warn('⚠️ Cutoff update note:', cutErr);
    }

    // Auto-populate / upgrade default inspection_teams with full roleInTeam, position, and adjustmentHistoryJson
    const teamCount = db.prepare('SELECT COUNT(*) as count FROM inspection_teams').get() as { count: number };
    const hasRichTeams = db.prepare("SELECT COUNT(*) as count FROM inspection_teams WHERE code = 'DKT-2026-PC07-04'").get() as { count: number };
    if (teamCount.count === 0 || hasRichTeams.count === 0) {
      const insertTeam = db.prepare(`
        INSERT OR REPLACE INTO inspection_teams (
          code, name, teamType, inspectionType, leadUnit, participatingUnits, ward, decisionNumber,
          leaderName, membersJson, scheduleStart, scheduleEnd, inspectionContent, workflowCode, status, adjustmentHistoryJson, establishedByName
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertTeam.run(
        'DKT-2026-LN01',
        'Đoàn Kiểm tra Liên ngành An ninh Kinh tế & Thương mại Điện tử (Đợt 1/2026)',
        'inter_agency',
        'planned',
        'Phòng An ninh Kinh tế (PA04)',
        JSON.stringify(['Phòng An ninh Kinh tế (PA04)', 'Đội Quản lý Thị trường số 1', 'Phòng Cảnh sát PCCC & CNCH (PC07)', 'UBND Phường Hoàn Kiếm', 'Chi cục Thuế Khu vực']),
        'Phường Hoàn Kiếm',
        'QĐ-142/PA04-LN',
        'Thượng tá Nguyễn Hoàng Nam (PA04)',
        JSON.stringify([
          { fullName: 'Thượng tá Nguyễn Hoàng Nam', roleInTeam: 'Trưởng đoàn', role: 'Trưởng đoàn', unit: 'Phòng An ninh Kinh tế (PA04)', position: 'Phó Trưởng phòng PA04', phone: '0912345111' },
          { fullName: 'Thiếu tá Lê Văn Cường', roleInTeam: 'Phó trưởng đoàn', role: 'Phó trưởng đoàn', unit: 'Công an Phường Hoàn Kiếm', position: 'Phó Trưởng Công an Phường', phone: '0912345222' },
          { fullName: 'Ông Trần Minh Đức', roleInTeam: 'Thành viên', role: 'Thành viên', unit: 'Đội Quản lý Thị trường số 1', position: 'Kiểm soát viên thị trường', phone: '0912345333' },
          { fullName: 'Đại úy Phạm Quốc Bảo', roleInTeam: 'Thành viên', role: 'Thành viên', unit: 'Phòng Cảnh sát PCCC & CNCH (PC07)', position: 'Cán bộ kiểm tra PCCC', phone: '0912345444' },
          { fullName: 'Bà Vũ Thị Thu Hà', roleInTeam: 'Thư ký đoàn', role: 'Thư ký đoàn', unit: 'UBND Phường Hoàn Kiếm', position: 'Công chức Văn phòng - Thống kê', phone: '0912345555' }
        ]),
        '2026-04-05',
        '2026-06-25',
        'Kiểm tra liên ngành việc chấp hành pháp luật về ĐKKD, PCCC, ATTP và hoạt động thương mại có yếu tố nước ngoài.',
        'WF_INTER_AGENCY',
        'adjusted',
        JSON.stringify([
          { adjustedAt: '12/04/2026 09:30', adjustedBy: 'Đại tá Trần Quốc Tuấn (Trưởng phòng PA04)', reason: 'Bổ sung 01 cán bộ Phòng Cảnh sát PCCC (PC07) và điều chỉnh lịch kiểm tra khu vực giáp ranh Hoàn Kiếm - Ba Đình', note: 'Bổ sung nhân sự PC07 phối hợp liên ngành' }
        ]),
        'Đại tá Trần Quốc Tuấn (Lãnh đạo PA04)'
      );
      insertTeam.run(
        'DKT-2026-NV02',
        'Đoàn Kiểm tra Chuyên đề Doanh nghiệp FDI & Dịch vụ Nước ngoài (PC04 / PA04)',
        'inter_agency',
        'professional_request',
        'Phòng Cảnh sát Kinh tế / An ninh Kinh tế (PC04 / PA04)',
        JSON.stringify(['Phòng Cảnh sát Kinh tế / An ninh Kinh tế (PC04 / PA04)', 'Phòng Quản lý Xuất nhập cảnh (PA08)', 'Sở Kế hoạch & Đầu tư', 'Công an Phường Ba Đình']),
        'Phường Ba Đình',
        'QĐ-189/PA04-NV',
        'Trung tá Đỗ Quang Huy (PC04/PA04)',
        JSON.stringify([
          { fullName: 'Trung tá Đỗ Quang Huy', roleInTeam: 'Trưởng đoàn', role: 'Trưởng đoàn', unit: 'Phòng Cảnh sát Kinh tế / An ninh Kinh tế (PC04 / PA04)', position: 'Đội trưởng Đội Nghiệp vụ Kinh tế', phone: '0988111222' },
          { fullName: 'Thiếu tá Hoàng Thanh Tùng', roleInTeam: 'Phó trưởng đoàn', role: 'Phó trưởng đoàn', unit: 'Phòng Quản lý XNC (PA08)', position: 'Phó Đội trưởng Quản lý cư trú NN', phone: '0988111333' },
          { fullName: 'Ông Nguyễn Thành Long', roleInTeam: 'Thành viên', role: 'Thành viên', unit: 'Sở Kế hoạch & Đầu tư', position: 'Chuyên viên Thanh tra ĐKKD FDI', phone: '0988111444' },
          { fullName: 'Đại úy Bùi Văn Kiên', roleInTeam: 'Thư ký đoàn', role: 'Thư ký đoàn', unit: 'Công an Phường Ba Đình', position: 'Cảnh sát khu vực phụ trách địa bàn', phone: '0988111555' }
        ]),
        '2026-04-10',
        '2026-05-30',
        'Kiểm tra theo yêu cầu nghiệp vụ đối với các doanh nghiệp, chi nhánh có vốn đầu tư nước ngoài và sử dụng lao động nước ngoài.',
        'WF_PA04_FOREIGN',
        'active',
        JSON.stringify([
          { adjustedAt: '14/04/2026 14:15', adjustedBy: 'Thượng tá Vũ Minh Đức (Phó Trưởng phòng PC04)', reason: 'Cập nhật lịch kiểm tra thực tế tại 3 chi nhánh của doanh nghiệp FDI trên địa bàn Ba Đình & Đống Đa', note: 'Điều chỉnh lịch kiểm tra chuỗi chi nhánh' }
        ]),
        'Đại tá Trần Quốc Tuấn (Lãnh đạo PC04/PA04)'
      );
      insertTeam.run(
        'DKT-2026-DX03',
        'Tổ Công tác Kiểm tra Đột xuất ANTT - PCCC Địa bàn Đống Đa & Cầu Giấy',
        'unit',
        'adhoc',
        'Công an Phường Đống Đa',
        JSON.stringify(['Công an Phường Đống Đa', 'UBND Phường Đống Đa', 'Đội Cảnh sát PCCC & CNCH Khu vực 2']),
        'Phường Đống Đa',
        'QĐ-75/CAĐĐ-KT',
        'Thiếu tá Phạm Văn Hùng',
        JSON.stringify([
          { fullName: 'Thiếu tá Phạm Văn Hùng', roleInTeam: 'Trưởng đoàn', role: 'Trưởng đoàn', unit: 'Công an Phường Đống Đa', position: 'Phó Trưởng Công an Phường', phone: '0904555666' },
          { fullName: 'Thượng úy Ngô Minh Tuấn', roleInTeam: 'Phó trưởng đoàn', role: 'Phó trưởng đoàn', unit: 'Đội Cảnh sát PCCC & CNCH KV2', position: 'Cán bộ kiểm tra an toàn PCCC', phone: '0904555777' },
          { fullName: 'Ông Lê Hoàng Nam', roleInTeam: 'Thành viên', role: 'Thành viên', unit: 'UBND Phường Đống Đa', position: 'Cán bộ Quản lý Đô thị - Môi trường', phone: '0904555888' }
        ]),
        '2026-04-12',
        '2026-06-30',
        'Kiểm tra đột xuất các cơ sở kinh doanh có điều kiện về ANTT, PCCC khi có phản ánh hoặc dấu hiệu vi phạm.',
        'WF_ADHOC_FAST',
        'active',
        JSON.stringify([]),
        'Trung tá Nguyễn Hoàng Nam (Trưởng CAP)'
      );
      insertTeam.run(
        'DKT-2026-PC07-04',
        'Đoàn Kiểm tra Chuyên ngành An toàn PCCC & CNCH Các Tổ hợp Thương mại (PC07)',
        'unit',
        'planned',
        'Phòng Cảnh sát PCCC & CNCH (PC07)',
        JSON.stringify(['Phòng Cảnh sát PCCC & CNCH (PC07)', 'Đội Công tác Phòng cháy', 'Công an Phường Hai Bà Trưng']),
        'Phường Hai Bà Trưng',
        'QĐ-215/PC07-KT',
        'Thiếu tá Hoàng Văn Sơn (PC07)',
        JSON.stringify([
          { fullName: 'Thiếu tá Hoàng Văn Sơn', roleInTeam: 'Trưởng đoàn', role: 'Trưởng đoàn', unit: 'Phòng Cảnh sát PCCC & CNCH (PC07)', position: 'Đội trưởng Đội Công tác Phòng cháy', phone: '0918222111' },
          { fullName: 'Đại úy Nguyễn Tuấn Kiệt', roleInTeam: 'Phó trưởng đoàn', role: 'Phó trưởng đoàn', unit: 'Phòng Cảnh sát PCCC & CNCH (PC07)', position: 'Phó Đội trưởng Đội Kiểm tra PCCC', phone: '0918222222' },
          { fullName: 'Thượng úy Đặng Quốc Khánh', roleInTeam: 'Thành viên', role: 'Thành viên', unit: 'Phòng Cảnh sát PCCC & CNCH (PC07)', position: 'Kỹ sư thẩm duyệt hệ thống PCCC', phone: '0918222333' },
          { fullName: 'Trung úy Trần Minh Hiếu', roleInTeam: 'Thư ký đoàn', role: 'Thư ký đoàn', unit: 'Công an Phường Hai Bà Trưng', position: 'Cán bộ Cảnh sát khu vực', phone: '0918222444' }
        ]),
        '2026-04-08',
        '2026-06-20',
        'Kiểm tra định kỳ chuyên ngành hệ thống báo cháy tự động, họng nước chữa cháy và lối thoát nạn tại các trung tâm thương mại, kho hàng.',
        'WF_PC07_PLANNED',
        'adjusted',
        JSON.stringify([
          { adjustedAt: '15/04/2026 08:45', adjustedBy: 'Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng PC07)', reason: 'Bổ sung Kỹ sư thẩm duyệt PCCC tham gia kiểm tra kỹ thuật tại Chi nhánh Bạch Mai & Lê Duẩn', note: 'Tăng cường cán bộ kỹ thuật PC07' }
        ]),
        'Đại tá Lê Minh Hải (Trưởng phòng PC07)'
      );
      insertTeam.run(
        'DKT-2026-PC06-05',
        'Đoàn Kiểm tra Liên ngành Cơ sở Kinh doanh Có Điều kiện về ANTT & Lưu trú (PC06)',
        'inter_agency',
        'planned',
        'Phòng Cảnh sát QLHC về TTXH (PC06)',
        JSON.stringify(['Phòng Cảnh sát QLHC về TTXH (PC06)', 'Phòng Cảnh sát PCCC & CNCH (PC07)', 'Công an Phường Cầu Giấy', 'Phòng Văn hóa & Thông tin']),
        'Phường Cầu Giấy',
        'QĐ-308/PC06-LN',
        'Thiếu tá Ngô Quốc Khánh (PC06)',
        JSON.stringify([
          { fullName: 'Thiếu tá Ngô Quốc Khánh', roleInTeam: 'Trưởng đoàn', role: 'Trưởng đoàn', unit: 'Phòng Cảnh sát QLHC về TTXH (PC06)', position: 'Đội trưởng Đội Quản lý ngành nghề KD có ĐK', phone: '0977333111' },
          { fullName: 'Đại úy Lê Thanh Hải', roleInTeam: 'Phó trưởng đoàn', role: 'Phó trưởng đoàn', unit: 'Công an Phường Cầu Giấy', position: 'Phó Trưởng Công an Phường Cầu Giấy', phone: '0977333222' },
          { fullName: 'Thượng úy Vũ Hoàng Long', roleInTeam: 'Thành viên', role: 'Thành viên', unit: 'Phòng Cảnh sát PCCC & CNCH (PC07)', position: 'Cán bộ kiểm tra PCCC', phone: '0977333333' },
          { fullName: 'Bà Nguyễn Thị Thanh Tâm', roleInTeam: 'Thư ký đoàn', role: 'Thư ký đoàn', unit: 'Phòng Văn hóa & Thông tin', position: 'Chuyên viên quản lý văn hóa', phone: '0977333444' }
        ]),
        '2026-04-14',
        '2026-06-28',
        'Kiểm tra giấy chứng nhận đủ điều kiện về ANTT, khai báo lưu trú và an toàn phòng cháy tại các cơ sở lưu trú, karaoke, massage.',
        'WF_PC06_PLANNED',
        'active',
        JSON.stringify([]),
        'Đại tá Phạm Hồng Quân (Trưởng phòng PC06)'
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
