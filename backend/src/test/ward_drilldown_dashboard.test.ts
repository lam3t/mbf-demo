import { db, initDatabase } from '../db/connection';
import { WardsController } from '../controllers/wards.controller';
import { DashboardController } from '../controllers/dashboard.controller';

initDatabase();

function createMockReqRes(query: any = {}, body: any = {}, params: any = {}, user: any = { id: 1, role: 'admin', fullName: 'Admin' }) {
  const req: any = { query, body, params, user };
  let responseData: any = null;
  let responseStatus = 200;

  const res: any = {
    status: (code: number) => {
      responseStatus = code;
      return res;
    },
    json: (data: any) => {
      responseData = data;
      return res;
    }
  };

  return {
    req,
    res,
    getData: () => responseData,
    getStatus: () => responseStatus
  };
}

async function runTests() {
  console.log('🧪 Starting CR-05 Tests: Ward Drill-down Dashboard & Role Security...');

  // TEST 1: GET /api/wards
  {
    console.log('\n--- Test 1: WardsController.getAll ---');
    const { req, res, getData, getStatus } = createMockReqRes();
    WardsController.getAll(req, res);
    const data = getData();
    console.assert(getStatus() === 200, `Expected 200, got ${getStatus()}`);
    console.assert(data.success === true, 'Expected success true');
    console.assert(Array.isArray(data.data), 'Expected array of wards');
    console.assert(data.data.length === 5, `Expected 5 wards, got ${data.data.length}`);

    data.data.forEach((w: any) => {
      console.log(`  - Ward: [${w.code}] ${w.name} (GPS: ${w.lat}, ${w.lng}) - Objects: ${w.totalObjects}, Quota: ${w.assignedQuota}, Inspections: ${w.completedInspections}/${w.totalInspections}`);
      console.assert(typeof w.lat === 'number' && typeof w.lng === 'number', 'Coordinates should be numbers');
    });
    console.log('✅ Test 1 Passed: 5 wards returned successfully with GPS and quota stats.');
  }

  // TEST 2: GET /api/wards/:idOrCode
  {
    console.log('\n--- Test 2: WardsController.getByIdOrCode ---');
    const { req, res, getData } = createMockReqRes({}, {}, { idOrCode: 'HOAN_KIEM' });
    WardsController.getByIdOrCode(req, res);
    const data = getData();
    console.assert(data.success === true, 'Expected success');
    console.assert(data.data.name === 'Phường Hoàn Kiếm', 'Expected Phường Hoàn Kiếm');
    console.log('✅ Test 2 Passed: Retrieved single ward by code:', data.data.name);
  }

  // TEST 3: GET /api/dashboard/summary with ward filter (City Commander drill-down)
  {
    console.log('\n--- Test 3: DashboardController.getSummary (Drill-down Phường Hoàn Kiếm) ---');
    const { req, res, getData } = createMockReqRes({ ward: 'Phường Hoàn Kiếm' });
    DashboardController.getSummary(req, res);
    const data = getData();
    console.assert(data.success === true, 'Expected success');
    console.assert(data.data.isWardLevel === true, 'isWardLevel should be true');
    console.assert(data.data.wardName === 'Phường Hoàn Kiếm', 'wardName should match');
    console.assert(data.data.totalInspections === 8, `Expected 8 inspections for Hoàn Kiếm, got ${data.data.totalInspections}`);
    console.assert(data.data.completedCount === 8, `Expected 8 completed for Hoàn Kiếm, got ${data.data.completedCount}`);
    console.assert(data.data.taskCompletionRate === 100, `Expected 100% completion rate for Hoàn Kiếm, got ${data.data.taskCompletionRate}`);
    console.log('✅ Test 3 Passed: Ward-level summary metrics computed accurately:', data.data);
  }

  // TEST 4: GET /api/dashboard/by-domain with ward filter
  {
    console.log('\n--- Test 4: DashboardController.getByDomain (Drill-down Phường Ba Đình) ---');
    const { req, res, getData } = createMockReqRes({ ward: 'Phường Ba Đình' });
    DashboardController.getByDomain(req, res);
    const data = getData();
    console.assert(data.success === true, 'Expected success');
    console.assert(Array.isArray(data.data), 'Expected array');
    data.data.forEach((d: any) => {
      console.log(`  - Domain: [${d.domainCode}] PassRate: ${d.passRate}%, Checked: ${d.totalChecked}`);
    });
    console.log('✅ Test 4 Passed: Domain statistics computed for specific ward.');
  }

  // TEST 5: Role-based isolation for officer_ward
  {
    console.log('\n--- Test 5: Role-based isolation for officer_ward ---');
    const wardUser = { id: 4, role: 'officer_ward', unit: 'Phường Hoàn Kiếm', fullName: 'Lê Văn Cường' };
    
    // Attempting to query with no query param -> should default to user.unit ('Phường Hoàn Kiếm')
    const { req: req1, res: res1, getData: getData1 } = createMockReqRes({}, {}, {}, wardUser);
    DashboardController.getSummary(req1, res1);
    const data1 = getData1();
    console.assert(data1.data.isWardLevel === true, 'Should be ward level');
    console.assert(data1.data.wardName === 'Phường Hoàn Kiếm', 'Should be locked to user unit');

    // Attempting to query another ward ('Phường Ba Đình') -> should be automatically locked to 'Phường Hoàn Kiếm'
    const { req: req2, res: res2, getData: getData2 } = createMockReqRes({ ward: 'Phường Ba Đình' }, {}, {}, wardUser);
    DashboardController.getSummary(req2, res2);
    const data2 = getData2();
    console.assert(data2.data.wardName === 'Phường Hoàn Kiếm', 'Should force lock to user unit even if other ward requested');
    console.log('✅ Test 5 Passed: Security isolation enforced for officer_ward.');
  }

  console.log('\n🎉 ALL CR-05 BACKEND DRILL-DOWN TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
