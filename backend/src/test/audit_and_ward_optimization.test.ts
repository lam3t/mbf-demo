import { initDatabase, db } from '../db/connection';
import { AuditController } from '../controllers/audit.controller';
import { ObjectsController } from '../controllers/objects.controller';

console.log('🧪 Starting PROMPT 15 Tests: Audit Log Pre/Post Snapshot, Ward Denormalization, Indexes & Visual Diff...');

initDatabase();

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runTests() {
  try {
    // 1. Verify Database Schema & Performance Indexes
    console.log('\n--- 1. Testing Database Indexes & Schema ---');
    const tableInfo = db.prepare("PRAGMA table_info(audit_logs)").all() as Array<{ name: string }>;
    const cols = tableInfo.map(c => c.name);
    console.log('Audit log table columns:', cols.join(', '));
    if (!cols.includes('ward') || !cols.includes('beforeData') || !cols.includes('afterData') || !cols.includes('ipAddress')) {
      throw new Error('❌ Missing one or more required columns on audit_logs: ward, beforeData, afterData, ipAddress');
    }
    console.log('✅ audit_logs has all required columns (ward, beforeData, afterData, ipAddress).');

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all() as Array<{ name: string }>;
    const indexNames = indexes.map(i => i.name);
    console.log('Found performance indexes:', indexNames.filter(n => n.includes('ward')).join(', '));
    if (!indexNames.includes('idx_objects_ward')) throw new Error('❌ Missing idx_objects_ward');
    if (!indexNames.includes('idx_plans_ward_quarter')) throw new Error('❌ Missing idx_plans_ward_quarter');
    if (!indexNames.includes('idx_inspections_ward_status')) throw new Error('❌ Missing idx_inspections_ward_status');
    if (!indexNames.includes('idx_audit_logs_ward')) throw new Error('❌ Missing idx_audit_logs_ward');
    console.log('✅ All requested ward & audit performance indexes exist.');

    // 2. Insert Test Business Object and Simulate Update with Audit Log Snapshots
    console.log('\n--- 2. Testing Pre/Post Snapshot & Ward Denormalization ---');
    const insertObj = db.prepare(`
      INSERT INTO business_objects (type, taxCode, name, representative, address, ward, status)
      VALUES ('enterprise', '0108889999', 'Công Ty Cổ Phần Công Nghệ Demo 15', 'Nguyễn Văn A', '12 Phố Huế', 'Phường Hàng Bài', 'active')
    `).run();
    const objectId = Number(insertObj.lastInsertRowid);

    // Initial snapshot
    const beforeObj = db.prepare('SELECT * FROM business_objects WHERE id = ?').get(objectId);
    const beforeJson = JSON.stringify(beforeObj);

    // Perform Update on DB
    db.prepare(`
      UPDATE business_objects
      SET name = 'Công Ty Cổ Phần Công Nghệ Sao Mai (Đổi Tên)', address = '12A Phố Huế', status = 'suspended'
      WHERE id = ?
    `).run(objectId);

    const afterObj = db.prepare('SELECT * FROM business_objects WHERE id = ?').get(objectId);
    const afterJson = JSON.stringify(afterObj);

    // Insert Audit Log entry with snapshots
    const auditRes = db.prepare(`
      INSERT INTO audit_logs (userId, action, entityType, entityId, ward, beforeData, afterData, ipAddress, detail, createdAt)
      VALUES (1, 'UPDATE_OBJECT', 'BUSINESS_OBJECTS', ?, 'Phường Hàng Bài', ?, ?, '192.168.1.105', '{"method":"PUT"}', datetime('now'))
    `).run(objectId, beforeJson, afterJson);
    const auditLogId = Number(auditRes.lastInsertRowid);

    console.log(`✅ Created audit log ID ${auditLogId} with beforeData and afterData snapshots.`);

    // 3. Test GET /api/audit-logs with Ward filter
    console.log('\n--- 3. Testing GET /api/audit-logs with Ward filter ---');
    const reqList: any = {
      query: { ward: 'Phường Hàng Bài', limit: '10' }
    };
    const resList = createMockRes();
    AuditController.getAll(reqList, resList);

    if (!resList.body || !resList.body.success) {
      throw new Error(`❌ Failed to list audit logs: ${resList.body?.message}`);
    }
    const matchingLog = resList.body.data.find((l: any) => l.id === auditLogId);
    if (!matchingLog) {
      throw new Error('❌ Audit log was not returned when filtering by ward: Phường Hàng Bài');
    }
    console.log(`✅ Successfully filtered audit logs by ward. Found log #${matchingLog.id}, ward: ${matchingLog.ward}`);

    // 4. Test GET /api/audit-logs/:id/diff Visual Comparison
    console.log('\n--- 4. Testing GET /api/audit-logs/:id/diff Visual Comparison ---');
    const reqDiff: any = {
      params: { id: String(auditLogId) }
    };
    const resDiff = createMockRes();
    AuditController.getDiff(reqDiff, resDiff);

    if (!resDiff.body || !resDiff.body.success) {
      throw new Error(`❌ Failed to get audit diff: ${resDiff.body?.message}`);
    }

    const diffData = resDiff.body;
    console.log('Diff response summary:', diffData.summary);
    console.log(`Total fields: ${diffData.summary.totalFields}, Changed fields: ${diffData.summary.changedCount}`);

    const changedDiffs = diffData.diff.filter((d: any) => d.isChanged);
    console.log('Changed fields details:');
    changedDiffs.forEach((d: any) => {
      console.log(` - [${d.field}] ${d.label}: "${d.oldDisplay}" ➡️ "${d.newDisplay}"`);
    });

    const changedFieldNames = changedDiffs.map((d: any) => d.field);
    if (!changedFieldNames.includes('name') || !changedFieldNames.includes('address') || !changedFieldNames.includes('status')) {
      throw new Error(`❌ Expected name, address, and status to be detected as changed, but got: ${changedFieldNames.join(', ')}`);
    }

    if (diffData.log.ward !== 'Phường Hàng Bài') {
      throw new Error(`❌ Expected log ward to be "Phường Hàng Bài", got: ${diffData.log.ward}`);
    }
    if (diffData.log.ipAddress !== '192.168.1.105') {
      throw new Error(`❌ Expected IP "192.168.1.105", got: ${diffData.log.ipAddress}`);
    }

    console.log('✅ Diff comparison correctly highlighted modified fields with old/new values and labels!');

    // 5. Test Non-existent log handling
    const reqInvalid: any = { params: { id: '999999' } };
    const resInvalid = createMockRes();
    AuditController.getDiff(reqInvalid, resInvalid);
    if (resInvalid.statusCode !== 404) {
      throw new Error(`❌ Expected 404 for invalid log ID, got ${resInvalid.statusCode}`);
    }
    console.log('✅ Correctly returned 404 for non-existent log ID.');

    console.log('\n🎉 ALL PROMPT 15 BACKEND TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();
