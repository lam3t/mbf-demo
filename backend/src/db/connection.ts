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
  ward TEXT NOT NULL,
  status TEXT CHECK(status IN ('draft', 'pending', 'approved', 'rejected')) DEFAULT 'draft',
  rejectReason TEXT,
  submittedBy INTEGER,
  submittedAt DATETIME,
  approvedBy INTEGER,
  approvedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submittedBy) REFERENCES users(id),
  FOREIGN KEY (approvedBy) REFERENCES users(id)
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
  planId INTEGER NOT NULL,
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
  isLocked INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (objectId) REFERENCES business_objects(id),
  FOREIGN KEY (planId) REFERENCES plans(id)
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

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId INTEGER,
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
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_inspections_plan ON inspections(planId);
CREATE INDEX IF NOT EXISTS idx_inspections_object ON inspections(objectId);
CREATE INDEX IF NOT EXISTS idx_inspections_ward ON inspections(ward);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(userId);
`;

export function initDatabase(): void {
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
