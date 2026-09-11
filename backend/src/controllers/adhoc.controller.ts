import { Request, Response } from 'express';
import { db } from '../db/connection';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { checkObjectSingleCheckRule } from '../utils/singleCheck';

export class AdhocController {
  /**
   * 1. GET /api/adhoc-requests - List ad-hoc inspection requests with filters & pagination
   */
  static getAll(req: AuthenticatedRequest, res: Response): void {
    try {
      const { status, ward, quarter, year, search, page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string, 10) || 1;
      const limitNum = parseInt(limit as string, 10) || 50;
      const offset = (pageNum - 1) * limitNum;

      const user = req.user;
      const effectiveWard = (user && user.role === 'officer_ward') ? user.unit : (ward as string | undefined);

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (effectiveWard) {
        whereClause += ' AND a.wardRequestedBy = ?';
        params.push(effectiveWard);
      }

      if (status && status !== 'all') {
        whereClause += ' AND a.status = ?';
        params.push(status);
      }

      if (quarter) {
        whereClause += ' AND a.relatedQuarter = ?';
        params.push(quarter);
      }

      if (year) {
        whereClause += ' AND a.relatedYear = ?';
        params.push(parseInt(year as string, 10));
      }

      if (search) {
        whereClause += ' AND (b.name LIKE ? OR b.taxCode LIKE ? OR b.idNumber LIKE ? OR a.reason LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term, term);
      }

      const countStmt = db.prepare(`
        SELECT COUNT(*) as total
        FROM adhoc_inspection_requests a
        JOIN business_objects b ON a.objectId = b.id
        ${whereClause}
      `);
      const countRes = countStmt.get(...params) as { total: number };

      const query = `
        SELECT a.*, 
               b.name as objectName, b.type as objectType, b.taxCode, b.idNumber, 
               b.address as objectAddress, b.representative, b.ward as objectWard,
               u1.fullName as requestedByName,
               u2.fullName as approvedByName
        FROM adhoc_inspection_requests a
        JOIN business_objects b ON a.objectId = b.id
        LEFT JOIN users u1 ON a.requestedBy = u1.id
        LEFT JOIN users u2 ON a.approvedBy = u2.id
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
   * 2. GET /api/adhoc-requests/:id - Single request details
   */
  static getById(req: AuthenticatedRequest, res: Response): void {
    try {
      const { id } = req.params;
      const query = `
        SELECT a.*, 
               b.name as objectName, b.type as objectType, b.taxCode, b.idNumber, 
               b.address as objectAddress, b.representative, b.ward as objectWard,
               u1.fullName as requestedByName,
               u2.fullName as approvedByName
        FROM adhoc_inspection_requests a
        JOIN business_objects b ON a.objectId = b.id
        LEFT JOIN users u1 ON a.requestedBy = u1.id
        LEFT JOIN users u2 ON a.approvedBy = u2.id
        WHERE a.id = ?
      `;

      const request = db.prepare(query).get(id);

      if (!request) {
        res.status(404).json({ success: false, message: 'Không tìm thấy đề xuất kiểm tra phát sinh.' });
        return;
      }

      res.json({ success: true, data: request });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 3. POST /api/adhoc-requests - Ward Officer creates ad-hoc inspection proposal with Single Check validation
   */
  static create(req: AuthenticatedRequest, res: Response): void {
    try {
      const { objectId, reason, relatedQuarter, relatedYear, ward } = req.body;
      const userId = req.user?.id || 1;
      const userRole = req.user?.role;
      const userWard = req.user?.unit;

      if (!objectId) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn cơ sở/đối tượng kiểm tra.' });
        return;
      }

      if (!reason || !reason.trim()) {
        res.status(400).json({ success: false, message: 'Vui lòng nhập lý do đề xuất kiểm tra đột xuất/phát sinh.' });
        return;
      }

      // Find business object
      const obj = db.prepare('SELECT id, name, ward FROM business_objects WHERE id = ?').get(objectId) as { id: number; name: string; ward: string } | undefined;
      if (!obj) {
        res.status(404).json({ success: false, message: 'Không tìm thấy thông tin cơ sở/đối tượng kinh doanh.' });
        return;
      }

      const effectiveWard = (userRole === 'officer_ward' && userWard) ? userWard : (ward || obj.ward);
      const targetYear = relatedYear ? parseInt(relatedYear, 10) : new Date().getFullYear();
      const currentQuarterMonth = Math.ceil((new Date().getMonth() + 1) / 3);
      const targetQuarter = relatedQuarter || `Q${currentQuarterMonth}`;

      // CR-01 / CR-11 / CR-10: Single Check validation across all quarters, other wards, and active ad-hoc requests
      const singleCheck = checkObjectSingleCheckRule(objectId, targetYear);
      if (singleCheck.isBlocked && singleCheck.blockReason) {
        res.status(409).json({
          success: false,
          message: singleCheck.blockReason,
          conflictType: singleCheck.conflictType,
          objectId
        });
        return;
      }

      const stmt = db.prepare(`
        INSERT INTO adhoc_inspection_requests (
          objectId, wardRequestedBy, reason, status, requestedBy, requestedAt, relatedQuarter, relatedYear, createdAt
        )
        VALUES (?, ?, ?, 'pending', ?, datetime('now'), ?, ?, datetime('now'))
      `);

      const result = stmt.run(
        objectId,
        effectiveWard,
        reason.trim(),
        userId,
        targetQuarter,
        targetYear
      );

      const createdId = result.lastInsertRowid;

      res.status(201).json({
        success: true,
        message: 'Đã gửi đề xuất kiểm tra phát sinh lên PA04 xét duyệt thành công.',
        id: createdId
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 4. POST /api/adhoc-requests/:id/approve - PA04 Approves proposal & auto-creates inspection with isAdhoc=1
   */
  static approve(req: AuthenticatedRequest, res: Response): void {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 1;

      const adhocReq = db.prepare('SELECT * FROM adhoc_inspection_requests WHERE id = ?').get(id) as any;
      if (!adhocReq) {
        res.status(404).json({ success: false, message: 'Không tìm thấy đề xuất kiểm tra phát sinh.' });
        return;
      }

      if (adhocReq.status !== 'pending') {
        res.status(400).json({ success: false, message: `Đề xuất này đã ở trạng thái ${adhocReq.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}, không thể phê duyệt lại.` });
        return;
      }

      // Calculate deadline for inspection = now + N days (from system_configs, default 30)
      const deadlineRow = db.prepare("SELECT value FROM system_configs WHERE key = 'inspectionDeadlineDays'").get() as { value: string } | undefined;
      const deadlineDays = deadlineRow ? parseInt(deadlineRow.value, 10) || 30 : 30;
      const dueTimestamp = new Date();
      dueTimestamp.setDate(dueTimestamp.getDate() + deadlineDays);
      const inspDueDate = dueTimestamp.toISOString().replace('T', ' ').substring(0, 19);

      const defaultCriteria = [
        { domainId: 1, criteriaCode: 'pccc_1', criteriaName: 'Trang bị bình chữa cháy còn hạn & tiêu lệnh PCCC' },
        { domainId: 1, criteriaCode: 'pccc_2', criteriaName: 'Lối thoát nạn & hành lang thoát hiểm thông thoáng' },
        { domainId: 2, criteriaCode: 'attp_1', criteriaName: 'Giấy chứng nhận cơ sở đủ điều kiện ATTP / Cam kết ATTP' },
        { domainId: 2, criteriaCode: 'attp_2', criteriaName: 'Nguồn gốc nguyên liệu & điều kiện vệ sinh bảo quản' },
        { domainId: 3, criteriaCode: 'env_1', criteriaName: 'Thu gom, phân loại & xử lý rác thải / nước thải đúng quy định' },
        { domainId: 3, criteriaCode: 'env_2', criteriaName: 'Không gây ô nhiễm tiếng ồn, khói bụi vượt quy chuẩn' },
        { domainId: 4, criteriaCode: 'ttdt_1', criteriaName: 'Không lấn chiếm lòng lề đường, vỉa hè, hành lang an toàn' },
        { domainId: 4, criteriaCode: 'ttdt_2', criteriaName: 'Biển hiệu, bảng quảng cáo đúng quy chuẩn cấp phép' },
        { domainId: 5, criteriaCode: 'tax_1', criteriaName: 'Đăng ký kinh doanh & niêm yết giá công khai' },
        { domainId: 5, criteriaCode: 'tax_2', criteriaName: 'Kê khai & thực hiện đầy đủ nghĩa vụ thuế / hóa đơn' }
      ];

      const approveTx = db.transaction(() => {
        // 1. Create inspection record with isAdhoc = 1, planId = NULL
        const inspStmt = db.prepare(`
          INSERT INTO inspections (objectId, planId, status, ward, severity, dueDate, isOverdue, isLocked, isAdhoc, createdAt)
          VALUES (?, NULL, 'not_started', ?, 1, ?, 0, 0, 1, datetime('now'))
        `);
        const inspResult = inspStmt.run(adhocReq.objectId, adhocReq.wardRequestedBy, inspDueDate);
        const newInspectionId = inspResult.lastInsertRowid;

        // 2. Populate standard checklist items
        const insertItem = db.prepare(`
          INSERT INTO inspection_checklist_items (inspectionId, domainId, criteriaCode, criteriaName, result, notes)
          VALUES (?, ?, ?, ?, 'pass', '')
        `);
        for (const c of defaultCriteria) {
          insertItem.run(newInspectionId, c.domainId, c.criteriaCode, c.criteriaName);
        }

        // 3. Update adhoc request
        db.prepare(`
          UPDATE adhoc_inspection_requests
          SET status = 'approved', approvedBy = ?, approvedAt = datetime('now'), inspectionId = ?
          WHERE id = ?
        `).run(userId, newInspectionId, id);

        return newInspectionId;
      });

      const inspectionId = approveTx();

      res.json({
        success: true,
        message: 'Phê duyệt đề xuất kiểm tra phát sinh thành công. Đã tự động tạo hồ sơ kiểm tra thực địa.',
        inspectionId
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 5. POST /api/adhoc-requests/:id/reject - PA04 Rejects proposal with mandatory rejectReason
   */
  static reject(req: AuthenticatedRequest, res: Response): void {
    try {
      const { id } = req.params;
      const { rejectReason } = req.body;
      const userId = req.user?.id || 1;

      if (!rejectReason || !rejectReason.trim()) {
        res.status(400).json({ success: false, message: 'Vui lòng nhập lý do từ chối đề xuất kiểm tra phát sinh.' });
        return;
      }

      const adhocReq = db.prepare('SELECT * FROM adhoc_inspection_requests WHERE id = ?').get(id) as any;
      if (!adhocReq) {
        res.status(404).json({ success: false, message: 'Không tìm thấy đề xuất kiểm tra phát sinh.' });
        return;
      }

      if (adhocReq.status !== 'pending') {
        res.status(400).json({ success: false, message: `Đề xuất này đã ở trạng thái ${adhocReq.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}, không thể từ chối lại.` });
        return;
      }

      db.prepare(`
        UPDATE adhoc_inspection_requests
        SET status = 'rejected', rejectReason = ?, approvedBy = ?, approvedAt = datetime('now')
        WHERE id = ?
      `).run(rejectReason.trim(), userId, id);

      res.json({
        success: true,
        message: 'Đã từ chối đề xuất kiểm tra phát sinh.'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
