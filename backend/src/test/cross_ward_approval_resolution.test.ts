import { db, initDatabase } from '../db/connection';
import { PlansController } from '../controllers/plans.controller';
import { checkCrossWardPlanConflicts } from '../utils/singleCheck';

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

function runCrossWardApprovalTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 STARTING CROSS-WARD PLAN APPROVAL & RESOLUTION TESTS');
  console.log('🧪 ========================================================');

  initDatabase();

  let passed = 0;
  let total = 0;

  function assert(cond: boolean, desc: string, detail?: string) {
    total++;
    if (cond) {
      console.log(`✅ [PASS] Test ${total}: ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] Test ${total}: ${desc}`);
      if (detail) console.error(`   👉 Details: ${detail}`);
    }
  }

  // Setup Test Data
  const taxCode1 = '0109997771';
  const taxCode2 = '0109997772';

  // Cleanup
  db.prepare("DELETE FROM plan_items WHERE objectId IN (SELECT id FROM business_objects WHERE taxCode IN (?, ?))").run(taxCode1, taxCode2);
  db.prepare("DELETE FROM inspections WHERE objectId IN (SELECT id FROM business_objects WHERE taxCode IN (?, ?))").run(taxCode1, taxCode2);
  db.prepare("DELETE FROM business_objects WHERE taxCode IN (?, ?)").run(taxCode1, taxCode2);
  db.prepare("DELETE FROM plans WHERE quarter = 'Q2/2026_TEST_CW'").run();

  // Create Object 1 (Clean, uninspected)
  const obj1 = db.prepare(`
    INSERT INTO business_objects (name, taxCode, address, ward, type, status)
    VALUES ('Cty TNHH TM Dịch Vụ Alpha Test CW', ?, '12 Hàng Buồm', 'Phường Hoàn Kiếm', 'enterprise', 'active')
  `).run(taxCode1);
  const obj1Id = Number(obj1.lastInsertRowid);

  // Create Object 2 (Clean, uninspected)
  const obj2 = db.prepare(`
    INSERT INTO business_objects (name, taxCode, address, ward, type, status)
    VALUES ('Hộ KD Ẩm Thực Beta Test CW', ?, '45 Kim Mã', 'Phường Ba Đình', 'household', 'active')
  `).run(taxCode2);
  const obj2Id = Number(obj2.lastInsertRowid);

  // Plan A (Phường Hoàn Kiếm, Q2/2026_TEST_CW, pending) contains obj1
  const planA = db.prepare(`
    INSERT INTO plans (quarter, year, ward, status)
    VALUES ('Q2/2026_TEST_CW', 2026, 'Phường Hoàn Kiếm', 'pending')
  `).run();
  const planAId = Number(planA.lastInsertRowid);
  db.prepare('INSERT INTO plan_items (planId, objectId) VALUES (?, ?)').run(planAId, obj1Id);

  // Plan B (Phường Ba Đình, Q2/2026_TEST_CW, pending) ALSO contains obj1 (Cross-ward conflict!)
  const planB = db.prepare(`
    INSERT INTO plans (quarter, year, ward, status)
    VALUES ('Q2/2026_TEST_CW', 2026, 'Phường Ba Đình', 'pending')
  `).run();
  const planBId = Number(planB.lastInsertRowid);
  db.prepare('INSERT INTO plan_items (planId, objectId) VALUES (?, ?)').run(planBId, obj1Id);

  // 1. Test Conflict Detection
  const conflictsPlanA = checkCrossWardPlanConflicts(planAId);
  assert(conflictsPlanA.length === 1, 'Detected 1 cross-ward conflict for Plan A');
  assert(conflictsPlanA[0].objectId === obj1Id, 'Conflicting object is obj1');
  assert(conflictsPlanA[0].otherWard === 'Phường Ba Đình', 'Conflicting ward is Phường Ba Đình');

  // 2. Test GET /api/plans/:id/cross-ward-conflicts
  const reqConf: any = { params: { id: planAId } };
  const resConf = createMockRes();
  PlansController.getCrossWardConflicts(reqConf, resConf);
  assert(resConf.body?.hasConflicts === true, 'GET cross-ward-conflicts returns hasConflicts: true');
  assert(resConf.body?.conflictsCount === 1, 'conflictsCount is 1');

  // 3. Test Option 1: Approval with resolutionMode: 'merge_joint'
  const reqApproveJoint: any = {
    params: { id: planAId },
    body: {
      resolutionMode: 'merge_joint',
      jointDate: '2026-05-20',
      participatingWards: ['Phường Hoàn Kiếm', 'Phường Ba Đình', 'Đội QLTT Số 2']
    },
    user: { id: 1, role: 'leader_tnt', fullName: 'Lãnh đạo TNT' }
  };
  const resApproveJoint = createMockRes();
  PlansController.approve(reqApproveJoint, resApproveJoint);

  assert(resApproveJoint.body?.success === true, 'Approve with merge_joint succeeded');
  assert(resApproveJoint.body?.message?.includes('liên ngành'), 'Success message mentions joint inspection');

  // Verify Plan A status is approved
  const planARow = db.prepare('SELECT status FROM plans WHERE id = ?').get(planAId) as any;
  assert(planARow.status === 'approved', 'Plan A status updated to approved');

  // Verify inspection created for obj1
  const inspObj1 = db.prepare('SELECT * FROM inspections WHERE planId = ? AND objectId = ?').get(planAId, obj1Id) as any;
  assert(!!inspObj1, 'Inspection created for obj1 under Plan A');

  // Verify joint alerts sent
  const jointAlert = db.prepare(`SELECT * FROM alerts WHERE type = 'joint_inspection' AND ward = 'Phường Ba Đình' ORDER BY id DESC LIMIT 1`).get() as any;
  assert(!!jointAlert, 'Joint inspection alert generated for Phường Ba Đình');

  // 4. Test Option 2: Approval with resolutionMode: 'select_single'
  // Create Plan C (Hoàn Kiếm) and Plan D (Đống Đa) both containing obj2
  const planC = db.prepare(`
    INSERT INTO plans (quarter, year, ward, status)
    VALUES ('Q2/2026_TEST_CW', 2026, 'Phường Hoàn Kiếm', 'pending')
  `).run();
  const planCId = Number(planC.lastInsertRowid);
  db.prepare('INSERT INTO plan_items (planId, objectId) VALUES (?, ?)').run(planCId, obj2Id);

  const planD = db.prepare(`
    INSERT INTO plans (quarter, year, ward, status)
    VALUES ('Q2/2026_TEST_CW', 2026, 'Phường Đống Đa', 'pending')
  `).run();
  const planDId = Number(planD.lastInsertRowid);
  db.prepare('INSERT INTO plan_items (planId, objectId) VALUES (?, ?)').run(planDId, obj2Id);

  const reqApproveSingle: any = {
    params: { id: planCId },
    body: {
      resolutionMode: 'select_single'
    },
    user: { id: 1, role: 'leader_tnt', fullName: 'Lãnh đạo TNT' }
  };
  const resApproveSingle = createMockRes();
  PlansController.approve(reqApproveSingle, resApproveSingle);

  assert(resApproveSingle.body?.success === true, 'Approve with select_single succeeded');

  // Verify obj2 was removed from Plan D
  const planDItem = db.prepare('SELECT * FROM plan_items WHERE planId = ? AND objectId = ?').get(planDId, obj2Id);
  assert(!planDItem, 'Conflicting obj2 was automatically removed from Plan D');

  // Verify override alert sent to Phường Đống Đa
  const overrideAlert = db.prepare(`SELECT * FROM alerts WHERE type = 'single_check_conflict' AND ward = 'Phường Đống Đa' ORDER BY id DESC LIMIT 1`).get() as any;
  assert(!!overrideAlert, 'Single check override alert sent to Phường Đống Đa');

  // Cleanup
  db.prepare('DELETE FROM alerts WHERE type IN (?, ?)').run('joint_inspection', 'single_check_conflict');
  db.prepare("DELETE FROM plan_items WHERE planId IN (?, ?, ?, ?)").run(planAId, planBId, planCId, planDId);
  db.prepare("DELETE FROM inspections WHERE planId IN (?, ?, ?, ?)").run(planAId, planBId, planCId, planDId);
  db.prepare("DELETE FROM business_objects WHERE id IN (?, ?)").run(obj1Id, obj2Id);
  db.prepare("DELETE FROM plans WHERE id IN (?, ?, ?, ?)").run(planAId, planBId, planCId, planDId);

  console.log('🧪 ========================================================');
  console.log(`🧪 RESULTS: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('🧪 ========================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

if (require.main === module) {
  runCrossWardApprovalTests();
}
