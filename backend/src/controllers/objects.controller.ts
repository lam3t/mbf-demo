import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { db } from '../db/connection';
import { BusinessObject } from '../types';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { checkObjectSingleCheckRule, formatQuarterText, formatDateText } from '../utils/singleCheck';

export class ObjectsController {
  /**
   * 1. GET /api/objects - Filter & Pagination with Single Check annotations
   */
  static getAll(req: Request, res: Response): void {
    try {
      const { type, status, ward, search, hasForeignElement, page = '1', limit = '50', checkYear } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;
      const currentYear = checkYear ? parseInt(checkYear as string, 10) : new Date().getFullYear();

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
        whereClause += ' AND (b.ward = ? OR EXISTS (SELECT 1 FROM business_locations bl WHERE bl.objectId = b.id AND bl.ward = ?))';
        params.push(ward, ward);
      }
      if (hasForeignElement !== undefined && hasForeignElement !== '') {
        whereClause += ' AND b.hasForeignElement = ?';
        params.push(parseInt(hasForeignElement as string, 10) ? 1 : 0);
      }
      if (search) {
        whereClause += ' AND (b.name LIKE ? OR b.taxCode LIKE ? OR b.idNumber LIKE ? OR b.address LIKE ? OR b.representative LIKE ? OR EXISTS (SELECT 1 FROM business_locations bl2 WHERE bl2.objectId = b.id AND (bl2.name LIKE ? OR bl2.address LIKE ?)))';
        const term = `%${search}%`;
        params.push(term, term, term, term, term, term, term);
      }

      // Count total
      const countStmt = db.prepare(`SELECT COUNT(*) as total FROM business_objects b ${whereClause}`);
      const countRes = countStmt.get(...params) as { total: number };

      // Query data with plan info, location count, and single check status
      const query = `
        SELECT b.*, u.fullName as createdByName, 
               p.quarter as planQuarter, p.year as planYear, p.ward as planWard, p.status as planStatus,
               (SELECT COUNT(*) FROM business_locations bl WHERE bl.objectId = b.id) as locationCount,
               (SELECT COUNT(*) FROM inspections i_cnt WHERE i_cnt.objectId = b.id) as totalInspectionsCount,
               (SELECT COUNT(*) FROM inspections v_cnt WHERE v_cnt.objectId = b.id AND v_cnt.violationCodes IS NOT NULL AND v_cnt.violationCodes != '[]' AND v_cnt.violationCodes != '') as totalViolationsCount,
               (
                 SELECT p2.quarter || ' (' || p2.ward || ')'
                 FROM plan_items pi2 
                 JOIN plans p2 ON pi2.planId = p2.id 
                 WHERE pi2.objectId = b.id AND p2.status IN ('pending', 'approved') AND (p2.year = ? OR p2.quarter LIKE ?)
                 ORDER BY p2.id DESC LIMIT 1
               ) as activePlanLock,
               (
                 SELECT 'Phát sinh (' || a.wardRequestedBy || ' - ' || CASE WHEN a.status = 'approved' THEN 'đã duyệt' ELSE 'chờ duyệt' END || ')'
                 FROM adhoc_inspection_requests a
                 WHERE a.objectId = b.id AND a.status IN ('pending', 'approved') AND (a.relatedYear = ? OR a.relatedQuarter LIKE ?)
                 ORDER BY a.id DESC LIMIT 1
               ) as activeAdhocLock,
               (
                 SELECT i2.completedAt 
                 FROM inspections i2 
                 LEFT JOIN plans p3 ON i2.planId = p3.id
                 WHERE i2.objectId = b.id AND i2.status = 'completed' AND (p3.year = ? OR i2.completedAt LIKE ?)
                 ORDER BY i2.completedAt DESC LIMIT 1
               ) as completedInspectionThisYear,
               (
                 SELECT i3.ward 
                 FROM inspections i3 
                 LEFT JOIN plans p4 ON i3.planId = p4.id
                 WHERE i3.objectId = b.id AND i3.status = 'completed' AND (p4.year = ? OR i3.completedAt LIKE ?)
                 ORDER BY i3.completedAt DESC LIMIT 1
               ) as completedInspectionWard
        FROM business_objects b
        LEFT JOIN users u ON b.createdBy = u.id
        LEFT JOIN plans p ON b.planId = p.id
        ${whereClause}
        ORDER BY b.id DESC
        LIMIT ? OFFSET ?
      `;

      const rawData = db.prepare(query).all(
        currentYear,
        `%${currentYear}%`,
        currentYear,
        `%${currentYear}%`,
        currentYear,
        `%${currentYear}%`,
        currentYear,
        `%${currentYear}%`,
        ...params,
        limitNum,
        offset
      ) as any[];

      const locationsStmt = db.prepare(`SELECT * FROM business_locations WHERE objectId = ? ORDER BY CASE locationType WHEN 'headquarters' THEN 1 WHEN 'branch' THEN 2 WHEN 'facility' THEN 3 ELSE 4 END, id ASC`);

      const data = rawData.map(item => {
        // Per Requirement #2 & #3: Warn on duplicates, do NOT automatically hard-block!
        const isBlockedThisYear = false;
        let blockReason: string | null = null;
        let hasCrossWardWarning = false;
        let crossWardWarning: string | null = null;

        if (item.completedInspectionThisYear) {
          hasCrossWardWarning = true;
          const formattedDate = formatDateText(item.completedInspectionThisYear);
          const byWard = item.completedInspectionWard ? ` bởi ${item.completedInspectionWard}` : '';
          crossWardWarning = `Cảnh báo trùng: Đã được kiểm tra ngày ${formattedDate}${byWard}. Vẫn cho phép lập kế hoạch hoặc kiểm tra lại theo yêu cầu nghiệp vụ / chức năng đơn vị.`;
          blockReason = crossWardWarning;
        } else if (item.activePlanLock) {
          hasCrossWardWarning = true;
          crossWardWarning = `Cảnh báo trùng kế hoạch: Đang có trong kế hoạch ${item.activePlanLock} — Cho phép lập kế hoạch phối hợp liên ngành hoặc kiểm tra theo yêu cầu nghiệp vụ.`;
        } else if (item.activeAdhocLock) {
          hasCrossWardWarning = true;
          crossWardWarning = `Cảnh báo trùng: Đang có ${item.activeAdhocLock} — Cho phép phối hợp kiểm tra.`;
        }

        const locations = locationsStmt.all(item.id);

        return {
          ...item,
          hasForeignElement: !!item.hasForeignElement,
          locations,
          locationCount: locations.length || item.locationCount || 1,
          isBlockedThisYear,
          blockReason,
          hasCrossWardWarning,
          crossWardWarning,
          warningReason: crossWardWarning,
          isCrossWardCandidate: hasCrossWardWarning
        };
      });

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
   * 2. GET /api/objects/check/:idOrTaxCode - Check duplicate & city-wide Single Check rule
   */
  static checkDuplicate(req: AuthenticatedRequest, res: Response): void {
    try {
      const { idOrTaxCode } = req.params;
      const currentYear = new Date().getFullYear();

      // Find object by id (if numeric), taxCode or idNumber
      let obj: BusinessObject | undefined;
      if (/^\d+$/.test(idOrTaxCode) && idOrTaxCode.length < 9) {
        obj = db.prepare('SELECT * FROM business_objects WHERE id = ?').get(parseInt(idOrTaxCode, 10)) as BusinessObject | undefined;
      }

      if (!obj) {
        const objStmt = db.prepare(`
          SELECT * FROM business_objects 
          WHERE (taxCode = ? AND taxCode IS NOT NULL AND taxCode != '') 
             OR (idNumber = ? AND idNumber IS NOT NULL AND idNumber != '')
             OR id = ?
        `);
        obj = objStmt.get(idOrTaxCode, idOrTaxCode, idOrTaxCode) as BusinessObject | undefined;
      }

      if (!obj) {
        res.json({ success: true, exists: false, blocked: false, blockReason: null });
        return;
      }

      // Check city-wide Single Check rule for current year
      const singleCheck = checkObjectSingleCheckRule(obj.id, currentYear);

      res.json({
        success: true,
        exists: true,
        blocked: singleCheck.isBlocked,
        blockReason: singleCheck.blockReason,
        hasWarning: singleCheck.hasWarning || false,
        warningReason: singleCheck.warningReason || null,
        isCrossWardCandidate: singleCheck.isCrossWardCandidate || false,
        conflictType: singleCheck.conflictType || null,
        lockedByWard: singleCheck.planWard || null,
        planQuarter: singleCheck.planQuarter || null,
        planYear: singleCheck.planYear || null,
        planStatus: singleCheck.planStatus || null,
        isCompletedThisYear: singleCheck.conflictType === 'COMPLETED_INSPECTION',
        completedAt: singleCheck.completedAt || null,
        lastCheckedYear: obj.lastCheckedYear || (singleCheck.conflictType === 'COMPLETED_INSPECTION' ? currentYear : null),
        objectData: obj
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 3. GET /api/objects/:id - Details with Inspections history & Full Yearly Plan History
   */
  static getById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const currentYear = new Date().getFullYear();

      const stmt = db.prepare(`
        SELECT b.*, u.fullName as createdByName, p.quarter as planQuarter, p.year as planYear, p.ward as planWard
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

      // Query all operating locations (headquarters, branches, facilities, business locations) for this enterprise/object
      const locationsStmt = db.prepare(`
        SELECT bl.*,
               (SELECT COUNT(*) FROM inspections i_l WHERE i_l.objectId = bl.objectId AND (i_l.locationId = bl.id OR (i_l.locationId IS NULL AND bl.locationType IN ('headquarters', 'facility')))) as inspectionCount,
               (SELECT COUNT(*) FROM inspections v_l WHERE v_l.objectId = bl.objectId AND (v_l.locationId = bl.id OR (v_l.locationId IS NULL AND bl.locationType IN ('headquarters', 'facility'))) AND v_l.violationCodes IS NOT NULL AND v_l.violationCodes != '[]' AND v_l.violationCodes != '') as violationCount
        FROM business_locations bl
        WHERE bl.objectId = ?
        ORDER BY CASE bl.locationType WHEN 'headquarters' THEN 1 WHEN 'branch' THEN 2 WHEN 'facility' THEN 3 ELSE 4 END, bl.id ASC
      `);
      const locations = locationsStmt.all(id) as any[];

      // Query all inspection records for this object
      const inspectionsStmt = db.prepare(`
        SELECT i.*, 
               COALESCE(i.locationName, bl.name, b.name) as resolvedLocationName,
               COALESCE(i.locationAddress, bl.address, b.address) as resolvedLocationAddress,
               bl.locationType as locationType,
               p.quarter as planQuarter, p.year as planYear, p.ward as planWard, p.approvedAt as planApprovedAt
        FROM inspections i
        LEFT JOIN business_objects b ON i.objectId = b.id
        LEFT JOIN business_locations bl ON i.locationId = bl.id
        LEFT JOIN plans p ON i.planId = p.id
        WHERE i.objectId = ?
        ORDER BY i.id DESC
      `);
      const inspections = inspectionsStmt.all(id) as any[];

      // Build Violation History linked to enterprise & each specific location
      const violationCatalogRows = db.prepare('SELECT code, name FROM violation_catalog').all() as Array<{ code: string; name: string }>;
      const vCatalogMap: Record<string, string> = {};
      violationCatalogRows.forEach(v => { vCatalogMap[v.code] = v.name; });

      const violationHistory = inspections
        .filter(insp => {
          if (!insp.violationCodes) return false;
          try {
            const parsed = JSON.parse(insp.violationCodes);
            return Array.isArray(parsed) && parsed.length > 0;
          } catch {
            return insp.violationCodes.trim().length > 0 && insp.violationCodes !== '[]';
          }
        })
        .map(insp => {
          let codes: string[] = [];
          try {
            codes = JSON.parse(insp.violationCodes);
          } catch {
            codes = [insp.violationCodes];
          }
          return {
            inspectionId: insp.id,
            locationId: insp.locationId || (locations[0]?.id ?? null),
            locationName: insp.resolvedLocationName || item.name,
            locationAddress: insp.resolvedLocationAddress || item.address,
            ward: insp.ward,
            inspectionType: insp.inspectionType || (insp.isAdhoc ? 'adhoc' : 'planned'),
            inspectingUnit: insp.inspectingUnit || insp.ward,
            teamName: insp.teamName || 'Đoàn kiểm tra liên ngành / Phường',
            quarter: insp.planQuarter || 'Đột xuất / Nghiệp vụ',
            year: insp.planYear || currentYear,
            severity: insp.severity || 1,
            violationCodes: codes,
            violationDetails: codes.map(c => ({ code: c, name: vCatalogMap[c] || c })),
            recommendationNote: insp.recommendationNote,
            completedAt: insp.completedAt || insp.createdAt,
            acceptanceStatus: insp.acceptanceStatus || 'pending'
          };
        });

      // Query full plan history across all quarters and years (including draft, pending, approved, rejected)
      const plansHistoryStmt = db.prepare(`
        SELECT p.id as planId, p.quarter, p.year, p.ward, p.status as planStatus, 
               p.inspectionType as planInspectionType, p.scheduledStartDate, p.scheduledEndDate, p.inspectionContent as planInspectionContent,
               p.rejectReason, p.submittedAt, p.approvedAt, p.createdAt as planCreatedAt,
               u1.fullName as submittedByName, u2.fullName as approvedByName,
               i.id as inspectionId, i.status as inspectionStatus, i.completedAt as inspectionCompletedAt,
               i.locationId, COALESCE(i.locationName, bl.name) as locationName, COALESCE(i.locationAddress, bl.address) as locationAddress,
               i.inspectionType, i.teamName, i.inspectingUnit, i.acceptanceStatus,
               i.uninspectedReason, i.explanationContent, i.explanationStatus,
               i.severity, i.violationCodes, i.recommendationNote, i.isLocked as inspectionIsLocked
        FROM plan_items pi
        JOIN plans p ON pi.planId = p.id
        LEFT JOIN users u1 ON p.submittedBy = u1.id
        LEFT JOIN users u2 ON p.approvedBy = u2.id
        LEFT JOIN inspections i ON (i.planId = p.id AND i.objectId = pi.objectId)
        LEFT JOIN business_locations bl ON i.locationId = bl.id
        WHERE pi.objectId = ?
        ORDER BY COALESCE(p.year, 2026) DESC, p.quarter DESC, p.id DESC
      `);
      const planHistory = plansHistoryStmt.all(id);

      // Query adhoc requests history for this object
      const adhocRequestsStmt = db.prepare(`
        SELECT a.*, u1.fullName as requestedByName, u2.fullName as approvedByName
        FROM adhoc_inspection_requests a
        LEFT JOIN users u1 ON a.requestedBy = u1.id
        LEFT JOIN users u2 ON a.approvedBy = u2.id
        WHERE a.objectId = ?
        ORDER BY a.id DESC
      `);
      const adhocRequests = adhocRequestsStmt.all(id);

      // Single check summary for current year
      const singleCheck = checkObjectSingleCheckRule(parseInt(id as string, 10), currentYear);

      res.json({
        success: true,
        data: {
          ...item,
          hasForeignElement: !!item.hasForeignElement,
          locations,
          inspections,
          violationHistory,
          planHistory,
          adhocRequests,
          singleCheckSummary: singleCheck
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 4. POST /api/objects - Create object with type-based validation & Multi-locations
   */
  static create(req: AuthenticatedRequest, res: Response): void {
    try {
      const {
        type, taxCode, idNumber, name, representative, field, address, ward,
        status = 'active', hasForeignElement = false, foreignElementDetail = null, locations = []
      } = req.body;
      const userId = req.user?.id || null;

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

      const stmt = db.prepare(`
        INSERT INTO business_objects (type, taxCode, idNumber, name, representative, field, address, ward, status, hasForeignElement, foreignElementDetail, createdBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      const isForeignInt = hasForeignElement ? 1 : 0;

      const result = stmt.run(
        type,
        taxCode || null,
        idNumber || null,
        name,
        representative || null,
        field || null,
        address,
        ward,
        status,
        isForeignInt,
        foreignElementDetail || null,
        userId
      );

      const newObjectId = Number(result.lastInsertRowid);

      // Save operating locations (or create primary headquarters/facility automatically)
      const insertLoc = db.prepare(`
        INSERT INTO business_locations (objectId, locationType, locationCode, name, address, ward, contactPerson, phone, hasForeignElement, foreignElementDetail, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      if (Array.isArray(locations) && locations.length > 0) {
        locations.forEach((loc: any, idx: number) => {
          insertLoc.run(
            newObjectId,
            loc.locationType || (idx === 0 && type === 'enterprise' ? 'headquarters' : 'branch'),
            loc.locationCode || `CS-${newObjectId}-0${idx + 1}`,
            loc.name || `${name} - Cơ sở ${idx + 1}`,
            loc.address || address,
            loc.ward || ward,
            loc.contactPerson || representative || null,
            loc.phone || null,
            loc.hasForeignElement !== undefined ? (loc.hasForeignElement ? 1 : 0) : isForeignInt,
            loc.foreignElementDetail || foreignElementDetail || null,
            loc.status || 'active'
          );
        });
      } else {
        insertLoc.run(
          newObjectId,
          type === 'enterprise' ? 'headquarters' : 'facility',
          `CS-${newObjectId}-01`,
          type === 'enterprise' ? `Trụ sở chính - ${name}` : `Cơ sở chính - ${name}`,
          address,
          ward,
          representative || null,
          null,
          isForeignInt,
          foreignElementDetail || null,
          status
        );
      }

      res.status(201).json({
        success: true,
        message: 'Thêm mới đối tượng kinh doanh và địa điểm hoạt động thành công.',
        id: newObjectId
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 5. PUT /api/objects/:id - Update object & locations
   */
  static update(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const {
        type, taxCode, idNumber, name, representative, field, address, ward,
        status, hasForeignElement, foreignElementDetail, locations
      } = req.body;

      const isForeignInt = hasForeignElement ? 1 : 0;

      const stmt = db.prepare(`
        UPDATE business_objects 
        SET type = ?, taxCode = ?, idNumber = ?, name = ?, representative = ?, field = ?, address = ?, ward = ?, status = ?, hasForeignElement = ?, foreignElementDetail = ?
        WHERE id = ?
      `);

      stmt.run(
        type,
        taxCode || null,
        idNumber || null,
        name,
        representative || null,
        field || null,
        address,
        ward,
        status,
        isForeignInt,
        foreignElementDetail || null,
        id
      );

      // If locations array is provided, sync locations
      if (Array.isArray(locations)) {
        const existingLocs = db.prepare('SELECT id FROM business_locations WHERE objectId = ?').all(id) as Array<{ id: number }>;
        const incomingIds = new Set(locations.filter((l: any) => l.id).map((l: any) => Number(l.id)));

        // Delete removed locations
        existingLocs.forEach(ex => {
          if (!incomingIds.has(ex.id)) {
            db.prepare('DELETE FROM business_locations WHERE id = ? AND objectId = ?').run(ex.id, id);
          }
        });

        const updateLoc = db.prepare(`
          UPDATE business_locations
          SET locationType = ?, name = ?, address = ?, ward = ?, contactPerson = ?, phone = ?, hasForeignElement = ?, foreignElementDetail = ?, status = ?, updatedAt = datetime('now')
          WHERE id = ? AND objectId = ?
        `);
        const insertLoc = db.prepare(`
          INSERT INTO business_locations (objectId, locationType, locationCode, name, address, ward, contactPerson, phone, hasForeignElement, foreignElementDetail, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        locations.forEach((loc: any, idx: number) => {
          if (loc.id && incomingIds.has(Number(loc.id))) {
            updateLoc.run(
              loc.locationType || 'branch',
              loc.name || name,
              loc.address || address,
              loc.ward || ward,
              loc.contactPerson || representative || null,
              loc.phone || null,
              loc.hasForeignElement ? 1 : 0,
              loc.foreignElementDetail || null,
              loc.status || 'active',
              loc.id,
              id
            );
          } else {
            insertLoc.run(
              id,
              loc.locationType || 'branch',
              loc.locationCode || `CS-${id}-0${idx + 1}`,
              loc.name || `${name} - Cơ sở ${idx + 1}`,
              loc.address || address,
              loc.ward || ward,
              loc.contactPerson || representative || null,
              loc.phone || null,
              loc.hasForeignElement ? 1 : 0,
              loc.foreignElementDetail || null,
              loc.status || 'active'
            );
          }
        });
      }

      res.json({ success: true, message: 'Cập nhật thông tin doanh nghiệp và các cơ sở/địa điểm kinh doanh thành công.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 5b. Locations CRUD for an enterprise (/api/objects/:id/locations)
   */
  static getLocations(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const locations = db.prepare(`
        SELECT bl.*,
               (SELECT COUNT(*) FROM inspections i_l WHERE i_l.objectId = bl.objectId AND i_l.locationId = bl.id) as inspectionCount,
               (SELECT COUNT(*) FROM inspections v_l WHERE v_l.objectId = bl.objectId AND v_l.locationId = bl.id AND v_l.violationCodes IS NOT NULL AND v_l.violationCodes != '[]' AND v_l.violationCodes != '') as violationCount
        FROM business_locations bl
        WHERE bl.objectId = ?
        ORDER BY CASE bl.locationType WHEN 'headquarters' THEN 1 WHEN 'branch' THEN 2 WHEN 'facility' THEN 3 ELSE 4 END, bl.id ASC
      `).all(id);
      res.json({ success: true, data: locations });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static addLocation(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const { locationType = 'branch', locationCode, name, address, ward, contactPerson, phone, hasForeignElement = false, foreignElementDetail, status = 'active' } = req.body;
      if (!name || !address || !ward) {
        res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Tên cơ sở/chi nhánh, Địa chỉ và Phường quản lý.' });
        return;
      }

      const result = db.prepare(`
        INSERT INTO business_locations (objectId, locationType, locationCode, name, address, ward, contactPerson, phone, hasForeignElement, foreignElementDetail, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        locationType,
        locationCode || `CS-${id}-${Date.now().toString().slice(-3)}`,
        name,
        address,
        ward,
        contactPerson || null,
        phone || null,
        hasForeignElement ? 1 : 0,
        foreignElementDetail || null,
        status
      );

      res.status(201).json({
        success: true,
        message: 'Đã thêm mới cơ sở / địa điểm kinh doanh thành công.',
        id: Number(result.lastInsertRowid)
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static updateLocation(req: Request, res: Response): void {
    try {
      const { id, locId } = req.params;
      const { locationType = 'branch', name, address, ward, contactPerson, phone, hasForeignElement = false, foreignElementDetail, status = 'active' } = req.body;
      db.prepare(`
        UPDATE business_locations
        SET locationType = ?, name = ?, address = ?, ward = ?, contactPerson = ?, phone = ?, hasForeignElement = ?, foreignElementDetail = ?, status = ?, updatedAt = datetime('now')
        WHERE id = ? AND objectId = ?
      `).run(
        locationType,
        name,
        address,
        ward,
        contactPerson || null,
        phone || null,
        hasForeignElement ? 1 : 0,
        foreignElementDetail || null,
        status,
        locId,
        id
      );

      res.json({ success: true, message: 'Đã cập nhật thông tin cơ sở / địa điểm kinh doanh.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  static deleteLocation(req: Request, res: Response): void {
    try {
      const { id, locId } = req.params;
      db.prepare('DELETE FROM business_locations WHERE id = ? AND objectId = ?').run(locId, id);
      res.json({ success: true, message: 'Đã xóa địa điểm kinh doanh.' });
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

      res.setHeader('Content-Disposition', 'attachment; filename="Mau_Import_Doi_Tuong_MBF.xlsx"');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buf);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}
