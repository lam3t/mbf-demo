import { db } from '../db/connection';

export interface SingleCheckResult {
  isBlocked: boolean;
  blockReason: string | null;
  hasWarning?: boolean;
  warningReason?: string | null;
  isCrossWardCandidate?: boolean;
  conflictType?: 'COMPLETED_INSPECTION' | 'EXISTING_PLAN' | 'EXISTING_ADHOC_REQUEST' | 'CROSS_WARD_UNINSPECTED';
  completedAt?: string;
  planId?: number;
  planQuarter?: string;
  planYear?: number;
  planWard?: string;
  planStatus?: string;
  adhocRequestId?: number;
  adhocStatus?: string;
  otherWard?: string;
}

export function formatQuarterText(quarter: string, year?: number): string {
  if (!quarter) return year ? `năm ${year}` : 'năm hiện tại';
  let formatted = quarter;
  if (/^Q([1-4])\b/i.test(quarter)) {
    formatted = quarter.replace(/^Q([1-4])/i, 'Quý $1');
  }
  return formatted;
}

export function formatDateText(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {}
  return dateStr;
}

/**
 * Checks whether an object is blocked or has cross-ward warning by Single Check rule in the specified year.
 * Rule:
 * 1. If object ALREADY COMPLETED inspection in targetYear => HARD BLOCK (isBlocked = true).
 * 2. If object is NOT YET INSPECTED but in draft/pending/approved plan of another ward => ALLOW WITH WARNING (isBlocked = false, hasWarning = true, isCrossWardCandidate = true).
 *    PA04 can review this warning during plan approval to coordinate an inter-ward joint inspection (kiểm tra liên ngành).
 */
