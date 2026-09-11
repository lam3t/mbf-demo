import { db, initDatabase } from '../db/connection';
import { runDeadlineCheck } from '../services/deadlineChecker';

async function runTests() {
  console.log('--- STARTING DEADLINE & ALERTS TESTS ---');
  initDatabase();


  // 1. Check system_configs table
  const config = db.prepare(`SELECT value FROM system_configs WHERE key = 'inspectionDeadlineDays'`).get() as { value: string };
  console.log('Initial inspectionDeadlineDays config:', config);
  if (!config || config.value !== '30') {
    throw new Error('Expected initial inspectionDeadlineDays to be 30');
  }

  // Update config
  db.prepare(`UPDATE system_configs SET value = '15' WHERE key = 'inspectionDeadlineDays'`).run();
  const updatedConfig = db.prepare(`SELECT value FROM system_configs WHERE key = 'inspectionDeadlineDays'`).get() as { value: string };
  if (updatedConfig.value !== '15') {
    throw new Error('Expected updated inspectionDeadlineDays to be 15');
  }
  console.log('✅ Config inspectionDeadlineDays update works');

  // 2. Test Plan with past dueDate (draft)
  const pastDate = '2026-01-01 00:00:00';
  const planInsert = db.prepare(`
    INSERT INTO plans (quarter, year, ward, status, dueDate, createdAt)
    VALUES ('Q1/2026', 2026, 'Phường Test Deadline', 'draft', ?, datetime('now'))
  `).run(pastDate);
  const testPlanId = planInsert.lastInsertRowid;

  // 3. Test Inspection with past dueDate
  // First create a business object
  const objInsert = db.prepare(`
    INSERT INTO business_objects (name, type, taxCode, ward, address, status, createdAt)
    VALUES ('Cty Test Deadline Overdue', 'enterprise', '0109998887', 'Phường Test Deadline', '123 Đường Test', 'active', datetime('now'))
  `).run();
  const testObjId = objInsert.lastInsertRowid;

  const inspInsert = db.prepare(`
    INSERT INTO inspections (objectId, planId, status, ward, severity, dueDate, isLocked, createdAt)
    VALUES (?, ?, 'not_started', 'Phường Test Deadline', 1, ?, 0, datetime('now'))
  `).run(testObjId, testPlanId, pastDate);
  const testInspId = inspInsert.lastInsertRowid;

  // 4. Run deadlineChecker
  console.log('Running deadlineChecker...');
  const result = runDeadlineCheck();
  console.log('DeadlineChecker result:', result);

  if (result.overduePlansCount === 0 || result.overdueInspectionsCount === 0 || result.newAlertsCreated === 0) {
    throw new Error('Expected overdue items and alerts to be found and created');
  }

  // Check plan isOverdue
  const updatedPlan = db.prepare(`SELECT isOverdue FROM plans WHERE id = ?`).get(testPlanId) as { isOverdue: number };
  if (updatedPlan.isOverdue !== 1) {
    throw new Error('Expected plan isOverdue = 1');
  }

  // Check inspection isOverdue
  const updatedInsp = db.prepare(`SELECT isOverdue FROM inspections WHERE id = ?`).get(testInspId) as { isOverdue: number };
  if (updatedInsp.isOverdue !== 1) {
    throw new Error('Expected inspection isOverdue = 1');
  }

  // Check alerts in database
  const alerts = db.prepare(`SELECT * FROM alerts WHERE ward = 'Phường Test Deadline'`).all() as any[];
  console.log(`Found ${alerts.length} alerts for Phường Test Deadline:`, alerts.map(a => ({ type: a.type, severity: a.severity, isRead: a.isRead, message: a.message })));
  if (alerts.length < 2) {
    throw new Error('Expected at least 2 alerts created');
  }

  // 5. Test deduplication - running deadlineChecker again should NOT create duplicate unread alerts
  const secondResult = runDeadlineCheck();
  console.log('Second DeadlineChecker run result:', secondResult);
  const alertsAfterSecondRun = db.prepare(`SELECT * FROM alerts WHERE ward = 'Phường Test Deadline'`).all() as any[];
  if (alertsAfterSecondRun.length !== alerts.length) {
    throw new Error(`Deduplication failed! Expected ${alerts.length} alerts but found ${alertsAfterSecondRun.length}`);
  }
  console.log('✅ Alert deduplication works');

  // 6. Test Mark alert as read
  const alertIdToRead = alerts[0].id;
  db.prepare(`UPDATE alerts SET isRead = 1 WHERE id = ?`).run(alertIdToRead);
  const readAlert = db.prepare(`SELECT isRead FROM alerts WHERE id = ?`).get(alertIdToRead) as { isRead: number };
  if (readAlert.isRead !== 1) {
    throw new Error('Expected alert isRead = 1');
  }
  console.log('✅ Mark alert as read works');

  // Cleanup test data
  db.prepare(`DELETE FROM alerts WHERE ward = 'Phường Test Deadline'`).run();
  db.prepare(`DELETE FROM inspections WHERE id = ?`).run(testInspId);
  db.prepare(`DELETE FROM plans WHERE id = ?`).run(testPlanId);
  db.prepare(`DELETE FROM business_objects WHERE id = ?`).run(testObjId);
  db.prepare(`UPDATE system_configs SET value = '30' WHERE key = 'inspectionDeadlineDays'`).run();

  console.log('--- ALL DEADLINE & ALERTS BACKEND TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
