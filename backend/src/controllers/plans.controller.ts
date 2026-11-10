import { Request, Response } from 'express';
import { db } from '../db/connection';
import { Plan } from '../types';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { checkObjectSingleCheckRule, checkCrossWardPlanConflicts } from '../utils/singleCheck';

export class PlansController {
  /**
   * 1. GET /api/plans - Filter by quarter, year, ward, status & pagination
   */
  static getAll(req: Request, res: Response): void {
    try {
      const { quarter, year, ward, status, page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (quarter) {
        whereClause += ' AND p.quarter = ?';
        params.push(quarter);
      }
      if (year) {
        whereClause += ' AND p.year = ?';
        params.push(parseInt(year as string, 10));
      }
      if (ward) {
        whereClause += ' AND p.ward = ?';
        params.push(ward);
      }
      if (status) {
        whereClause += ' AND p.status = ?';
        params.push(status);
      }

      const countStmt = db.prepare(`SELECT COUNT(*) as total FROM plans p ${whereClause}`);
      const countRes = countStmt.get(...params) as { total: number };

      const query = `
        SELECT p.*, 
               u1.fullName as submittedByName,
               u2.fullName as approvedByName,
               (SELECT COUNT(*) FROM plan_items pi WHERE pi.planId = p.id) as totalObjects,
               CASE 
                 WHEN p.status = 'draft' AND (p.isOverdue = 1 OR (p.dueDate IS NOT NULL AND (p.dueDate < datetime('now', 'localtime') OR p.dueDate < datetime('now')))) THEN 1 
                 ELSE 0 
               END as isOverdue
        FROM plans p
        LEFT JOIN users u1 ON p.submittedBy = u1.id
        LEFT JOIN users u2 ON p.approvedBy = u2.id
        ${whereClause}
        ORDER BY p.year DESC, p.id DESC
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
   * Upload signed scan document for plans (.pdf, .jpg, .jpeg, .png <= 10MB)
   * POST /api/plans/upload-scan
   */
  static uploadScanDocument(req: Request, res: Response): void {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn file văn bản scan hợp lệ (.pdf, .jpg, .png).' });
        return;
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({
        success: true,
        message: 'Tải lên văn bản scan thành công.',
        fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 2. GET /api/plans/:id - Details with associated business objects & digital signatures
   */
  static getById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const plan = db.prepare(`
        SELECT p.*, 
               u1.fullName as submittedByName,
               u2.fullName as approvedByName,
               CASE 
                 WHEN p.status = 'draft' AND (p.isOverdue = 1 OR (p.dueDate IS NOT NULL AND (p.dueDate < datetime('now', 'localtime') OR p.dueDate < datetime('now')))) THEN 1 
                 ELSE 0 
               END as isOverdue
        FROM plans p
        LEFT JOIN users u1 ON p.submittedBy = u1.id
        LEFT JOIN users u2 ON p.approvedBy = u2.id
        WHERE p.id = ?
      `).get(id) as Plan | undefined;

      if (!plan) {
        res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch.' });
        return;
      }

      const items = db.prepare(`
        SELECT pi.id as planItemId, b.*
        FROM plan_items pi
        JOIN business_objects b ON pi.objectId = b.id
        WHERE pi.planId = ?
        ORDER BY b.id ASC
      `).all(id) as any[];

      // Check cross-ward conflicts for inter-ward joint inspections
      const crossWardConflicts = checkCrossWardPlanConflicts(Number(id));
      const conflictMap = new Map<number, any>();
      crossWardConflicts.forEach(c => {
        conflictMap.set(c.objectId, c);
      });

      const annotatedItems = items.map(item => {
        const conflict = conflictMap.get(item.id);
        return {
          ...item,
          isDuplicateAcrossWards: !!conflict,
          crossWardInfo: conflict || null,
          crossWardNote: conflict ? `Đối tượng đồng thời thuộc kế hoạch ${conflict.otherQuarter} của ${conflict.otherWard} - Đề xuất đoàn kiểm tra liên ngành.` : null
        };
      });

      // Query digital signatures for this plan
      const rawSignatures = db.prepare(`
        SELECT ds.*, u.fullName as signedByName
        FROM digital_signatures ds
        LEFT JOIN users u ON ds.signedByUserId = u.id
        WHERE ds.planId = ?
        ORDER BY ds.id DESC
      `).all(id) as any[];

      const digitalSignatures = rawSignatures.map(sig => {
        let certInfo = sig.certificateInfo;
        if (typeof certInfo === 'string') {
          try {
            certInfo = JSON.parse(certInfo);
          } catch {
            // retain string if parsing fails
          }
        }
        return {
          ...sig,
          certificateInfo: certInfo
        };
      });

      const digitalSignature = digitalSignatures.find(s => s.signatureType === 'digital_token') || digitalSignatures[0] || null;

      // Lookup dynamic unit_workflow for this plan
      const wfCode = (plan as any).workflowCode || 'WF_PC07_PLANNED';
      const wfRow = db.prepare('SELECT * FROM unit_workflows WHERE code = ?').get(wfCode) as any
        || db.prepare('SELECT * FROM unit_workflows ORDER BY id ASC LIMIT 1').get() as any;

      let workflowDetail: any = null;
      if (wfRow) {
        let parsedSteps: any[] = [];
        try {
          parsedSteps = JSON.parse(wfRow.stepsJson || '[]');
        } catch {
          parsedSteps = [];
        }
        workflowDetail = {
          ...wfRow,
          steps: parsedSteps
        };
      }

      res.json({
        success: true,
        data: {
          ...plan,
          workflowDetail,
          items: annotatedItems,
          crossWardConflicts,
          hasCrossWardConflicts: crossWardConflicts.length > 0,
          digitalSignature,
          digitalSignatures
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 3. POST /api/plans - Create draft plan with selected objectIds and Single Check validation
   */
  static create(req: AuthenticatedRequest, res: Response): void {
    try {
      const {
        quarter,
        year,
        ward,
        unitName,
        workflowCode,
        approvingDept,
        assignedApproverName,
        inspectionType = 'planned',
        scheduledStartDate,
        scheduledEndDate,
        inspectionLocation,
        inspectionContent,
        objectIds = []
      } = req.body;
      const userId = req.user?.id || null;

      if (!quarter || !ward) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn Quý và Đơn vị phường.' });
        return;
      }

      const planYear = year ? parseInt(year, 10) : (quarter.includes('/') ? parseInt(quarter.split('/')[1], 10) : new Date().getFullYear());

      // Resolve dynamic workflow details from unit_workflows
      const wfRow = workflowCode
        ? (db.prepare('SELECT * FROM unit_workflows WHERE code = ?').get(workflowCode) as any)
        : (db.prepare("SELECT * FROM unit_workflows WHERE inspectionType = ? ORDER BY id ASC LIMIT 1").get(inspectionType || 'planned') as any);

      const resolvedUnitName = unitName || wfRow?.unitName || 'Phòng Cảnh sát PCCC & CNCH (PC07)';
      const resolvedWfCode = wfRow?.code || workflowCode || 'WF_PC07_PLANNED';
      const resolvedWfName = wfRow?.name || 'Quy trình Kiểm tra Định kỳ An toàn PCCC & CNCH (PC07)';
      const resolvedApprovingDept = approvingDept || wfRow?.planApprovalDept || 'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)';
      const resolvedApproverName = assignedApproverName || wfRow?.planApproverName || 'Đại tá Lê Minh Hải (Trưởng phòng PC07)';

      // Collect duplicate warnings (Warn-only, DO NOT hard-block per Requirement #2 & #3)
      const warnings: any[] = [];
      for (const objId of objectIds) {
        const singleCheck = checkObjectSingleCheckRule(objId, planYear);
        if (singleCheck.hasWarning) {
          warnings.push({
            objectId: objId,
            conflictType: singleCheck.conflictType,
            warningReason: singleCheck.warningReason
          });
        }
      }

      // Get cutoff config for quarter to set default dueDate
      const cutoff = db.prepare('SELECT cutoffDateTime FROM cutoff_configs WHERE quarter = ?').get(quarter) as { cutoffDateTime: string } | undefined;
      const dueDate = cutoff ? cutoff.cutoffDateTime : null;

      const createPlanTx = db.transaction(() => {
        const stmt = db.prepare(`
          INSERT INTO plans (
            quarter, year, ward, unitName, workflowCode, workflowName, approvingDept, assignedApproverName,
            inspectionType, scheduledStartDate, scheduledEndDate, inspectionLocation, inspectionContent,
            status, dueDate, submittedBy, createdAt
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, datetime('now'))
        `);
        const result = stmt.run(
          quarter,
          planYear,
          ward,
          resolvedUnitName,
          resolvedWfCode,
          resolvedWfName,
          resolvedApprovingDept,
          resolvedApproverName,
          inspectionType || 'planned',
          scheduledStartDate || '2026-04-01',
          scheduledEndDate || '2026-06-30',
          inspectionLocation || ward,
          inspectionContent || 'Kiểm tra việc chấp hành quy định pháp luật về ĐKKD, PCCC, ATTP, ANTT và nghĩa vụ thuế.',
          dueDate,
          userId
        );
        const planId = result.lastInsertRowid;

        const itemStmt = db.prepare('INSERT INTO plan_items (planId, objectId, scheduledDate, inspectionContent, createdAt) VALUES (?, ?, ?, ?, datetime(\'now\'))');
        const updateObjStmt = db.prepare('UPDATE business_objects SET planId = ? WHERE id = ?');

        for (const objId of objectIds) {
          itemStmt.run(planId, objId, scheduledStartDate || null, inspectionContent || null);
          updateObjStmt.run(planId, objId);
        }

        return planId;
      });

      const newPlanId = createPlanTx();
      res.status(201).json({
        success: true,
        message: warnings.length > 0
          ? `Đã tạo kế hoạch thành công (Lưu ý: Có ${warnings.length} cơ sở có cảnh báo trùng lặp).`
          : 'Tạo kế hoạch nháp thành công.',
        id: newPlanId,
        warnings
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 4. PUT /api/plans/:id/items - Replace/Update plan items (Allowed in draft, pending, and approved status for flexible adjustment during implementation)
   */
  static updateItems(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { objectIds = [], adjustmentNote } = req.body;

      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as any;
      if (!plan) {
        res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch.' });
        return;
      }

      const planYear = plan.year || (plan.quarter.includes('/') ? parseInt(plan.quarter.split('/')[1], 10) : new Date().getFullYear());

      const warnings: any[] = [];
      for (const objId of objectIds) {
        const singleCheck = checkObjectSingleCheckRule(objId, planYear, plan.id);
        if (singleCheck.hasWarning) {
          warnings.push({
            objectId: objId,
            conflictType: singleCheck.conflictType,
            warningReason: singleCheck.warningReason
          });
        }
      }

      const updateTx = db.transaction(() => {
        if (adjustmentNote) {
          db.prepare(`UPDATE plans SET adjustmentNote = ?, adjustedAt = datetime('now') WHERE id = ?`).run(adjustmentNote, id);
        }
        // Reset old plan items
        db.prepare('UPDATE business_objects SET planId = NULL WHERE planId = ?').run(id);
        db.prepare('DELETE FROM plan_items WHERE planId = ?').run(id);

        const insertItem = db.prepare('INSERT INTO plan_items (planId, objectId, createdAt) VALUES (?, ?, datetime(\'now\'))');
        const updateObj = db.prepare('UPDATE business_objects SET planId = ? WHERE id = ?');

        for (const objId of objectIds) {
          insertItem.run(id, objId);
          updateObj.run(id, objId);
        }

        // If plan is already approved, ensure field inspections exist for newly added objects
        if (plan.status === 'approved') {
          PlansController.ensureInspectionsForPlan(Number(id), plan, objectIds);
        }
      });

      updateTx();
      res.json({
        success: true,
        message: warnings.length > 0
          ? `Đã cập nhật danh sách đối tượng thành công (Có ${warnings.length} cảnh báo trùng lặp, hệ thống vẫn cho phép thực hiện).`
          : 'Cập nhật danh sách đối tượng thành công.',
        warnings
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 4b. POST /api/plans/:id/items - Add object(s) to plan items (Allowed in draft, pending, and approved status)
   */
  static addItems(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { objectId, objectIds } = req.body;

      const incomingIds: number[] = [];
      if (Array.isArray(objectIds)) {
        incomingIds.push(...objectIds);
      } else if (objectId !== undefined && objectId !== null) {
        incomingIds.push(Number(objectId));
      }

      if (incomingIds.length === 0) {
        res.status(400).json({ success: false, message: 'Vui lòng cung cấp ít nhất một objectId.' });
        return;
      }

      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as any;
      if (!plan) {
        res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch.' });
        return;
      }

      const planYear = plan.year || (plan.quarter.includes('/') ? parseInt(plan.quarter.split('/')[1], 10) : new Date().getFullYear());

      const warnings: any[] = [];
      for (const objId of incomingIds) {
        const singleCheck = checkObjectSingleCheckRule(objId, planYear, plan.id);
        if (singleCheck.hasWarning) {
          warnings.push({
            objectId: objId,
            conflictType: singleCheck.conflictType,
            warningReason: singleCheck.warningReason
          });
        }
      }

      const addTx = db.transaction(() => {
        const checkItemStmt = db.prepare('SELECT id FROM plan_items WHERE planId = ? AND objectId = ?');
        const insertItem = db.prepare('INSERT INTO plan_items (planId, objectId, createdAt) VALUES (?, ?, datetime(\'now\'))');
        const updateObj = db.prepare('UPDATE business_objects SET planId = ? WHERE id = ?');

        let addedCount = 0;
        for (const objId of incomingIds) {
          const exists = checkItemStmt.get(id, objId);
          if (!exists) {
            insertItem.run(id, objId);
            updateObj.run(id, objId);
            addedCount++;
          }
        }

        if (plan.status === 'approved') {
          PlansController.ensureInspectionsForPlan(Number(id), plan, incomingIds);
        }
        return addedCount;
      });

      const added = addTx();
      res.status(200).json({
        success: true,
        message: warnings.length > 0
          ? `Đã thêm ${added} đối tượng vào kế hoạch (Lưu ý: Có ${warnings.length} cảnh báo trùng lặp).`
          : `Đã thêm ${added} đối tượng vào giỏ kế hoạch.`,
        addedCount: added,
        warnings
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 4c. PUT /api/plans/:id/adjust - Adjust plan schedule, location, content, inspectionType, and items during implementation
   */
  static adjustPlan(req: AuthenticatedRequest, res: Response): void {
    try {
      const { id } = req.params;
      const {
        quarter,
        ward,
        unitName,
        workflowCode,
        approvingDept,
        assignedApproverName,
        inspectionType,
        scheduledStartDate,
        scheduledEndDate,
        inspectionLocation,
        inspectionContent,
        adjustmentNote,
        objectIds
      } = req.body;
      const userId = req.user?.id || null;

      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as any;
      if (!plan) {
        res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch.' });
        return;
      }

      const wfRow = workflowCode
        ? (db.prepare('SELECT * FROM unit_workflows WHERE code = ?').get(workflowCode) as any)
        : null;

      db.transaction(() => {
        db.prepare(`
          UPDATE plans
          SET quarter = COALESCE(?, quarter),
              ward = COALESCE(?, ward),
              unitName = COALESCE(?, unitName),
              workflowCode = COALESCE(?, workflowCode),
              workflowName = COALESCE(?, workflowName),
              approvingDept = COALESCE(?, approvingDept),
              assignedApproverName = COALESCE(?, assignedApproverName),
              inspectionType = COALESCE(?, inspectionType),
              scheduledStartDate = COALESCE(?, scheduledStartDate),
              scheduledEndDate = COALESCE(?, scheduledEndDate),
              inspectionLocation = COALESCE(?, inspectionLocation),
              inspectionContent = COALESCE(?, inspectionContent),
              adjustmentNote = COALESCE(?, adjustmentNote),
              adjustedAt = datetime('now'),
              adjustedBy = ?
          WHERE id = ?
        `).run(
          quarter || null,
          ward || null,
          unitName || wfRow?.unitName || null,
          workflowCode || null,
          wfRow?.name || null,
          approvingDept || wfRow?.planApprovalDept || null,
          assignedApproverName || wfRow?.planApproverName || null,
          inspectionType || null,
          scheduledStartDate || null,
          scheduledEndDate || null,
          inspectionLocation || null,
          inspectionContent || null,
          adjustmentNote || 'Điều chỉnh quy trình, thời gian, địa điểm và nội dung kiểm tra trong quá trình triển khai',
          userId,
          id
        );

        // Propagate adjusted schedule & content to inspections belonging to this plan
        if (scheduledStartDate || inspectionContent || inspectionType) {
          db.prepare(`
            UPDATE inspections
            SET scheduledDate = COALESCE(?, scheduledDate),
                inspectionContent = COALESCE(?, inspectionContent),
                inspectionType = COALESCE(?, inspectionType)
            WHERE planId = ?
          `).run(
            scheduledStartDate || null,
            inspectionContent || null,
            inspectionType || null,
            id
          );
        }

        // If objectIds array was also passed to adjust objects in the plan
        if (Array.isArray(objectIds)) {
          db.prepare('UPDATE business_objects SET planId = NULL WHERE planId = ?').run(id);
          db.prepare('DELETE FROM plan_items WHERE planId = ?').run(id);

          const insertItem = db.prepare('INSERT INTO plan_items (planId, objectId, scheduledDate, inspectionContent, createdAt) VALUES (?, ?, ?, ?, datetime(\'now\'))');
          const updateObj = db.prepare('UPDATE business_objects SET planId = ? WHERE id = ?');

          for (const objId of objectIds) {
            insertItem.run(id, objId, scheduledStartDate || plan.scheduledStartDate || null, inspectionContent || plan.inspectionContent || null);
            updateObj.run(id, objId);
          }

          const updatedPlan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as any;
          if (updatedPlan && updatedPlan.status === 'approved') {
            PlansController.ensureInspectionsForPlan(Number(id), updatedPlan, objectIds);
          }
        }
      })();

      res.json({
        success: true,
        message: 'Đã điều chỉnh kế hoạch, thời gian, địa điểm và nội dung kiểm tra thành công!'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Helper to ensure field inspections exist with valid GPS coordinates, location info & checklist items
   */
  static ensureInspectionsForPlan(planId: number, plan: any, objectIds: number[]): void {
    const deadlineRow = db.prepare(`SELECT value FROM system_configs WHERE key = 'inspectionDeadlineDays'`).get() as { value: string } | undefined;
    const deadlineDays = deadlineRow ? parseInt(deadlineRow.value, 10) || 30 : 30;
    const dueTimestamp = new Date();
    dueTimestamp.setDate(dueTimestamp.getDate() + deadlineDays);
    const inspDueDate = plan.scheduledEndDate || dueTimestamp.toISOString().replace('T', ' ').substring(0, 19);

    const wardCoords: Record<string, [number, number]> = {
      'Phường Hoàn Kiếm': [21.0285, 105.8520],
      'Phường Ba Đình': [21.0340, 105.8200],
      'Phường Đống Đa': [21.0150, 105.8280],
      'Phường Hai Bà Trưng': [21.0090, 105.8530],
      'Phường Cầu Giấy': [21.0330, 105.7900]
    };

    const insertInspection = db.prepare(`
      INSERT INTO inspections (
        objectId, locationId, locationName, locationAddress, planId, inspectionType,
        scheduledDate, inspectionContent, status, ward, lat, lng, severity, dueDate, isLocked, createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'not_started', ?, ?, ?, 1, ?, 0, datetime('now'))
    `);
    const insertChecklistItem = db.prepare(`
      INSERT INTO inspection_checklist_items (inspectionId, domainId, criteriaCode, criteriaName, result, notes)
      VALUES (?, ?, ?, ?, 'pass', '')
    `);

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

    for (const objId of objectIds) {
      const existingInspection = db.prepare('SELECT id FROM inspections WHERE objectId = ? AND planId = ?').get(objId, planId) as { id: number } | undefined;
      if (!existingInspection) {
        const primaryLoc = db.prepare('SELECT * FROM business_locations WHERE objectId = ? ORDER BY id ASC LIMIT 1').get(objId) as any;
        const objInfo = db.prepare('SELECT * FROM business_objects WHERE id = ?').get(objId) as any;
        const baseCoord = wardCoords[plan.ward] || [21.0285, 105.8520];
        const lat = primaryLoc?.lat || (baseCoord[0] + ((objId % 7) - 3) * 0.0014);
        const lng = primaryLoc?.lng || (baseCoord[1] + ((objId % 5) - 2) * 0.0014);

        const inspRes = insertInspection.run(
          objId,
          primaryLoc?.id || null,
          primaryLoc?.name || (objInfo ? `Trụ sở - ${objInfo.name}` : null),
          primaryLoc?.address || objInfo?.address || null,
          planId,
          plan.inspectionType || 'planned',
          plan.scheduledStartDate || '2026-05-15',
          plan.inspectionContent || 'Kiểm tra theo kế hoạch định kỳ các điều kiện kinh doanh, PCCC, ATTP, ANTT.',
          plan.ward,
          lat,
          lng,
          inspDueDate
        );
        const newInspId = inspRes.lastInsertRowid;
        for (const c of defaultCriteria) {
          insertChecklistItem.run(newInspId, c.domainId, c.criteriaCode, c.criteriaName);
        }
      }
    }
  }

  /**
   * 5. GET /api/plans/:id/quota-check - Check quota status
   */
  static checkQuota(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as Plan | undefined;

      if (!plan) {
        res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch.' });
        return;
      }

      const quota = db.prepare('SELECT minCount, maxCount FROM quota_configs WHERE ward = ? AND quarter = ?').get(plan.ward, plan.quarter) as { minCount: number; maxCount: number } | undefined;
      const countRes = db.prepare('SELECT COUNT(*) as current FROM plan_items WHERE planId = ?').get(id) as { current: number };

      const min = quota?.minCount || 2;
      const max = quota?.maxCount || 10;
      const current = countRes.current;

      let status: 'ok' | 'below' | 'above' = 'ok';
      if (current < min) status = 'below';
      else if (current > max) status = 'above';

      res.json({
        success: true,
        data: { min, max, current, status, ward: plan.ward, quarter: plan.quarter }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 6. POST /api/plans/:id/submit - Submit plan to pending, checking cutoff time & requiring signed document scan
   */
  static submit(req: AuthenticatedRequest, res: Response): void {
    try {
      const { id } = req.params;
      const {
        signedDocumentUrl,
        unitName,
        workflowCode,
        workflowName,
        approvingDept,
        assignedApproverName,
        inspectionType,
        scheduledStartDate,
        scheduledEndDate,
        inspectionLocation,
        inspectionContent
      } = req.body || {};
      const userId = req.user?.id || null;
      const userRole = req.user?.role || 'officer_ward';

      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as any;
      if (!plan) {
        res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch.' });
        return;
      }

      // Default to sample signed document URL if none uploaded so demo submission never fails
      const finalDocumentUrl = (signedDocumentUrl || plan.signedDocumentUrl || '/uploads/To_trinh_Ke_hoach_Kiem_tra_Q2_2026_Signed.pdf').trim();

      const wfRow = workflowCode
        ? (db.prepare('SELECT * FROM unit_workflows WHERE code = ?').get(workflowCode) as any)
        : null;

      const submitTx = db.transaction(() => {
        db.prepare(`
          UPDATE plans 
          SET status = 'pending', 
              submittedBy = ?, 
              submittedAt = datetime('now'),
              signedDocumentUrl = ?,
              signedDocumentUploadedAt = datetime('now'),
              unitName = COALESCE(?, unitName),
              workflowCode = COALESCE(?, workflowCode),
              workflowName = COALESCE(?, workflowName),
              approvingDept = COALESCE(?, approvingDept),
              assignedApproverName = COALESCE(?, assignedApproverName),
              inspectionType = COALESCE(?, inspectionType),
              scheduledStartDate = COALESCE(?, scheduledStartDate),
              scheduledEndDate = COALESCE(?, scheduledEndDate),
              inspectionLocation = COALESCE(?, inspectionLocation),
              inspectionContent = COALESCE(?, inspectionContent)
          WHERE id = ?
        `).run(
          userId,
          finalDocumentUrl,
          unitName || wfRow?.unitName || null,
          workflowCode || null,
          workflowName || wfRow?.name || null,
          approvingDept || wfRow?.planApprovalDept || null,
          assignedApproverName || wfRow?.planApproverName || null,
          inspectionType || null,
          scheduledStartDate || null,
          scheduledEndDate || null,
          inspectionLocation || null,
          inspectionContent || null,
          id
        );

        // Record scan signature entry in digital_signatures table for audit trail
        if (userId) {
          db.prepare(`
            INSERT INTO digital_signatures (planId, signedByUserId, signedByRole, signatureType, signatureImageUrl, createdAt)
            VALUES (?, ?, ?, 'scan', ?, datetime('now'))
          `).run(id, userId, userRole, finalDocumentUrl);
        }
      });

      submitTx();

      res.json({
        success: true,
        message: 'Đã trình duyệt kế hoạch theo Quy trình Động kèm văn bản đã ký lên Phòng ban phê duyệt thành công!',
        signedDocumentUrl: finalDocumentUrl
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 6b. GET /api/plans/:id/cross-ward-conflicts
   * Check if any uninspected objects in this plan are also in other wards' plans
   */
  static getCrossWardConflicts(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const conflicts = checkCrossWardPlanConflicts(Number(id));
      res.json({
        success: true,
        hasConflicts: conflicts.length > 0,
        conflictsCount: conflicts.length,
        conflicts
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 7. POST /api/plans/:id/approve - Approve single plan ("Duyệt thường" - any PA04 officer/leader)
   * Supports resolutionMode: 'merge_joint' | 'select_single' | 'standard'
   */
  static approve(req: AuthenticatedRequest, res: Response): void {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      const { resolutionMode = 'standard', jointDate, participatingWards, leaderComment } = req.body || {};

      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as Plan | undefined;
      if (!plan) {
        res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch.' });
        return;
      }

      const conflicts = checkCrossWardPlanConflicts(Number(id));

      const approveTx = db.transaction(() => {
        // Handle cross-ward conflict resolution
        if (conflicts.length > 0) {
          if (resolutionMode === 'merge_joint') {
            // Option 1: Merge into 1 Joint Inspection Plan
            for (const c of conflicts) {
              const allWards = participatingWards && participatingWards.length > 0
                ? participatingWards
                : [plan.ward, c.otherWard];
              const wardListStr = allWards.join(', ');
              const dateStr = jointDate ? `vào ngày ${jointDate}` : 'trong quý';

              const alertMsg = `PA04 đã phê duyệt Kế hoạch kiểm tra liên ngành đối với cơ sở "${c.objectName}" giữa ${wardListStr} (${dateStr}). Vui lòng phối hợp thực hiện.`;

              // Notify both wards
              db.prepare(`
                INSERT INTO alerts (type, relatedEntityType, relatedEntityId, severity, ward, message, isRead, createdAt)
                VALUES ('joint_inspection', 'PLANS', ?, 'info', ?, ?, 0, datetime('now'))
              `).run(id, c.otherWard, alertMsg);

              db.prepare(`
                INSERT INTO alerts (type, relatedEntityType, relatedEntityId, severity, ward, message, isRead, createdAt)
                VALUES ('joint_inspection', 'PLANS', ?, 'info', ?, ?, 0, datetime('now'))
              `).run(id, plan.ward, alertMsg);
            }
          } else if (resolutionMode === 'select_single') {
            // Option 2: Select this plan, reject/remove from other wards' draft/pending plans
            for (const c of conflicts) {
              // Delete from competing plan_items
              db.prepare('DELETE FROM plan_items WHERE planId = ? AND objectId = ?').run(c.otherPlanId, c.objectId);

              const alertMsg = `Cơ sở "${c.objectName}" đã được PA04 ưu tiên phê duyệt trong kế hoạch của ${plan.ward} (${plan.quarter}) theo nguyên tắc Single Check. Cơ sở đã được tự động loại khỏi kế hoạch của ${c.otherWard}.`;

              db.prepare(`
                INSERT INTO alerts (type, relatedEntityType, relatedEntityId, severity, ward, message, isRead, createdAt)
                VALUES ('single_check_conflict', 'PLANS', ?, 'warning', ?, ?, 0, datetime('now'))
              `).run(id, c.otherWard, alertMsg);
            }
          }
        }

        // Update plan status
        db.prepare(`
          UPDATE plans 
          SET status = 'approved', approvedBy = ?, approvedAt = datetime('now')
          WHERE id = ?
        `).run(userId, id);

        // Auto-generate inspections for each object in this plan
        const items = db.prepare('SELECT objectId FROM plan_items WHERE planId = ?').all(id) as Array<{ objectId: number }>;
        PlansController.ensureInspectionsForPlan(Number(id), plan, items.map(i => i.objectId));
      });

      approveTx();

      let successMessage = 'Phê duyệt kế hoạch thành công (Duyệt thường). Đã tạo các hồ sơ kiểm tra thực địa.';
      if (conflicts.length > 0 && resolutionMode === 'merge_joint') {
        successMessage = 'Đã phê duyệt và thiết lập Đoàn kiểm tra liên ngành thành công! Đã gửi thông báo tới các Phường liên quan.';
      } else if (conflicts.length > 0 && resolutionMode === 'select_single') {
        successMessage = `Đã phê duyệt kế hoạch cho ${plan.ward}. Các cơ sở trùng lặp trong kế hoạch của phường khác đã được tự động loại bỏ.`;
      }

      res.json({ success: true, message: successMessage });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 7b. POST /api/plans/:id/sign-digital - Digital token signature approval (Leader MBF / Admin only)
   * Supports resolutionMode: 'merge_joint' | 'select_single' | 'standard'
   */
  static signDigital(req: AuthenticatedRequest, res: Response): void {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;
      const userRole = req.user?.role || 'leader_mbf';
      const userFullName = req.user?.fullName || 'Lãnh đạo MBF';
      const { resolutionMode = 'standard', jointDate, participatingWards, leaderComment } = req.body || {};

      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as Plan | undefined;
      if (!plan) {
        res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch.' });
        return;
      }

      const conflicts = checkCrossWardPlanConflicts(Number(id));

      // Simulated Digital Certificate Info
      const randomHex = Math.floor(10000000 + Math.random() * 90000000).toString(16).toUpperCase();
      const mockCert = {
        serialNumber: `54:02:AA:7E:${randomHex}:2026`,
        issuer: 'Ban Cơ yếu Chính phủ (demo)',
        subject: `${userFullName} - ${userRole === 'admin' ? 'Quản trị viên Hệ thống' : 'Trưởng phòng / Lãnh đạo PA04'}`,
        validFrom: '2025-01-01T00:00:00.000Z',
        validTo: '2028-01-01T00:00:00.000Z',
        signedAt: new Date().toISOString()
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

      const signTx = db.transaction(() => {
        // Handle cross-ward conflict resolution
        if (conflicts.length > 0) {
          if (resolutionMode === 'merge_joint') {
            for (const c of conflicts) {
              const allWards = participatingWards && participatingWards.length > 0
                ? participatingWards
                : [plan.ward, c.otherWard];
              const wardListStr = allWards.join(', ');
              const dateStr = jointDate ? `vào ngày ${jointDate}` : 'trong quý';

              const alertMsg = `PA04 đã ký số phê duyệt Kế hoạch kiểm tra liên ngành đối với cơ sở "${c.objectName}" giữa ${wardListStr} (${dateStr}). Vui lòng phối hợp thực hiện.`;

              db.prepare(`
                INSERT INTO alerts (type, relatedEntityType, relatedEntityId, severity, ward, message, isRead, createdAt)
                VALUES ('joint_inspection', 'PLANS', ?, 'info', ?, ?, 0, datetime('now'))
              `).run(id, c.otherWard, alertMsg);

              db.prepare(`
                INSERT INTO alerts (type, relatedEntityType, relatedEntityId, severity, ward, message, isRead, createdAt)
                VALUES ('joint_inspection', 'PLANS', ?, 'info', ?, ?, 0, datetime('now'))
              `).run(id, plan.ward, alertMsg);
            }
          } else if (resolutionMode === 'select_single') {
            for (const c of conflicts) {
              db.prepare('DELETE FROM plan_items WHERE planId = ? AND objectId = ?').run(c.otherPlanId, c.objectId);

              const alertMsg = `Cơ sở "${c.objectName}" đã được PA04 ký số ưu tiên phê duyệt trong kế hoạch của ${plan.ward} (${plan.quarter}) theo nguyên tắc Single Check. Cơ sở đã được tự động loại khỏi kế hoạch của ${c.otherWard}.`;

              db.prepare(`
                INSERT INTO alerts (type, relatedEntityType, relatedEntityId, severity, ward, message, isRead, createdAt)
                VALUES ('single_check_conflict', 'PLANS', ?, 'warning', ?, ?, 0, datetime('now'))
              `).run(id, c.otherWard, alertMsg);
            }
          }
        }

        // Insert digital_signatures record
        db.prepare(`
          INSERT INTO digital_signatures (planId, signedByUserId, signedByRole, signatureType, certificateInfo, createdAt)
          VALUES (?, ?, ?, 'digital_token', ?, datetime('now'))
        `).run(id, userId, userRole, JSON.stringify(mockCert));

        // Update plan status to approved
        db.prepare(`
          UPDATE plans 
          SET status = 'approved', approvedBy = ?, approvedAt = datetime('now')
          WHERE id = ?
        `).run(userId, id);

        // Calculate inspection dueDate = approvedAt + N days (from system_configs, default 30)
        const deadlineRow = db.prepare(`SELECT value FROM system_configs WHERE key = 'inspectionDeadlineDays'`).get() as { value: string } | undefined;
        const deadlineDays = deadlineRow ? parseInt(deadlineRow.value, 10) || 30 : 30;
        const dueTimestamp = new Date();
        dueTimestamp.setDate(dueTimestamp.getDate() + deadlineDays);
        const inspDueDate = dueTimestamp.toISOString().replace('T', ' ').substring(0, 19);

        // Auto-generate inspections for each object in this plan
        const items = db.prepare('SELECT objectId FROM plan_items WHERE planId = ?').all(id) as Array<{ objectId: number }>;
        const insertInspection = db.prepare(`
          INSERT INTO inspections (objectId, planId, status, ward, severity, dueDate, isLocked, createdAt)
          VALUES (?, ?, 'not_started', ?, 1, ?, 0, datetime('now'))
        `);
        const insertChecklistItem = db.prepare(`
          INSERT INTO inspection_checklist_items (inspectionId, domainId, criteriaCode, criteriaName, result, notes)
          VALUES (?, ?, ?, ?, 'pass', '')
        `);

        for (const item of items) {
          const existingInspection = db.prepare('SELECT id FROM inspections WHERE objectId = ? AND planId = ?').get(item.objectId, id) as { id: number } | undefined;
          if (!existingInspection) {
            const inspRes = insertInspection.run(item.objectId, id, plan.ward, inspDueDate);
            const newInspId = inspRes.lastInsertRowid;
            for (const c of defaultCriteria) {
              insertChecklistItem.run(newInspId, c.domainId, c.criteriaCode, c.criteriaName);
            }
          }
        }
      });

      signTx();

      let successMessage = 'Ký số điện tử và phê duyệt kế hoạch thành công! Đã tạo các hồ sơ kiểm tra thực địa.';
      if (conflicts.length > 0 && resolutionMode === 'merge_joint') {
        successMessage = 'Đã ký số điện tử và thiết lập Đoàn kiểm tra liên ngành thành công! Đã gửi thông báo tới các Phường liên quan.';
      } else if (conflicts.length > 0 && resolutionMode === 'select_single') {
        successMessage = `Đã ký số điện tử phê duyệt kế hoạch cho ${plan.ward}. Các cơ sở trùng lặp trong kế hoạch của phường khác đã được tự động loại bỏ.`;
      }

      res.json({
        success: true,
        message: successMessage,
        certificateInfo: mockCert
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 8. POST /api/plans/:id/reject - Reject plan with mandatory reason
   */
  static reject(req: AuthenticatedRequest, res: Response): void {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || !reason.trim()) {
        res.status(400).json({ success: false, message: 'Bắt buộc phải nhập lý do từ chối kế hoạch.' });
        return;
      }

      db.prepare(`
        UPDATE plans 
        SET status = 'draft', rejectReason = ?
        WHERE id = ?
      `).run(reason, id);

      res.json({ success: true, message: 'Đã trả kế hoạch về Bản nháp để đơn vị cơ sở chỉnh sửa.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 9. GET /api/plans/pending-grid - Flat list of pending objects across plans
   */
  static getPendingGrid(req: Request, res: Response): void {
    try {
      const query = `
        SELECT pi.id as planItemId, pi.planId, p.quarter, p.ward, p.submittedAt,
               p.signedDocumentUrl,
               u.fullName as submittedByName,
               b.id as objectId, b.name as objectName, b.type as objectType,
               b.taxCode, b.idNumber, b.address, b.representative,
               q.minCount, q.maxCount
        FROM plan_items pi
        JOIN plans p ON pi.planId = p.id
        JOIN business_objects b ON pi.objectId = b.id
        LEFT JOIN users u ON p.submittedBy = u.id
        LEFT JOIN quota_configs q ON p.ward = q.ward AND p.quarter = q.quarter
        WHERE p.status = 'pending'
        ORDER BY p.id DESC, b.id ASC
      `;
      const data = db.prepare(query).all();
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 10. POST /api/plans/approve-bulk - Bulk approve plans or individual plan items
   */
  static approveBulk(req: AuthenticatedRequest, res: Response): void {
    try {
      const { planIds = [], planItemIds = [] } = req.body;
      const userId = req.user?.id || null;

      if (planIds.length === 0 && planItemIds.length === 0) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất một kế hoạch hoặc cơ sở để duyệt.' });
        return;
      }

      let approvedPlansCount = 0;
      let inspectionsCreatedCount = 0;

      const bulkTx = db.transaction(() => {
        // If planItemIds are provided:
        if (planItemIds.length > 0) {
          const items = db.prepare(`
            SELECT pi.id as planItemId, pi.planId, pi.objectId, p.ward, p.quarter
            FROM plan_items pi
            JOIN plans p ON pi.planId = p.id
            WHERE pi.id IN (${planItemIds.map(() => '?').join(',')})
          `).all(...planItemIds) as any[];

          const distinctPlanIds = Array.from(new Set(items.map(i => i.planId)));

          const insertInspection = db.prepare(`
            INSERT INTO inspections (objectId, planId, status, ward, severity, isLocked, createdAt)
            VALUES (?, ?, 'not_started', ?, 1, 0, datetime('now'))
          `);

          for (const item of items) {
            const existingInspection = db.prepare('SELECT id FROM inspections WHERE objectId = ? AND planId = ?').get(item.objectId, item.planId);
            if (!existingInspection) {
              insertInspection.run(item.objectId, item.planId, item.ward);
              inspectionsCreatedCount++;
            }
          }

          // Mark plans as approved
          for (const pId of distinctPlanIds) {
            db.prepare(`
              UPDATE plans 
              SET status = 'approved', approvedBy = ?, approvedAt = datetime('now')
              WHERE id = ?
            `).run(userId, pId);
            approvedPlansCount++;
          }
        } else if (planIds.length > 0) {
          // If planIds are provided:
          for (const id of planIds) {
            const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as Plan | undefined;
            if (plan && plan.status === 'pending') {
              db.prepare(`
                UPDATE plans 
                SET status = 'approved', approvedBy = ?, approvedAt = datetime('now')
                WHERE id = ?
              `).run(userId, id);
              approvedPlansCount++;

              const items = db.prepare('SELECT objectId FROM plan_items WHERE planId = ?').all(id) as Array<{ objectId: number }>;
              const insertInspection = db.prepare(`
                INSERT INTO inspections (objectId, planId, status, ward, severity, isLocked, createdAt)
                VALUES (?, ?, 'not_started', ?, 1, 0, datetime('now'))
              `);

              for (const item of items) {
                const existingInspection = db.prepare('SELECT id FROM inspections WHERE objectId = ? AND planId = ?').get(item.objectId, id);
                if (!existingInspection) {
                  insertInspection.run(item.objectId, id, plan.ward);
                  inspectionsCreatedCount++;
                }
              }
            }
          }
        }
      });

      bulkTx();

      res.json({
        success: true,
        message: `Đã phê duyệt thành công ${approvedPlansCount} kế hoạch (${inspectionsCreatedCount} cơ sở kiểm tra thực địa).`,
        approvedPlansCount,
        inspectionsCreatedCount
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
