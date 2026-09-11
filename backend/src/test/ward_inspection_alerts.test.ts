import { initDatabase, db } from '../db/connection';
import { WardsController } from '../controllers/wards.controller';
import { runDeadlineCheck } from '../services/deadlineChecker';

console.log('🧪 Starting PROMPT 13 Tests: Ward Inspection Alerts & Notice Dispatch Tracking...');

initDatabase();

// Mock Express response helper
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
    // 1. Setup Test Data: Create a business object, plan, and completed inspection with fail items in Phường Hoàn Kiếm
    const objRes = db.prepare(`
      INSERT INTO business_objects (name, taxCode, address, ward, type, status)
      VALUES ('Nhà Hàng Biển Đông Test', '0108889999', '12 Hàng Bông', 'Phường Hoàn Kiếm', 'enterprise', 'active')
    `).run();
    const testObjectId = Number(objRes.lastInsertRowid);

    const planRes = db.prepare(`
      INSERT INTO plans (quarter, year, ward, status)
      VALUES ('Q2/2026', 2026, 'Phường Hoàn Kiếm', 'approved')
    `).run();
    const testPlanId = Number(planRes.lastInsertRowid);

    // Completed 4 days ago
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    const inspRes = db.prepare(`
      INSERT INTO inspections (objectId, planId, ward, status, completedAt, severity)
      VALUES (?, ?, 'Phường Hoàn Kiếm', 'completed', ?, 3)
    `).run(testObjectId, testPlanId, fourDaysAgo);
    const testInspectionId = Number(inspRes.lastInsertRowid);

    // Insert checklist items: 1 pass, 2 fail
    db.prepare(`
      INSERT INTO inspection_checklist_items (inspectionId, domainId, criteriaCode, criteriaName, result, notes)
      VALUES (?, 1, 'pccc_1', 'Trang bị bình chữa cháy', 'fail', 'Bình chữa cháy hết hạn áp suất')
    `).run(testInspectionId);

    db.prepare(`
      INSERT INTO inspection_checklist_items (inspectionId, domainId, criteriaCode, criteriaName, result, notes)
      VALUES (?, 2, 'attp_1', 'Giấy chứng nhận cơ sở đủ điều kiện ATTP', 'pass', 'Đầy đủ')
    `).run(testInspectionId);

    db.prepare(`
      INSERT INTO inspection_checklist_items (inspectionId, domainId, criteriaCode, criteriaName, result, notes)
      VALUES (?, 3, 'env_1', 'Phân loại rác thải', 'fail', 'Chưa có thùng rác phân loại nguy hại')
    `).run(testInspectionId);

    console.log(`\n--- Test 1: GET /api/wards/HOAN_KIEM/inspection-alerts ---`);
    const req1: any = {
      params: { wardId: 'HOAN_KIEM' },
      query: {},
      user: { id: 1, role: 'leader_tnt', unit: 'Cục TNT' }
    };
    const res1 = createMockRes();
    WardsController.getInspectionAlerts(req1, res1);

    if (res1.statusCode !== 200 || !res1.body?.success) {
      throw new Error(`Test 1 Failed: Status ${res1.statusCode} - ${res1.body?.message}`);
    }

    const alertsList = res1.body.data;
    const targetAlert = alertsList.find((a: any) => a.inspectionId === testInspectionId);
    if (!targetAlert) {
      throw new Error(`Test 1 Failed: Could not find created inspection alert #${testInspectionId}`);
    }

    if (!targetAlert.needsNoticeLetter) {
      throw new Error(`Test 1 Failed: Expected needsNoticeLetter=true for failed inspection without notice`);
    }

    if (targetAlert.failCount !== 2 || targetAlert.passCount !== 1) {
      throw new Error(`Test 1 Failed: Expected failCount=2, passCount=1, got fail=${targetAlert.failCount}, pass=${targetAlert.passCount}`);
    }

    console.log(`✅ Test 1 Passed: Retrieved alert for '${targetAlert.objectName}' with needsNoticeLetter=true, ${targetAlert.failCount} failed criteria.`);

    console.log(`\n--- Test 2: Run DeadlineChecker to test 'notice_letter_pending' system alert generation ---`);
    const checkRes = runDeadlineCheck();
    const alertRow = db.prepare(`
      SELECT * FROM alerts 
      WHERE type = 'notice_letter_pending' AND relatedEntityId = ?
    `).get(testInspectionId) as any;

    if (!alertRow) {
      throw new Error(`Test 2 Failed: Expected 'notice_letter_pending' alert to be created for 4-day-old unnotified inspection.`);
    }
    console.log(`✅ Test 2 Passed: 'notice_letter_pending' alert successfully generated: "${alertRow.message}"`);

    console.log(`\n--- Test 3: POST /api/wards/HOAN_KIEM/inspection-alerts/:inspectionId/mark-notice-sent ---`);
    const req3: any = {
      params: { wardId: 'HOAN_KIEM', inspectionId: testInspectionId.toString() },
      body: {
        method: 'van_ban_giay',
        sentAt: '2026-09-11 09:30:00',
        note: 'Đã gửi công văn số 104/UBND-PCCC tận tay đại diện cơ sở',
        fileUrl: '/uploads/notices/scan_notice_104.pdf'
      },
      user: { id: 2, role: 'officer_ward', unit: 'Phường Hoàn Kiếm' }
    };
    const res3 = createMockRes();
    WardsController.markNoticeSent(req3, res3);

    if (res3.statusCode !== 200 || !res3.body?.success) {
      throw new Error(`Test 3 Failed: Status ${res3.statusCode} - ${res3.body?.message}`);
    }

    if (res3.body.data.needsNoticeLetter !== false) {
      throw new Error(`Test 3 Failed: Expected needsNoticeLetter=false after marking notice sent.`);
    }

    // Verify record in business_notices table
    const noticeInDb = db.prepare('SELECT * FROM business_notices WHERE inspectionId = ?').get(testInspectionId) as any;
    if (!noticeInDb || noticeInDb.method !== 'van_ban_giay') {
      throw new Error(`Test 3 Failed: business_notices record not created properly.`);
    }

    // Verify related alert is marked read
    const updatedAlert = db.prepare('SELECT isRead FROM alerts WHERE id = ?').get(alertRow.id) as any;
    if (updatedAlert.isRead !== 1) {
      throw new Error(`Test 3 Failed: Related alert was not automatically marked as read.`);
    }

    console.log(`✅ Test 3 Passed: Notice recorded in business_notices, alert marked as read, needsNoticeLetter flipped to false.`);

    console.log(`\n--- Test 4: Re-query inspection alerts to ensure needsNoticeLetter is false ---`);
    const req4: any = {
      params: { wardId: '1' },
      query: { filter: 'all' },
      user: { id: 2, role: 'officer_ward', unit: 'Phường Hoàn Kiếm' }
    };
    const res4 = createMockRes();
    WardsController.getInspectionAlerts(req4, res4);

    const reloadedAlert = res4.body.data.find((a: any) => a.inspectionId === testInspectionId);
    if (!reloadedAlert || reloadedAlert.needsNoticeLetter !== false || !reloadedAlert.hasNotice) {
      throw new Error(`Test 4 Failed: Expected hasNotice=true and needsNoticeLetter=false on reload.`);
    }

    console.log(`✅ Test 4 Passed: Reloaded alert confirms notice metadata: method=${reloadedAlert.notice.method}, sentAt=${reloadedAlert.notice.sentAt}`);

    console.log('\n🎉 ALL PROMPT 13 WARD INSPECTION ALERTS BACKEND TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Test execution error:', err);
    process.exit(1);
  }
}

runTests();
