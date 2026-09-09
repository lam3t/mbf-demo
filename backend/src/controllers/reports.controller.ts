import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { db } from '../db/connection';

export class ReportsController {
  static getRecommendations(req: Request, res: Response): void {
    try {
      const { quarter, ward, tag } = req.query;

      let whereClause = "WHERE i.recommendationNote IS NOT NULL AND i.recommendationNote != ''";
      const params: any[] = [];

      if (quarter) {
        whereClause += ' AND p.quarter = ?';
        params.push(quarter);
      }
      if (ward) {
        whereClause += ' AND i.ward = ?';
        params.push(ward);
      }
      if (tag) {
        whereClause += ' AND i.recommendationTags LIKE ?';
        params.push(`%${tag}%`);
      }

      const query = `
        SELECT i.id, i.ward, i.recommendationNote, i.recommendationTags, i.severity, i.completedAt,
               b.name as objectName, b.type as objectType, b.taxCode, b.idNumber, b.address as objectAddress,
               p.quarter as planQuarter
        FROM inspections i
        JOIN business_objects b ON i.objectId = b.id
        JOIN plans p ON i.planId = p.id
        ${whereClause}
        ORDER BY i.completedAt DESC, i.id DESC
      `;

      const data = db.prepare(query).all(...params);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async exportRecommendationsExcel(req: Request, res: Response): Promise<void> {
    try {
      const { quarter, ward, tag } = req.query;

      let whereClause = "WHERE i.recommendationNote IS NOT NULL AND i.recommendationNote != ''";
      const params: any[] = [];

      if (quarter) {
        whereClause += ' AND p.quarter = ?';
        params.push(quarter);
      }
      if (ward) {
        whereClause += ' AND i.ward = ?';
        params.push(ward);
      }
      if (tag) {
        whereClause += ' AND i.recommendationTags LIKE ?';
        params.push(`%${tag}%`);
      }

      const query = `
        SELECT i.id, i.ward, i.recommendationNote, i.recommendationTags, i.severity, i.completedAt,
               b.name as objectName, b.type as objectType, b.taxCode, b.idNumber, b.address as objectAddress,
               p.quarter as planQuarter
        FROM inspections i
        JOIN business_objects b ON i.objectId = b.id
        JOIN plans p ON i.planId = p.id
        ${whereClause}
        ORDER BY i.completedAt DESC, i.id DESC
      `;

      const items = db.prepare(query).all(...params) as any[];

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PA04 - Hệ thống Quản lý Kiểm tra';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('Báo cáo Kiến nghị');

      // Title & Header rows
      worksheet.mergeCells('A1:G1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'BÁO CÁO TỔNG HỢP KIẾN NGHỊ & ĐỀ XUẤT XỬ LÝ THỰC ĐỊA';
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 30;

      // Filter summary sub-header
      worksheet.mergeCells('A2:G2');
      const subCell = worksheet.getCell('A2');
      subCell.value = `Thời gian xuất: ${new Date().toLocaleString('vi-VN')} | Đơn vị: ${ward || 'Tất cả các Phường'} | Kỳ: ${quarter || 'Tất cả các Quý'}`;
      subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.addRow([]); // Blank row

      // Table Header
      const headers = [
        'STT',
        'Mã HS',
        'Tên cơ sở kinh doanh',
        'Địa chỉ & Phường',
        'Lĩnh vực kiến nghị',
        'Nội dung kiến nghị / Biện pháp đề xuất',
        'Thời gian ghi nhận'
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Data Rows
      items.forEach((item, index) => {
        let tagsFormatted = '';
        try {
          const parsed = typeof item.recommendationTags === 'string' ? JSON.parse(item.recommendationTags) : item.recommendationTags;
          tagsFormatted = Array.isArray(parsed) ? parsed.join(', ') : (item.recommendationTags || '');
        } catch {
          tagsFormatted = item.recommendationTags || '';
        }

        const row = worksheet.addRow([
          index + 1,
          `#${item.id}`,
          item.objectName,
          `${item.objectAddress} (${item.ward})`,
          tagsFormatted,
          item.recommendationNote,
          item.completedAt || 'Chưa hoàn thành'
        ]);

        row.alignment = { vertical: 'middle' };
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      // Set column widths
      worksheet.columns = [
        { width: 8 },  // STT
        { width: 10 }, // Mã HS
        { width: 35 }, // Tên cơ sở
        { width: 35 }, // Địa chỉ
        { width: 22 }, // Thẻ
        { width: 50 }, // Nội dung
        { width: 22 }  // Ngày
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Bao_cao_Kien_nghi_${Date.now()}.xlsx"`);

      const buffer = await workbook.xlsx.writeBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static getQuarterlySummary(req: Request, res: Response): void {
    try {
      const { quarter } = req.query;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (quarter) {
        whereClause += ' AND p.quarter = ?';
        params.push(quarter);
      }

      const query = `
        SELECT p.quarter, i.ward,
               COUNT(i.id) as totalInspections,
               SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as completedCount,
               SUM(CASE WHEN i.status = 'in_progress' THEN 1 ELSE 0 END) as inProgressCount,
               SUM(CASE WHEN i.status = 'not_started' THEN 1 ELSE 0 END) as notStartedCount,
               SUM(CASE WHEN i.violationCodes IS NOT NULL AND i.violationCodes != '[]' AND i.violationCodes != '' THEN 1 ELSE 0 END) as violationCount,
               ROUND(CAST(SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(i.id) * 100, 1) as completionRate
        FROM inspections i
        JOIN plans p ON i.planId = p.id
        ${whereClause}
        GROUP BY p.quarter, i.ward
        ORDER BY p.quarter DESC, completionRate ASC
      `;

      const data = db.prepare(query).all(...params);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static async exportQuarterlySummaryExcel(req: Request, res: Response): Promise<void> {
    try {
      const { quarter } = req.query;

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (quarter) {
        whereClause += ' AND p.quarter = ?';
        params.push(quarter);
      }

      const query = `
        SELECT p.quarter, i.ward,
               COUNT(i.id) as totalInspections,
               SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as completedCount,
               SUM(CASE WHEN i.status = 'in_progress' THEN 1 ELSE 0 END) as inProgressCount,
               SUM(CASE WHEN i.status = 'not_started' THEN 1 ELSE 0 END) as notStartedCount,
               SUM(CASE WHEN i.violationCodes IS NOT NULL AND i.violationCodes != '[]' AND i.violationCodes != '' THEN 1 ELSE 0 END) as violationCount,
               ROUND(CAST(SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(i.id) * 100, 1) as completionRate
        FROM inspections i
        JOIN plans p ON i.planId = p.id
        ${whereClause}
        GROUP BY p.quarter, i.ward
        ORDER BY p.quarter DESC, completionRate ASC
      `;

      const items = db.prepare(query).all(...params) as any[];

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PA04 - Hệ thống Quản lý Kiểm tra';
      const worksheet = workbook.addWorksheet('Tổng kết Quý');

      // Title
      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'BÁO CÁO TỔNG KẾT TIẾN ĐỘ KIỂM TRA THEO ĐỊA BÀN VÀ QUÝ';
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 30;

      worksheet.mergeCells('A2:H2');
      const subCell = worksheet.getCell('A2');
      subCell.value = `Thời gian xuất: ${new Date().toLocaleString('vi-VN')} | Kỳ báo cáo: ${quarter || 'Tất cả các Quý'}`;
      subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.addRow([]);

      const headers = [
        'STT',
        'Kỳ Kế hoạch',
        'Đơn vị Phường / Xã',
        'Tổng số nhiệm vụ',
        'Đã hoàn thành',
        'Đang kiểm tra',
        'Chưa thực hiện',
        'Số vụ có vi phạm',
        'Tỷ lệ hoàn thành (%)'
      ];

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      items.forEach((item, index) => {
        const row = worksheet.addRow([
          index + 1,
          item.quarter,
          item.ward,
          item.totalInspections,
          item.completedCount,
          item.inProgressCount,
          item.notStartedCount,
          item.violationCount,
          `${item.completionRate || 0}%`
        ]);

        row.alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' }; // Ward name left align

        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        });
      });

      worksheet.columns = [
        { width: 8 },  // STT
        { width: 14 }, // Kỳ
        { width: 28 }, // Phường
        { width: 18 }, // Tổng
        { width: 16 }, // Xong
        { width: 16 }, // Đang làm
        { width: 16 }, // Chưa làm
        { width: 18 }, // Vi phạm
        { width: 22 }  // %
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Bao_cao_Tong_ket_${Date.now()}.xlsx"`);

      const buffer = await workbook.xlsx.writeBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
