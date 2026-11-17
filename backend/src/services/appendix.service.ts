import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { db } from '../db/connection';

export interface Appendix02Row {
  stt: number;
  planItemId: number;
  planId: number;
  objectId: number;
  ward: string;
  quarter: string;
  planStatus: string;
  objectName: string;
  taxCode: string;
  address: string;
  inspectionContent: string;
  inspectionMethod: string;
  leadUnit: string;
  coordinatingUnit: string;
  note: string;
  isDuplicate: boolean;
  isOutOfScope: boolean;
  filterReason?: string;
}

export interface Appendix03Row {
  stt: number;
  inspectionId: number;
  objectId: number;
  planId: number | null;
  ward: string;
  quarter: string;
  objectName: string;
  taxCode: string;
  address: string;
  inspectionContent: string;
  leadUnit: string;
  uninspectedReason: string;
  explanationStatus: string;
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildDocWrapper(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 20mm 15mm 20mm 25mm; }
  body { font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.45; color: #000; }
  table.header-tbl { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  table.header-tbl td { vertical-align: top; text-align: center; border: none; padding: 2px 4px; }
  .org-top { font-size: 12pt; font-weight: bold; text-transform: uppercase; }
  .org-sub { font-size: 12pt; font-weight: bold; text-transform: uppercase; text-decoration: underline; }
  .doc-title { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 14px 0 4px; }
  .doc-subtitle { text-align: center; font-size: 13pt; font-weight: bold; margin: 0 0 12px; }
  .kinh-gui { text-align: center; font-size: 13pt; font-style: italic; margin-bottom: 12px; }
  table.data-tbl { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11.5pt; }
  table.data-tbl th, table.data-tbl td { border: 1px solid #000; padding: 5px 6px; vertical-align: top; }
  table.data-tbl th { font-weight: bold; text-align: center; background: #f3f4f6; }
  .section-h { font-weight: bold; margin-top: 10px; }
  .indent { text-indent: 24px; margin: 4px 0; }
  .sign-tbl { width: 100%; border-collapse: collapse; margin-top: 24px; }
  .sign-tbl td { border: none; width: 50%; text-align: center; vertical-align: top; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function buildOfficialHeader(unitLabel: string, docNumberPlaceholder = 'Số: ......../BC-'): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `
  <table class="header-tbl">
    <tr>
      <td style="width: 44%;">
        <div class="org-top">CÔNG AN TP HÀ NỘI</div>
        <div class="org-sub">${escapeHtml(unitLabel)}</div>
        <div style="font-size: 12pt; margin-top: 4px;">${escapeHtml(docNumberPlaceholder)}</div>
      </td>
      <td style="width: 56%;">
        <div class="org-top">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div class="org-sub">Độc lập – Tự do – Hạnh phúc</div>
        <div style="font-size: 12pt; font-style: italic; margin-top: 4px;">Hà Nội, ngày ${day} tháng ${month} năm ${year}</div>
      </td>
    </tr>
  </table>`;
}

export class AppendixService {
  /**
   * Phụ lục 02: Danh sách DN/HKD/CNKD dự kiến kiểm tra (Đầu quý & CATP lọc trùng, lọc sai diện)
   */
  static getAppendix02(params: {
    quarter?: string;
    ward?: string;
    deduplicate?: boolean;
    excludeOutOfScope?: boolean;
  }) {
    const { quarter, ward, deduplicate = true, excludeOutOfScope = true } = params;

    let where = 'WHERE 1=1';
    const sqlParams: any[] = [];
    if (quarter) {
      where += ' AND p.quarter = ?';
      sqlParams.push(quarter);
    }
    if (ward) {
      where += ' AND p.ward = ?';
      sqlParams.push(ward);
    }

    const rawRows = db
      .prepare(
        `SELECT pi.id as planItemId, pi.planId, pi.objectId, pi.inspectionContent as itemContent,
                p.quarter, p.ward, p.unitName, p.status as planStatus, p.inspectionContent as planContent,
                p.inspectionType, p.approvingDept,
                b.name as objectName, b.type as objectType, b.taxCode, b.idNumber,
                b.address as objectAddress, b.status as objectStatus,
                bl.name as locationName, bl.address as locationAddress
         FROM plan_items pi
         JOIN plans p ON pi.planId = p.id
         JOIN business_objects b ON pi.objectId = b.id
         LEFT JOIN business_locations bl ON pi.locationId = bl.id
         ${where}
         ORDER BY
           CASE p.status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END ASC,
           p.id ASC, pi.id ASC`
      )
      .all(...sqlParams) as any[];

    const seenKeys = new Map<string, { ward: string; planId: number }>();
    const validItems: Appendix02Row[] = [];
    const filteredOutItems: Appendix02Row[] = [];
    let duplicateRemoved = 0;
    let outOfScopeRemoved = 0;

    for (const r of rawRows) {
      const code = (r.taxCode || r.idNumber || '').trim();
      const normName = (r.objectName || '').trim().toLowerCase();
      const dedupeKey = code ? `CODE:${code.toLowerCase()}` : `NAME:${normName}|${(r.objectAddress || '').trim().toLowerCase()}`;

      let isOutOfScope = false;
      let isDuplicate = false;
      let filterReason = '';

      if (r.objectStatus === 'suspended') {
        isOutOfScope = true;
        filterReason = 'Sai diện: Cơ sở đã tạm ngừng hoạt động';
      } else if (!code && !normName) {
        isOutOfScope = true;
        filterReason = 'Sai diện: Thiếu thông tin định danh (MST/CCCD)';
      }

      if (!isOutOfScope && seenKeys.has(dedupeKey)) {
        const first = seenKeys.get(dedupeKey)!;
        isDuplicate = true;
        filterReason = `Trùng cơ sở (đã có trong kế hoạch #${first.planId} - ${first.ward})`;
      } else if (!isOutOfScope) {
        seenKeys.set(dedupeKey, { ward: r.ward, planId: r.planId });
      }

      const displayName = r.locationName ? `${r.locationName} - ${r.objectName}` : r.objectName;
      const displayAddress = r.locationAddress || r.objectAddress || r.ward;
      const row: Appendix02Row = {
        stt: 0,
        planItemId: r.planItemId,
        planId: r.planId,
        objectId: r.objectId,
        ward: r.ward,
        quarter: r.quarter,
        planStatus: r.planStatus,
        objectName: displayName,
        taxCode: code || '—',
        address: displayAddress,
        inspectionContent: r.itemContent || r.planContent || 'Kiểm tra việc chấp hành quy định pháp luật',
        inspectionMethod: r.inspectionType === 'remote' ? 'Kiểm tra trực tuyến/từ xa' : 'Kiểm tra trực tiếp',
        leadUnit: r.unitName || r.ward,
        coordinatingUnit: r.approvingDept || (r.ward && r.unitName !== r.ward ? r.ward : 'UBND / Công an phường phối hợp'),
        note: filterReason || '',
        isDuplicate,
        isOutOfScope,
        filterReason: filterReason || undefined
      };

      const shouldRemove = (deduplicate && isDuplicate) || (excludeOutOfScope && isOutOfScope);
      if (shouldRemove) {
        if (isDuplicate) duplicateRemoved++;
        if (isOutOfScope) outOfScopeRemoved++;
        filteredOutItems.push(row);
      } else {
        row.stt = validItems.length + 1;
        validItems.push(row);
      }
    }

    return {
      items: validItems,
      filteredOutItems,
      stats: {
        totalRaw: rawRows.length,
        duplicateRemoved,
        outOfScopeRemoved,
        totalValid: validItems.length
      }
    };
  }

  static async exportAppendix02(params: {
    quarter?: string;
    ward?: string;
    deduplicate?: boolean;
    excludeOutOfScope?: boolean;
    format?: 'excel' | 'doc';
  }): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const { items } = this.getAppendix02(params);
    const quarterLabel = params.quarter || 'Q2/2026';
    const unitLabel = params.ward ? params.ward.toUpperCase() : 'PHÒNG PA04 (TỔNG HỢP CATP)';

    if (params.format === 'doc') {
      const rowsHtml = items
        .map(
          (r) => `
        <tr>
          <td style="text-align:center;">${r.stt}</td>
          <td>${escapeHtml(r.objectName)}</td>
          <td style="text-align:center;">${escapeHtml(r.taxCode)}</td>
          <td>${escapeHtml(r.address)}</td>
          <td>${escapeHtml(r.inspectionContent)}</td>
          <td>${escapeHtml(r.inspectionMethod)}</td>
          <td>${escapeHtml(r.leadUnit)}</td>
          <td>${escapeHtml(r.coordinatingUnit)}</td>
          <td>${escapeHtml(r.note)}</td>
        </tr>`
        )
        .join('');

      const body = `
        <div style="font-size: 11pt; font-style: italic; margin-bottom: 6px;">Phụ lục 02</div>
        ${buildOfficialHeader(unitLabel, 'Số: ......../BC-')}
        <div class="doc-title">BÁO CÁO</div>
        <div class="doc-subtitle">Đề xuất danh sách doanh nghiệp, hộ kinh doanh, cá nhân kinh doanh dự kiến kiểm tra trong ${escapeHtml(quarterLabel)}</div>
        <div class="kinh-gui">Kính gửi: Đồng chí Giám đốc Công an thành phố Hà Nội (qua PA04)</div>
        <p class="indent">${escapeHtml(params.ward || 'Công an các đơn vị thuộc CATP')} kính báo cáo và đề xuất danh sách doanh nghiệp, hộ kinh doanh, cá nhân kinh doanh dự kiến kiểm tra trong ${escapeHtml(quarterLabel)} như sau:</p>
        <table class="data-tbl">
          <thead>
            <tr>
              <th style="width:4%;">STT</th>
              <th style="width:16%;">Tổ chức, cá nhân được kiểm tra (DN/HKD/CNKD)</th>
              <th style="width:10%;">MST</th>
              <th style="width:14%;">Địa chỉ</th>
              <th style="width:18%;">Nội dung kiểm tra</th>
              <th style="width:10%;">Hình thức kiểm tra</th>
              <th style="width:11%;">Đơn vị chủ trì</th>
              <th style="width:10%;">Đơn vị phối hợp</th>
              <th style="width:7%;">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="9" style="text-align:center;">Không có dữ liệu</td></tr>'}
          </tbody>
        </table>
        <p class="indent" style="margin-top: 10px;">${escapeHtml(params.ward || 'Đơn vị tổng hợp')} báo cáo để đồng chí biết, chỉ đạo./.</p>
      `;

      const html = buildDocWrapper(`Phu luc 02 - ${quarterLabel}`, body);
      return {
        buffer: Buffer.from('\ufeff' + html, 'utf-8'),
        contentType: 'application/msword; charset=utf-8',
        filename: `Phu_luc_02_Du_kien_${quarterLabel.replace('/', '_')}.doc`
      };
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'CATP Hà Nội - Hệ thống Quản lý Kiểm tra';
    const ws = wb.addWorksheet('Phụ lục 02');

    ws.mergeCells('A1:I1');
    ws.getCell('A1').value = 'PHỤ LỤC 02 - DANH SÁCH DOANH NGHIỆP, HỘ KINH DOANH, CÁ NHÂN KINH DOANH DỰ KIẾN KIỂM TRA';
    ws.getCell('A1').font = { name: 'Times New Roman', size: 13, bold: true, color: { argb: 'FF1E3A8A' } };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    ws.mergeCells('A2:I2');
    ws.getCell('A2').value = `Kỳ: ${quarterLabel} | Đơn vị: ${params.ward || 'Tổng hợp toàn CATP (đã lọc trùng & sai diện)'}`;
    ws.getCell('A2').font = { name: 'Times New Roman', size: 11, italic: true };
    ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

    ws.addRow([]);
    const headerRow = ws.addRow([
      'STT',
      'Tổ chức, cá nhân được kiểm tra (DN/HKD/CNKD)',
      'MST',
      'Địa chỉ',
      'Nội dung kiểm tra',
      'Hình thức kiểm tra',
      'Đơn vị chủ trì',
      'Đơn vị phối hợp',
      'Ghi chú'
    ]);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    for (const r of items) {
      const row = ws.addRow([
        r.stt,
        r.objectName,
        r.taxCode,
        r.address,
        r.inspectionContent,
        r.inspectionMethod,
        r.leadUnit,
        r.coordinatingUnit,
        r.note
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Times New Roman', size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 || colNumber === 3 ? 'center' : 'left', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    }

    ws.columns = [
      { width: 6 },
      { width: 32 },
      { width: 15 },
      { width: 26 },
      { width: 34 },
      { width: 20 },
      { width: 24 },
      { width: 22 },
      { width: 20 }
    ];

    const buf = await wb.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buf),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `Phu_luc_02_Du_kien_${quarterLabel.replace('/', '_')}.xlsx`
    };
  }

  /**
   * Import danh sách dự kiến kiểm tra từ mẫu Excel Phụ lục 02
   */
  static importAppendix02(params: {
    fileBuffer?: Buffer;
    rows?: any[];
    quarter: string;
    ward: string;
    userId: number;
  }) {
    const { fileBuffer, quarter, ward, userId } = params;
    let parsedRows: any[] = params.rows || [];

    if (fileBuffer) {
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawMatrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

      // Find header row containing "MST" or "Tổ chức"
      let headerIdx = rawMatrix.findIndex((row) =>
        row.some((c) => String(c).toLowerCase().includes('mst') || String(c).toLowerCase().includes('tổ chức'))
      );
      if (headerIdx === -1) headerIdx = 0;

      for (let i = headerIdx + 1; i < rawMatrix.length; i++) {
        const row = rawMatrix[i];
        const name = String(row[1] || '').trim();
        if (!name) continue;
        parsedRows.push({
          objectName: name,
          taxCode: String(row[2] || '').trim(),
          address: String(row[3] || '').trim() || ward,
          inspectionContent: String(row[4] || '').trim(),
          inspectionMethod: String(row[5] || '').trim(),
          leadUnit: String(row[6] || '').trim() || ward,
          coordinatingUnit: String(row[7] || '').trim(),
          note: String(row[8] || '').trim()
        });
      }
    }

    const yearMatch = quarter.match(/(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

    // Find or create draft plan for this ward & quarter
    let plan = db
      .prepare("SELECT * FROM plans WHERE ward = ? AND quarter = ? AND status IN ('draft', 'pending') ORDER BY id DESC LIMIT 1")
      .get(ward, quarter) as any;

    if (!plan) {
      const info = db
        .prepare(
          `INSERT INTO plans (quarter, year, ward, unitName, inspectionType, inspectionContent, status, submittedBy)
           VALUES (?, ?, ?, ?, 'planned', ?, 'draft', ?)`
        )
        .run(quarter, year, ward, ward, 'Kiểm tra theo Kế hoạch 83/KH-CATP-PA04', userId);
      plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(info.lastInsertRowid);
    }

    let importedCount = 0;
    let skippedDuplicates = 0;

    const findObjByTax = db.prepare('SELECT id FROM business_objects WHERE taxCode = ? LIMIT 1');
    const findObjByName = db.prepare('SELECT id FROM business_objects WHERE LOWER(name) = LOWER(?) AND ward = ? LIMIT 1');
    const insertObj = db.prepare(
      `INSERT INTO business_objects (type, taxCode, name, address, ward, status, createdBy)
       VALUES ('enterprise', ?, ?, ?, ?, 'active', ?)`
    );
    const checkPlanItem = db.prepare('SELECT id FROM plan_items WHERE planId = ? AND objectId = ?');
    const insertPlanItem = db.prepare(
      'INSERT INTO plan_items (planId, objectId, inspectionContent) VALUES (?, ?, ?)'
    );

    for (const item of parsedRows) {
      const name = String(item.objectName || '').trim();
      if (!name) continue;
      const taxCode = String(item.taxCode || '').trim();
      const address = String(item.address || ward).trim();
      const content = String(item.inspectionContent || 'Kiểm tra việc chấp hành quy định pháp luật').trim();

      let obj = taxCode ? (findObjByTax.get(taxCode) as any) : null;
      if (!obj) {
        obj = findObjByName.get(name, ward) as any;
      }
      if (!obj) {
        const res = insertObj.run(taxCode || null, name, address, ward, userId);
        obj = { id: Number(res.lastInsertRowid) };
      }

      const existing = checkPlanItem.get(plan.id, obj.id);
      if (existing) {
        skippedDuplicates++;
        continue;
      }

      insertPlanItem.run(plan.id, obj.id, content);
      importedCount++;
    }

    return { planId: plan.id, quarter, ward, importedCount, skippedDuplicates };
  }

  /**
   * Phụ lục 01: Báo cáo định kỳ kết quả kiểm tra (Cuối quý)
   */
  static getAppendix01(params: { quarter?: string; ward?: string }) {
    const { quarter, ward } = params;
    let where = 'WHERE 1=1';
    const sqlParams: any[] = [];
    if (quarter) {
      where += " AND COALESCE(p.quarter, 'Q2/2026') = ?";
      sqlParams.push(quarter);
    }
    if (ward) {
      where += ' AND i.ward = ?';
      sqlParams.push(ward);
    }

    const rows = db
      .prepare(
        `SELECT i.*, p.quarter as planQuarter, p.inspectionType as planType,
                t.teamType, t.leadUnit
         FROM inspections i
         LEFT JOIN plans p ON i.planId = p.id
         LEFT JOIN inspection_teams t ON i.teamId = t.id
         ${where}`
      )
      .all(...sqlParams) as any[];

    const plannedRows = rows.filter((r) => !r.isAdhoc && r.inspectionType !== 'adhoc');
    const plannedCompleted = plannedRows.filter((r) => r.status === 'completed');
    const adhocRows = rows.filter((r) => r.isAdhoc || r.inspectionType === 'adhoc');
    const interAgencyRows = rows.filter((r) => r.teamType === 'inter_agency');
    const deptLedRows = rows.filter(
      (r) => !r.isAdhoc && r.teamType !== 'inter_agency' && r.inspectingUnit && !r.inspectingUnit.toLowerCase().includes('phường') && !r.inspectingUnit.toLowerCase().includes('xã')
    );
    const wardLedRows = rows.filter(
      (r) => !r.isAdhoc && r.teamType !== 'inter_agency' && (!r.inspectingUnit || r.inspectingUnit.toLowerCase().includes('phường') || r.inspectingUnit.toLowerCase().includes('xã'))
    );

    const calcStats = (list: any[]) => {
      const completed = list.filter((r) => r.status === 'completed');
      const violations = completed.filter((r) => {
        if (!r.violationCodes) return false;
        try {
          const parsed = JSON.parse(r.violationCodes);
          return Array.isArray(parsed) && parsed.length > 0;
        } catch {
          return String(r.violationCodes).trim().length > 2;
        }
      });
      const criminalCount = violations.filter((r) => (r.severity || 1) >= 4).length;
      const adminCount = violations.filter((r) => (r.severity || 1) === 2 || (r.severity || 1) === 3).length;
      const warningCount = Math.max(0, completed.length - criminalCount - adminCount);
      return {
        total: list.length,
        completed: completed.length,
        violationsCount: violations.length,
        criminalCount,
        adminCount,
        fineAmount: adminCount * 15000000,
        warningCount
      };
    };

    const notes = rows
      .filter((r) => r.recommendationNote && String(r.recommendationNote).trim() !== '')
      .slice(0, 8)
      .map((r) => `- ${r.ward}: ${r.recommendationNote}`)
      .join('\n');

    return {
      quarter: quarter || 'Q2/2026',
      ward: ward || 'Toàn CATP Hà Nội',
      plannedTotal: plannedRows.length,
      plannedCompleted: plannedCompleted.length,
      carriedOverTotal: rows.filter((r) => r.explanationStatus === 'rescheduled').length,
      carriedOverCompleted: rows.filter((r) => r.explanationStatus === 'rescheduled' && r.status === 'completed').length,
      directCount: plannedCompleted.length,
      remoteCount: 0,
      deptLed: calcStats(deptLedRows),
      wardLed: calcStats(wardLedRows),
      interAgency: calcStats(interAgencyRows),
      adhoc: calcStats(adhocRows),
      officerViolationsCount: 0,
      securityIssuesNote: notes || 'Chưa ghi nhận vấn đề phức tạp nổi cộm về an ninh kinh tế qua công tác kiểm tra.',
      assessmentNote:
        'Các doanh nghiệp, hộ kinh doanh cơ bản chấp hành quy định pháp luật và hợp tác với đoàn kiểm tra theo lịch công khai.',
      proposalLegal: '',
      proposalSolution: 'Tiếp tục chuẩn hóa danh sách dự kiến kiểm tra theo Phụ lục 02 và tăng cường lọc trùng trên hệ thống.',
      proposalOther: ''
    };
  }

  static async exportAppendix01(params: {
    quarter?: string;
    ward?: string;
    format?: 'excel' | 'doc';
    securityIssuesNote?: string;
    assessmentNote?: string;
    proposalLegal?: string;
    proposalSolution?: string;
    proposalOther?: string;
  }): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const data = this.getAppendix01(params);
    const secNote = params.securityIssuesNote ?? data.securityIssuesNote;
    const assessNote = params.assessmentNote ?? data.assessmentNote;
    const propLegal = params.proposalLegal ?? data.proposalLegal;
    const propSol = params.proposalSolution ?? data.proposalSolution;
    const propOther = params.proposalOther ?? data.proposalOther;
    const unitLabel = params.ward ? params.ward.toUpperCase() : 'PHÒNG PA04 (TỔNG HỢP CATP)';

    if (params.format === 'excel') {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Phụ lục 01');
      ws.mergeCells('A1:G1');
      ws.getCell('A1').value = `PHỤ LỤC 01 - BÁO CÁO ĐỊNH KỲ KẾT QUẢ KIỂM TRA (${data.quarter})`;
      ws.getCell('A1').font = { name: 'Times New Roman', size: 13, bold: true, color: { argb: 'FF1E3A8A' } };
      ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 28;

      ws.mergeCells('A2:G2');
      ws.getCell('A2').value = `Đơn vị: ${data.ward}`;
      ws.getCell('A2').alignment = { horizontal: 'center' };
      ws.addRow([]);

      const header = ws.addRow([
        'Nhóm chỉ tiêu',
        'Số đoàn triển khai',
        'Số vụ vi phạm',
        'Xử lý hình sự (vụ)',
        'Xử phạt hành chính (TH)',
        'Tổng tiền phạt (đồng)',
        'Hướng dẫn, nhắc nhở (TH)'
      ]);
      header.eachCell((c) => {
        c.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      const tableRows = [
        ['1.1.a. Phòng nghiệp vụ chủ trì', data.deptLed.completed, data.deptLed.violationsCount, data.deptLed.criminalCount, data.deptLed.adminCount, data.deptLed.fineAmount, data.deptLed.warningCount],
        ['1.1.b. Công an cấp xã/phường chủ trì', data.wardLed.completed, data.wardLed.violationsCount, data.wardLed.criminalCount, data.wardLed.adminCount, data.wardLed.fineAmount, data.wardLed.warningCount],
        ['1.2. Đoàn kiểm tra liên ngành tham gia', `${data.interAgency.completed}/${data.interAgency.total}`, data.interAgency.violationsCount, data.interAgency.criminalCount, data.interAgency.adminCount, data.interAgency.fineAmount, data.interAgency.warningCount],
        ['1.3. Đoàn kiểm tra đột xuất', data.adhoc.completed, data.adhoc.violationsCount, data.adhoc.criminalCount, data.adhoc.adminCount, data.adhoc.fineAmount, data.adhoc.warningCount]
      ];
      for (const r of tableRows) {
        const row = ws.addRow(r);
        row.eachCell((c, idx) => {
          c.font = { name: 'Times New Roman', size: 11 };
          c.alignment = { horizontal: idx === 1 ? 'left' : 'center', vertical: 'middle' };
          c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
      }
      ws.columns = [{ width: 36 }, { width: 18 }, { width: 15 }, { width: 18 }, { width: 22 }, { width: 20 }, { width: 22 }];
      const buf = await wb.xlsx.writeBuffer();
      return {
        buffer: Buffer.from(buf),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `Phu_luc_01_Ket_qua_${data.quarter.replace('/', '_')}.xlsx`
      };
    }

    const fmtMoney = (n: number) => n.toLocaleString('vi-VN');
    const body = `
      <div style="font-size: 11pt; font-style: italic; margin-bottom: 6px;">Phụ lục 01</div>
      ${buildOfficialHeader(unitLabel, 'Số: ......../BC-')}
      <div class="doc-title">BÁO CÁO</div>
      <div class="doc-subtitle">Kết quả kiểm tra việc chấp hành quy định pháp luật thuộc phạm vi quản lý nhà nước của Bộ Công an tại doanh nghiệp, hộ kinh doanh, cá nhân kinh doanh trong ${escapeHtml(data.quarter)}</div>
      <div class="kinh-gui">Kính gửi: Đ/c Giám đốc CATP Hà Nội (qua Phòng PA04)</div>
      <p class="indent">Thực hiện Kế hoạch số 83/KH-CATP-PA04 ngày 30/3/2026 của Công an TP Hà Nội; ${escapeHtml(data.ward)} báo cáo kết quả triển khai Kế hoạch trong ${escapeHtml(data.quarter)} như sau:</p>

      <div class="section-h">1. Việc triển khai các mặt công tác kiểm tra</div>
      <p class="indent">Số lượng đoàn kiểm tra đã triển khai theo lịch dự kiến trong Quý: <b>${data.plannedCompleted}/${data.plannedTotal}</b>; số lượng đoàn kiểm tra từ Quý trước chuyển sang đã triển khai: <b>${data.carriedOverCompleted}/${data.carriedOverTotal}</b>. Trong đó đã kiểm tra trực tiếp <b>${data.directCount}</b> đoàn, kiểm tra trực tuyến/từ xa <b>${data.remoteCount}</b> đoàn. Chi tiết cụ thể như sau:</p>
      <p class="indent">- Số lượng đoàn kiểm tra do các Phòng nghiệp vụ chủ trì: <b>${data.deptLed.completed}</b>; số lượng vụ việc vi phạm phát hiện: <b>${data.deptLed.violationsCount}</b>; Hình thức xử lý (hình sự: ${data.deptLed.criminalCount} vụ; xử phạt hành chính: ${data.deptLed.adminCount} trường hợp, tổng số tiền xử phạt ${fmtMoney(data.deptLed.fineAmount)} đồng; hướng dẫn, nhắc nhở: ${data.deptLed.warningCount} trường hợp).</p>
      <p class="indent">- Số lượng đoàn kiểm tra do Công an cấp xã/phường chủ trì: <b>${data.wardLed.completed}</b>; số lượng vụ việc vi phạm phát hiện: <b>${data.wardLed.violationsCount}</b>; Hình thức xử lý (hình sự: ${data.wardLed.criminalCount} vụ; xử phạt hành chính: ${data.wardLed.adminCount} trường hợp, tổng số tiền xử phạt ${fmtMoney(data.wardLed.fineAmount)} đồng; hướng dẫn, nhắc nhở: ${data.wardLed.warningCount} trường hợp).</p>
      <p class="indent">- Số lượng đoàn kiểm tra liên ngành đã tham gia: <b>${data.interAgency.completed}/${data.interAgency.total}</b>; số lượng vụ việc vi phạm phát hiện: <b>${data.interAgency.violationsCount}</b>; Hình thức xử lý (hình sự: ${data.interAgency.criminalCount} vụ; xử phạt hành chính: ${data.interAgency.adminCount} trường hợp, tổng số tiền xử phạt ${fmtMoney(data.interAgency.fineAmount)} đồng; hướng dẫn, nhắc nhở: ${data.interAgency.warningCount} trường hợp).</p>
      <p class="indent">1.3. Số lượng đoàn kiểm tra đột xuất đã triển khai do có dấu hiệu vi phạm rõ ràng: <b>${data.adhoc.completed}</b>; số lượng vụ việc vi phạm phát hiện: <b>${data.adhoc.violationsCount}</b>; Hình thức xử lý (hình sự: ${data.adhoc.criminalCount} vụ; xử phạt hành chính: ${data.adhoc.adminCount} trường hợp, tổng số tiền xử phạt ${fmtMoney(data.adhoc.fineAmount)} đồng; hướng dẫn, nhắc nhở: ${data.adhoc.warningCount} trường hợp).</p>
      <p class="indent">1.4. Số lượng CBCS Công an chưa chấp hành quy định trong việc thực hiện công tác kiểm tra (nếu có): <b>${data.officerViolationsCount}</b>.</p>

      <div class="section-h">2. Các tình hình, vấn đề đáng chú ý liên quan an ninh kinh tế được phát hiện qua công tác kiểm tra</div>
      <p class="indent">${escapeHtml(secNote).replace(/\n/g, '<br>')}</p>

      <div class="section-h">3. Nhận xét, đề xuất</div>
      <p class="indent"><b>3.1. Nhận xét, đánh giá chung:</b> ${escapeHtml(assessNote)}</p>
      <p class="indent"><b>3.2. Đề xuất:</b></p>
      <p class="indent">- Vướng mắc về chủ trương, chính sách, pháp luật: ${escapeHtml(propLegal || 'Không có')}</p>
      <p class="indent">- Giải pháp nâng cao hiệu quả triển khai Kế hoạch 83/KH-CATP-PA04: ${escapeHtml(propSol || 'Không có')}</p>
      <p class="indent">- Các nội dung đề xuất khác (nếu có): ${escapeHtml(propOther || 'Không có')}</p>
      <p class="indent" style="margin-top: 12px;">${escapeHtml(data.ward)} kính báo cáo./.</p>
    `;

    const html = buildDocWrapper(`Phu luc 01 - ${data.quarter}`, body);
    return {
      buffer: Buffer.from('\ufeff' + html, 'utf-8'),
      contentType: 'application/msword; charset=utf-8',
      filename: `Phu_luc_01_Ket_qua_${data.quarter.replace('/', '_')}.doc`
    };
  }

  /**
   * Phụ lục 03: Danh sách DN/HKD/CNKD chưa hoàn thành kiểm tra trong Quý chuyển Quý sau
   */
  static getAppendix03(params: { quarter?: string; ward?: string }): Appendix03Row[] {
    const { quarter, ward } = params;
    let where = "WHERE i.status != 'completed'";
    const sqlParams: any[] = [];
    if (quarter) {
      where += " AND COALESCE(p.quarter, 'Q2/2026') = ?";
      sqlParams.push(quarter);
    }
    if (ward) {
      where += ' AND i.ward = ?';
      sqlParams.push(ward);
    }

    const rows = db
      .prepare(
        `SELECT i.id as inspectionId, i.objectId, i.planId, i.ward,
                i.inspectionContent, i.inspectingUnit, i.uninspectedReason,
                i.explanationContent, COALESCE(i.explanationStatus, 'none') as explanationStatus,
                b.name as objectName, b.taxCode, b.idNumber, b.address as objectAddress,
                bl.name as locationName, bl.address as locationAddress,
                COALESCE(p.quarter, 'Q2/2026') as quarter, p.unitName
         FROM inspections i
         JOIN business_objects b ON i.objectId = b.id
         LEFT JOIN business_locations bl ON i.locationId = bl.id
         LEFT JOIN plans p ON i.planId = p.id
         ${where}
         ORDER BY i.ward ASC, i.id ASC`
      )
      .all(...sqlParams) as any[];

    return rows.map((r, idx) => ({
      stt: idx + 1,
      inspectionId: r.inspectionId,
      objectId: r.objectId,
      planId: r.planId,
      ward: r.ward,
      quarter: r.quarter,
      objectName: r.locationName ? `${r.locationName} - ${r.objectName}` : r.objectName,
      taxCode: r.taxCode || r.idNumber || '—',
      address: r.locationAddress || r.objectAddress || r.ward,
      inspectionContent: r.inspectionContent || 'Kiểm tra việc chấp hành quy định pháp luật',
      leadUnit: r.inspectingUnit || r.unitName || r.ward,
      uninspectedReason: r.uninspectedReason || r.explanationContent || 'Chưa cập nhật lý do',
      explanationStatus: r.explanationStatus
    }));
  }

  static async exportAppendix03(params: {
    quarter?: string;
    ward?: string;
    format?: 'excel' | 'doc';
  }): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const items = this.getAppendix03(params);
    const quarterLabel = params.quarter || 'Q2/2026';
    const unitLabel = params.ward ? params.ward.toUpperCase() : 'PHÒNG PA04 (TỔNG HỢP CATP)';

    if (params.format === 'doc') {
      const rowsHtml = items
        .map(
          (r) => `
        <tr>
          <td style="text-align:center;">${r.stt}</td>
          <td>${escapeHtml(r.objectName)}</td>
          <td style="text-align:center;">${escapeHtml(r.taxCode)}</td>
          <td>${escapeHtml(r.address)}</td>
          <td>${escapeHtml(r.inspectionContent)}</td>
          <td>${escapeHtml(r.leadUnit)}</td>
          <td>${escapeHtml(r.uninspectedReason)}</td>
        </tr>`
        )
        .join('');

      const body = `
        <div style="font-size: 11pt; font-style: italic; margin-bottom: 6px;">Phụ lục 03</div>
        ${buildOfficialHeader(unitLabel, 'Số: ......../BC-')}
        <div class="doc-title">BÁO CÁO</div>
        <div class="doc-subtitle">Danh sách doanh nghiệp, hộ kinh doanh, cá nhân kinh doanh chưa hoàn thành việc kiểm tra trong ${escapeHtml(quarterLabel)} chuyển Quý sau</div>
        <div class="kinh-gui">Kính gửi: Đồng chí Giám đốc Công an thành phố Hà Nội (qua PA04)</div>
        <p class="indent">${escapeHtml(params.ward || 'Công an các đơn vị thuộc CATP')} báo cáo danh sách doanh nghiệp, hộ kinh doanh, cá nhân kinh doanh chưa hoàn thành việc kiểm tra theo lịch dự kiến ${escapeHtml(quarterLabel)} chuyển Quý sau như sau:</p>
        <table class="data-tbl">
          <thead>
            <tr>
              <th style="width:5%;">STT</th>
              <th style="width:20%;">Tổ chức, cá nhân được kiểm tra (DN/HKD/CNKD)</th>
              <th style="width:12%;">MST</th>
              <th style="width:17%;">Địa chỉ</th>
              <th style="width:16%;">Nội dung kiểm tra</th>
              <th style="width:14%;">Đơn vị chủ trì</th>
              <th style="width:16%;">Lí do chưa kiểm tra</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="text-align:center;">Không có cơ sở chuyển quý</td></tr>'}
          </tbody>
        </table>
        <p class="indent" style="margin-top: 10px;">${escapeHtml(params.ward || 'Đơn vị tổng hợp')} kính báo cáo./.</p>
      `;

      const html = buildDocWrapper(`Phu luc 03 - ${quarterLabel}`, body);
      return {
        buffer: Buffer.from('\ufeff' + html, 'utf-8'),
        contentType: 'application/msword; charset=utf-8',
        filename: `Phu_luc_03_Chuyen_quy_${quarterLabel.replace('/', '_')}.doc`
      };
    }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Phụ lục 03');
    ws.mergeCells('A1:G1');
    ws.getCell('A1').value = 'PHỤ LỤC 03 - DANH SÁCH CHƯA HOÀN THÀNH KIỂM TRA TRONG QUÝ CHUYỂN QUÝ SAU';
    ws.getCell('A1').font = { name: 'Times New Roman', size: 13, bold: true, color: { argb: 'FF1E3A8A' } };
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    ws.mergeCells('A2:G2');
    ws.getCell('A2').value = `Kỳ: ${quarterLabel} | Đơn vị: ${params.ward || 'Tổng hợp toàn CATP'}`;
    ws.getCell('A2').alignment = { horizontal: 'center' };
    ws.addRow([]);

    const headerRow = ws.addRow([
      'STT',
      'Tổ chức, cá nhân được kiểm tra (DN/HKD/CNKD)',
      'MST',
      'Địa chỉ',
      'Nội dung kiểm tra',
      'Đơn vị chủ trì',
      'Lí do chưa kiểm tra'
    ]);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    for (const r of items) {
      const row = ws.addRow([
        r.stt,
        r.objectName,
        r.taxCode,
        r.address,
        r.inspectionContent,
        r.leadUnit,
        r.uninspectedReason
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Times New Roman', size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 || colNumber === 3 ? 'center' : 'left', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    }

    ws.columns = [
      { width: 6 },
      { width: 34 },
      { width: 15 },
      { width: 28 },
      { width: 32 },
      { width: 24 },
      { width: 34 }
    ];

    const buf = await wb.xlsx.writeBuffer();
    return {
      buffer: Buffer.from(buf),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `Phu_luc_03_Chuyen_quy_${quarterLabel.replace('/', '_')}.xlsx`
    };
  }

  /**
   * Đẩy danh sách chưa kiểm tra (Phụ lục 03) sang Quý tiếp theo (tạo/cập nhật kế hoạch dự kiến Phụ lục 02 cho Quý sau)
   */
  static carryOverToNextQuarter(params: {
    fromQuarter: string;
    toQuarter: string;
    ward?: string;
    inspectionIds?: number[];
    userId: number;
  }) {
    const { fromQuarter, toQuarter, ward, inspectionIds, userId } = params;
    const allItems = this.getAppendix03({ quarter: fromQuarter, ward });
    const targetItems =
      inspectionIds && inspectionIds.length > 0
        ? allItems.filter((item) => inspectionIds.includes(item.inspectionId))
        : allItems;

    const yearMatch = toQuarter.match(/(\d{4})/);
    const toYear = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

    let carriedCount = 0;
    const findPlan = db.prepare(
      "SELECT * FROM plans WHERE ward = ? AND quarter = ? AND status IN ('draft', 'pending') ORDER BY id DESC LIMIT 1"
    );
    const insertPlan = db.prepare(
      `INSERT INTO plans (quarter, year, ward, unitName, inspectionType, inspectionContent, status, submittedBy)
       VALUES (?, ?, ?, ?, 'planned', ?, 'draft', ?)`
    );
    const checkItem = db.prepare('SELECT id FROM plan_items WHERE planId = ? AND objectId = ?');
    const insertItem = db.prepare(
      'INSERT INTO plan_items (planId, objectId, inspectionContent) VALUES (?, ?, ?)'
    );
    const markRescheduled = db.prepare(
      "UPDATE inspections SET explanationStatus = 'rescheduled' WHERE id = ?"
    );

    for (const item of targetItems) {
      let plan = findPlan.get(item.ward, toQuarter) as any;
      if (!plan) {
        const info = insertPlan.run(
          toQuarter,
          toYear,
          item.ward,
          item.ward,
          `Kế hoạch kiểm tra ${toQuarter} (bao gồm cơ sở chuyển từ ${fromQuarter})`,
          userId
        );
        plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(info.lastInsertRowid);
      }

      if (!checkItem.get(plan.id, item.objectId)) {
        insertItem.run(
          plan.id,
          item.objectId,
          `${item.inspectionContent} [Chuyển từ ${fromQuarter}: ${item.uninspectedReason}]`
        );
        carriedCount++;
      }
      markRescheduled.run(item.inspectionId);
    }

    return { fromQuarter, toQuarter, carriedCount, totalCandidates: targetItems.length };
  }
}
