-- ==========================================================
-- Schema: MBF - He Thong Quan Ly Dang Ky & Kiem Tra
-- SQLite Database Schema per SRS Section 5
-- ==========================================================

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

CREATE INDEX IF NOT EXISTS idx_adhoc_status ON adhoc_inspection_requests(status);
CREATE INDEX IF NOT EXISTS idx_adhoc_ward ON adhoc_inspection_requests(wardRequestedBy);
CREATE INDEX IF NOT EXISTS idx_adhoc_object ON adhoc_inspection_requests(objectId);
CREATE INDEX IF NOT EXISTS idx_adhoc_year ON adhoc_inspection_requests(relatedYear);

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
  type TEXT CHECK(type IN ('overdue_inspection', 'overdue_plan', 'quota_below', 'quota_above', 'notice_letter_pending', 'joint_inspection', 'single_check_conflict')) NOT NULL,
  relatedEntityType TEXT NOT NULL,
  relatedEntityId INTEGER NOT NULL,
  ward TEXT,
  message TEXT NOT NULL,
  severity TEXT CHECK(severity IN ('info', 'warning', 'critical')) NOT NULL,
  isRead INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inspection_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT
);

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

-- Indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_objects_ward ON business_objects(ward);
CREATE INDEX IF NOT EXISTS idx_objects_taxcode ON business_objects(taxCode);
CREATE INDEX IF NOT EXISTS idx_objects_idnumber ON business_objects(idNumber);
CREATE INDEX IF NOT EXISTS idx_plans_quarter ON plans(quarter);
CREATE INDEX IF NOT EXISTS idx_plans_ward ON plans(ward);
CREATE INDEX IF NOT EXISTS idx_plans_ward_quarter ON plans(ward, quarter);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_planId ON digital_signatures(planId);
CREATE INDEX IF NOT EXISTS idx_inspections_plan ON inspections(planId);
CREATE INDEX IF NOT EXISTS idx_inspections_object ON inspections(objectId);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_ward ON inspections(ward);
CREATE INDEX IF NOT EXISTS idx_inspections_ward_status ON inspections(ward, status);
CREATE INDEX IF NOT EXISTS idx_alerts_lookup ON alerts(type, relatedEntityId, isRead);
CREATE INDEX IF NOT EXISTS idx_alerts_ward ON alerts(ward, isRead);
CREATE INDEX IF NOT EXISTS idx_checklist_inspection ON inspection_checklist_items(inspectionId);
CREATE INDEX IF NOT EXISTS idx_checklist_domain ON inspection_checklist_items(domainId);
CREATE INDEX IF NOT EXISTS idx_checklist_result ON inspection_checklist_items(result);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(userId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ward ON audit_logs(ward);
CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt ON audit_logs(createdAt);