export function checkObjectSingleCheckRule(
  objectId: number,
  targetYear: number = new Date().getFullYear(),
  excludePlanId?: number,
  excludeAdhocId?: number
): SingleCheckResult {
  const currentYearStr = targetYear.toString();

  // 1. Check if object has completed inspection in targetYear -> HARD BLOCK
  const inspectionStmt = db.prepare(`
    SELECT i.id, i.completedAt, i.ward, p.quarter, p.year
    FROM inspections i
    LEFT JOIN plans p ON i.planId = p.id
    WHERE i.objectId = ? AND i.status = 'completed'
      AND (p.year = ? OR i.completedAt LIKE ? OR (p.year IS NULL AND i.createdAt LIKE ?))
    ORDER BY i.completedAt DESC, i.id DESC
    LIMIT 1
  `);
  const completed = inspectionStmt.get(
    objectId,
    targetYear,
    `%${currentYearStr}%`,
    `%${currentYearStr}%`
  ) as { id: number; completedAt: string; ward: string; quarter: string; year: number } | undefined;

  if (completed) {
    const formattedDate = formatDateText(completed.completedAt);
    const wardText = completed.ward ? ` bởi ${completed.ward}` : '';
    const dateText = formattedDate ? ` vào ngày ${formattedDate}` : '';
    return {
      isBlocked: true,
      conflictType: 'COMPLETED_INSPECTION',
      blockReason: `Doanh nghiệp/đối tượng này đã hoàn thành kiểm tra${dateText}${wardText} - Không được phép kiểm tra trùng lặp theo nguyên tắc 1 năm/1 lần.`,
      completedAt: completed.completedAt,
      planQuarter: completed.quarter,
      planYear: completed.year || targetYear,
      planWard: completed.ward
    };
  }

  // 2. Check if object is in any plan in targetYear (exclude current plan) -> WARNING FOR INTER-WARD JOINT INSPECTION
  let planQuery = `
    SELECT p.id, p.ward, p.quarter, p.year, p.status
    FROM plan_items pi
    JOIN plans p ON pi.planId = p.id
    WHERE pi.objectId = ?
      AND (p.year = ? OR p.quarter LIKE ?)
  `;
  const params: any[] = [objectId, targetYear, `%${currentYearStr}%`];

  if (excludePlanId) {
    planQuery += ` AND p.id != ?`;
    params.push(excludePlanId);
  }

  planQuery += ` ORDER BY p.id DESC LIMIT 1`;

  const existingPlan = db.prepare(planQuery).get(...params) as {
    id: number;
    ward: string;
    quarter: string;
    year: number;
    status: string;
  } | undefined;

  if (existingPlan) {
    const qText = formatQuarterText(existingPlan.quarter, existingPlan.year || targetYear);
    return {
      isBlocked: false,
      blockReason: null,
      hasWarning: true,
      isCrossWardCandidate: true,
      conflictType: 'EXISTING_PLAN',
      warningReason: `Đối tượng này đồng thời có trong kế hoạch của ${existingPlan.ward} (${qText}) - Cảnh báo phối hợp đoàn kiểm tra liên ngành khi phê duyệt.`,
      planId: existingPlan.id,
      planQuarter: existingPlan.quarter,
      planYear: existingPlan.year || targetYear,
      planWard: existingPlan.ward,
      planStatus: existingPlan.status,
      otherWard: existingPlan.ward
    };
  }

  // 3. Check active ad-hoc request (pending or approved) in targetYear
  try {
    let adhocQuery = `
      SELECT id, wardRequestedBy, relatedQuarter, relatedYear, status
      FROM adhoc_inspection_requests
      WHERE objectId = ? AND status IN ('pending', 'approved')
        AND (relatedYear = ? OR relatedQuarter LIKE ?)
    `;
    const adhocParams: any[] = [objectId, targetYear, `%${currentYearStr}%`];

    if (excludeAdhocId) {
      adhocQuery += ` AND id != ?`;
      adhocParams.push(excludeAdhocId);
    }

    adhocQuery += ` ORDER BY id DESC LIMIT 1`;

    const existingAdhoc = db.prepare(adhocQuery).get(...adhocParams) as {
      id: number;
      wardRequestedBy: string;
      relatedQuarter: string;
      relatedYear: number;
      status: string;
    } | undefined;

    if (existingAdhoc) {
      const statusText = existingAdhoc.status === 'approved' ? 'đã duyệt' : 'chờ duyệt';
      const qText = formatQuarterText(existingAdhoc.relatedQuarter, existingAdhoc.relatedYear || targetYear);
      return {
        isBlocked: false,
        blockReason: null,
        hasWarning: true,
        isCrossWardCandidate: true,
        conflictType: 'EXISTING_ADHOC_REQUEST',
        warningReason: `Đối tượng này đã có đề xuất kiểm tra phát sinh (${statusText}) tại ${existingAdhoc.wardRequestedBy} (${qText}) - Đề xuất phối hợp liên ngành.`,
        adhocRequestId: existingAdhoc.id,
        adhocStatus: existingAdhoc.status,
        planQuarter: existingAdhoc.relatedQuarter,
        planYear: existingAdhoc.relatedYear || targetYear,
        planWard: existingAdhoc.wardRequestedBy,
        otherWard: existingAdhoc.wardRequestedBy
      };
    }
  } catch (err) {
    // Table might not be created during early bootstrap; safely ignore
  }

  return {
    isBlocked: false,
    blockReason: null,
    hasWarning: false
  };
}

/**
 * Scans a plan to find all objects that are also in other wards' plans (for Joint Inspection Warnings upon Approval)
 */
export function checkCrossWardPlanConflicts(planId: number): Array<{
  objectId: number;
  objectName: string;
  objectAddress: string;
  otherPlanId: number;
  otherWard: string;
  otherQuarter: string;
  otherStatus: string;
}> {
  const currentPlan = db.prepare('SELECT id, ward, quarter, year FROM plans WHERE id = ?').get(planId) as any;
  if (!currentPlan) return [];

  const targetYear = currentPlan.year || (currentPlan.quarter.includes('/') ? parseInt(currentPlan.quarter.split('/')[1], 10) : new Date().getFullYear());

  const query = `
    SELECT 
      b.id as objectId,
      b.name as objectName,
      b.address as objectAddress,
      p2.id as otherPlanId,
      p2.ward as otherWard,
      p2.quarter as otherQuarter,
      p2.status as otherStatus
    FROM plan_items pi1
    JOIN business_objects b ON pi1.objectId = b.id
    JOIN plan_items pi2 ON b.id = pi2.objectId AND pi2.planId != ?
    JOIN plans p2 ON pi2.planId = p2.id AND p2.ward != ?
    WHERE pi1.planId = ?
      AND (p2.year = ? OR p2.quarter LIKE ?)
  `;

  return db.prepare(query).all(
    planId,
    currentPlan.ward,
    planId,
    targetYear,
    `%${targetYear}%`
  ) as any[];
}
