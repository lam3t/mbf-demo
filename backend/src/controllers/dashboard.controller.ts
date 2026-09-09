import { Request, Response } from 'express';
import { db } from '../db/connection';

export class DashboardController {
  static getSummary(req: Request, res: Response): void {
    try {
      const targetCount = 9960; // Target quota for city

      // Total inspections and counts by status
      const totalInspections = (db.prepare('SELECT COUNT(*) as count FROM inspections').get() as { count: number }).count;
      const completedCount = (db.prepare("SELECT COUNT(*) as count FROM inspections WHERE status = 'completed'").get() as { count: number }).count;
      const inProgressCount = (db.prepare("SELECT COUNT(*) as count FROM inspections WHERE status = 'in_progress'").get() as { count: number }).count;
      
      // Calculate overdue inspections
      const overdueCount = (db.prepare(`
        SELECT COUNT(*) as count 
        FROM inspections i
        LEFT JOIN plans p ON i.planId = p.id
        WHERE i.status != 'completed' 
          AND (julianday('now') - julianday(COALESCE(p.approvedAt, i.createdAt))) > 30
      `).get() as { count: number }).count;

      const notStartedCount = (db.prepare(`
        SELECT COUNT(*) as count 
        FROM inspections i
        LEFT JOIN plans p ON i.planId = p.id
        WHERE i.status = 'not_started' 
          AND (julianday('now') - julianday(COALESCE(p.approvedAt, i.createdAt))) <= 30
      `).get() as { count: number }).count;

      // Objects counts
      const totalObjects = (db.prepare('SELECT COUNT(*) as count FROM business_objects').get() as { count: number }).count;
      const activeObjects = (db.prepare("SELECT COUNT(*) as count FROM business_objects WHERE status = 'active'").get() as { count: number }).count;
      const suspendedObjects = (db.prepare("SELECT COUNT(*) as count FROM business_objects WHERE status = 'suspended'").get() as { count: number }).count;

      // Overall completion percent (against target)
      const targetCompletionRate = targetCount > 0 ? Number(((completedCount / targetCount) * 100).toFixed(2)) : 0;
      // Actual task completion rate (against total assigned tasks)
      const taskCompletionRate = totalInspections > 0 ? Number(((completedCount / totalInspections) * 100).toFixed(1)) : 0;

      // Ward level progress aggregation
      const wardProgressList = db.prepare(`
        SELECT ward, 
               COUNT(*) as total,
               SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
               SUM(CASE WHEN status != 'completed' AND (julianday('now') - julianday(createdAt)) > 30 THEN 1 ELSE 0 END) as overdue
        FROM inspections
        GROUP BY ward
      `).all() as Array<{ ward: string; total: number; completed: number; overdue: number }>;

      let completedWards = 0;
      let inProgressWards = 0;
      let notStartedWards = 0;

      for (const w of wardProgressList) {
        if (w.total > 0 && w.completed === w.total) {
          completedWards++;
        } else if (w.completed > 0) {
          inProgressWards++;
        } else {
          notStartedWards++;
        }
      }

      res.json({
        success: true,
        data: {
          targetCount,
          completedCount,
          inProgressCount,
          notStartedCount,
          overdueCount,
          totalInspections,
          totalObjects,
          activeObjects,
          suspendedObjects,
          targetCompletionRate,
          taskCompletionRate,
          completedWards,
          inProgressWards,
          notStartedWards,
          totalWards: wardProgressList.length
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getProgressByDay(req: Request, res: Response): void {
    try {
      const daysCount = parseInt((req.query.days as string) || '14', 10);
      
      // Generate daily timeline for the past N days
      const result: Array<{ date: string; completed: number; target: number; rate: number }> = [];
      const now = new Date();

      // Cumulative baseline
      let baseCompleted = Math.max(2, Math.floor(daysCount * 0.8));
      
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        
        // Cumulative growth
        baseCompleted += Math.floor(Math.random() * 3) + 1;
        const target = Math.min(9960, 50 + (daysCount - i) * 12);
        const rate = Number(((baseCompleted / target) * 100).toFixed(1));

        result.push({
          date: dayStr,
          completed: baseCompleted,
          target,
          rate
        });
      }

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getOverdueRanking(req: Request, res: Response): void {
    try {
      const limit = parseInt((req.query.limit as string) || '5', 10);

      const wardsStats = db.prepare(`
        SELECT i.ward,
               COUNT(*) as total,
               SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as completed,
               SUM(CASE WHEN i.status != 'completed' AND (julianday('now') - julianday(COALESCE(p.approvedAt, i.createdAt))) > 30 THEN 1 ELSE 0 END) as overdue,
               ROUND(CAST(SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1) as rate
        FROM inspections i
        LEFT JOIN plans p ON i.planId = p.id
        GROUP BY i.ward
        ORDER BY rate ASC, overdue DESC
        LIMIT ?
      `).all(limit) as Array<{ ward: string; total: number; completed: number; overdue: number; rate: number }>;

      const formatted = wardsStats.map(w => {
        let status = 'Bình thường';
        if (w.rate < 30 || w.overdue > 0) status = 'Chậm tiến độ';
        else if (w.rate < 60) status = 'Cảnh báo';
        else if (w.rate >= 80) status = 'Tốt';

        return {
          ward: w.ward,
          target: w.total,
          completed: w.completed,
          overdue: w.overdue,
          rate: w.rate || 0,
          status
        };
      });

      res.json({ success: true, data: formatted });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getCompliancePie(req: Request, res: Response): void {
    try {
      // 1. Tốt (Không có vi phạm nào)
      const goodCount = (db.prepare(`
        SELECT COUNT(DISTINCT b.id) as count 
        FROM business_objects b
        WHERE b.status = 'active'
          AND b.id NOT IN (
            SELECT objectId FROM inspections 
            WHERE violationCodes IS NOT NULL AND violationCodes != '[]' AND violationCodes != ''
          )
      `).get() as { count: number }).count;

      // 2. Vi phạm (Có ít nhất 1 inspection có violationCodes)
      const violationCount = (db.prepare(`
        SELECT COUNT(DISTINCT objectId) as count 
        FROM inspections 
        WHERE violationCodes IS NOT NULL AND violationCodes != '[]' AND violationCodes != ''
      `).get() as { count: number }).count;

      // 3. Đình chỉ (Trạng thái suspended)
      const suspendedCount = (db.prepare(`
        SELECT COUNT(*) as count 
        FROM business_objects 
        WHERE status = 'suspended'
      `).get() as { count: number }).count;

      res.json({
        success: true,
        data: [
          { name: 'Chấp hành tốt (Không vi phạm)', count: goodCount, color: '#10B981' },
          { name: 'Phát hiện vi phạm', count: violationCount, color: '#F59E0B' },
          { name: 'Đình chỉ hoạt động', count: suspendedCount, color: '#EF4444' }
        ]
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getViolationsGeo(req: Request, res: Response): void {
    try {
      const { timeRange, ward, violationType } = req.query;

      let whereClause = "WHERE i.lat IS NOT NULL AND i.lng IS NOT NULL AND i.violationCodes IS NOT NULL AND i.violationCodes != '[]' AND i.violationCodes != ''";
      const params: any[] = [];

      if (ward) {
        whereClause += ' AND i.ward = ?';
        params.push(ward);
      }
      if (violationType) {
        whereClause += ' AND i.violationCodes LIKE ?';
        params.push(`%${violationType}%`);
      }
      if (timeRange === 'week') {
        whereClause += " AND i.createdAt >= datetime('now', '-7 days')";
      } else if (timeRange === 'month') {
        whereClause += " AND i.createdAt >= datetime('now', '-30 days')";
      } else if (timeRange === 'quarter') {
        whereClause += " AND i.createdAt >= datetime('now', '-90 days')";
      }

      const query = `
        SELECT i.id as inspectionId, i.lat, i.lng, i.ward, i.severity, i.violationCodes, i.completedAt, i.status,
               b.name as objectName, b.type as objectType, b.address as objectAddress,
               p.quarter as planQuarter
        FROM inspections i
        JOIN business_objects b ON i.objectId = b.id
        JOIN plans p ON i.planId = p.id
        ${whereClause}
        ORDER BY i.severity DESC, i.id DESC
      `;

      const data = db.prepare(query).all(...params);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
