import { db, initDatabase } from '../db/connection';
import { checkObjectSingleCheckRule, formatQuarterText, formatDateText } from '../utils/singleCheck';

function runSingleCheckRuleTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 STARTING SINGLE CHECK (RULE-SC & RULE-01) UNIT TESTS');
  console.log('🧪 ========================================================');

  initDatabase();

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] Test ${totalTests}: ${testName}`);
      if (detail) console.error(`   👉 Details: ${detail}`);
    }
  }

  // Setup test data
  const testTaxCode = '0109999888';
  const testIdNumber = '001090999888';

  // 1. Clean up any existing test records
  db.prepare("DELETE FROM plan_items WHERE objectId IN (SELECT id FROM business_objects WHERE taxCode = ?)").run(testTaxCode);
  db.prepare("DELETE FROM inspections WHERE objectId IN (SELECT id FROM business_objects WHERE taxCode = ?)").run(testTaxCode);
  db.prepare("DELETE FROM business_objects WHERE taxCode = ?").run(testTaxCode);
  db.prepare("DELETE FROM plans WHERE quarter IN ('Q1/2026_TEST', 'Q3/2026_TEST')").run();

  // 2. Create Object A
  const insertObj = db.prepare(`
    INSERT INTO business_objects (type, taxCode, idNumber, name, representative, address, ward, status, createdAt)
    VALUES ('enterprise', ?, ?, 'Công ty CP Công Nghệ Alpha Test', 'Nguyễn Văn Alpha', 'Số 88 Tràng Tiền', 'Phường Hoàn Kiếm', 'active', datetime('now'))
  `);
  const objRes = insertObj.run(testTaxCode, testIdNumber);
  const objectAId = Number(objRes.lastInsertRowid);

  assert(objectAId > 0, 'Create Object A in Phường Hoàn Kiếm');

  // 3. Create Plan 1: Q1/2026, Phường Hoàn Kiếm, status = 'approved'
  const insertPlan1 = db.prepare(`
    INSERT INTO plans (quarter, year, ward, status, submittedAt, approvedAt, createdAt)
    VALUES ('Q1/2026', 2026, 'Phường Hoàn Kiếm', 'approved', datetime('now', '-30 days'), datetime('now', '-28 days'), datetime('now', '-30 days'))
  `);
  const plan1Res = insertPlan1.run();
  const plan1Id = Number(plan1Res.lastInsertRowid);

  assert(plan1Id > 0, 'Create Plan 1 (Q1/2026, Phường Hoàn Kiếm, Approved)');

  // 4. Add Object A to Plan 1
  db.prepare('INSERT INTO plan_items (planId, objectId, createdAt) VALUES (?, ?, datetime(\'now\'))').run(plan1Id, objectAId);
  db.prepare('UPDATE business_objects SET planId = ? WHERE id = ?').run(plan1Id, objectAId);

  // 5. Create Plan 2: Q3/2026, Phường Ba Đình, status = 'draft'
  const insertPlan2 = db.prepare(`
    INSERT INTO plans (quarter, year, ward, status, createdAt)
    VALUES ('Q3/2026', 2026, 'Phường Ba Đình', 'draft', datetime('now'))
  `);
  const plan2Res = insertPlan2.run();
  const plan2Id = Number(plan2Res.lastInsertRowid);

  assert(plan2Id > 0, 'Create Plan 2 (Q3/2026, Phường Ba Đình, Draft)');

  // 6. TEST RULE: Attempt to check Single Check rule for adding Object A to Plan 2 (Q3/2026 Ba Đình)
  // When not yet completed, it allows cross-ward inclusion with a WARNING for inter-ward joint inspection
  const checkResultForPlan2 = checkObjectSingleCheckRule(objectAId, 2026, plan2Id);

  assert(checkResultForPlan2.isBlocked === false, 'Single Check does NOT hard-block uninspected Object A across wards');
  assert(checkResultForPlan2.hasWarning === true, 'Single Check raises warning for cross-ward candidate');
  assert(checkResultForPlan2.isCrossWardCandidate === true, 'Flagged as cross-ward candidate');
  assert(checkResultForPlan2.conflictType === 'EXISTING_PLAN', 'Conflict type is EXISTING_PLAN');

  // 7. TEST RULE: Mark inspection in Plan 1 as completed with specific completedAt date
  const completedDate = '2026-02-15 10:30:00';
  db.prepare(`
    INSERT INTO inspections (objectId, planId, status, ward, severity, completedAt, isLocked, createdAt)
    VALUES (?, ?, 'completed', 'Phường Hoàn Kiếm', 2, ?, 1, datetime('now'))
  `).run(objectAId, plan1Id, completedDate);

  const checkResultAfterCompleted = checkObjectSingleCheckRule(objectAId, 2026);
  const expectedCompletedMsg = 'Doanh nghiệp/đối tượng này đã hoàn thành kiểm tra vào ngày 15/02/2026 bởi Phường Hoàn Kiếm - Không được phép kiểm tra trùng lặp theo nguyên tắc 1 năm/1 lần.';

  assert(checkResultAfterCompleted.isBlocked === true, 'Single Check blocks Object A after inspection completed in 2026');
  assert(checkResultAfterCompleted.conflictType === 'COMPLETED_INSPECTION', 'Conflict type is COMPLETED_INSPECTION');
  assert(checkResultAfterCompleted.blockReason === expectedCompletedMsg, 'Error message matches exact required format for completed inspection', `Expected: "${expectedCompletedMsg}"\nReceived: "${checkResultAfterCompleted.blockReason}"`);

  // 8. TEST helpers: formatQuarterText & formatDateText
  assert(formatQuarterText('Q1/2026', 2026) === 'Quý 1/2026', 'formatQuarterText Q1/2026 -> Quý 1/2026');
  assert(formatQuarterText('Q4/2026', 2026) === 'Quý 4/2026', 'formatQuarterText Q4/2026 -> Quý 4/2026');
  assert(formatDateText('2026-04-12 10:30:00') === '12/04/2026', 'formatDateText 2026-04-12 10:30:00 -> 12/04/2026');

  // Clean up test data
  db.prepare('DELETE FROM inspections WHERE objectId = ?').run(objectAId);
  db.prepare('DELETE FROM plan_items WHERE objectId = ?').run(objectAId);
  db.prepare('DELETE FROM business_objects WHERE id = ?').run(objectAId);
  db.prepare('DELETE FROM plans WHERE id IN (?, ?)').run(plan1Id, plan2Id);

  console.log('🧪 ========================================================');
  console.log(`🧪 RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('🧪 ========================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

if (require.main === module) {
  runSingleCheckRuleTests();
}
