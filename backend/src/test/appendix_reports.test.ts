import assert from 'assert';
import { initDatabase } from '../db/connection';
import { AppendixService } from '../services/appendix.service';

async function run() {
  initDatabase();

  // 1. Appendix 02 (data + excel + doc)
  const app02 = AppendixService.getAppendix02({ quarter: 'Q2/2026', deduplicate: true, excludeOutOfScope: true });
  assert.ok(Array.isArray(app02.items), 'Appendix 02 items should be an array');
  assert.ok(app02.stats.totalRaw >= app02.stats.totalValid, 'totalRaw >= totalValid');

  const app02Xlsx = await AppendixService.exportAppendix02({ quarter: 'Q2/2026', format: 'excel' });
  assert.ok(app02Xlsx.buffer.length > 1000, 'Appendix 02 Excel buffer should not be empty');

  const app02Doc = await AppendixService.exportAppendix02({ quarter: 'Q2/2026', format: 'doc' });
  assert.ok(app02Doc.buffer.toString('utf-8').includes('Phụ lục 02'), 'Appendix 02 Doc should contain Phụ lục 02');

  // 2. Appendix 01 (data + doc + excel)
  const app01 = AppendixService.getAppendix01({ quarter: 'Q2/2026' });
  assert.strictEqual(app01.quarter, 'Q2/2026');
  const app01Doc = await AppendixService.exportAppendix01({ quarter: 'Q2/2026', format: 'doc' });
  assert.ok(app01Doc.buffer.toString('utf-8').includes('Phụ lục 01'), 'Appendix 01 Doc should contain Phụ lục 01');
  const app01Xlsx = await AppendixService.exportAppendix01({ quarter: 'Q2/2026', format: 'excel' });
  assert.ok(app01Xlsx.buffer.length > 1000, 'Appendix 01 Excel buffer should not be empty');

  // 3. Appendix 03 (data + doc + excel)
  const app03 = AppendixService.getAppendix03({ quarter: 'Q2/2026' });
  assert.ok(Array.isArray(app03), 'Appendix 03 should be an array');
  const app03Doc = await AppendixService.exportAppendix03({ quarter: 'Q2/2026', format: 'doc' });
  assert.ok(app03Doc.buffer.toString('utf-8').includes('Phụ lục 03'), 'Appendix 03 Doc should contain Phụ lục 03');
  const app03Xlsx = await AppendixService.exportAppendix03({ quarter: 'Q2/2026', format: 'excel' });
  assert.ok(app03Xlsx.buffer.length > 1000, 'Appendix 03 Excel buffer should not be empty');

  console.log('✅ All Appendix 01, 02, 03 service & export tests passed!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
