import { Request, Response } from 'express';
import { db } from '../db/connection';

const FIELD_LABELS: Record<string, string> = {
  id: 'Mã ID',
  name: 'Tên cơ sở / Tổ chức kinh doanh',
  type: 'Loại hình kinh doanh',
  taxCode: 'Mã số thuế',
  idNumber: 'Số CCCD / CMND',
  representative: 'Người đại diện / Chủ hộ',
  address: 'Địa chỉ kinh doanh',
  ward: 'Phường / Xã quản lý',
  status: 'Trạng thái',
  quarter: 'Quý áp dụng',
  year: 'Năm áp dụng',
  dueDate: 'Hạn hoàn thành / xử lý',
  isOverdue: 'Trạng thái quá hạn',
  isLocked: 'Khóa biên bản thực địa',
  isAdhoc: 'Kiểm tra phát sinh',
  severity: 'Mức độ vi phạm',
  recommendationNote: 'Ý kiến kiến nghị / xử lý',
  recommendationTags: 'Lĩnh vực kiến nghị',
  checklist: 'Tiêu chí kiểm tra',
  violationCodes: 'Hành vi vi phạm',
  evidenceFiles: 'Tệp bằng chứng kiểm tra',
  signedDocumentUrl: 'Văn bản scan có chữ ký & dấu',
  signedDocumentUploadedAt: 'Thời điểm upload văn bản',
  rejectReason: 'Lý do từ chối',
  reason: 'Lý do đề xuất kiểm tra phát sinh',
  wardRequestedBy: 'Phường đề xuất',
  relatedQuarter: 'Quý đề xuất',
  relatedYear: 'Năm đề xuất',
  minCount: 'Chỉ tiêu tối thiểu (Min)',
  maxCount: 'Chỉ tiêu tối đa (Max)',
  cutoffDateTime: 'Thời điểm chốt sổ (Cut-off)',
  username: 'Tên đăng nhập',
  fullName: 'Họ và tên cán bộ',
  role: 'Vai trò',
  unit: 'Đơn vị công tác',
  isActive: 'Trạng thái kích hoạt',
  code: 'Mã danh mục',
  method: 'Hình thức gửi thông báo',
  sentAt: 'Thời điểm gửi thông báo',
  note: 'Ghi chú thông báo',
  fileUrl: 'Đường dẫn tệp đính kèm'
};

const IGNORED_KEYS = new Set(['passwordHash', 'createdAt', 'updatedAt']);

export interface DiffItem {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
  oldDisplay: string;
  newDisplay: string;
  isChanged: boolean;
}

export class AuditController {
  /**
   * GET /api/audit-logs
   * Supports filtering by entityType, action, userId, and ward
   */
  static getAll(req: Request, res: Response): void {
    try {
      const { entityType, action, userId, ward, page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (entityType) {
        whereClause += ' AND a.entityType = ?';
        params.push(entityType);
      }
      if (action) {
        whereClause += ' AND a.action = ?';
        params.push(action);
      }
      if (userId) {
        whereClause += ' AND a.userId = ?';
        params.push(userId);
      }
      if (ward && ward !== 'all' && ward !== '') {
        whereClause += ' AND (a.ward = ? OR a.ward LIKE ?)';
        params.push(ward, `%${ward}%`);
      }

      const countStmt = db.prepare(`SELECT COUNT(*) as total FROM audit_logs a ${whereClause}`);
      const countRes = countStmt.get(...params) as { total: number };

      const query = `
        SELECT a.*, u.fullName as userName, u.username
        FROM audit_logs a
        LEFT JOIN users u ON a.userId = u.id
        ${whereClause}
        ORDER BY a.id DESC
        LIMIT ? OFFSET ?
      `;

      const data = db.prepare(query).all(...params, limitNum, offset);

      res.json({
        success: true,
        data,
        pagination: {
          total: countRes.total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(countRes.total / limitNum)
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/audit-logs/:id/diff
   * Returns visual field-by-field diff of beforeData vs afterData
   */
  static getDiff(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const logId = parseInt(id, 10);

      if (isNaN(logId)) {
        res.status(400).json({ success: false, message: 'ID nhật ký không hợp lệ.' });
        return;
      }

      const query = `
        SELECT a.*, u.fullName as userName, u.username
        FROM audit_logs a
        LEFT JOIN users u ON a.userId = u.id
        WHERE a.id = ?
      `;

      const log = db.prepare(query).get(logId) as any;

      if (!log) {
        res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi nhật ký.' });
        return;
      }

      let beforeObj: Record<string, any> = {};
      let afterObj: Record<string, any> = {};

      if (log.beforeData) {
        try {
          beforeObj = JSON.parse(log.beforeData);
        } catch {
          beforeObj = { raw: log.beforeData };
        }
      }

      if (log.afterData) {
        try {
          afterObj = JSON.parse(log.afterData);
        } catch {
          afterObj = { raw: log.afterData };
        }
      }

      // Collect all keys
      const allKeys = Array.from(
        new Set([...Object.keys(beforeObj || {}), ...Object.keys(afterObj || {})])
      ).filter(k => !IGNORED_KEYS.has(k));

      const formatDisplayValue = (val: any): string => {
        if (val === null || val === undefined) return '—';
        if (typeof val === 'boolean') return val ? 'Có / Đạt / Đúng' : 'Không / Chưa';
        if (typeof val === 'object') return JSON.stringify(val, null, 2);
        return String(val);
      };

      const diffList: DiffItem[] = [];

      for (const key of allKeys) {
        const oldVal = beforeObj[key];
        const newVal = afterObj[key];

        const oldJson = JSON.stringify(oldVal === undefined ? null : oldVal);
        const newJson = JSON.stringify(newVal === undefined ? null : newVal);
        const isChanged = oldJson !== newJson;

        diffList.push({
          field: key,
          label: FIELD_LABELS[key] || key,
          oldValue: oldVal ?? null,
          newValue: newVal ?? null,
          oldDisplay: formatDisplayValue(oldVal),
          newDisplay: formatDisplayValue(newVal),
          isChanged
        });
      }

      // Sort: changed fields first, then alphabetical by label
      diffList.sort((a, b) => {
        if (a.isChanged && !b.isChanged) return -1;
        if (!a.isChanged && b.isChanged) return 1;
        return a.label.localeCompare(b.label, 'vi');
      });

      const changedCount = diffList.filter(d => d.isChanged).length;

      res.json({
        success: true,
        log: {
          id: log.id,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          ward: log.ward,
          ipAddress: log.ipAddress,
          userName: log.userName || log.username || 'Hệ thống',
          createdAt: log.createdAt
        },
        summary: {
          totalFields: diffList.length,
          changedCount,
          isCreate: !log.beforeData && !!log.afterData,
          isDelete: !!log.beforeData && !log.afterData,
          isUpdate: !!log.beforeData && !!log.afterData
        },
        diff: diffList
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
