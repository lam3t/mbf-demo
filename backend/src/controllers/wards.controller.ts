import { Request, Response } from 'express';
import { db } from '../db/connection';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export interface WardInfo {
  id: number;
  code: string;
  name: string;
  lat: number;
  lng: number;
  totalObjects: number;
  activeObjects: number;
  assignedQuota: number;
  totalInspections: number;
  completedInspections: number;
}

export const DEMO_WARDS = [
  { id: 1, code: 'HOAN_KIEM', name: 'Phường Hoàn Kiếm', lat: 21.0318, lng: 105.8528 },
  { id: 2, code: 'BA_DINH', name: 'Phường Ba Đình', lat: 21.0345, lng: 105.8320 },
  { id: 3, code: 'DONG_DA', name: 'Phường Đống Đa', lat: 21.0180, lng: 105.8270 },
  { id: 4, code: 'HAI_BA_TRUNG', name: 'Phường Hai Bà Trưng', lat: 21.0080, lng: 105.8510 },
  { id: 5, code: 'CAU_GIAY', name: 'Phường Cầu Giấy', lat: 21.0330, lng: 105.7860 }
];

export function resolveWard(wardParam?: string): typeof DEMO_WARDS[0] | undefined {
  if (!wardParam) return undefined;
  const decoded = decodeURIComponent(wardParam).trim();
  const parsedId = parseInt(decoded, 10);

  return DEMO_WARDS.find(w => 
    (!isNaN(parsedId) && w.id === parsedId) ||
    w.code.toLowerCase() === decoded.toLowerCase() ||
    w.name.toLowerCase() === decoded.toLowerCase() ||
    w.name.toLowerCase().includes(decoded.toLowerCase()) ||
    decoded.toLowerCase().includes(w.name.toLowerCase())
  );
}

