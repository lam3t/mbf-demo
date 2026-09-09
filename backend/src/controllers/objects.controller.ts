import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { db } from '../db/connection';
import { BusinessObject } from '../types';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class ObjectsController {
  /**
   * 1. GET /api/objects - Filter & Pagination
   */
  static getAll(req: Request, res: Response): void {
    try {
      const { type, status, ward, search, page = '1', limit = '50' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (type) {
        whereClause += ' AND b.type = ?';
        params.push(type);
      }
      if (status) {
        whereClause += ' AND b.status = ?';
        params.push(status);
      }
      if (ward) {
        whereClause += ' AND b.ward = ?';
        params.push(ward);
      }
      if (search) {
        whereClause += ' AND (b.name LIKE ? OR b.taxCode LIKE ? OR b.idNumber LIKE ? OR b.address LIKE ? OR b.representative LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term, term, term);
      }

      // Count total
      const countStmt = db.prepare(`SELECT COUNT(*) as total FROM business_objects b ${whereClause}`);
      const countRes = countStmt.get(...params) as { total: number };

      // Query data
      const query = `
        SELECT b.*, u.fullName as createdByName, p.quarter as planQuarter, p.ward as planWard
        FROM business_objects b
        LEFT JOIN users u ON b.createdBy = u.id
        LEFT JOIN plans p ON b.planId = p.id
        ${whereClause}
        ORDER BY b.id DESC
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
   * 2. GET /api/objects/check/:idOrTaxCode - Check duplicate & cross-ward plan lock
   */
  static checkDuplicate(req: AuthenticatedRequest, res: Response): void {
    try {
      const { idOrTaxCode } = req.params;
      const currentYear = new Date().getFullYear().toString();
      const currentUserWard = req.user?.unit || '';

      // Find object by taxCode or idNumber
      const objStmt = db.prepare(`
        SELECT * FROM business_objects 
        WHERE taxCode = ? OR idNumber = ?
      `);
      const obj = objStmt.get(idOrTaxCode, idOrTaxCode) as BusinessObject | undefined;

      if (!obj) {
        res.json({ success: true, exists: false });
        return;
      }

      // Check RULE-01: Inspected & completed in current financial year
      const inspectionCheckStmt = db.prepare(`
        SELECT i.id, i.completedAt, i.ward 
        FROM inspections i
        WHERE i.objectId = ? AND i.status = 'completed' AND (i.completedAt LIKE ? OR i.createdAt LIKE ?)
      `);
      const completedInspection = inspectionCheckStmt.get(obj.id, `%${currentYear}%`, `%${currentYear}%`) as any;

      // Check if object is in any plan for the current year
      const planCheckStmt = db.prepare(`
        SELECT p.id, p.ward, p.quarter, p.status 
        FROM plan_items pi
        JOIN plans p ON pi.planId = p.id
        WHERE pi.objectId = ? AND p.quarter LIKE ?
      `);
      const plan = planCheckStmt.get(obj.id, `%${currentYear}%`) as { id: number; ward: string; quarter: string; status: string } | undefined;

      // If object belongs to another ward's plan or is locked
      let lockedByWard: string | null = null;
      if (plan) {
        lockedByWard = plan.ward;
      } else if (obj.ward && currentUserWard && !currentUserWard.includes(obj.ward) && !currentUserWard.includes('TNT')) {
        // Also if object belongs to another ward
        lockedByWard = obj.ward;
      }

      res.json({
        success: true,
        exists: true,
        lockedByWard,
        planQuarter: plan ? plan.quarter : null,
        isCompletedThisYear: !!completedInspection,
        lastCheckedYear: obj.lastCheckedYear || (completedInspection ? parseInt(currentYear, 10) : null),
        objectData: obj
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 3. GET /api/objects/:id - Details with Inspections history
   */
  static getById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const stmt = db.prepare(`
        SELECT b.*, u.fullName as createdByName, p.quarter as planQuarter, p.ward as planWard
        FROM business_objects b
        LEFT JOIN users u ON b.createdBy = u.id
        LEFT JOIN plans p ON b.planId = p.id
        WHERE b.id = ?
      `);
      const item = stmt.get(id) as any;

      if (!item) {
        res.status(404).json({ success: false, message: 'Không tìm thấy đối tượng kinh doanh.' });
        return;
      }

      // Query inspection history for this object
      const inspectionsStmt = db.prepare(`
        SELECT i.*, p.quarter as planQuarter, p.approvedAt as planApprovedAt
        FROM inspections i
        LEFT JOIN plans p ON i.planId = p.id
        WHERE i.objectId = ?
        ORDER BY i.id DESC
      `);
      const inspections = inspectionsStmt.all(id);

      res.json({
        success: true,
        data: {
          ...item,
          inspections
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 4. POST /api/objects - Create object with type-based validation & RULE-01
   */
  static create(req: AuthenticatedRequest, res: Response): void {
    try {
      const { type, taxCode, idNumber, name, representative, address, ward, status = 'active' } = req.body;
      const userId = req.user?.id || null;
      const currentYear = new Date().getFullYear();

      // Validate required fields by type
      if (!type || !name || !address || !ward) {
        res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ loại hình, tên cơ sở, địa chỉ và phường quản lý.' });
        return;
      }

      if (type === 'enterprise') {
        if (!taxCode || !representative) {
          res.status(400).json({ success: false, message: 'Doanh nghiệp bắt buộc phải có Mã số thuế (MST) và Người đại diện pháp luật.' });
          return;
        }
      } else if (type === 'household') {
        if (!idNumber) {
          res.status(400).json({ success: false, message: 'Hộ kinh doanh bắt buộc phải có Số CCCD chủ hộ.' });
          return;
        }
      } else if (type === 'individual') {
        if (!idNumber) {
          res.status(400).json({ success: false, message: 'Cá nhân kinh doanh bắt buộc phải có Số CCCD.' });
          return;
        }
      }

      // Check duplicate identifier & lock in other ward
      const duplicateStmt = db.prepare(`
        SELECT id, ward, lastCheckedYear FROM business_objects 
        WHERE (taxCode = ? AND taxCode IS NOT NULL AND taxCode != '') 
           OR (idNumber = ? AND idNumber IS NOT NULL AND idNumber != '')
      `);
      const duplicate = duplicateStmt.get(taxCode || null, idNumber || null) as { id: number; ward: string; lastCheckedYear?: number } | undefined;

      if (duplicate) {
        // Check RULE-01: If completed inspection in current financial year
        if (duplicate.lastCheckedYear === currentYear) {
          res.status(400).json({
            success: false,
            message: `RULE-01: Đối tượng đã hoàn thành kiểm tra trong năm ${currentYear}. Không được phép thêm mới/lập kế hoạch trùng lặp.`
          });
          return;
        }

        // Check if locked by another ward's plan
        const planCheckStmt = db.prepare(`
          SELECT p.ward FROM plan_items pi
          JOIN plans p ON pi.planId = p.id
          WHERE pi.objectId = ? AND p.quarter LIKE ?
        `);
        const plan = planCheckStmt.get(duplicate.id, `%${currentYear}%`) as { ward: string } | undefined;

        const lockedWard = plan ? plan.ward : duplicate.ward;
        res.status(400).json({
          success: false,
          message: `Đối tượng đã thuộc quản lý kế hoạch kiểm tra của ${lockedWard} - Không được phép thêm mới.`
        });
        return;
      }

      const stmt = db.prepare(`
        INSERT INTO business_objects (type, taxCode, idNumber, name, representative, address, ward, status, createdBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const result = stmt.run(
        type,
        taxCode || null,
        idNumber || null,
        name,
        representative || null,
        address,
        ward,
        status,
        userId
      );

      res.status(201).json({
        success: true,
        message: 'Thêm mới đối tượng kinh doanh thành công.',
        id: result.lastInsertRowid
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 5. PUT /api/objects/:id - Update object
   */
  static update(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { type, taxCode, idNumber, name, representative, address, ward, status } = req.body;

      const stmt = db.prepare(`
        UPDATE business_objects 
        SET type = ?, taxCode = ?, idNumber = ?, name = ?, representative = ?, address = ?, ward = ?, status = ?
        WHERE id = ?
      `);

      stmt.run(type, taxCode || null, idNumber || null, name, representative || null, address, ward, status, id);
      res.json({ success: true, message: 'Cập nhật thông tin đối tượng thành công.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 6. POST /api/objects/import - Excel File / CSV / JSON Batch Import with validation
   */
  static importBatch(req: AuthenticatedRequest, res: Response): void {
    try {
      const userId = req.user?.id || null;
      let rawRows: any[] = [];

      // Check if file was uploaded via multer
      if (req.file) {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        
        // Parse all sheets
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const sheetData: any[] = XLSX.utils.sheet_to_json(sheet);

          let detectedType: 'enterprise' | 'household' | 'individual' = 'enterprise';
          const lowerSheet = sheetName.toLowerCase();
          if (lowerSheet.includes('hộ') || lowerSheet.includes('ho kinh doanh')) {
            detectedType = 'household';
          } else if (lowerSheet.includes('cá nhân') || lowerSheet.includes('ca nhan')) {
            detectedType = 'individual';
          }

          sheetData.forEach((row, idx) => {
            rawRows.push({
              sheetName,
              rowNumber: idx + 2, // Header is row 1
              type: row['Loại hình'] || row['type'] || detectedType,
              taxCode: row['Mã số thuế'] || row['MST'] || row['taxCode'],
              idNumber: row['Số CCCD'] || row['CCCD'] || row['idNumber'],
              name: row['Tên cơ sở'] || row['Tên doanh nghiệp'] || row['Tên hộ kinh doanh'] || row['Họ và tên'] || row['name'],
              representative: row['Người đại diện'] || row['Chủ hộ'] || row['representative'],
              address: row['Địa chỉ'] || row['address'],
              ward: row['Phường quản lý'] || row['Phường'] || row['ward'],
              status: row['Trạng thái'] || row['status'] || 'active'
            });
          });
        });
      } else if (Array.isArray(req.body.items)) {
        rawRows = req.body.items.map((it: any, idx: number) => ({
          ...it,
          rowNumber: idx + 1,
          sheetName: 'Danh sách'
        }));
      } else {
        res.status(400).json({ success: false, message: 'Vui lòng tải lên file Excel (.xlsx) hoặc cung cấp mảng items.' });
        return;
      }

      if (rawRows.length === 0) {
        res.status(400).json({ success: false, message: 'File tải lên không có dữ liệu bản ghi nào.' });
        return;
      }

      let successCount = 0;
      const errors: Array<{ row: number; sheet?: string; identifier?: string; reason: string }> = [];

      const checkDupStmt = db.prepare(`
        SELECT id, ward FROM business_objects 
        WHERE (taxCode = ? AND taxCode IS NOT NULL AND taxCode != '') 
           OR (idNumber = ? AND idNumber IS NOT NULL AND idNumber != '')
      `);

      const insertStmt = db.prepare(`
        INSERT INTO business_objects (type, taxCode, idNumber, name, representative, address, ward, status, createdBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const transaction = db.transaction((rows: any[]) => {
        for (const item of rows) {
          const rowNum = item.rowNumber;
          const identifier = item.taxCode || item.idNumber || 'Không có';

          if (!item.name || !item.address || !item.ward) {
            errors.push({
              row: rowNum,
              sheet: item.sheetName,
              identifier,
              reason: 'Thiếu thông tin bắt buộc (Tên cơ sở, Địa chỉ hoặc Phường quản lý)'
            });
            continue;
          }

          if (item.type === 'enterprise' && !item.taxCode) {
            errors.push({
              row: rowNum,
              sheet: item.sheetName,
              identifier,
              reason: 'Doanh nghiệp bắt buộc phải có Mã số thuế (MST)'
            });
            continue;
          }

          if ((item.type === 'household' || item.type === 'individual') && !item.idNumber) {
            errors.push({
              row: rowNum,
              sheet: item.sheetName,
              identifier,
              reason: 'Hộ kinh doanh / Cá nhân bắt buộc phải có số CCCD'
            });
            continue;
          }

          const existing = checkDupStmt.get(item.taxCode || null, item.idNumber || null) as { id: number; ward: string } | undefined;
          if (existing) {
            errors.push({
              row: rowNum,
              sheet: item.sheetName,
              identifier,
              reason: `Mã định danh đã tồn tại (thuộc quản lý của ${existing.ward})`
            });
            continue;
          }

          insertStmt.run(
            item.type,
            item.taxCode || null,
            item.idNumber || null,
            item.name,
            item.representative || null,
            item.address,
            item.ward,
            item.status === 'suspended' ? 'suspended' : 'active',
            userId
          );
          successCount++;
        }
      });

      transaction(rawRows);

      res.json({
        success: true,
        message: `Đã import thành công ${successCount}/${rawRows.length} bản ghi.`,
        successCount,
        totalRows: rawRows.length,
        errors
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 7. GET /api/objects/import/template - Generate multi-sheet template Excel file
   */
  static getImportTemplate(req: Request, res: Response): void {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Doanh nghiệp
      const enterpriseHeaders = [
        { 'Mã số thuế': '0101234567', 'Tên doanh nghiệp': 'Công ty TNHH Demo Công nghệ', 'Người đại diện': 'Nguyễn Văn A', 'Địa chỉ': '123 Phố Huế', 'Phường quản lý': 'Phường Hàng Bài', 'Trạng thái': 'active' },
        { 'Mã số thuế': '0107654321', 'Tên doanh nghiệp': 'Công ty CP Xây Dựng Thủ Đô', 'Người đại diện': 'Trần Thị B', 'Địa chỉ': '456 Lê Trọng Tấn', 'Phường quản lý': 'Phường Khương Mai', 'Trạng thái': 'active' }
      ];
      const wsEnterprise = XLSX.utils.json_to_sheet(enterpriseHeaders);
      XLSX.utils.book_append_sheet(wb, wsEnterprise, 'Doanh nghiệp');

      // Sheet 2: Hộ kinh doanh
      const householdHeaders = [
        { 'Số CCCD': '001090012345', 'Tên hộ kinh doanh': 'Hộ kinh doanh Tạp Hóa Bình An', 'Mã số thuế': '8012345678', 'Địa chỉ': '12 Hoàng Văn Thái', 'Phường quản lý': 'Phường Khương Mai', 'Trạng thái': 'active' },
        { 'Số CCCD': '001090054321', 'Tên hộ kinh doanh': 'Cửa hàng Kim Khí Thành Đạt', 'Mã số thuế': '8098765432', 'Địa chỉ': '88 Đại La', 'Phường quản lý': 'Phường Đồng Tâm', 'Trạng thái': 'active' }
      ];
      const wsHousehold = XLSX.utils.json_to_sheet(householdHeaders);
      XLSX.utils.book_append_sheet(wb, wsHousehold, 'Hộ kinh doanh');

      // Sheet 3: Cá nhân kinh doanh
      const individualHeaders = [
        { 'Số CCCD': '001085001122', 'Họ và tên': 'Lê Văn C', 'Lĩnh vực kinh doanh': 'Kinh doanh dịch vụ ăn uống', 'Địa chỉ': '25 Tô Ngọc Vân', 'Phường quản lý': 'Phường Quảng An', 'Trạng thái': 'active' },
        { 'Số CCCD': '001088003344', 'Họ và tên': 'Phạm Thị D', 'Lĩnh vực kinh doanh': 'Kinh doanh bán lẻ hàng lưu niệm', 'Địa chỉ': '10 Đinh Tiên Hoàng', 'Phường quản lý': 'Phường Hàng Bài', 'Trạng thái': 'active' }
      ];
      const wsIndividual = XLSX.utils.json_to_sheet(individualHeaders);
      XLSX.utils.book_append_sheet(wb, wsIndividual, 'Cá nhân kinh doanh');

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename="Mau_Import_Doi_Tuong_TNT.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
