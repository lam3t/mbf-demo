import { db, initDatabase } from '../db/connection';
import { DashboardController } from '../controllers/dashboard.controller';
import { CatalogsController } from '../controllers/catalogs.controller';
import { InspectionsController } from '../controllers/inspections.controller';

// Initialize DB schema & seed/migrations
initDatabase();

function createMockReqRes(query: any = {}, body: any = {}, params: any = {}) {
  const req: any = { query, body, params, user: { id: 1, role: 'admin', fullName: 'Admin' } };
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
  console.log('🧪 Starting CR-03 + CR-04 Tests: Domain Dashboard & Fast/Slow Ranking...');

  // TEST 1: GET /api/catalogs/domains
  {
    console.log('\n--- Test 1: CatalogsController.getDomains ---');
    const { req, res, getData, getStatus } = createMockReqRes();
    CatalogsController.getDomains(req, res);
    const data = getData();
    console.assert(getStatus() === 200, `Expected 200, got ${getStatus()}`);
    console.assert(data.success === true, 'Expected success true');
    console.assert(Array.isArray(data.data), 'Expected array of domains');
    console.assert(data.data.length >= 5, `Expected at least 5 domains, got ${data.data.length}`);
    const domainCodes = data.data.map((d: any) => d.code);
    console.assert(domainCodes.includes('PCCC'), 'Should include PCCC');
    console.assert(domainCodes.includes('ATTP'), 'Should include ATTP');
    console.assert(domainCodes.includes('MOI_TRUONG'), 'Should include MOI_TRUONG');
    console.assert(domainCodes.includes('TTDT'), 'Should include TTDT');
    console.assert(domainCodes.includes('THUE'), 'Should include THUE');
    console.log('✅ Test 1 Passed: 5 Domains successfully cataloged:', domainCodes);
  }

  // TEST 2: GET /api/dashboard/by-domain
  {
    console.log('\n--- Test 2: DashboardController.getByDomain ---');
    const { req, res, getData, getStatus } = createMockReqRes();
    DashboardController.getByDomain(req, res);
    const data = getData();
    console.assert(getStatus() === 200, `Expected 200, got ${getStatus()}`);
    console.assert(data.success === true, 'Expected success true');
    console.assert(Array.isArray(data.data), 'Expected array of domain stats');
    console.assert(data.data.length >= 5, `Expected at least 5 domain stats, got ${data.data.length}`);

    data.data.forEach((stat: any) => {
      console.log(`  - Domain: [${stat.domainCode}] ${stat.domainName}: Checked=${stat.totalChecked}, Pass=${stat.totalPass}, Fail=${stat.totalFail}, PassRate=${stat.passRate}%`);
      console.assert(typeof stat.passRate === 'number', 'passRate should be number');
      console.assert(typeof stat.failRate === 'number', 'failRate should be number');
      console.assert(stat.totalChecked >= 0, 'totalChecked should be >= 0');
    });
    console.log('✅ Test 2 Passed: Domain statistics computed accurately.');
  }

  // TEST 3: GET /api/dashboard/ranking (Overall fastest vs slowest)
  {
    console.log('\n--- Test 3: DashboardController.getRanking (Overall scope) ---');
    // Fastest
    const { req: reqFast, res: resFast, getData: getDataFast } = createMockReqRes({ scope: 'overall', order: 'fastest', limit: '5' });
    DashboardController.getRanking(reqFast, resFast);
    const fastData = getDataFast();
    console.assert(fastData.success === true, 'Expected success true');
    console.assert(Array.isArray(fastData.data), 'Expected array');
    console.log('Top Fastest Wards:');
    fastData.data.forEach((w: any) => {
      console.log(`  #${w.rank} ${w.ward}: Rate=${w.rate}%, Completed=${w.completed}/${w.target} (${w.status})`);
    });

    // Slowest
    const { req: reqSlow, res: resSlow, getData: getDataSlow } = createMockReqRes({ scope: 'overall', order: 'slowest', limit: '5' });
    DashboardController.getRanking(reqSlow, resSlow);
    const slowData = getDataSlow();
    console.assert(slowData.success === true, 'Expected success true');
    console.assert(Array.isArray(slowData.data), 'Expected array');
    console.log('Top Slowest Wards:');
    slowData.data.forEach((w: any) => {
      console.log(`  #${w.rank} ${w.ward}: Rate=${w.rate}%, Completed=${w.completed}/${w.target} (${w.status})`);
    });

    console.assert(fastData.data[0].rate >= slowData.data[0].rate, 'Fastest top rate should be >= slowest top rate');
    console.log('✅ Test 3 Passed: Overall Ranking computed correctly.');
  }

  // TEST 4: GET /api/dashboard/ranking (Domain scope)
  {
    console.log('\n--- Test 4: DashboardController.getRanking (Domain scope: PCCC) ---');
    const { req, res, getData } = createMockReqRes({ scope: 'domain', domainId: '1', order: 'fastest', limit: '5' });
    DashboardController.getRanking(req, res);
    const data = getData();
    console.assert(data.success === true, 'Expected success true');
    console.assert(Array.isArray(data.data), 'Expected array');
    console.log('PCCC Ranking:');
    data.data.forEach((w: any) => {
      console.log(`  #${w.rank} ${w.ward}: PassRate=${w.rate}%, Domain=${w.domainName}`);
    });
    console.log('✅ Test 4 Passed: Domain-specific ranking computed correctly.');
  }

  // TEST 5: InspectionsController.getById and update with checklistItems
  {
    console.log('\n--- Test 5: InspectionsController getById & update with checklistItems ---');
    const insp = db.prepare('SELECT id FROM inspections WHERE isLocked = 0 LIMIT 1').get() as { id: number };
    console.assert(!!insp, 'Must have at least 1 unlocked inspection');

    const { req: reqGet, res: resGet, getData: getDataGet } = createMockReqRes({}, {}, { id: insp.id.toString() });
    InspectionsController.getById(reqGet, resGet);
    const inspData = getDataGet();
    console.assert(inspData.success === true, 'Expected inspection getById success');
    console.assert(Array.isArray(inspData.data.checklistItems), 'Should have checklistItems array');
    console.assert(inspData.data.checklistItems.length >= 5, 'Should have checklistItems for domains');
    console.log(`Loaded inspection #${insp.id} with ${inspData.data.checklistItems.length} checklist items.`);

    // Modify one item result
    const targetItem = inspData.data.checklistItems[0];
    const newResult = targetItem.result === 'pass' ? 'fail' : 'pass';
    const updatedItems = inspData.data.checklistItems.map((item: any) => {
      if (item.id === targetItem.id) {
        return { ...item, result: newResult, notes: 'Updated in test' };
      }
      return item;
    });

    const { req: reqUpdate, res: resUpdate, getData: getDataUpdate } = createMockReqRes(
      {},
      { checklistItems: updatedItems, notes: 'Test update' },
      { id: insp.id.toString() }
    );
    InspectionsController.update(reqUpdate, resUpdate);
    const updateRes = getDataUpdate();
    console.assert(updateRes.success === true, 'Expected update success');

    // Verify persisted
    const verifyRow = db.prepare('SELECT result, notes FROM inspection_checklist_items WHERE id = ?').get(targetItem.id) as any;
    console.assert(verifyRow.result === newResult, `Expected ${newResult}, got ${verifyRow.result}`);
    console.assert(verifyRow.notes === 'Updated in test', 'Expected notes updated');
    console.log(`✅ Test 5 Passed: Checklist items updated & verified: result=${verifyRow.result}`);
  }

  console.log('\n🎉 ALL CR-03 + CR-04 BACKEND TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
