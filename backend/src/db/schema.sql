-- ==========================================================
-- Schema: PA04 - He Thong Quan Ly Dang Ky & Kiem Tra
-- SQLite Database Schema per SRS Section 5
-- ==========================================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  fullName TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'leader_pa04', 'officer_pa04', 'officer_ward')) NOT NULL,
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

-- Indexes for optimal performance
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
