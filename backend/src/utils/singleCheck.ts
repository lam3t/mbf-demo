import { db } from '../db/connection';

export interface SingleCheckResult {
  isBlocked: boolean;
  blockReason: string | null;
  conflictType?: 'COMPLETED_INSPECTION' | 'EXISTING_PLAN' | 'EXISTING_ADHOC_REQUEST';
  completedAt?: string;
  planId?: number;
  planQuarter?: string;
  planYear?: number;
  planWard?: string;
  planStatus?: string;
  adhocRequestId?: number;
  adhocStatus?: string;
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
 * Checks whether an object is blocked by Single Check rule in the specified year.
 * @param objectId The Business Object ID
 * @param targetYear The year to check (e.g. 2026)
 * @param excludePlanId Optional planId to exclude (e.g. when updating items in the same plan)
 * @param excludeAdhocId Optional adhocId to exclude (e.g. when updating an adhoc request)
 */
export function checkObjectSingleCheckRule(
  objectId: number,
  targetYear: number = new Date().getFullYear(),
  excludePlanId?: number,
  excludeAdhocId?: number
): SingleCheckResult {
  const currentYearStr = targetYear.toString();

  // 1. Check if object has completed inspection in targetYear
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
      blockReason: `Doanh nghiệp/đối tượng này đã hoàn thành kiểm tra${dateText}${wardText} - Không được phép thêm mới theo nguyên tắc 1 năm/1 lần.`,
      completedAt: completed.completedAt,
      planQuarter: completed.quarter,
      planYear: completed.year || targetYear,
      planWard: completed.ward
    };
  }

  // 2. Check if object is in any plan with status IN ('pending', 'approved') in targetYear
  let planQuery = `
    SELECT p.id, p.ward, p.quarter, p.year, p.status
    FROM plan_items pi
    JOIN plans p ON pi.planId = p.id
    WHERE pi.objectId = ? AND p.status IN ('pending', 'approved')
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
      isBlocked: true,
      conflictType: 'EXISTING_PLAN',
      blockReason: `Doanh nghiệp/đối tượng này đã được lên kế hoạch kiểm tra trong ${qText} bởi ${existingPlan.ward} - Không được phép thêm mới theo nguyên tắc 1 năm/1 lần.`,
      planId: existingPlan.id,
      planQuarter: existingPlan.quarter,
      planYear: existingPlan.year || targetYear,
      planWard: existingPlan.ward,
      planStatus: existingPlan.status
    };
  }

  // 3. Check if object has active ad-hoc request (pending or approved) in targetYear
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
        isBlocked: true,
        conflictType: 'EXISTING_ADHOC_REQUEST',
        blockReason: `Doanh nghiệp/đối tượng này đã có đề xuất kiểm tra phát sinh (${statusText}) tại ${existingAdhoc.wardRequestedBy} (${qText}) - Không được phép thêm mới theo nguyên tắc 1 năm/1 lần.`,
        adhocRequestId: existingAdhoc.id,
        adhocStatus: existingAdhoc.status,
        planQuarter: existingAdhoc.relatedQuarter,
        planYear: existingAdhoc.relatedYear || targetYear,
        planWard: existingAdhoc.wardRequestedBy
      };
    }
  } catch (err) {
    // Table might not be created during early bootstrap; safely ignore
  }

  return {
    isBlocked: false,
    blockReason: null
  };
}
