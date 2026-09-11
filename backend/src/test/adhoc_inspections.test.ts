import { initDatabase, db } from '../db/connection';
import { AdhocController } from '../controllers/adhoc.controller';
import { PlansController } from '../controllers/plans.controller';
import { InspectionsController } from '../controllers/inspections.controller';
import { checkObjectSingleCheckRule } from '../utils/singleCheck';

console.log('🧪 Starting PROMPT 14 Tests: Ad-hoc Inspection Requests Workflow & Single Check Integration...');

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
    const currentYear = new Date().getFullYear();

    // Object 1: Already inspected and completed in Phường B (Q1/2026)
    const obj1Res = db.prepare(`
      INSERT INTO business_objects (name, taxCode, address, ward, type, status)
      VALUES ('Công Ty TNHH Xây Dựng Phương Nam', '0109991111', '100 Giải Phóng', 'Phường Phương Mai', 'enterprise', 'active')
    `).run();
    const objId1 = Number(obj1Res.lastInsertRowid);

    const planB = db.prepare(`
      INSERT INTO plans (quarter, year, ward, status)
      VALUES ('Q1/2026', ?, 'Phường Phương Mai', 'approved')
    `).run(currentYear);
    const planBId = Number(planB.lastInsertRowid);

    db.prepare(`
      INSERT INTO plan_items (planId, objectId)
      VALUES (?, ?)
    `).run(planBId, objId1);

    db.prepare(`
      INSERT INTO inspections (objectId, planId, status, ward, completedAt, isLocked)
      VALUES (?, ?, 'completed', 'Phường Phương Mai', '2026-02-10 09:00:00', 1)
    `).run(objId1, planBId);

    // Object 2: Clean object in Phường Hàng Bài (no plans, no inspections)
    const obj2Res = db.prepare(`
      INSERT INTO business_objects (name, taxCode, address, ward, type, status)
      VALUES ('Nhà Hàng Ẩm Thực Phố Cổ Adhoc', '0109992222', '45 Hàng Bài', 'Phường Hàng Bài', 'enterprise', 'active')
    `).run();
    const objId2 = Number(obj2Res.lastInsertRowid);

    // Object 3: Clean object for reject test
    const obj3Res = db.prepare(`
      INSERT INTO business_objects (name, taxCode, address, ward, type, status)
      VALUES ('Quán Cafe Sáng Tạo Test', '0109993333', '88 Lý Thường Kiệt', 'Phường Hàng Bài', 'household', 'active')
    `).run();
    const objId3 = Number(obj3Res.lastInsertRowid);

    // -------------------------------------------------------------------------
    // TEST 1: Ward Officer tries to propose ad-hoc inspection for Object 1 (Already completed in Phường Phương Mai) -> BLOCKED (409)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 1: Single Check Rule Blocks Proposing Object Already Completed in Another Ward ---');
    const req1: any = {
      body: {
        objectId: objId1,
        reason: 'Nghi ngờ vi phạm quy định PCCC và lối thoát hiểm đột xuất'
      },
      user: { id: 2, username: 'officer_hb', role: 'officer_ward', unit: 'Phường Hàng Bài' }
    };
    const res1 = createMockRes();
    AdhocController.create(req1, res1);

    console.log(`Response Status: ${res1.statusCode}`);
    console.log(`Response Message: ${res1.body?.message}`);
    if (res1.statusCode !== 409) {
      throw new Error(`Expected 409 Conflict when proposing duplicate object, got ${res1.statusCode}`);
    }
    if (!res1.body?.message.includes('Phường Phương Mai')) {
      throw new Error(`Expected message to mention locking ward 'Phường Phương Mai', got: ${res1.body?.message}`);
    }
    console.log('✅ TEST 1 PASSED: Object completed in another ward successfully blocked with 409 Conflict.');

    // -------------------------------------------------------------------------
    // TEST 2: Ward Officer proposes valid ad-hoc inspection for Object 2 -> SUCCESS (201)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Ward Officer Successfully Proposes Valid Ad-hoc Inspection ---');
    const req2: any = {
      body: {
        objectId: objId2,
        reason: 'Có đơn thư phản ánh của người dân về an toàn thực phẩm và vệ sinh môi trường',
        relatedQuarter: 'Q2',
        relatedYear: currentYear
      },
      user: { id: 2, username: 'officer_hb', role: 'officer_ward', unit: 'Phường Hàng Bài' }
    };
    const res2 = createMockRes();
    AdhocController.create(req2, res2);

    console.log(`Response Status: ${res2.statusCode}, Created ID: ${res2.body?.id}`);
    if (res2.statusCode !== 201 || !res2.body?.id) {
      throw new Error(`Expected 201 Created, got ${res2.statusCode}: ${JSON.stringify(res2.body)}`);
    }
    const adhocReq2Id = res2.body.id;
    console.log('✅ TEST 2 PASSED: Ad-hoc proposal created with pending status.');

    // -------------------------------------------------------------------------
    // TEST 3: Single Check Rule Detects Active Ad-hoc Request Warning
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Single Check Rule Flags Warning for Active Ad-hoc Object ---');
    const singleCheckObj2 = checkObjectSingleCheckRule(objId2, currentYear);
    console.log(`Single Check Blocked: ${singleCheckObj2.isBlocked}, HasWarning: ${singleCheckObj2.hasWarning}, Reason: ${singleCheckObj2.warningReason}`);
    if (!singleCheckObj2.hasWarning || singleCheckObj2.conflictType !== 'EXISTING_ADHOC_REQUEST') {
      throw new Error(`Expected Single Check to flag warning for Object 2 due to active adhoc request`);
    }
    console.log('✅ TEST 3 PASSED: Single Check rule detects active ad-hoc request and flags warning for coordination.');

    // -------------------------------------------------------------------------
    // TEST 4: GET /api/adhoc-requests returns list with ward & status filter
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: GET /api/adhoc-requests Filter by Ward and Status ---');
    const reqList: any = {
      query: { status: 'pending', ward: 'Phường Hàng Bài' },
      user: { id: 1, role: 'leader_mbf' }
    };
    const resList = createMockRes();
    AdhocController.getAll(reqList, resList);

    console.log(`Found ${resList.body?.data?.length} adhoc requests`);
    const foundObj2 = resList.body?.data?.find((item: any) => item.id === adhocReq2Id);
    if (!foundObj2 || foundObj2.objectName !== 'Nhà Hàng Ẩm Thực Phố Cổ Adhoc') {
      throw new Error(`Expected to find created ad-hoc request in list`);
    }
    console.log('✅ TEST 4 PASSED: GET list correctly returned pending ad-hoc request with joined object data.');

    // -------------------------------------------------------------------------
    // TEST 5: PA04 Rejection with Reason
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: PA04 Rejection with Mandatory Reason ---');
    // First create proposal for obj 3
    const req3Create: any = {
      body: {
        objectId: objId3,
        reason: 'Kiểm tra đột xuất biển hiệu quảng cáo'
      },
      user: { id: 2, role: 'officer_ward', unit: 'Phường Hàng Bài' }
    };
    const res3Create = createMockRes();
    AdhocController.create(req3Create, res3Create);
    const adhocReq3Id = res3Create.body.id;

    // Reject without reason -> 400
    const reqRejectEmpty: any = {
      params: { id: adhocReq3Id },
      body: { rejectReason: '' },
      user: { id: 1, role: 'leader_mbf' }
    };
    const resRejectEmpty = createMockRes();
    AdhocController.reject(reqRejectEmpty, resRejectEmpty);
    if (resRejectEmpty.statusCode !== 400) {
      throw new Error(`Expected 400 when rejectReason is empty, got ${resRejectEmpty.statusCode}`);
    }

    // Reject with reason -> 200
    const reqRejectValid: any = {
      params: { id: adhocReq3Id },
      body: { rejectReason: 'Chưa đủ căn cứ pháp lý theo Nghị định về kiểm tra đột xuất.' },
      user: { id: 1, role: 'leader_mbf' }
    };
    const resRejectValid = createMockRes();
    AdhocController.reject(reqRejectValid, resRejectValid);
    if (resRejectValid.statusCode !== 200) {
      throw new Error(`Expected 200 on reject, got ${resRejectValid.statusCode}`);
    }

    const checkRejected = db.prepare('SELECT status, rejectReason FROM adhoc_inspection_requests WHERE id = ?').get(adhocReq3Id) as any;
    if (checkRejected.status !== 'rejected' || !checkRejected.rejectReason.includes('Nghị định')) {
      throw new Error(`Adhoc record not properly updated on reject`);
    }
    console.log('✅ TEST 5 PASSED: Rejection validation and status update verified.');

    // -------------------------------------------------------------------------
    // TEST 6: PA04 Approval -> Auto-generates Inspection with isAdhoc=1 and 10 checklist items
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: PA04 Approval Generates Inspection (isAdhoc=1) with 10 Checklist Items ---');
    const reqApprove: any = {
      params: { id: adhocReq2Id },
      user: { id: 1, role: 'leader_mbf' }
    };
    const resApprove = createMockRes();
    AdhocController.approve(reqApprove, resApprove);

    console.log(`Approve Response: ${JSON.stringify(resApprove.body)}`);
    if (resApprove.statusCode !== 200 || !resApprove.body?.inspectionId) {
      throw new Error(`Expected 200 and inspectionId, got: ${JSON.stringify(resApprove.body)}`);
    }

    const generatedInspId = resApprove.body.inspectionId;
    const inspRecord = db.prepare('SELECT * FROM inspections WHERE id = ?').get(generatedInspId) as any;
    if (!inspRecord || inspRecord.isAdhoc !== 1 || inspRecord.status !== 'not_started') {
      throw new Error(`Generated inspection record invalid: ${JSON.stringify(inspRecord)}`);
    }

    // Check 10 checklist items generated
    const checklistItems = db.prepare('SELECT * FROM inspection_checklist_items WHERE inspectionId = ?').all(generatedInspId);
    if (checklistItems.length !== 10) {
      throw new Error(`Expected 10 checklist items, got ${checklistItems.length}`);
    }

    // Verify inspection appears in GET /api/inspections
    const reqInspList: any = {
      query: { objectId: objId2 },
      user: { id: 1, role: 'leader_mbf' }
    };
    const resInspList = createMockRes();
    InspectionsController.getAll(reqInspList, resInspList);
    const foundInsp = resInspList.body?.data?.find((i: any) => i.id === generatedInspId);
    if (!foundInsp || foundInsp.isAdhoc !== 1) {
      throw new Error(`Ad-hoc inspection not found in getAll inspections list with isAdhoc=1`);
    }
    console.log('✅ TEST 6 PASSED: Ad-hoc approval generated inspection with isAdhoc=1, 10 checklist items, visible in inspections list.');

    // -------------------------------------------------------------------------
    // TEST 7: Official Plan Quota Is Not Altered by Ad-hoc Inspection
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Ensure Ad-hoc Items Do Not Alter Official Plan Quota ---');
    const planCheckReq: any = {
      params: { id: planBId }
    };
    const planCheckRes = createMockRes();
    PlansController.checkQuota(planCheckReq, planCheckRes);
    console.log(`Plan B Quota Count: ${planCheckRes.body?.data?.current}`);
    if (planCheckRes.body?.data?.current !== 1) {
      throw new Error(`Expected Plan B count to remain 1, got ${planCheckRes.body?.data?.current}`);
    }
    console.log('✅ TEST 7 PASSED: Official quarterly plan quota is isolated from ad-hoc inspections.');

    console.log('\n🎉 ALL PROMPT 14 BACKEND TESTS PASSED 100%!\n');
  } catch (error) {
    console.error('❌ PROMPT 14 TEST FAILED:', error);
    process.exit(1);
  }
}

runTests();
