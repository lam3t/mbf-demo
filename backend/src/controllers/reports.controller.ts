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
        whereClause += " AND COALESCE(p.quarter, 'Q2/2026') = ?";
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
               i.inspectionType, i.locationName, i.teamName,
               b.name as objectName, b.type as objectType, b.taxCode, b.idNumber, b.address as objectAddress,
               COALESCE(p.quarter, 'Q2/2026') as planQuarter
        FROM inspections i
        JOIN business_objects b ON i.objectId = b.id
        LEFT JOIN plans p ON i.planId = p.id
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
        whereClause += " AND COALESCE(p.quarter, 'Q2/2026') = ?";
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
               i.inspectionType, i.locationName, i.teamName,
               b.name as objectName, b.type as objectType, b.taxCode, b.idNumber, b.address as objectAddress,
               COALESCE(p.quarter, 'Q2/2026') as planQuarter
        FROM inspections i
        JOIN business_objects b ON i.objectId = b.id
        LEFT JOIN plans p ON i.planId = p.id
        ${whereClause}
        ORDER BY i.completedAt DESC, i.id DESC
      `;

      const items = db.prepare(query).all(...params) as any[];

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'MBF - Hệ thống Quản lý Kiểm tra';
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
        whereClause += " AND COALESCE(p.quarter, 'Q2/2026') = ?";
        params.push(quarter);
      }

      const query = `
        SELECT COALESCE(p.quarter, 'Q2/2026') as quarter, i.ward,
               COUNT(i.id) as totalInspections,
               SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as completedCount,
               SUM(CASE WHEN i.status = 'in_progress' THEN 1 ELSE 0 END) as inProgressCount,
               SUM(CASE WHEN i.status = 'not_started' THEN 1 ELSE 0 END) as notStartedCount,
               SUM(CASE WHEN i.violationCodes IS NOT NULL AND i.violationCodes != '[]' AND i.violationCodes != '' THEN 1 ELSE 0 END) as violationCount,
               ROUND(CAST(SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(i.id) * 100, 1) as completionRate
        FROM inspections i
        LEFT JOIN plans p ON i.planId = p.id
        ${whereClause}
        GROUP BY COALESCE(p.quarter, 'Q2/2026'), i.ward
        ORDER BY quarter DESC, completionRate ASC
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
        whereClause += " AND COALESCE(p.quarter, 'Q2/2026') = ?";
        params.push(quarter);
      }

      const query = `
        SELECT COALESCE(p.quarter, 'Q2/2026') as quarter, i.ward,
               COUNT(i.id) as totalInspections,
               SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as completedCount,
               SUM(CASE WHEN i.status = 'in_progress' THEN 1 ELSE 0 END) as inProgressCount,
               SUM(CASE WHEN i.status = 'not_started' THEN 1 ELSE 0 END) as notStartedCount,
               SUM(CASE WHEN i.violationCodes IS NOT NULL AND i.violationCodes != '[]' AND i.violationCodes != '' THEN 1 ELSE 0 END) as violationCount,
               ROUND(CAST(SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(i.id) * 100, 1) as completionRate
        FROM inspections i
        LEFT JOIN plans p ON i.planId = p.id
        ${whereClause}
        GROUP BY COALESCE(p.quarter, 'Q2/2026'), i.ward
        ORDER BY quarter DESC, completionRate ASC
      `;

      const items = db.prepare(query).all(...params) as any[];

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'MBF - Hệ thống Quản lý Kiểm tra';
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

  /**
   * 6. Quản lý báo cáo, giải trình đối với các doanh nghiệp/cơ sở chưa được kiểm tra theo kế hoạch
   * GET /api/reports/uninspected
   */
  static getUninspectedReport(req: Request, res: Response): void {
    try {
      const { quarter, ward, explanationStatus, inspectionType } = req.query;

      let baseFilter = 'WHERE 1=1';
      const baseParams: any[] = [];

      if (quarter) {
        baseFilter += " AND COALESCE(p.quarter, 'Q2/2026') = ?";
        baseParams.push(quarter);
      }
      if (ward) {
        baseFilter += ' AND i.ward = ?';
        baseParams.push(ward);
      }
      if (inspectionType) {
        baseFilter += ' AND i.inspectionType = ?';
        baseParams.push(inspectionType);
      }

      // Summary KPI across all planned/assigned tasks matching quarter/ward
      const summaryQuery = `
        SELECT
          COUNT(i.id) as totalPlanned,
          SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) as completedCount,
          SUM(CASE WHEN i.status != 'completed' THEN 1 ELSE 0 END) as uninspectedCount,
          SUM(CASE WHEN i.status != 'completed' AND i.explanationContent IS NOT NULL AND i.explanationContent != '' THEN 1 ELSE 0 END) as explainedCount,
          SUM(CASE WHEN i.status != 'completed' AND (i.explanationContent IS NULL OR i.explanationContent = '') THEN 1 ELSE 0 END) as unexplainedCount,
          ROUND(CAST(SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / MAX(1, COUNT(i.id)) * 100, 1) as completionRate
        FROM inspections i
        LEFT JOIN plans p ON i.planId = p.id
        ${baseFilter}
      `;
      const summary = db.prepare(summaryQuery).get(...baseParams) as any;

      let itemFilter = `${baseFilter} AND i.status != 'completed'`;
      const itemParams = [...baseParams];

      if (explanationStatus) {
        if (explanationStatus === 'none') {
          itemFilter += " AND (i.explanationStatus IS NULL OR i.explanationStatus = 'none' OR i.explanationContent IS NULL OR i.explanationContent = '')";
        } else {
          itemFilter += ' AND i.explanationStatus = ?';
          itemParams.push(explanationStatus);
        }
      }

      const itemsQuery = `
        SELECT i.id, i.planId, i.objectId, i.ward, i.status, i.dueDate, i.isOverdue,
               i.locationId, i.locationName, i.locationAddress,
               i.inspectionType, i.teamId, i.teamName, i.inspectingUnit, i.scheduledDate,
               i.uninspectedReason, i.explanationContent, COALESCE(i.explanationStatus, 'none') as explanationStatus,
               i.explainedBy, i.explainedByName, i.explainedAt, i.explanationReviewNote,
               b.name as objectName, b.type as objectType, b.taxCode, b.idNumber, b.address as objectAddress,
               b.hasForeignElement, b.field as objectField,
               COALESCE(p.quarter, 'Q2/2026') as planQuarter
        FROM inspections i
        JOIN business_objects b ON i.objectId = b.id
        LEFT JOIN plans p ON i.planId = p.id
        ${itemFilter}
        ORDER BY
          CASE WHEN i.explanationContent IS NOT NULL AND i.explanationContent != '' THEN 0 ELSE 1 END ASC,
          i.id DESC
      `;

      const items = db.prepare(itemsQuery).all(...itemParams);

      res.json({
        success: true,
        data: {
          summary: {
            totalPlanned: summary?.totalPlanned || 0,
            completedCount: summary?.completedCount || 0,
            uninspectedCount: summary?.uninspectedCount || 0,
            explainedCount: summary?.explainedCount || 0,
            unexplainedCount: summary?.unexplainedCount || 0,
            completionRate: summary?.completionRate || 0
          },
          items
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * GET /api/reports/uninspected/export
   */
  static async exportUninspectedExcel(req: Request, res: Response): Promise<void> {
    try {
      const { quarter, ward, explanationStatus } = req.query;

      let whereClause = "WHERE i.status != 'completed'";
      const params: any[] = [];

      if (quarter) {
        whereClause += " AND COALESCE(p.quarter, 'Q2/2026') = ?";
        params.push(quarter);
      }
      if (ward) {
        whereClause += ' AND i.ward = ?';
        params.push(ward);
      }
      if (explanationStatus) {
        if (explanationStatus === 'none') {
          whereClause += " AND (i.explanationStatus IS NULL OR i.explanationStatus = 'none' OR i.explanationContent IS NULL OR i.explanationContent = '')";
        } else {
          whereClause += ' AND i.explanationStatus = ?';
          params.push(explanationStatus);
        }
      }

      const query = `
        SELECT i.id, i.ward, i.status, i.dueDate,
               i.locationName, i.locationAddress, i.inspectionType, i.teamName,
               i.uninspectedReason, i.explanationContent, COALESCE(i.explanationStatus, 'none') as explanationStatus,
               i.explainedByName, i.explainedAt, i.explanationReviewNote,
               b.name as objectName, b.taxCode, b.idNumber, b.address as objectAddress,
               COALESCE(p.quarter, 'Q2/2026') as planQuarter
        FROM inspections i
        JOIN business_objects b ON i.objectId = b.id
        LEFT JOIN plans p ON i.planId = p.id
        ${whereClause}
        ORDER BY i.ward ASC, i.id DESC
      `;

      const items = db.prepare(query).all(...params) as any[];

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'MBF - Hệ thống Quản lý Kiểm tra';
      const worksheet = workbook.addWorksheet('Giải trình Chưa kiểm tra');

      worksheet.mergeCells('A1:J1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'BÁO CÁO TỔNG HỢP & GIẢI TRÌNH CÁC CƠ SỞ CHƯA ĐƯỢC KIỂM TRA THEO KẾ HOẠCH';
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 30;

      worksheet.mergeCells('A2:J2');
      const subCell = worksheet.getCell('A2');
      subCell.value = `Thời gian xuất: ${new Date().toLocaleString('vi-VN')} | Đơn vị: ${ward || 'Tất cả đơn vị'} | Kỳ: ${quarter || 'Tất cả các Quý'}`;
      subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
      subCell.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.addRow([]);

      const headers = [
        'STT',
        'Mã HS',
        'Kỳ KH',
        'Đơn vị / Phường',
        'Tên Doanh nghiệp & Cơ sở',
        'Loại hình KT',
        'Nguyên nhân chưa kiểm tra',
        'Nội dung giải trình chi tiết',
        'Tình trạng xử lý',
        'Cán bộ giải trình / Thời gian'
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

      const statusLabels: Record<string, string> = {
        none: 'Chưa giải trình',
        pending_review: 'Đã giải trình - Chờ lãnh đạo duyệt',
        accepted: 'Đã chấp thuận giải trình',
        rescheduled: 'Đã chuyển lịch kiểm tra bù'
      };

      const typeLabels: Record<string, string> = {
        planned: 'Theo kế hoạch/định kỳ',
        adhoc: 'Kiểm tra đột xuất',
        professional_request: 'Theo yêu cầu nghiệp vụ'
      };

      items.forEach((item, index) => {
        const row = worksheet.addRow([
          index + 1,
          `#${item.id}`,
          item.planQuarter,
          item.ward,
          `${item.objectName}${item.locationName ? ' - ' + item.locationName : ''} (${item.locationAddress || item.objectAddress})`,
          typeLabels[item.inspectionType] || 'Theo kế hoạch',
          item.uninspectedReason || 'Chưa cập nhật nguyên nhân',
          item.explanationContent || 'Chưa có nội dung giải trình',
          statusLabels[item.explanationStatus] || 'Chưa giải trình',
          item.explainedByName ? `${item.explainedByName} (${item.explainedAt || ''})` : '-'
        ]);

        row.alignment = { vertical: 'middle', wrapText: true };
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
        { width: 6 },
        { width: 10 },
        { width: 10 },
        { width: 20 },
        { width: 35 },
        { width: 22 },
        { width: 28 },
        { width: 45 },
        { width: 24 },
        { width: 25 }
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Bao_cao_Giai_trinh_Chua_Kiem_tra_${Date.now()}.xlsx"`);

      const buffer = await workbook.xlsx.writeBuffer();
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
