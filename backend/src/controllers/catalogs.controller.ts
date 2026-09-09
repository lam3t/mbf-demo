import { Request, Response } from 'express';
import { db } from '../db/connection';

export class CatalogsController {
  static getViolations(req: Request, res: Response): void {
    try {
      const items = db.prepare('SELECT * FROM violation_catalog ORDER BY id ASC').all();
      res.json({ success: true, data: items });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static createViolation(req: Request, res: Response): void {
    try {
      const { code, name } = req.body;
      if (!code || !name) {
        res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã và tên lỗi vi phạm.' });
        return;
      }
      const result = db.prepare('INSERT INTO violation_catalog (code, name) VALUES (?, ?)').run(code, name);
      res.status(201).json({ success: true, id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static updateViolation(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { code, name } = req.body;
      db.prepare('UPDATE violation_catalog SET code = ?, name = ? WHERE id = ?').run(code, name, id);
      res.json({ success: true, message: 'Cập nhật danh mục thành công.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static deleteViolation(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM violation_catalog WHERE id = ?').run(id);
      res.json({ success: true, message: 'Đã xóa danh mục.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getRecommendationTags(req: Request, res: Response): void {
    try {
      const items = db.prepare('SELECT * FROM recommendation_tag_catalog ORDER BY id ASC').all();
      res.json({ success: true, data: items });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static createRecommendationTag(req: Request, res: Response): void {
    try {
      const { code, name } = req.body;
      if (!code || !name) {
        res.status(400).json({ success: false, message: 'Vui lòng cung cấp mã và tên lĩnh vực kiến nghị.' });
        return;
      }
      const result = db.prepare('INSERT INTO recommendation_tag_catalog (code, name) VALUES (?, ?)').run(code, name);
      res.status(201).json({ success: true, id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static updateRecommendationTag(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { code, name } = req.body;
      db.prepare('UPDATE recommendation_tag_catalog SET code = ?, name = ? WHERE id = ?').run(code, name, id);
      res.json({ success: true, message: 'Cập nhật danh mục thành công.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static deleteRecommendationTag(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM recommendation_tag_catalog WHERE id = ?').run(id);
      res.json({ success: true, message: 'Đã xóa danh mục.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
