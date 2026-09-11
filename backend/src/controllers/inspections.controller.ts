import { Request, Response } from 'express';
import { db } from '../db/connection';
import { Inspection } from '../types';

export class InspectionsController {
  static getAll(req: Request, res: Response): void {
    try {
      const { status, ward, quarter, search, objectId, page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (objectId) {
        whereClause += ' AND i.objectId = ?';
        params.push(objectId);
      }
      if (status === 'overdue') {
        whereClause += " AND i.status != 'completed' AND (i.isOverdue = 1 OR (i.dueDate IS NOT NULL AND (i.dueDate < datetime('now', 'localtime') OR i.dueDate < datetime('now'))))";
      } else if (status) {
        whereClause += ' AND i.status = ?';
        params.push(status);
      }
      if (ward) {
        whereClause += ' AND i.ward = ?';
        params.push(ward);
      }
      if (quarter) {
        whereClause += ' AND p.quarter = ?';
        params.push(quarter);
      }
      if (search) {
        whereClause += ' AND (b.name LIKE ? OR b.taxCode LIKE ? OR b.idNumber LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
      }

      const countStmt = db.prepare(`
        SELECT COUNT(*) as total 
        FROM inspections i
        JOIN business_objects b ON i.objectId = b.id
        LEFT JOIN plans p ON i.planId = p.id
        ${whereClause}
      `);
      const countRes = countStmt.get(...params) as { total: number };

      const query = `
        SELECT i.*, 
               b.name as objectName, b.type as objectType, b.taxCode, b.idNumber, b.address as objectAddress,
               p.quarter as planQuarter, p.approvedAt as planApprovedAt,
               CASE 
                 WHEN i.status != 'completed' AND (i.isOverdue = 1 OR (i.dueDate IS NOT NULL AND (i.dueDate < datetime('now', 'localtime') OR i.dueDate < datetime('now')))) THEN 1 
                 ELSE 0 
               END as isOverdue
        FROM inspections i
        JOIN business_objects b ON i.objectId = b.id
        LEFT JOIN plans p ON i.planId = p.id
        ${whereClause}
        ORDER BY i.id DESC
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

  static getById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const query = `
        SELECT i.*, 
               b.name as objectName, b.type as objectType, b.taxCode, b.idNumber, 
               b.representative, b.address as objectAddress,
               p.quarter as planQuarter, p.approvedAt as planApprovedAt,
               CASE 
                 WHEN i.status != 'completed' AND (i.isOverdue = 1 OR (i.dueDate IS NOT NULL AND (i.dueDate < datetime('now', 'localtime') OR i.dueDate < datetime('now')))) THEN 1 
                 ELSE 0 
               END as isOverdue
        FROM inspections i
        JOIN business_objects b ON i.objectId = b.id
        LEFT JOIN plans p ON i.planId = p.id
        WHERE i.id = ?
      `;

      const inspection = db.prepare(query).get(id) as any;


      if (!inspection) {
        res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ kiểm tra.' });
        return;
      }

      // Query checklist items classified by domain
      let checklistItems = db.prepare(`
        SELECT ci.*, d.code as domainCode, d.name as domainName, d.icon as domainIcon, d.color as domainColor
        FROM inspection_checklist_items ci
        JOIN inspection_domains d ON ci.domainId = d.id
        WHERE ci.inspectionId = ?
        ORDER BY ci.domainId ASC, ci.id ASC
      `).all(id) as any[];

      if (checklistItems.length === 0) {
        // Auto-generate default 5-domain checklist items
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

        const insertItem = db.prepare(`
          INSERT INTO inspection_checklist_items (inspectionId, domainId, criteriaCode, criteriaName, result, notes)
          VALUES (?, ?, ?, ?, 'pass', '')
        `);

        db.transaction(() => {
          for (const c of defaultCriteria) {
            insertItem.run(id, c.domainId, c.criteriaCode, c.criteriaName);
          }
        })();

        checklistItems = db.prepare(`
          SELECT ci.*, d.code as domainCode, d.name as domainName, d.icon as domainIcon, d.color as domainColor
          FROM inspection_checklist_items ci
          JOIN inspection_domains d ON ci.domainId = d.id
          WHERE ci.inspectionId = ?
          ORDER BY ci.domainId ASC, ci.id ASC
        `).all(id) as any[];
      }

      inspection.checklistItems = checklistItems;

      res.json({ success: true, data: inspection });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static update(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { checklist, checklistItems, violationCodes, recommendationNote, recommendationTags, lat, lng, severity, status } = req.body;

      const current = db.prepare('SELECT isLocked, status FROM inspections WHERE id = ?').get(id) as Inspection | undefined;

      if (!current) {
        res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ kiểm tra.' });
        return;
      }

      if (current.isLocked === 1) {
        res.status(403).json({ success: false, message: 'Hồ sơ đã được chốt và khóa dữ liệu (RULE-03). Không thể chỉnh sửa.' });
        return;
      }

      const updateTx = db.transaction(() => {
        const stmt = db.prepare(`
          UPDATE inspections 
          SET checklist = ?,
              violationCodes = ?,
              recommendationNote = ?,
              recommendationTags = ?,
              lat = ?,
              lng = ?,
              severity = ?,
              status = ?
          WHERE id = ?
        `);

        stmt.run(
          typeof checklist === 'object' ? JSON.stringify(checklist) : checklist || null,
          typeof violationCodes === 'object' ? JSON.stringify(violationCodes) : violationCodes || null,
          recommendationNote || '',
          typeof recommendationTags === 'object' ? JSON.stringify(recommendationTags) : recommendationTags || null,
          lat || null,
          lng || null,
          severity || 1,
          status || 'in_progress',
          id
        );

        if (Array.isArray(checklistItems)) {
          const updateItemStmt = db.prepare(`
            UPDATE inspection_checklist_items
            SET result = ?, violationCodeId = ?, notes = ?
            WHERE id = ? AND inspectionId = ?
          `);
          const insertItemStmt = db.prepare(`
            INSERT INTO inspection_checklist_items (inspectionId, domainId, criteriaCode, criteriaName, result, violationCodeId, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);

          for (const item of checklistItems) {
            if (item.id) {
              updateItemStmt.run(item.result || 'pass', item.violationCodeId || null, item.notes || '', item.id, id);
            } else {
              insertItemStmt.run(id, item.domainId, item.criteriaCode, item.criteriaName, item.result || 'pass', item.violationCodeId || null, item.notes || '');
            }
          }
        }
      });