export class WardsController {
  static getAll(req: Request, res: Response): void {
    try {
      const wardsData: WardInfo[] = DEMO_WARDS.map(w => {
        // Count objects
        const objectsCount = (db.prepare('SELECT COUNT(*) as count FROM business_objects WHERE ward = ?').get(w.name) as { count: number })?.count || 0;
        const activeCount = (db.prepare("SELECT COUNT(*) as count FROM business_objects WHERE ward = ? AND status = 'active'").get(w.name) as { count: number })?.count || 0;

        // Quota
        const quotaRow = db.prepare('SELECT maxCount FROM quota_configs WHERE ward = ? ORDER BY id DESC LIMIT 1').get(w.name) as { maxCount: number } | undefined;
        const assignedQuota = quotaRow ? quotaRow.maxCount : 50;

        // Inspections
        const totalInsp = (db.prepare('SELECT COUNT(*) as count FROM inspections WHERE ward = ?').get(w.name) as { count: number })?.count || 0;
        const completedInsp = (db.prepare("SELECT COUNT(*) as count FROM inspections WHERE ward = ? AND status = 'completed'").get(w.name) as { count: number })?.count || 0;

        return {
          id: w.id,
          code: w.code,
          name: w.name,
          lat: w.lat,
          lng: w.lng,
          totalObjects: objectsCount,
          activeObjects: activeCount,
          assignedQuota,
          totalInspections: totalInsp,
          completedInspections: completedInsp
        };
      });

      res.json({ success: true, data: wardsData });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getByIdOrCode(req: Request, res: Response): void {
    try {
      const { idOrCode } = req.params;
      const found = resolveWard(idOrCode);

      if (!found) {
        res.status(404).json({ success: false, message: 'Không tìm thấy thông tin phường.' });
        return;
      }

      const objectsCount = (db.prepare('SELECT COUNT(*) as count FROM business_objects WHERE ward = ?').get(found.name) as { count: number })?.count || 0;
      const activeCount = (db.prepare("SELECT COUNT(*) as count FROM business_objects WHERE ward = ? AND status = 'active'").get(found.name) as { count: number })?.count || 0;
      const quotaRow = db.prepare('SELECT maxCount FROM quota_configs WHERE ward = ? ORDER BY id DESC LIMIT 1').get(found.name) as { maxCount: number } | undefined;
      const assignedQuota = quotaRow ? quotaRow.maxCount : 50;
      const totalInsp = (db.prepare('SELECT COUNT(*) as count FROM inspections WHERE ward = ?').get(found.name) as { count: number })?.count || 0;
      const completedInsp = (db.prepare("SELECT COUNT(*) as count FROM inspections WHERE ward = ? AND status = 'completed'").get(found.name) as { count: number })?.count || 0;

      res.json({
        success: true,
        data: {
          id: found.id,
          code: found.code,
          name: found.name,
          lat: found.lat,
          lng: found.lng,
          totalObjects: objectsCount,
          activeObjects: activeCount,
          assignedQuota,
          totalInspections: totalInsp,
          completedInspections: completedInsp
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/wards/:wardId/inspection-alerts
   * Returns recent completed inspections of this ward with pass/fail checklist items,
   * business_notices metadata, and needsNoticeLetter flag.
   */
  static getInspectionAlerts(req: AuthenticatedRequest, res: Response): void {
    try {
      const { wardId } = req.params;
      const { filter = 'all' } = req.query; // 'all', 'needs_action', 'completed'

      // Role isolation: officer_ward is forced to their own unit
      let targetWardName: string | undefined;
      if (req.user?.role === 'officer_ward') {
        targetWardName = req.user.unit;
      } else {
        const found = resolveWard(wardId);
        targetWardName = found ? found.name : decodeURIComponent(wardId);
      }

      if (!targetWardName) {
        res.status(400).json({ success: false, message: 'Địa bàn phường không hợp lệ.' });
        return;
      }

      // 1. Fetch completed inspections of this ward
      const query = `
        SELECT 
          i.id as inspectionId,
          i.objectId,
          i.planId,
          i.ward,
          i.severity,
          i.status,
          i.completedAt,
          i.dueDate,
          i.recommendationNote,
          o.name as objectName,
          o.taxCode as objectTaxCode,
          o.address as objectAddress,
          o.type as objectType,
          o.representative as objectRepresentative,
          p.quarter as planQuarter,
          p.year as planYear,
          bn.id as noticeId,
          bn.method as noticeMethod,
          bn.sentAt as noticeSentAt,
          bn.note as noticeNote,
          bn.fileUrl as noticeFileUrl,
          u.fullName as noticeSentByName
        FROM inspections i
        JOIN business_objects o ON i.objectId = o.id
        JOIN plans p ON i.planId = p.id
        LEFT JOIN business_notices bn ON bn.inspectionId = i.id
        LEFT JOIN users u ON bn.sentByUserId = u.id
        WHERE i.ward = ? AND i.status = 'completed'
        ORDER BY i.completedAt DESC, i.id DESC
      `;

      const rows = db.prepare(query).all(targetWardName) as any[];

      // 2. Fetch all checklist items for these inspections
      const checklistStmt = db.prepare(`
        SELECT 
          ci.id,
          ci.inspectionId,
          ci.criteriaCode,
          ci.criteriaName,
          ci.result,
          ci.notes,
          d.id as domainId,
          d.code as domainCode,
          d.name as domainName,
          d.color as domainColor
        FROM inspection_checklist_items ci
        JOIN inspection_domains d ON ci.domainId = d.id
        WHERE ci.inspectionId = ?
        ORDER BY d.id ASC, ci.id ASC
      `);

      let totalCompleted = 0;
      let totalWithViolations = 0;
      let pendingNoticesCount = 0;
      let sentNoticesCount = 0;

      const items = rows.map(r => {
        totalCompleted++;
        const checklistItems = checklistStmt.all(r.inspectionId) as any[];

        const passItems = checklistItems.filter(c => c.result === 'pass');
        const failItems = checklistItems.filter(c => c.result === 'fail');

        const hasFailures = failItems.length > 0;
        if (hasFailures) {
          totalWithViolations++;
        }

        const hasNotice = !!r.noticeId;
        const needsNoticeLetter = hasFailures && !hasNotice;

        if (needsNoticeLetter) {
          pendingNoticesCount++;
        } else if (hasNotice) {
          sentNoticesCount++;
        }

        return {
          inspectionId: r.inspectionId,
          objectId: r.objectId,
          planId: r.planId,
          ward: r.ward,
          severity: r.severity,
          status: r.status,
          completedAt: r.completedAt,
          dueDate: r.dueDate,
          recommendationNote: r.recommendationNote,
          objectName: r.objectName,
          objectTaxCode: r.objectTaxCode,
          objectAddress: r.objectAddress,
          objectType: r.objectType,
          objectRepresentative: r.objectRepresentative,
          planQuarter: r.planQuarter,
          planYear: r.planYear,
          totalCriteria: checklistItems.length,
          passCount: passItems.length,
          failCount: failItems.length,
          passItems: passItems.map(p => ({
            id: p.id,
            criteriaCode: p.criteriaCode,
            criteriaName: p.criteriaName,
            domainCode: p.domainCode,
            domainName: p.domainName
          })),
          failItems: failItems.map(f => ({
            id: f.id,
            criteriaCode: f.criteriaCode,
            criteriaName: f.criteriaName,
            domainCode: f.domainCode,
            domainName: f.domainName,
            domainColor: f.domainColor,
            notes: f.notes
          })),
          hasNotice,
          needsNoticeLetter,
          notice: hasNotice ? {
            id: r.noticeId,
            method: r.noticeMethod,
            sentAt: r.noticeSentAt,
            note: r.noticeNote,
            fileUrl: r.noticeFileUrl,
            sentByName: r.noticeSentByName
          } : null
        };
      });

      // 3. Apply optional filtering
      let filteredItems = items;
      if (filter === 'needs_action') {
        filteredItems = items.filter(i => i.needsNoticeLetter);
      } else if (filter === 'completed') {
        filteredItems = items.filter(i => !i.needsNoticeLetter);
      }

      res.json({
        success: true,
        ward: targetWardName,
        summary: {
          totalCompleted,
          totalWithViolations,
          pendingNoticesCount,
          sentNoticesCount
        },
        data: filteredItems
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/wards/:wardId/inspection-alerts/:inspectionId/mark-notice-sent
   * Officer confirms notice letter was sent to business.
   * Inserts into business_notices, marks related alerts as read, and logs audit.
   */
  static markNoticeSent(req: AuthenticatedRequest, res: Response): void {
    try {
      const { wardId, inspectionId } = req.params;
      const { method = 'van_ban_giay', sentAt, note, fileUrl } = req.body;

      const inspIdNum = parseInt(inspectionId, 10);
      if (isNaN(inspIdNum)) {
        res.status(400).json({ success: false, message: 'ID hồ sơ kiểm tra không hợp lệ.' });
        return;
      }

      const insp = db.prepare(`
        SELECT i.*, o.name as objectName, o.taxCode as objectTaxCode
        FROM inspections i
        JOIN business_objects o ON i.objectId = o.id
        WHERE i.id = ?
      `).get(inspIdNum) as any;

      if (!insp) {
        res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ kiểm tra.' });
        return;
      }

      // Security check: officer_ward can only act on their own ward
      if (req.user?.role === 'officer_ward' && req.user.unit !== insp.ward) {
        res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật hồ sơ của phường khác.' });
        return;
      }

      // Validate method
      const validMethod = method === 'khac' ? 'khac' : 'van_ban_giay';
      const effectiveSentAt = sentAt || new Date().toISOString().replace('T', ' ').substring(0, 19);
      const userId = req.user?.id || 1;

      // Insert or replace notice
      const existingNotice = db.prepare('SELECT id FROM business_notices WHERE inspectionId = ?').get(inspIdNum) as { id: number } | undefined;

      let noticeId: number;
      if (existingNotice) {
        db.prepare(`
          UPDATE business_notices 
          SET sentByUserId = ?, method = ?, sentAt = ?, note = ?, fileUrl = ?
          WHERE id = ?
        `).run(userId, validMethod, effectiveSentAt, note || null, fileUrl || null, existingNotice.id);
        noticeId = existingNotice.id;
      } else {
        const insResult = db.prepare(`
          INSERT INTO business_notices (inspectionId, objectId, sentByUserId, method, sentAt, note, fileUrl)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(inspIdNum, insp.objectId, userId, validMethod, effectiveSentAt, note || null, fileUrl || null);
        noticeId = Number(insResult.lastInsertRowid);
      }

      // Automatically mark any pending alerts for this inspection as read
      db.prepare(`
        UPDATE alerts 
        SET isRead = 1 
        WHERE type = 'notice_letter_pending' AND relatedEntityId = ?
      `).run(inspIdNum);

      // Audit Log
      try {
        db.prepare(`
          INSERT INTO audit_logs (userId, action, entityType, entityId, detail)
          VALUES (?, 'MARK_NOTICE_SENT', 'inspection', ?, ?)
        `).run(userId, inspIdNum, `Đã xác nhận gửi văn bản thông báo cho cơ sở ${insp.objectName} (${validMethod === 'van_ban_giay' ? 'Văn bản giấy' : 'Hình thức khác'})`);
      } catch (logErr) {
        // ignore audit log failure
      }

      res.json({
        success: true,
        message: 'Xác nhận đã gửi văn bản thông báo cho doanh nghiệp thành công!',
        data: {
          noticeId,
          inspectionId: inspIdNum,
          objectId: insp.objectId,
          objectName: insp.objectName,
          ward: insp.ward,
          method: validMethod,
          sentAt: effectiveSentAt,
          note: note || '',
          fileUrl: fileUrl || '',
          needsNoticeLetter: false
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
