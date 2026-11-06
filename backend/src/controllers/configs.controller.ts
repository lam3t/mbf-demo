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

  /**
   * 7. Quản lý Quy trình kiểm tra đặc thù theo từng đơn vị nghiệp vụ
   * GET /api/configs/workflows
   */
  static getWorkflows(req: Request, res: Response): void {
    try {
      const rows = db.prepare(`SELECT * FROM unit_workflows ORDER BY id ASC`).all() as any[];
      const data = rows.map(r => {
        let steps: any[] = [];
        try {
          steps = JSON.parse(r.stepsJson || '[]');
        } catch {
          steps = [];
        }
        return {
          ...r,
          isActive: Boolean(r.isActive),
          steps
        };
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * POST /api/configs/workflows & PUT /api/configs/workflows/:id
   */
  static saveWorkflow(req: Request, res: Response): void {
    try {
      const id = req.params.id ? parseInt(req.params.id as string, 10) : req.body.id;
      const {
        code,
        name,
        unitName,
        inspectionType,
        steps,
        planApprovalRole,
        teamEstablishRole,
        resultAcceptanceRole,
        isActive
      } = req.body;

      if (!name || !unitName) {
        res.status(400).json({ success: false, message: 'Vui lòng nhập Tên quy trình và Đơn vị áp dụng.' });
        return;
      }

      const stepsJson = JSON.stringify(Array.isArray(steps) ? steps : []);
      const wfCode = (code || `WF_${Date.now()}`).toString().toUpperCase().replace(/\s+/g, '_');

      if (id) {
        db.prepare(`
          UPDATE unit_workflows SET
            code = ?,
            name = ?,
            unitName = ?,
            inspectionType = ?,
            stepsJson = ?,
            planApprovalRole = ?,
            teamEstablishRole = ?,
            resultAcceptanceRole = ?,
            isActive = ?,
            updatedAt = datetime('now', 'localtime')
          WHERE id = ?
        `).run(
          wfCode,
          name,
          unitName,
          inspectionType || 'all',
          stepsJson,
          planApprovalRole || 'Trưởng Công an Phường / Lãnh đạo Phòng Nghiệp vụ',
          teamEstablishRole || 'Trưởng đơn vị chủ trì / Trưởng phòng Nghiệp vụ',
          resultAcceptanceRole || 'Lãnh đạo đơn vị phê duyệt kế hoạch / Trưởng đoàn kiểm tra',
          isActive !== undefined ? (isActive ? 1 : 0) : 1,
          id
        );
      } else {
        db.prepare(`
          INSERT INTO unit_workflows (
            code, name, unitName, inspectionType, stepsJson,
            planApprovalRole, teamEstablishRole, resultAcceptanceRole, isActive, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
          ON CONFLICT(code) DO UPDATE SET
            name = excluded.name,
            unitName = excluded.unitName,
            inspectionType = excluded.inspectionType,
            stepsJson = excluded.stepsJson,
            planApprovalRole = excluded.planApprovalRole,
            teamEstablishRole = excluded.teamEstablishRole,
            resultAcceptanceRole = excluded.resultAcceptanceRole,
            isActive = excluded.isActive,
            updatedAt = datetime('now', 'localtime')
        `).run(
          wfCode,
          name,
          unitName,
          inspectionType || 'all',
          stepsJson,
          planApprovalRole || 'Trưởng Công an Phường / Lãnh đạo Phòng Nghiệp vụ',
          teamEstablishRole || 'Trưởng đơn vị chủ trì / Trưởng phòng Nghiệp vụ',
          resultAcceptanceRole || 'Lãnh đạo đơn vị phê duyệt kế hoạch / Trưởng đoàn kiểm tra',
          isActive !== undefined ? (isActive ? 1 : 0) : 1
        );
      }

      res.json({ success: true, message: 'Đã lưu cấu hình quy trình kiểm tra của đơn vị nghiệp vụ.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * DELETE /api/configs/workflows/:id
   */
  static deleteWorkflow(req: Request, res: Response): void {
    try {
      const id = parseInt(req.params.id as string, 10);
      db.prepare(`DELETE FROM unit_workflows WHERE id = ?`).run(id);
      res.json({ success: true, message: 'Đã xóa quy trình kiểm tra.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * 7. Ma trận Phân quyền & Phân định Thẩm quyền 3 bước
   * GET /api/configs/permissions
   */
  static getPermissions(req: Request, res: Response): void {
    try {
      const row = db.prepare(`SELECT value FROM system_configs WHERE key = 'rolePermissionsMatrix'`).get() as { value: string } | undefined;
      if (row && row.value) {
        try {
          res.json({ success: true, data: JSON.parse(row.value) });
          return;
        } catch {
          // fallback to default
        }
      }

      const defaultMatrix = {
        authoritySeparation: {
          planApproval: {
            title: '1. Thẩm quyền Phê duyệt & Điều chỉnh Kế hoạch Kiểm tra',
            roles: ['Lãnh đạo Phòng Nghiệp vụ (PA04, PC06, PC07, PC03)', 'Ban Chỉ huy Công an Quận/Thành phố', 'Quản trị hệ thống (Admin)'],
            description: 'Xét duyệt kế hoạch định kỳ, phê duyệt đề xuất đột xuất/yêu cầu nghiệp vụ và duyệt điều chỉnh lịch/đối tượng kiểm tra.'
          },
          teamEstablishment: {
            title: '2. Thẩm quyền Thành lập & Điều chỉnh Đoàn Kiểm tra / Liên ngành',
            roles: ['Trưởng phòng Nghiệp vụ chủ trì', 'Trưởng Công an Phường/Xã', 'Lãnh đạo Ban Chỉ đạo Liên ngành'],
            description: 'Ra quyết định thành lập đoàn kiểm tra đơn vị hoặc liên ngành, phân công Trưởng đoàn và điều chỉnh nhân sự đoàn trong quá trình thực hiện.'
          },
          resultAcceptance: {
            title: '3. Thẩm quyền Nghiệm thu Kết quả Kiểm tra & Duyệt Giải trình',
            roles: ['Lãnh đạo cấp phê duyệt kế hoạch', 'Trưởng Công an Phường/Đơn vị chủ trì', 'Lãnh đạo Phòng Nghiệp vụ ngành dọc'],
            description: 'Nghiệm thu biên bản kết luận kiểm tra, phê duyệt báo cáo giải trình các cơ sở chưa kiểm tra và đóng hồ sơ kiểm tra.'
          }
        },
        permissions: [
          {
            code: 'OBJ_CREATE_UPDATE',
            group: '1. Quản lý Doanh nghiệp & Địa điểm',
            name: 'Thêm mới, cập nhật thông tin doanh nghiệp & yếu tố nước ngoài',
            admin: true,
            unitLeader: true,
            wardOfficer: true,
            inspector: true
          },
          {
            code: 'OBJ_LOCATION_MANAGE',
            group: '1. Quản lý Doanh nghiệp & Địa điểm',
            name: 'Thêm mới, cập nhật linh hoạt Trụ sở, Chi nhánh, Cơ sở, Địa điểm kinh doanh',
            admin: true,
            unitLeader: true,
            wardOfficer: true,
            inspector: true
          },
          {
            code: 'PLAN_CREATE_EDIT',
            group: '2. Quản lý Kế hoạch Kiểm tra',
            name: 'Lập dự thảo, sửa kế hoạch kiểm tra theo từng đơn vị / địa bàn',
            admin: true,
            unitLeader: true,
            wardOfficer: true,
            inspector: false
          },
          {
            code: 'PLAN_APPROVE',
            group: '2. Quản lý Kế hoạch Kiểm tra',
            name: 'Thẩm quyền Phê duyệt / Từ chối kế hoạch kiểm tra & đề xuất đột xuất',
            admin: true,
            unitLeader: true,
            wardOfficer: false,
            inspector: false
          },
          {
            code: 'PLAN_ADJUST_RUNTIME',
            group: '2. Quản lý Kế hoạch Kiểm tra',
            name: 'Điều chỉnh kế hoạch, thời gian, địa điểm và nội dung trong quá trình triển khai',
            admin: true,
            unitLeader: true,
            wardOfficer: true,
            inspector: false
          },
          {
            code: 'TEAM_ESTABLISH',
            group: '3. Quản lý Đoàn Kiểm tra & Liên ngành',
            name: 'Thẩm quyền Thành lập đoàn kiểm tra đơn vị & đoàn liên ngành',
            admin: true,
            unitLeader: true,
            wardOfficer: true,
            inspector: false
          },
          {
            code: 'TEAM_ADJUST_MEMBERS',
            group: '3. Quản lý Đoàn Kiểm tra & Liên ngành',
            name: 'Bổ sung, thay đổi thành phần đoàn và lịch kiểm tra khi triển khai',
            admin: true,
            unitLeader: true,
            wardOfficer: true,
            inspector: false
          },
          {
            code: 'INSP_EXECUTE',
            group: '4. Thực hiện Kiểm tra & Giải trình',
            name: 'Ghi nhận biên bản kiểm tra, vi phạm theo từng cơ sở và tải minh chứng',
            admin: true,
            unitLeader: true,
            wardOfficer: true,
            inspector: true
          },
          {
            code: 'INSP_EXPLAIN_UNINSPECTED',
            group: '4. Thực hiện Kiểm tra & Giải trình',
            name: 'Báo cáo nguyên nhân, nhập giải trình đối với cơ sở chưa kiểm tra theo kế hoạch',
            admin: true,
            unitLeader: true,
            wardOfficer: true,
            inspector: true
          },
          {
            code: 'INSP_ACCEPT_RESULT',
            group: '5. Nghiệm thu Kết quả & Cấu hình Quy trình',
            name: 'Thẩm quyền Nghiệm thu kết quả kiểm tra & Duyệt giải trình chưa kiểm tra',
            admin: true,
            unitLeader: true,
            wardOfficer: false,
            inspector: false
          },
          {
            code: 'WORKFLOW_CONFIG',
            group: '5. Nghiệm thu Kết quả & Cấu hình Quy trình',
            name: 'Cấu hình, bổ sung quy trình kiểm tra riêng theo từng đơn vị nghiệp vụ / ngành dọc',
            admin: true,
            unitLeader: true,
            wardOfficer: false,
            inspector: false
          }
        ]
      };

      res.json({ success: true, data: defaultMatrix });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * PUT /api/configs/permissions
   */
  static savePermissions(req: Request, res: Response): void {
    try {
      const payload = req.body;
      db.prepare(`
        INSERT INTO system_configs (key, value)
        VALUES ('rolePermissionsMatrix', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(JSON.stringify(payload));

      res.json({ success: true, message: 'Đã lưu cấu hình Phân quyền & Thẩm quyền nghiệp vụ thành công.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

