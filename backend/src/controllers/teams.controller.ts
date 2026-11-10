import { Request, Response } from 'express';
import { db } from '../db/connection';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class TeamsController {
  /**
   * 1. GET /api/teams - List all inspection teams with filters
   */
  static getAll(req: Request, res: Response): void {
    try {
      const { ward, teamType, inspectionType, status, search } = req.query;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (ward && ward !== 'all') {
        whereClause += ' AND (t.ward = ? OR t.participatingUnits LIKE ?)';
        params.push(ward, `%${ward}%`);
      }
      if (teamType && teamType !== 'all') {
        whereClause += ' AND t.teamType = ?';
        params.push(teamType);
      }
      if (inspectionType && inspectionType !== 'all') {
        whereClause += ' AND t.inspectionType = ?';
        params.push(inspectionType);
      }
      if (status && status !== 'all') {
        whereClause += ' AND t.status = ?';
        params.push(status);
      }
      if (search) {
        whereClause += ' AND (t.name LIKE ? OR t.code LIKE ? OR t.leaderName LIKE ? OR t.leadUnit LIKE ? OR t.decisionNumber LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term, term, term);
      }

      const query = `
        SELECT t.*,
               w.name as workflowName,
               w.stepsJson as workflowStepsJson,
               (SELECT COUNT(*) FROM inspections i WHERE i.teamId = t.id) as assignedInspectionsCount
        FROM inspection_teams t
        LEFT JOIN unit_workflows w ON t.workflowCode = w.code
        ${whereClause}
        ORDER BY t.id DESC
      `;

      const rows = db.prepare(query).all(...params) as any[];
      const data = rows.map(row => {
        const parsedUnits = TeamsController.safeParseJson(row.participatingUnits, []);
        const parsedMembers = TeamsController.safeParseJson(row.membersJson, []).map((m: any) => ({
          ...m,
          roleInTeam: m.roleInTeam || m.role || 'Thành viên',
          role: m.role || m.roleInTeam || 'Thành viên',
          position: m.position || 'Cán bộ nghiệp vụ'
        }));
        const parsedHistory = TeamsController.safeParseJson(row.adjustmentHistoryJson, []).map((h: any) => ({
          ...h,
          reason: h.reason || h.note || 'Điều chỉnh thành phần đoàn và lịch công tác',
          note: h.note || h.reason || 'Điều chỉnh thành phần đoàn và lịch công tác'
        }));
        return {
          ...row,
          participatingUnits: parsedUnits,
          participatingUnitsList: parsedUnits,
          members: parsedMembers,
          adjustmentHistory: parsedHistory,
          workflowSteps: TeamsController.safeParseJson(row.workflowStepsJson, []),
          inspectionCount: row.assignedInspectionsCount || 0
        };
      });

      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 2. GET /api/teams/:id - Team details & assigned inspections
   */
  static getById(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      const row = db.prepare(`
        SELECT t.*, w.name as workflowName, w.stepsJson as workflowStepsJson
        FROM inspection_teams t
        LEFT JOIN unit_workflows w ON t.workflowCode = w.code
        WHERE t.id = ?
      `).get(id) as any;

      if (!row) {
        res.status(404).json({ success: false, message: 'Không tìm thấy đoàn kiểm tra.' });
        return;
      }

      const inspections = db.prepare(`
        SELECT i.*, b.name as objectName, b.taxCode, b.idNumber, b.address as objectAddress
        FROM inspections i
        JOIN business_objects b ON i.objectId = b.id
        WHERE i.teamId = ?
        ORDER BY i.id DESC
      `).all(id);

      const parsedUnits = TeamsController.safeParseJson(row.participatingUnits, []);
      const parsedMembers = TeamsController.safeParseJson(row.membersJson, []).map((m: any) => ({
        ...m,
        roleInTeam: m.roleInTeam || m.role || 'Thành viên',
        role: m.role || m.roleInTeam || 'Thành viên',
        position: m.position || 'Cán bộ nghiệp vụ'
      }));
      const parsedHistory = TeamsController.safeParseJson(row.adjustmentHistoryJson, []).map((h: any) => ({
        ...h,
        reason: h.reason || h.note || 'Điều chỉnh thành phần đoàn và lịch công tác',
        note: h.note || h.reason || 'Điều chỉnh thành phần đoàn và lịch công tác'
      }));

      res.json({
        success: true,
        data: {
          ...row,
          participatingUnits: parsedUnits,
          participatingUnitsList: parsedUnits,
          members: parsedMembers,
          adjustmentHistory: parsedHistory,
          workflowSteps: TeamsController.safeParseJson(row.workflowStepsJson, []),
          inspections,
          inspectionCount: inspections.length
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 3. POST /api/teams - Establish a new inspection team (Unit or Inter-agency)
   */
  static create(req: AuthenticatedRequest, res: Response): void {
    try {
      const {
        code,
        name,
        teamType = 'inter_agency',
        inspectionType = 'planned',
        leadUnit,
        participatingUnits = [],
        ward,
        planId,
        decisionNumber,
        leaderName,
        members = [],
        scheduleStart,
        scheduleEnd,
        inspectionContent,
        workflowCode = 'WF_INTER_AGENCY',
        status = 'active'
      } = req.body;

      if (!name || !leadUnit || !leaderName) {
        res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ Tên đoàn kiểm tra, Đơn vị chủ trì và Trưởng đoàn.' });
        return;
      }

      const finalCode = code || `DKT-2026-${Math.floor(100 + Math.random() * 900)}`;
      const userId = req.user?.id || 1;
      const establishedByName = req.user?.fullName || 'Lãnh đạo / Cán bộ thẩm quyền';

      const unitsJson = Array.isArray(participatingUnits) ? JSON.stringify(participatingUnits) : (participatingUnits || '[]');
      const membersJsonStr = Array.isArray(members) ? JSON.stringify(members) : (members || '[]');

      const result = db.prepare(`
        INSERT INTO inspection_teams (
          code, name, teamType, inspectionType, leadUnit, participatingUnits, ward, planId,
          decisionNumber, leaderName, membersJson, scheduleStart, scheduleEnd,
          inspectionContent, workflowCode, status, adjustmentHistoryJson,
          establishedBy, establishedByName, establishedAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, datetime('now'), datetime('now'))
      `).run(
        finalCode,
        name,
        teamType,
        inspectionType,
        leadUnit,
        unitsJson,
        ward || 'Toàn địa bàn',
        planId || null,
        decisionNumber || `QĐ-${Math.floor(100 + Math.random() * 900)}/QĐ-KT`,
        leaderName,
        membersJsonStr,
        scheduleStart || '2026-04-15',
        scheduleEnd || '2026-06-30',
        inspectionContent || 'Kiểm tra chấp hành quy định pháp luật tại doanh nghiệp và cơ sở kinh doanh.',
        workflowCode,
        status,
        userId,
        establishedByName
      );

      res.status(201).json({
        success: true,
        message: 'Đã thành lập Đoàn kiểm tra thành công.',
        id: Number(result.lastInsertRowid)
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 4. PUT /api/teams/:id - Update / Adjust team members, schedule, participating units, workflow during implementation
   */
  static update(req: AuthenticatedRequest, res: Response): void {
    try {
      const { id } = req.params;
      const {
        name,
        teamType,
        inspectionType,
        leadUnit,
        participatingUnits,
        ward,
        decisionNumber,
        leaderName,
        members,
        scheduleStart,
        scheduleEnd,
        inspectionContent,
        workflowCode,
        status,
        adjustmentNote
      } = req.body;

      const existing = db.prepare('SELECT * FROM inspection_teams WHERE id = ?').get(id) as any;
      if (!existing) {
        res.status(404).json({ success: false, message: 'Không tìm thấy đoàn kiểm tra.' });
        return;
      }

      const history = TeamsController.safeParseJson(existing.adjustmentHistoryJson, []);
      const noteText = req.body.adjustmentReason || adjustmentNote || 'Cập nhật, điều chỉnh thành phần đoàn kiểm tra và lịch công tác';
      history.unshift({
        adjustedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
        adjustedBy: req.user?.fullName || 'Cán bộ quản lý',
        reason: noteText,
        note: noteText
      });

      const unitsJson = participatingUnits !== undefined
        ? (Array.isArray(participatingUnits) ? JSON.stringify(participatingUnits) : participatingUnits)
        : existing.participatingUnits;
      const membersJsonStr = members !== undefined
        ? (Array.isArray(members) ? JSON.stringify(members) : members)
        : existing.membersJson;

      db.prepare(`
        UPDATE inspection_teams
        SET name = COALESCE(?, name),
            teamType = COALESCE(?, teamType),
            inspectionType = COALESCE(?, inspectionType),
            leadUnit = COALESCE(?, leadUnit),
            participatingUnits = ?,
            ward = COALESCE(?, ward),
            decisionNumber = COALESCE(?, decisionNumber),
            leaderName = COALESCE(?, leaderName),
            membersJson = ?,
            scheduleStart = COALESCE(?, scheduleStart),
            scheduleEnd = COALESCE(?, scheduleEnd),
            inspectionContent = COALESCE(?, inspectionContent),
            workflowCode = COALESCE(?, workflowCode),
            status = COALESCE(?, status),
            adjustmentHistoryJson = ?,
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(
        name || null,
        teamType || null,
        inspectionType || null,
        leadUnit || null,
        unitsJson,
        ward || null,
        decisionNumber || null,
        leaderName || null,
        membersJsonStr,
        scheduleStart || null,
        scheduleEnd || null,
        inspectionContent || null,
        workflowCode || null,
        status || 'adjusted',
        JSON.stringify(history),
        id
      );

      // Also update teamName and workflowCode on linked inspections
      if (name || workflowCode) {
        db.prepare(`
          UPDATE inspections
          SET teamName = COALESCE(?, teamName),
              workflowCode = COALESCE(?, workflowCode)
          WHERE teamId = ?
        `).run(name || null, workflowCode || null, id);
      }

      res.json({
        success: true,
        message: 'Đã điều chỉnh thành phần đoàn kiểm tra, thời gian và lịch kiểm tra thành công.'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 5. DELETE /api/teams/:id - Delete team
   */
  static delete(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      db.prepare('UPDATE inspections SET teamId = NULL WHERE teamId = ?').run(id);
      db.prepare('DELETE FROM inspection_teams WHERE id = ?').run(id);
      res.json({ success: true, message: 'Đã xóa đoàn kiểm tra.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  private static safeParseJson(raw: any, fallback: any): any {
    if (!raw) return fallback;
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
}

