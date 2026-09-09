import { Request, Response } from 'express';
import { db } from '../db/connection';

export class AuditController {
  static getAll(req: Request, res: Response): void {
    try {
      const { entityType, action, userId, page = '1', limit = '50' } = req.query;
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
}
