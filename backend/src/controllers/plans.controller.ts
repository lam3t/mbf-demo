import { Request, Response } from 'express';
import { db } from '../db/connection';
import { Plan } from '../types';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class PlansController {
  /**
   * 1. GET /api/plans - Filter by quarter, ward, status & pagination
   */
  static getAll(req: Request, res: Response): void {
    try {
      const { quarter, ward, status, page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (quarter) {
        whereClause += ' AND p.quarter = ?';
        params.push(quarter);
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
               (SELECT COUNT(*) FROM plan_items pi WHERE pi.planId = p.id) as totalObjects
        FROM plans p
        LEFT JOIN users u1 ON p.submittedBy = u1.id
        LEFT JOIN users u2 ON p.approvedBy = u2.id
        ${whereClause}
        ORDER BY p.id DESC
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
   * 2. GET /api/plans/:id - Details with associated business objects
   */
  static getById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const plan = db.prepare(`
        SELECT p.*, 
               u1.fullName as submittedByName,
               u2.fullName as approvedByName
        FROM plans p
        LEFT JOIN users u1 ON p.submittedBy = u1.id
        LEFT JOIN users u2 ON p.approvedBy = u2.id
        WHERE p.id = ?
      `).get(id);

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
      `).all(id);

      res.json({ success: true, data: { ...plan, items } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 3. POST /api/plans - Create draft plan with selected objectIds
   */
  static create(req: AuthenticatedRequest, res: Response): void {
    try {
      const { quarter, ward, objectIds = [] } = req.body;
      const userId = req.user?.id || null;

      if (!quarter || !ward) {
        res.status(400).json({ success: false, message: 'Vui lòng chọn Quý và Đơn vị phường.' });
        return;
      }

      // Check existing plan for same ward and quarter
      const existing = db.prepare('SELECT id, status FROM plans WHERE quarter = ? AND ward = ?').get(quarter, ward) as Plan | undefined;
      if (existing) {
        res.status(400).json({ success: false, message: `Kế hoạch ${quarter} của ${ward} đã tồn tại (Trạng thái: ${existing.status}).` });
        return;
      }

      const createPlanTx = db.transaction(() => {
        const stmt = db.prepare(`
          INSERT INTO plans (quarter, ward, status, submittedBy, createdAt)
          VALUES (?, ?, 'draft', ?, datetime('now'))
        `);
        const result = stmt.run(quarter, ward, userId);
        const planId = result.lastInsertRowid;

        const itemStmt = db.prepare('INSERT INTO plan_items (planId, objectId, createdAt) VALUES (?, ?, datetime(\'now\'))');
        const updateObjStmt = db.prepare('UPDATE business_objects SET planId = ? WHERE id = ?');

        for (const objId of objectIds) {
          itemStmt.run(planId, objId);
          updateObjStmt.run(planId, objId);
        }

        return planId;
      });

      const newPlanId = createPlanTx();
      res.status(201).json({ success: true, message: 'Tạo kế hoạch nháp thành công.', id: newPlanId });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 4. PUT /api/plans/:id/items - Update plan items in draft status
   */
  static updateItems(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { objectIds = [] } = req.body;

      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as Plan | undefined;
      if (!plan) {
        res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch.' });
        return;
      }

      if (plan.status !== 'draft') {
        res.status(400).json({ success: false, message: 'Chỉ có thể chỉnh sửa đối tượng khi kế hoạch ở trạng thái Bản nháp.' });
        return;
      }

      const updateTx = db.transaction(() => {
        // Reset old plan items
        db.prepare('UPDATE business_objects SET planId = NULL WHERE planId = ?').run(id);
        db.prepare('DELETE FROM plan_items WHERE planId = ?').run(id);

        const insertItem = db.prepare('INSERT INTO plan_items (planId, objectId, createdAt) VALUES (?, ?, datetime(\'now\'))');
        const updateObj = db.prepare('UPDATE business_objects SET planId = ? WHERE id = ?');

        for (const objId of objectIds) {
          insertItem.run(id, objId);
          updateObj.run(id, objId);
        }
      });

      updateTx();
      res.json({ success: true, message: 'Cập nhật danh sách đối tượng thành công.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
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
   * 6. POST /api/plans/:id/submit - Submit plan to pending, checking cutoff time
   */
  static submit(req: AuthenticatedRequest, res: Response): void {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;

      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as Plan | undefined;
      if (!plan) {
        res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch.' });
        return;
      }

      // Check cut-off time
      const cutoff = db.prepare('SELECT cutoffDateTime FROM cutoff_configs WHERE quarter = ?').get(plan.quarter) as { cutoffDateTime: string } | undefined;
      if (cutoff && new Date(cutoff.cutoffDateTime).getTime() < Date.now()) {
        res.status(400).json({
          success: false,
          message: `Đã quá thời hạn Cut-off (${cutoff.cutoffDateTime}). Cổng tiếp nhận kế hoạch của ${plan.quarter} đã đóng.`
        });
        return;
      }

      db.prepare(`
        UPDATE plans 
        SET status = 'pending', submittedBy = ?, submittedAt = datetime('now')
        WHERE id = ?
      `).run(userId, id);

      res.json({ success: true, message: 'Đã trình duyệt kế hoạch lên Lãnh đạo TNT thành công.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 7. POST /api/plans/:id/approve - Approve single plan and generate inspections
   */
  static approve(req: AuthenticatedRequest, res: Response): void {
    try {
      const { id } = req.params;
      const userId = req.user?.id || null;

      const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as Plan | undefined;
      if (!plan) {
        res.status(404).json({ success: false, message: 'Không tìm thấy kế hoạch.' });
        return;
      }

      const approveTx = db.transaction(() => {
        // Update plan status
        db.prepare(`
          UPDATE plans 
          SET status = 'approved', approvedBy = ?, approvedAt = datetime('now')
          WHERE id = ?
        `).run(userId, id);

        // Auto-generate inspections for each object in this plan
        const items = db.prepare('SELECT objectId FROM plan_items WHERE planId = ?').all(id) as Array<{ objectId: number }>;
        const insertInspection = db.prepare(`
          INSERT INTO inspections (objectId, planId, status, ward, severity, isLocked, createdAt)
          VALUES (?, ?, 'not_started', ?, 1, 0, datetime('now'))
        `);

        for (const item of items) {
          // Check if inspection already exists
          const existingInspection = db.prepare('SELECT id FROM inspections WHERE objectId = ? AND planId = ?').get(item.objectId, id);
          if (!existingInspection) {
            insertInspection.run(item.objectId, id, plan.ward);
          }
        }
      });

      approveTx();

      res.json({ success: true, message: 'Phê duyệt kế hoạch thành công. Đã tạo các hồ sơ kiểm tra thực địa.' });
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
