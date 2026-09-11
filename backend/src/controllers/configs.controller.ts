import { Request, Response } from 'express';
import { db } from '../db/connection';

export class ConfigsController {
  static getQuotas(req: Request, res: Response): void {
    try {
      const { quarter, ward } = req.query;
      let query = 'SELECT * FROM quota_configs WHERE 1=1';
      const params: any[] = [];

      if (quarter) {
        query += ' AND quarter = ?';
        params.push(quarter);
      }
      if (ward) {
        query += ' AND ward = ?';
        params.push(ward);
      }

      query += ' ORDER BY id ASC';
      const items = db.prepare(query).all(...params);
      res.json({ success: true, data: items });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static saveQuota(req: Request, res: Response): void {
    try {
      const { ward, quarter, minCount, maxCount } = req.body;
      if (!ward || !quarter || minCount === undefined || maxCount === undefined) {
        res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin Quota.' });
        return;
      }

      const stmt = db.prepare(`
        INSERT INTO quota_configs (ward, quarter, minCount, maxCount)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(ward, quarter) DO UPDATE SET
          minCount = excluded.minCount,
          maxCount = excluded.maxCount
      `);
      stmt.run(ward, quarter, minCount, maxCount);

      res.json({ success: true, message: 'Lưu cấu hình Quota thành công.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getCutoffs(req: Request, res: Response): void {
    try {
      const items = db.prepare('SELECT * FROM cutoff_configs ORDER BY id DESC').all();
      res.json({ success: true, data: items });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static saveCutoff(req: Request, res: Response): void {
    try {
      const { quarter, cutoffDateTime } = req.body;
      if (!quarter || !cutoffDateTime) {
        res.status(400).json({ success: false, message: 'Vui lòng cung cấp Quý và thời điểm Cut-off.' });
        return;
      }

      const stmt = db.prepare(`
        INSERT INTO cutoff_configs (quarter, cutoffDateTime)
        VALUES (?, ?)
        ON CONFLICT(quarter) DO UPDATE SET
          cutoffDateTime = excluded.cutoffDateTime
      `);
      stmt.run(quarter, cutoffDateTime);

      res.json({ success: true, message: 'Lưu cấu hình Cut-off time thành công.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getInspectionDeadlineDays(req: Request, res: Response): void {
    try {
      const row = db.prepare(`SELECT value FROM system_configs WHERE key = 'inspectionDeadlineDays'`).get() as { value: string } | undefined;
      const days = row ? parseInt(row.value, 10) : 30;
      res.json({ success: true, data: { days } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static saveInspectionDeadlineDays(req: Request, res: Response): void {
    try {
      const { days } = req.body;
      const daysNum = parseInt(days, 10);
      if (isNaN(daysNum) || daysNum <= 0) {
        res.status(400).json({ success: false, message: 'Số ngày thời hạn kiểm tra không hợp lệ (phải > 0).' });
        return;
      }

      db.prepare(`
        INSERT INTO system_configs (key, value)
        VALUES ('inspectionDeadlineDays', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(daysNum.toString());

      res.json({ success: true, message: 'Lưu cấu hình thời hạn kiểm tra thành công.', data: { days: daysNum } });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

