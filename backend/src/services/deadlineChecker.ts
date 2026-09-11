import cron from 'node-cron';
import { db } from '../db/connection';

export interface DeadlineCheckResult {
  overduePlansCount: number;
  overdueInspectionsCount: number;
  noticePendingCount?: number;
  newAlertsCreated: number;
}

/**
 * Scans inspections and plans for overdue deadlines and generates alerts.
 * Also scans completed inspections with fail items pending notice dispatch (> 3 days).
 */
export function runDeadlineCheck(): DeadlineCheckResult {
  let overduePlansCount = 0;
  let overdueInspectionsCount = 0;
  let noticePendingCount = 0;
  let newAlertsCreated = 0;

  try {
    const nowIso = new Date().toISOString();
    const nowLocal = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // 1. Scan draft plans where dueDate < now
    const overduePlans = db.prepare(`
      SELECT p.*, p.quarter, p.year, p.ward, p.dueDate
      FROM plans p
      WHERE p.status = 'draft' 
        AND p.dueDate IS NOT NULL 
        AND (p.dueDate < ? OR p.dueDate < ?)
    `).all(nowIso, nowLocal) as any[];

    const updatePlanStmt = db.prepare(`UPDATE plans SET isOverdue = 1 WHERE id = ?`);
    const checkPlanAlertStmt = db.prepare(`
      SELECT id FROM alerts 
      WHERE type = 'overdue_plan' AND relatedEntityId = ? AND isRead = 0
    `);
    const insertAlertStmt = db.prepare(`
      INSERT INTO alerts (type, relatedEntityType, relatedEntityId, ward, message, severity, isRead, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now', 'localtime'))
    `);

    for (const plan of overduePlans) {
      if (!plan.isOverdue) {
        updatePlanStmt.run(plan.id);
      }
      overduePlansCount++;

      const existingAlert = checkPlanAlertStmt.get(plan.id);
      if (!existingAlert) {
        const message = `Kế hoạch Quý ${plan.quarter}/${plan.year} của ${plan.ward} đã quá hạn cut-off trình duyệt (${plan.dueDate})`;
        insertAlertStmt.run('overdue_plan', 'plan', plan.id, plan.ward, message, 'warning');
        newAlertsCreated++;
      }
    }

    // 2. Scan inspections where status != 'completed' and dueDate < now
    const overdueInspections = db.prepare(`
      SELECT i.*, o.name as objectName, o.taxCode as objectTaxCode
      FROM inspections i
      LEFT JOIN business_objects o ON i.objectId = o.id
      WHERE i.status != 'completed' 
        AND i.dueDate IS NOT NULL 
        AND (i.dueDate < ? OR i.dueDate < ?)
    `).all(nowIso, nowLocal) as any[];

    const updateInspStmt = db.prepare(`UPDATE inspections SET isOverdue = 1 WHERE id = ?`);
    const checkInspAlertStmt = db.prepare(`
      SELECT id FROM alerts 
      WHERE type = 'overdue_inspection' AND relatedEntityId = ? AND isRead = 0
    `);

    for (const insp of overdueInspections) {
      if (!insp.isOverdue) {
        updateInspStmt.run(insp.id);
      }
      overdueInspectionsCount++;

      const existingAlert = checkInspAlertStmt.get(insp.id);
      if (!existingAlert) {
        const objDisplay = insp.objectName ? `${insp.objectName} (${insp.objectTaxCode || ''})` : `ID #${insp.objectId}`;
        const message = `Hồ sơ kiểm tra đối tượng ${objDisplay} (${insp.ward}) đã quá hạn hoàn thành (${insp.dueDate})`;
        insertAlertStmt.run('overdue_inspection', 'inspection', insp.id, insp.ward, message, 'critical');
        newAlertsCreated++;
      }
    }

    // 3. Scan completed inspections with fail items pending notice dispatch (> 3 days)
    const noticePendingInspections = db.prepare(`
      SELECT i.*, o.name as objectName, o.taxCode as objectTaxCode
      FROM inspections i
      JOIN business_objects o ON i.objectId = o.id
      WHERE i.status = 'completed'
        AND EXISTS (
          SELECT 1 FROM inspection_checklist_items ci 
          WHERE ci.inspectionId = i.id AND ci.result = 'fail'
        )
        AND NOT EXISTS (
          SELECT 1 FROM business_notices bn 
          WHERE bn.inspectionId = i.id
        )
        AND (
          julianday('now', 'localtime') - julianday(COALESCE(i.completedAt, i.createdAt)) >= 3
          OR julianday(?) - julianday(COALESCE(i.completedAt, i.createdAt)) >= 3
        )
    `).all(nowLocal) as any[];

    const checkNoticeAlertStmt = db.prepare(`
      SELECT id FROM alerts 
      WHERE type = 'notice_letter_pending' AND relatedEntityId = ? AND isRead = 0
    `);

    for (const insp of noticePendingInspections) {
      noticePendingCount++;
      const existingAlert = checkNoticeAlertStmt.get(insp.id);
      if (!existingAlert) {
        const objDisplay = insp.objectName ? `${insp.objectName} (${insp.objectTaxCode || ''})` : `ID #${insp.objectId}`;
        const message = `Cơ sở ${objDisplay} (${insp.ward}) có hạng mục vi phạm chưa gửi văn bản thông báo quá 3 ngày`;
        insertAlertStmt.run('notice_letter_pending', 'inspection', insp.id, insp.ward, message, 'warning');
        newAlertsCreated++;
      }
    }

    console.log(`[DeadlineChecker] Checked at ${nowLocal}: ${overduePlansCount} overdue plans, ${overdueInspectionsCount} overdue inspections, ${noticePendingCount} notice-pending inspections, ${newAlertsCreated} new alerts created.`);
  } catch (error) {
    console.error('[DeadlineChecker] Error running deadline check:', error);
  }

  return {
    overduePlansCount,
    overdueInspectionsCount,
    noticePendingCount,
    newAlertsCreated,
  };
}

let cronJob: any = null;

/**
 * Initializes hourly cron job for checking deadlines.
 */
export function initDeadlineCheckerCron(): void {
  if (cronJob) {
    return;
  }
  // Run once immediately on startup
  runDeadlineCheck();

  // Run at minute 0 every hour: '0 * * * *'
  cronJob = cron.schedule('0 * * * *', () => {
    console.log('[DeadlineChecker] Triggering scheduled hourly deadline check...');
    runDeadlineCheck();
  });

  console.log('[DeadlineChecker] Hourly deadline checker cron scheduled.');
}
