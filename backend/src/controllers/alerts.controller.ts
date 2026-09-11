import { Request, Response } from 'express';
import { db } from '../db/connection';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { runDeadlineCheck } from '../services/deadlineChecker';

export class AlertsController {
  /**
   * GET /api/alerts
   * Filter by ward, type, severity, isRead, search, with pagination & unread count
   */
  static getAll(req: AuthenticatedRequest, res: Response): void {
    try {
      const { ward, type, severity, isRead, search, page = '1', limit = '50' } = req.query;
      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.max(1, Math.min(200, parseInt(limit as string, 10) || 50));
      const offset = (pageNum - 1) * limitNum;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Ward filter: Ward officers see their ward by default unless specified
      const userWard = req.user?.role === 'officer_ward' ? req.user.unit : (ward as string);
      if (userWard && userWard !== 'all') {
        whereClause += ' AND a.ward = ?';
        params.push(userWard);
      }

      if (type && type !== 'all') {
        whereClause += ' AND a.type = ?';
        params.push(type);
      }

      if (severity && severity !== 'all') {
        whereClause += ' AND a.severity = ?';
        params.push(severity);
      }

      if (isRead !== undefined && isRead !== '' && isRead !== 'all') {
        const readVal = isRead === '1' || isRead === 'true' ? 1 : 0;
        whereClause += ' AND a.isRead = ?';
        params.push(readVal);
      }

      if (search) {
        whereClause += ' AND a.message LIKE ?';
        params.push(`%${search}%`);
      }

      const countQuery = `SELECT COUNT(*) as total FROM alerts a ${whereClause}`;
      const countRes = db.prepare(countQuery).get(...params) as { total: number };

      const query = `
        SELECT a.*
        FROM alerts a
        ${whereClause}
        ORDER BY a.isRead ASC, a.id DESC
        LIMIT ? OFFSET ?
      `;

      const data = db.prepare(query).all(...params, limitNum, offset);

      // Also compute unread count for the current user's scope
      let unreadWhere = 'WHERE isRead = 0';
      const unreadParams: any[] = [];
      if (userWard && userWard !== 'all') {
        unreadWhere += ' AND ward = ?';
        unreadParams.push(userWard);
      }
      const unreadRes = db.prepare(`SELECT COUNT(*) as unreadCount FROM alerts ${unreadWhere}`).get(...unreadParams) as { unreadCount: number };

      res.json({
        success: true,
        data,
        unreadCount: unreadRes ? unreadRes.unreadCount : 0,
        pagination: {
          total: countRes.total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(countRes.total / limitNum) || 1,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/alerts/:id/read
   * Mark a single alert as read
   */
  static markAsRead(req: AuthenticatedRequest, res: Response): void {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ success: false, message: 'ID cảnh báo không hợp lệ.' });
        return;
      }

      const stmt = db.prepare(`UPDATE alerts SET isRead = 1 WHERE id = ?`);
      const result = stmt.run(id);

      if (result.changes === 0) {
        res.status(404).json({ success: false, message: 'Không tìm thấy cảnh báo.' });
        return;
      }

      res.json({ success: true, message: 'Đã đánh dấu cảnh báo là đã đọc.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PATCH /api/alerts/read-all
   * Mark all alerts as read (scoped to ward if ward officer)
   */
  static markAllAsRead(req: AuthenticatedRequest, res: Response): void {
    try {
      let query = `UPDATE alerts SET isRead = 1 WHERE isRead = 0`;
      const params: any[] = [];

      if (req.user?.role === 'officer_ward') {
        query += ` AND ward = ?`;
        params.push(req.user.unit);
      }

      const result = db.prepare(query).run(...params);

      res.json({
        success: true,
        message: `Đã đánh dấu ${result.changes} cảnh báo là đã đọc.`,
        updatedCount: result.changes,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/alerts/check-deadlines
   * Trigger deadline checker manually
   */
  static triggerDeadlineCheck(req: AuthenticatedRequest, res: Response): void {
    try {
      const result = runDeadlineCheck();
      res.json({
        success: true,
        message: 'Kiểm tra hạn hoàn thành thành công.',
        data: result,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
