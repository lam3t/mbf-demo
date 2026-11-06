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
      const { status, ward, quarter, year, inspectionType, search, page = '1', limit = '50' } = req.query;
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

      if (inspectionType && inspectionType !== 'all') {
        whereClause += ' AND a.inspectionType = ?';
        params.push(inspectionType);
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
        whereClause += ' AND (b.name LIKE ? OR b.taxCode LIKE ? OR b.idNumber LIKE ? OR a.reason LIKE ? OR a.locationName LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term, term, term);
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
      const {
        objectId,
        locationId,
        locationName,
        inspectionType = 'adhoc',
        unitName,
        workflowCode,
        approvingDept,
        assignedApproverName,
        reason,
        inspectionContent,
        scheduledDate,
        relatedQuarter,
        relatedYear,
        ward
      } = req.body;
      const userId = req.user?.id || 1;
      const userRole = req.user?.role;
      const userWard = req.user?.unit;

      if (!objectId) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn cơ sở/đối tượng kiểm tra.' });
        return;
      }

      if (!reason || !reason.trim()) {
        res.status(400).json({ success: false, message: 'Vui lòng nhập lý do đề xuất kiểm tra đột xuất / theo yêu cầu nghiệp vụ.' });
        return;
      }

      // Find business object
      const obj = db.prepare('SELECT id, name, ward, address FROM business_objects WHERE id = ?').get(objectId) as { id: number; name: string; ward: string; address: string } | undefined;
      if (!obj) {
        res.status(404).json({ success: false, message: 'Không tìm thấy thông tin cơ sở/đối tượng kinh doanh.' });
        return;
      }

      const effectiveWard = (userRole === 'officer_ward' && userWard) ? userWard : (ward || obj.ward);
      const targetYear = relatedYear ? parseInt(relatedYear, 10) : new Date().getFullYear();
      const currentQuarterMonth = Math.ceil((new Date().getMonth() + 1) / 3);
      const targetQuarter = relatedQuarter || `Q${currentQuarterMonth}`;

      // Requirement #2 & #3: Check duplicate history -> Warn only, DO NOT block!
      // Allows re-inspecting an enterprise/facility already inspected by another unit previously if a professional requirement or ad-hoc need arises.
      const singleCheck = checkObjectSingleCheckRule(objectId, targetYear);

      let resolvedLocationName = locationName || null;
      if (locationId && !resolvedLocationName) {
        const locRow = db.prepare('SELECT name FROM business_locations WHERE id = ?').get(locationId) as { name: string } | undefined;
        if (locRow) resolvedLocationName = locRow.name;
      }

      const wfRow = workflowCode
        ? (db.prepare('SELECT * FROM unit_workflows WHERE code = ?').get(workflowCode) as any)
        : (db.prepare('SELECT * FROM unit_workflows WHERE inspectionType = ? ORDER BY id ASC LIMIT 1').get(inspectionType === 'professional_request' ? 'professional_request' : 'adhoc') as any);

      const resolvedUnitName = unitName || wfRow?.unitName || 'Phòng Cảnh sát PCCC & CNCH (PC07)';
      const resolvedWfCode = wfRow?.code || workflowCode || 'WF_PC07_ADHOC';
      const resolvedWfName = wfRow?.name || 'Quy trình Kiểm tra Đột xuất (PC07)';
      const resolvedApprovingDept = approvingDept || wfRow?.planApprovalDept || 'Ban Chỉ huy Phòng PC07';
      const resolvedApproverName = assignedApproverName || wfRow?.planApproverName || 'Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng PC07)';

      const stmt = db.prepare(`
        INSERT INTO adhoc_inspection_requests (
          objectId, locationId, locationName, wardRequestedBy, inspectionType,
          unitName, workflowCode, workflowName, approvingDept, assignedApproverName,
          reason, inspectionContent, scheduledDate,
          status, requestedBy, requestedAt, relatedQuarter, relatedYear, createdAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), ?, ?, datetime('now'))
      `);

      const result = stmt.run(
        objectId,
        locationId || null,
        resolvedLocationName,
        effectiveWard,
        inspectionType === 'professional_request' ? 'professional_request' : 'adhoc',
        resolvedUnitName,
        resolvedWfCode,
        resolvedWfName,
        resolvedApprovingDept,
        resolvedApproverName,
        reason.trim(),
        inspectionContent || reason.trim(),
        scheduledDate || new Date().toISOString().substring(0, 10),
        userId,
        targetQuarter,
        targetYear
      );

      const createdId = result.lastInsertRowid;

      res.status(201).json({
        success: true,
        message: singleCheck.hasWarning
          ? `Đã gửi đề xuất ${inspectionType === 'professional_request' ? 'kiểm tra theo yêu cầu nghiệp vụ' : 'kiểm tra đột xuất'} lên PA04 thành công (Ghi nhận kiểm tra lại theo chức năng/nhiệm vụ đơn vị).`
          : 'Đã gửi đề xuất kiểm tra phát sinh / nghiệp vụ lên PA04 xét duyệt thành công.',
        id: createdId,
        warningReason: singleCheck.warningReason || null
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 4. POST /api/adhoc-requests/:id/approve - PA04 Approves proposal & auto-creates inspection
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

      const wardCoords: Record<string, [number, number]> = {
        'Phường Hoàn Kiếm': [21.0285, 105.8520],
        'Phường Ba Đình': [21.0340, 105.8200],
        'Phường Đống Đa': [21.0150, 105.8280],
        'Phường Hai Bà Trưng': [21.0090, 105.8530],
        'Phường Cầu Giấy': [21.0330, 105.7900]
      };

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
        const objInfo = db.prepare('SELECT * FROM business_objects WHERE id = ?').get(adhocReq.objectId) as any;
        const locInfo = adhocReq.locationId
          ? (db.prepare('SELECT * FROM business_locations WHERE id = ?').get(adhocReq.locationId) as any)
          : (db.prepare('SELECT * FROM business_locations WHERE objectId = ? ORDER BY id ASC LIMIT 1').get(adhocReq.objectId) as any);

        const baseCoord = wardCoords[adhocReq.wardRequestedBy] || [21.0285, 105.8520];
        const lat = locInfo?.lat || (baseCoord[0] + ((adhocReq.objectId % 7) - 3) * 0.0014);
        const lng = locInfo?.lng || (baseCoord[1] + ((adhocReq.objectId % 5) - 2) * 0.0014);
        const inspType = adhocReq.inspectionType || 'adhoc';

        // 1. Create inspection record with isAdhoc = 1, planId = NULL
        const inspStmt = db.prepare(`
          INSERT INTO inspections (
            objectId, locationId, locationName, locationAddress, planId, inspectionType,
            inspectingUnit, scheduledDate, inspectionContent, workflowCode,
            status, ward, lat, lng, severity, dueDate, isOverdue, isLocked, isAdhoc, createdAt
          )
          VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 'not_started', ?, ?, ?, 1, ?, 0, 0, 1, datetime('now'))
        `);
        const inspResult = inspStmt.run(
          adhocReq.objectId,
          locInfo?.id || null,
          adhocReq.locationName || locInfo?.name || (objInfo ? `Cơ sở - ${objInfo.name}` : null),
          locInfo?.address || objInfo?.address || null,
          inspType,
          adhocReq.wardRequestedBy,
          adhocReq.scheduledDate || new Date().toISOString().substring(0, 10),
          adhocReq.inspectionContent || adhocReq.reason,
          inspType === 'professional_request' ? 'WF_PA04_FOREIGN' : 'WF_ADHOC_FAST',
          adhocReq.wardRequestedBy,
          lat,
          lng,
          inspDueDate
        );
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
        message: 'Phê duyệt đề xuất thành công. Đã tự động tạo hồ sơ kiểm tra thực địa.',
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
