import { db, initDatabase } from '../db/connection';
import { PlansController } from '../controllers/plans.controller';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { Response } from 'express';

function createMockReqRes(params: any = {}, body: any = {}, user: any = {}, query: any = {}) {
  const req: Partial<AuthenticatedRequest> = {
    params,
    body,
    user,
    query
  };

  let statusCode = 200;
  let responseData: any = null;

  const res: Partial<Response> = {
    status: (code: number) => {
      statusCode = code;
      return res as Response;
    },
    json: (data: any) => {
      responseData = data;
      return res as Response;
    }
  };

  return {
    req: req as AuthenticatedRequest,
    res: res as Response,
    getStatus: () => statusCode,
    getData: () => responseData
  };
}

function runDigitalSignatureTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 STARTING CR-02 DIGITAL SIGNATURE & SCAN WORKFLOW TESTS');
  console.log('🧪 ========================================================');

  initDatabase();

  let passed = 0;
  let failed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] Test ${total}: ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] Test ${total}: ${testName}`);
      if (detail) console.error(`   👉 Details: ${detail}`);
      failed++;
    }
  }

  // Find or use real users from database
  let wardUser = db.prepare("SELECT * FROM users WHERE role = 'officer_ward' LIMIT 1").get() as any;
  let officerUser = db.prepare("SELECT * FROM users WHERE role = 'officer_tnt' LIMIT 1").get() as any;
  let leaderUser = db.prepare("SELECT * FROM users WHERE role = 'leader_tnt' LIMIT 1").get() as any;

  if (!wardUser) {
    const res = db.prepare("INSERT INTO users (username, passwordHash, fullName, role, unit) VALUES ('test_ward', 'hash', 'Cán bộ Phường Test', 'officer_ward', 'Phường Test')").run();
    wardUser = { id: Number(res.lastInsertRowid), username: 'test_ward', fullName: 'Cán bộ Phường Test', role: 'officer_ward', unit: 'Phường Test' };
  }
  if (!officerUser) {
    const res = db.prepare("INSERT INTO users (username, passwordHash, fullName, role, unit) VALUES ('test_officer', 'hash', 'Cán bộ TNT Test', 'officer_tnt', 'PA04 TNT')").run();
    officerUser = { id: Number(res.lastInsertRowid), username: 'test_officer', fullName: 'Cán bộ TNT Test', role: 'officer_tnt', unit: 'PA04 TNT' };
  }
  if (!leaderUser) {
    const res = db.prepare("INSERT INTO users (username, passwordHash, fullName, role, unit) VALUES ('test_leader', 'hash', 'Trưởng phòng TNT Test', 'leader_tnt', 'PA04 TNT')").run();
    leaderUser = { id: Number(res.lastInsertRowid), username: 'test_leader', fullName: 'Trưởng phòng TNT Test', role: 'leader_tnt', unit: 'PA04 TNT' };
  }

  // Setup: Create test business object and test draft plan
  const objRes = db.prepare(`
    INSERT INTO business_objects (type, taxCode, name, address, ward, status)
    VALUES ('enterprise', '0109999888', 'Doanh Nghiệp Ký Số Test', '123 Phố Test', 'Phường Test', 'active')
  `).run();
  const testObjId = Number(objRes.lastInsertRowid);

  const planRes = db.prepare(`
    INSERT INTO plans (quarter, year, ward, status, submittedBy, createdAt)
    VALUES ('Q3/2026', 2026, 'Phường Test', 'draft', ?, datetime('now'))
  `).run(wardUser.id);
  const testPlanId = Number(planRes.lastInsertRowid);

  db.prepare('INSERT INTO plan_items (planId, objectId) VALUES (?, ?)').run(testPlanId, testObjId);

  // 1. Submit plan WITHOUT signed document -> Must fail with 400
  {
    const mock = createMockReqRes({ id: testPlanId.toString() }, {}, wardUser);
    PlansController.submit(mock.req, mock.res);

    assert(mock.getStatus() === 400, 'Submit plan without signedDocumentUrl returns 400 Bad Request');
    assert(mock.getData()?.message === 'Vui lòng đính kèm văn bản đã ký trước khi trình duyệt', 'Returns exact required error message');
  }

  // 2. Submit plan WITH signed document -> Success 200, status becomes pending, scan record created
  {
    const mock = createMockReqRes({ id: testPlanId.toString() }, { signedDocumentUrl: '/uploads/signed_plan_doc_123.pdf' }, wardUser);
    PlansController.submit(mock.req, mock.res);

    assert(mock.getStatus() === 200, 'Submit plan with signedDocumentUrl succeeds (200)');
    
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(testPlanId) as any;
    assert(plan.status === 'pending', 'Plan status updated to "pending"');
    assert(plan.signedDocumentUrl === '/uploads/signed_plan_doc_123.pdf', 'Plan signedDocumentUrl saved correctly');

    const scanRecord = db.prepare("SELECT * FROM digital_signatures WHERE planId = ? AND signatureType = 'scan'").get(testPlanId) as any;
    assert(!!scanRecord && scanRecord.signatureImageUrl === '/uploads/signed_plan_doc_123.pdf', 'Scan signature entry created in digital_signatures');
  }

  // 3. Leader TNT executes signDigital (Ký số điện tử bằng Token) -> Success 200, status becomes approved, certificateInfo stored
  {
    const mock = createMockReqRes({ id: testPlanId.toString() }, {}, leaderUser);
    PlansController.signDigital(mock.req, mock.res);

    assert(mock.getStatus() === 200, 'Leader signDigital succeeds (200)');
    assert(mock.getData()?.certificateInfo?.issuer === 'Ban Cơ yếu Chính phủ (demo)', 'Digital certificate generated with mock Ban Cơ yếu Chính phủ info');

    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(testPlanId) as any;
    assert(plan.status === 'approved', 'Plan status updated to "approved"');
    assert(plan.approvedBy === leaderUser.id, 'Plan approvedBy recorded');

    const tokenSig = db.prepare("SELECT * FROM digital_signatures WHERE planId = ? AND signatureType = 'digital_token'").get(testPlanId) as any;
    assert(!!tokenSig, 'digital_token record created in digital_signatures table');
    assert(tokenSig.signedByRole === 'leader_tnt', 'Role leader_tnt stored in digital signature');

    const inspections = db.prepare('SELECT * FROM inspections WHERE planId = ?').all(testPlanId) as any[];
    assert(inspections.length > 0, 'Inspections auto-generated for business objects in plan');
  }

  // 4. GET /api/plans/:id returns digital signature details
  {
    const mock = createMockReqRes({ id: testPlanId.toString() }, {}, leaderUser);
    PlansController.getById(mock.req, mock.res);

    assert(mock.getStatus() === 200, 'getById succeeds (200)');
    const resData = mock.getData()?.data;
    assert(resData.digitalSignature?.signatureType === 'digital_token', 'Plan details contains digitalSignature with type digital_token');
    assert(resData.digitalSignature?.certificateInfo?.issuer === 'Ban Cơ yếu Chính phủ (demo)', 'Parsed certificateInfo returned in plan details');
    assert(resData.signedDocumentUrl === '/uploads/signed_plan_doc_123.pdf', 'signedDocumentUrl returned in plan details');
  }

  // 5. Standard approval ("Duyệt thường") by Officer TNT
  {
    const plan2Res = db.prepare(`
      INSERT INTO plans (quarter, year, ward, status, signedDocumentUrl, submittedBy, createdAt)
      VALUES ('Q4/2026', 2026, 'Phường Test 2', 'pending', '/uploads/scan_doc_2.pdf', ?, datetime('now'))
    `).run(wardUser.id);
    const plan2Id = Number(plan2Res.lastInsertRowid);
    db.prepare('INSERT INTO plan_items (planId, objectId) VALUES (?, ?)').run(plan2Id, testObjId);

    const mock = createMockReqRes({ id: plan2Id.toString() }, {}, officerUser);
    PlansController.approve(mock.req, mock.res);

    assert(mock.getStatus() === 200, 'Standard approval by officer succeeds (200)');

    const plan2 = db.prepare('SELECT * FROM plans WHERE id = ?').get(plan2Id) as any;
    assert(plan2.status === 'approved', 'Plan 2 approved');

    const tokenCheck = db.prepare("SELECT * FROM digital_signatures WHERE planId = ? AND signatureType = 'digital_token'").get(plan2Id);
    assert(!tokenCheck, 'Standard approval does NOT create a digital_token record (preserves distinction)');

    // Verify getById for standard approved plan returns null or scan only
    const mockGet2 = createMockReqRes({ id: plan2Id.toString() }, {}, officerUser);
    PlansController.getById(mockGet2.req, mockGet2.res);
    const plan2Details = mockGet2.getData()?.data;
    assert(!plan2Details.digitalSignature || plan2Details.digitalSignature.signatureType !== 'digital_token', 'Standard approved plan does not have digital_token signature');
  }

  // Clean up test records
  db.prepare('DELETE FROM inspections WHERE planId IN (?, ?)').run(testPlanId, testPlanId + 1);
  db.prepare('DELETE FROM plan_items WHERE planId IN (?, ?)').run(testPlanId, testPlanId + 1);
  db.prepare('DELETE FROM digital_signatures WHERE planId IN (?, ?)').run(testPlanId, testPlanId + 1);
  db.prepare('DELETE FROM plans WHERE id IN (?, ?)').run(testPlanId, testPlanId + 1);
  db.prepare('DELETE FROM business_objects WHERE id = ?').run(testObjId);

  console.log('========================================================');
  console.log(`📊 TOTAL: ${total} | ✅ PASSED: ${passed} | ❌ FAILED: ${failed}`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDigitalSignatureTests();