      updateTx();

      res.json({ success: true, message: 'Cập nhật hồ sơ kiểm tra thực địa thành công.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static uploadEvidence(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        res.status(400).json({ success: false, message: 'Chưa đính kèm file bằng chứng.' });
        return;
      }

      const current = db.prepare('SELECT evidenceFiles, isLocked FROM inspections WHERE id = ?').get(id) as Inspection | undefined;

      if (!current) {
        res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ kiểm tra.' });
        return;
      }

      if (current.isLocked === 1) {
        res.status(403).json({ success: false, message: 'Hồ sơ đã bị khóa.' });
        return;
      }

      let fileList: string[] = [];
      try {
        if (current.evidenceFiles) {
          fileList = JSON.parse(current.evidenceFiles);
        }
      } catch (e) {
        fileList = [];
      }

      const relativePath = `/uploads/${file.filename}`;
      fileList.push(relativePath);

      db.prepare('UPDATE inspections SET evidenceFiles = ? WHERE id = ?').run(JSON.stringify(fileList), id);

      res.json({
        success: true,
        message: 'Tải lên tệp bằng chứng thành công.',
        filePath: relativePath,
        evidenceFiles: fileList
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static complete(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const current = db.prepare('SELECT objectId, isLocked FROM inspections WHERE id = ?').get(id) as Inspection | undefined;

      if (!current) {
        res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ kiểm tra.' });
        return;
      }

      if (current.isLocked === 1) {
        res.status(400).json({ success: false, message: 'Hồ sơ này đã được hoàn thành trước đó.' });
        return;
      }

      const currentYear = new Date().getFullYear();

      const completeTx = db.transaction(() => {
        db.prepare(`
          UPDATE inspections 
          SET status = 'completed', isLocked = 1, completedAt = datetime('now')
          WHERE id = ?
        `).run(id);

        db.prepare(`
          UPDATE business_objects 
          SET lastCheckedYear = ?
          WHERE id = ?
        `).run(currentYear, current.objectId);
      });

      completeTx();

      res.json({ success: true, message: 'Đã hoàn thành và chốt khóa hồ sơ kiểm tra thực địa.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getRecommendations(req: Request, res: Response): void {
    try {
      const { tag, ward } = req.query;

      let whereClause = "WHERE i.recommendationNote IS NOT NULL AND i.recommendationNote != ''";
      const params: any[] = [];

      if (ward) {
        whereClause += ' AND i.ward = ?';
        params.push(ward);
      }
      if (tag) {
        whereClause += ' AND i.recommendationTags LIKE ?';
        params.push(`%${tag}%`);
      }

      const query = `
        SELECT i.id, i.recommendationNote, i.recommendationTags, i.completedAt, i.ward,
               b.name as objectName, b.type as objectType, b.address as objectAddress
        FROM inspections i
        JOIN business_objects b ON i.objectId = b.id
        ${whereClause}
        ORDER BY i.completedAt DESC, i.id DESC
      `;

      const data = db.prepare(query).all(...params);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
