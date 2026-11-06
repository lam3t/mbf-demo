import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import {
  PageHeaderComponent,
  PageHeaderAction,
  StatusTabsComponent,
  StatusTabItem,
  SearchFilterBarComponent,
  DataTableComponent,
  TableColumn,
  TableAction,
  WardSelectComponent
} from '../../shared/components';

import { UserDialogComponent } from './components/user-dialog.component';
import { CatalogDialogComponent } from './components/catalog-dialog.component';
import { LogDetailDialogComponent } from './components/log-detail-dialog.component';
import { LogDiffDialogComponent } from './components/log-diff-dialog.component';
import { ApiService } from '../../core/services/api.service';
import { AlertsService } from '../../core/services/alerts.service';
import { User, AuditLog, ViolationCatalog, RecommendationTagCatalog, QuotaConfig, CutoffConfig, Alert } from '../../core/models';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    PageHeaderComponent,
    StatusTabsComponent,
    SearchFilterBarComponent,
    DataTableComponent,
    WardSelectComponent
  ],
  template: `
    <div class="admin-management-page">
      <!-- Admin Top Nav Tabs (Matching Sidebar items) -->
      <div class="admin-nav-bar">
        <button
          type="button"
          class="nav-tab-btn"
          [class.active]="activeTab === 'users'"
          (click)="switchTab('users')"
        >
          <mat-icon>people</mat-icon>
          <span>1. Người dùng</span>
        </button>

        <button
          type="button"
          class="nav-tab-btn"
          [class.active]="activeTab === 'roles'"
          (click)="switchTab('roles')"
        >
          <mat-icon>security</mat-icon>
          <span>2. Phân quyền & Quy trình nghiệp vụ</span>
        </button>

        <button
          type="button"
          class="nav-tab-btn"
          [class.active]="activeTab === 'categories'"
          (click)="switchTab('categories')"
        >
          <mat-icon>category</mat-icon>
          <span>3. Danh mục</span>
        </button>

        <button
          type="button"
          class="nav-tab-btn"
          [class.active]="activeTab === 'config'"
          (click)="switchTab('config')"
        >
          <mat-icon>tune</mat-icon>
          <span>4. Cấu hình Quota & Cut-off</span>
        </button>

        <button
          type="button"
          class="nav-tab-btn"
          [class.active]="activeTab === 'logs'"
          (click)="switchTab('logs')"
        >
          <mat-icon>history</mat-icon>
          <span>5. Nhật ký hệ thống</span>
        </button>

        <button
          type="button"
          class="nav-tab-btn"
          [class.active]="activeTab === 'alerts'"
          (click)="switchTab('alerts')"
        >
          <mat-icon style="color: #ef4444;">crisis_alert</mat-icon>
          <span>6. Cảnh báo hệ thống</span>
        </button>
      </div>

      <!-- TAB 1: USER MANAGEMENT -->
      <div class="tab-view-container" *ngIf="activeTab === 'users'">
        <app-page-header
          title="Quản lý Người dùng & Cán bộ"
          [subtitle]="'Tổng số ' + users.length + ' tài khoản cán bộ trên hệ thống'"
          [actions]="userHeaderActions"
          (actionClick)="handleUserHeaderAction($event)"
        ></app-page-header>

        <app-search-filter-bar
          placeholder="Tìm kiếm theo tên cán bộ, username, đơn vị..."
          (search)="handleUserSearch($event)"
          (searchChange)="handleUserSearch($event)"
          (refresh)="loadUsers()"
        ></app-search-filter-bar>

        <app-status-tabs
          [tabs]="userStatusTabs"
          [activeKey]="activeUserStatus"
          (tabChange)="handleUserStatusChange($event)"
        ></app-status-tabs>

        <app-data-table
          [columns]="userColumns"
          [data]="filteredUsers"
          [actions]="userRowActions"
          [loading]="isLoadingUsers"
          (actionClick)="handleUserRowAction($event)"
        ></app-data-table>
      </div>

      <!-- TAB 2: ROLE & PERMISSION MATRIX + 3-STAGE AUTHORITY + CUSTOM UNIT WORKFLOWS -->
      <div class="tab-view-container" *ngIf="activeTab === 'roles'">
        <app-page-header
          title="Phân quyền Nghiệp vụ, Thẩm quyền 3 Cấp & Cấu hình Quy trình theo Đơn vị"
          subtitle="Phân định thẩm quyền Phê duyệt KH - Thành lập đoàn - Nghiệm thu kết quả, phân quyền chi tiết và cấu hình quy trình riêng từng đơn vị nghiệp vụ/ngành dọc"
        ></app-page-header>

        <!-- SECTION A: PHÂN ĐỊNH RÕ 3 THẨM QUYỀN CỐT LÕI -->
        <div class="authority-3-grid" *ngIf="authoritySeparation">
          <div class="auth-stage-card stage-plan">
            <div class="stage-head">
              <span class="stage-badge">THẨM QUYỀN CẤP 1</span>
              <mat-icon>fact_check</mat-icon>
            </div>
            <h4>{{ authoritySeparation.planApproval?.title }}</h4>
            <p class="stage-desc">{{ authoritySeparation.planApproval?.description }}</p>
            <div class="stage-roles">
              <span class="role-chip" *ngFor="let r of authoritySeparation.planApproval?.roles">{{ r }}</span>
            </div>
          </div>

          <div class="auth-stage-card stage-team">
            <div class="stage-head">
              <span class="stage-badge">THẨM QUYỀN CẤP 2</span>
              <mat-icon>groups</mat-icon>
            </div>
            <h4>{{ authoritySeparation.teamEstablishment?.title }}</h4>
            <p class="stage-desc">{{ authoritySeparation.teamEstablishment?.description }}</p>
            <div class="stage-roles">
              <span class="role-chip" *ngFor="let r of authoritySeparation.teamEstablishment?.roles">{{ r }}</span>
            </div>
          </div>

          <div class="auth-stage-card stage-accept">
            <div class="stage-head">
              <span class="stage-badge">THẨM QUYỀN CẤP 3</span>
              <mat-icon>verified</mat-icon>
            </div>
            <h4>{{ authoritySeparation.resultAcceptance?.title }}</h4>
            <p class="stage-desc">{{ authoritySeparation.resultAcceptance?.description }}</p>
            <div class="stage-roles">
              <span class="role-chip" *ngFor="let r of authoritySeparation.resultAcceptance?.roles">{{ r }}</span>
            </div>
          </div>
        </div>

        <!-- SECTION B: MA TRẬN PHÂN QUYỀN CHI TIẾT THEO ĐƠN VỊ & VAI TRÒ -->
        <div class="matrix-card">
          <div class="section-bar">
            <div>
              <h3 class="sec-title">
                <mat-icon>admin_panel_settings</mat-icon>
                Ma trận Phân quyền Chi tiết theo Đơn vị & Chức trách Nghiệp vụ
              </h3>
              <p class="sec-sub">
                Cấu hình quyền lập/sửa/duyệt/điều chỉnh kế hoạch, thêm/cập nhật doanh nghiệp & cơ sở, thành lập đoàn và nghiệm thu kết quả (Click vào ô để bật/tắt quyền)
              </p>
            </div>
            <button mat-flat-button class="btn-cids-primary" (click)="savePermissionMatrix()">
              <mat-icon>save</mat-icon>
              <span>Lưu Cấu hình Phân quyền</span>
            </button>
          </div>

          <table class="role-matrix-table">
            <thead>
              <tr>
                <th style="width: 18%;">Nhóm nghiệp vụ</th>
                <th style="width: 34%;">Chức năng / Quyền hạn cụ thể</th>
                <th class="text-center">Quản trị Hệ thống</th>
                <th class="text-center">Lãnh đạo Phòng Nghiệp vụ / Chỉ huy</th>
                <th class="text-center">Trưởng / Cán bộ Đơn vị (Phường/Đội)</th>
                <th class="text-center">Cán bộ Kiểm tra / Thành viên Đoàn</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let perm of detailedPermissions">
                <td>
                  <span class="perm-group-pill">{{ perm.group }}</span>
                </td>
                <td>
                  <strong>{{ perm.name }}</strong>
                  <span class="perm-desc">Mã quyền: {{ perm.code }}</span>
                </td>
                <td class="text-center">
                  <input type="checkbox" class="perm-checkbox" [(ngModel)]="perm.admin" />
                </td>
                <td class="text-center">
                  <input type="checkbox" class="perm-checkbox" [(ngModel)]="perm.unitLeader" />
                </td>
                <td class="text-center">
                  <input type="checkbox" class="perm-checkbox" [(ngModel)]="perm.wardOfficer" />
                </td>
                <td class="text-center">
                  <input type="checkbox" class="perm-checkbox" [(ngModel)]="perm.inspector" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- SECTION C: CẤU HÌNH QUY TRÌNH ĐỘNG THEO TỪNG ĐƠN VỊ (PC07, PC04, PC06, PHƯỜNG...) & LOẠI KẾ HOẠCH -->
        <div class="matrix-card">
          <div class="section-bar">
            <div>
              <h3 class="sec-title">
                <mat-icon>account_tree</mat-icon>
                Cấu hình Quy trình Động theo Đơn vị Nghiệp vụ (PC07, PC04, PC06, Phường...) & Loại hình Kế hoạch ({{ filteredWorkflows.length }}/{{ unitWorkflows.length }} quy trình)
              </h3>
              <p class="sec-sub">
                Mỗi đơn vị (PC07, PC04/PA04, PC06, Công an Phường...) có nhiều quy trình riêng cho Kế hoạch Định kỳ, Kiểm tra Đột xuất, Yêu cầu Nghiệp vụ — Cấu hình rõ <strong>Phòng ban nào duyệt</strong> và <strong>Người duyệt cụ thể</strong> ở từng bước
              </p>
            </div>
            <button mat-flat-button class="btn-cids-primary" (click)="openWorkflowEditor()">
              <mat-icon>add_circle</mat-icon>
              <span>+ Thêm Quy trình Động cho Đơn vị</span>
            </button>
          </div>

          <!-- Filter Bar by Unit (PC07, PC04, PC06, CAP, Liên ngành) & Inspection Type (Định kỳ, Đột xuất, Yêu cầu nghiệp vụ) -->
          <div class="wf-filter-bar" style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <span style="font-size: 12px; font-weight: 700; color: #334155;">Đơn vị nghiệp vụ:</span>
            <button
              type="button"
              *ngFor="let u of unitFilterOptions"
              (click)="selectedWfUnitCode = u.code; applyWorkflowFilter()"
              [style.background]="selectedWfUnitCode === u.code ? '#1e3a8a' : '#ffffff'"
              [style.color]="selectedWfUnitCode === u.code ? '#ffffff' : '#334155'"
              style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 11px; font-size: 12px; font-weight: 600; cursor: pointer;">
              {{ u.label }}
            </button>

            <span style="font-size: 12px; font-weight: 700; color: #334155; margin-left: auto;">Loại kế hoạch / kiểm tra:</span>
            <select
              class="cids-select"
              style="height: 32px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12.5px;"
              [(ngModel)]="selectedWfInspectionType"
              (change)="applyWorkflowFilter()">
              <option value="all">Tất cả loại quy trình (Định kỳ, Đột xuất, Nghiệp vụ)</option>
              <option value="planned">📅 Quy trình Kiểm tra Định kỳ / Theo kế hoạch</option>
              <option value="adhoc">⚡ Quy trình Kiểm tra Đột xuất</option>
              <option value="professional_request">🎯 Quy trình Kiểm tra Yêu cầu Nghiệp vụ</option>
            </select>
          </div>

          <!-- Inline Dynamic Workflow Form Editor -->
          <div class="workflow-editor-panel" *ngIf="showWorkflowForm">
            <div class="wf-editor-header">
              <h4>
                <mat-icon>settings_suggest</mat-icon>
                {{ workflowForm.id ? 'Cấu hình / Điều chỉnh Quy trình Động của Đơn vị' : 'Thiết lập Quy trình Động Mới (Cấu hình Phòng ban duyệt & Người duyệt)' }}
              </h4>
              <button mat-icon-button (click)="closeWorkflowEditor()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <!-- Quick Preset Unit Picker -->
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px;">
              <span style="font-size: 12px; font-weight: 600; color: #475569;">Chọn nhanh Đơn vị mẫu:</span>
              <button
                type="button"
                *ngFor="let preset of unitPresets"
                (click)="selectUnitPreset(preset)"
                style="border: 1px solid #93c5fd; background: #eff6ff; color: #1d4ed8; border-radius: 5px; padding: 3px 10px; font-size: 11.5px; font-weight: 600; cursor: pointer;">
                {{ preset.unitCode }} — {{ preset.unitName }}
              </button>
            </div>

            <div class="wf-form-grid">
              <div class="wf-field">
                <label>Mã Đơn vị & Mã Quy trình (*)</label>
                <div style="display: flex; gap: 6px;">
                  <input type="text" class="cids-input" style="width: 90px; font-weight: 700;" [(ngModel)]="workflowForm.unitCode" placeholder="PC07" />
                  <input type="text" class="cids-input" style="flex: 1;" [(ngModel)]="workflowForm.code" placeholder="VD: WF_PC07_PLANNED" />
                </div>
              </div>
              <div class="wf-field">
                <label>Đơn vị nghiệp vụ sở hữu quy trình (*)</label>
                <input type="text" class="cids-input" [(ngModel)]="workflowForm.unitName" list="unitNameSuggestions" placeholder="VD: Phòng Cảnh sát PCCC & CNCH (PC07)" />
              </div>
              <div class="wf-field">
                <label>Loại Kế hoạch / Loại hình Kiểm tra áp dụng (*)</label>
                <select class="cids-select" [(ngModel)]="workflowForm.inspectionType">
                  <option value="planned">📅 Quy trình Kiểm tra Định kỳ / Theo kế hoạch</option>
                  <option value="adhoc">⚡ Quy trình Kiểm tra Đột xuất</option>
                  <option value="professional_request">🎯 Quy trình Kiểm tra Theo yêu cầu nghiệp vụ</option>
                </select>
              </div>
              <div class="wf-field">
                <label>Tên Quy trình Động (*)</label>
                <input type="text" class="cids-input" [(ngModel)]="workflowForm.name" placeholder="VD: Quy trình Kiểm tra Định kỳ An toàn PCCC (PC07)" />
              </div>
            </div>

            <!-- 3 Core Approval Milestones: Department + Specific Approver Person -->
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
              <div style="font-size: 12.5px; font-weight: 700; color: #1e3a8a; margin-bottom: 8px;">
                📌 Cấu hình Phòng ban Phê duyệt & Người duyệt cụ thể cho Kế hoạch của Đơn vị ({{ workflowForm.unitName || 'Đơn vị' }}):
              </div>
              <div class="wf-form-grid-3">
                <div class="wf-field" style="background: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #dbeafe;">
                  <label style="color: #1d4ed8; font-weight: 700;">1. Cấp Phê duyệt Kế hoạch Kiểm tra</label>
                  <span style="font-size: 11px; color: #64748b;">Phòng ban / Bộ phận duyệt kế hoạch:</span>
                  <input type="text" class="cids-input" [(ngModel)]="workflowForm.planApprovalDept" list="deptSuggestions" placeholder="VD: Ban Chỉ huy Phòng PC07" />
                  <span style="font-size: 11px; color: #64748b; margin-top: 4px;">Người duyệt kế hoạch cụ thể:</span>
                  <input type="text" class="cids-input" [(ngModel)]="workflowForm.planApproverName" list="approverSuggestions" placeholder="VD: Đại tá Lê Minh Hải (Trưởng phòng PC07)" />
                </div>

                <div class="wf-field" style="background: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #ede9fe;">
                  <label style="color: #6d28d9; font-weight: 700;">2. Cấp Duyệt Thành lập Đoàn Kiểm tra</label>
                  <span style="font-size: 11px; color: #64748b;">Phòng ban trình / duyệt thành lập đoàn:</span>
                  <input type="text" class="cids-input" [(ngModel)]="workflowForm.teamEstablishDept" list="deptSuggestions" placeholder="VD: Ban Chỉ huy Phòng PC07 & Đội Tham mưu" />
                  <span style="font-size: 11px; color: #64748b; margin-top: 4px;">Người ký QĐ thành lập đoàn:</span>
                  <input type="text" class="cids-input" [(ngModel)]="workflowForm.teamApproverName" list="approverSuggestions" placeholder="VD: Thượng tá Nguyễn Văn Bình (Phó phòng PC07)" />
                </div>

                <div class="wf-field" style="background: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #d1fae5;">
                  <label style="color: #047857; font-weight: 700;">3. Cấp Nghiệm thu Kết quả Kiểm tra</label>
                  <span style="font-size: 11px; color: #64748b;">Phòng ban nghiệm thu kết luận:</span>
                  <input type="text" class="cids-input" [(ngModel)]="workflowForm.resultAcceptanceDept" list="deptSuggestions" placeholder="VD: Ban Chỉ huy Phòng PC07" />
                  <span style="font-size: 11px; color: #64748b; margin-top: 4px;">Người duyệt nghiệm thu kết quả:</span>
                  <input type="text" class="cids-input" [(ngModel)]="workflowForm.resultApproverName" list="approverSuggestions" placeholder="VD: Đại tá Lê Minh Hải (Trưởng phòng PC07)" />
                </div>
              </div>
            </div>

            <!-- Datalist suggestions for quick selection or custom input -->
            <datalist id="unitNameSuggestions">
              <option value="Phòng Cảnh sát PCCC & CNCH (PC07)"></option>
              <option value="Phòng Cảnh sát Kinh tế / An ninh Kinh tế (PC04 / PA04)"></option>
              <option value="Phòng Cảnh sát QLHC về TTXH (PC06)"></option>
              <option value="Công an / UBND Phường"></option>
              <option value="Ban Chỉ đạo / Đoàn Kiểm tra Liên ngành"></option>
            </datalist>
            <datalist id="deptSuggestions">
              <option value="Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)"></option>
              <option value="Trực ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)"></option>
              <option value="Đội Công tác Phòng cháy - Phòng PC07"></option>
              <option value="Đội Tham mưu & Pháp chế - Phòng PC07"></option>
              <option value="Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)"></option>
              <option value="Đội Nghiệp vụ Kinh tế Thương mại - Phòng PC04"></option>
              <option value="Đội Tham mưu Tổng hợp - Phòng PC04"></option>
              <option value="Ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)"></option>
              <option value="Đội Quản lý Ngành nghề KD có điều kiện - Phòng PC06"></option>
              <option value="Ban Chỉ huy Công an Phường / Lãnh đạo UBND Phường"></option>
              <option value="Lãnh đạo Ban Chỉ đạo Kiểm tra Liên ngành (PC04 - PC07 - PC06)"></option>
            </datalist>
            <datalist id="approverSuggestions">
              <option value="Đại tá Lê Minh Hải (Trưởng phòng PC07)"></option>
              <option value="Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng PC07)"></option>
              <option value="Trung tá Nguyễn Thị Mai (Đội trưởng Đội Tham mưu PC07)"></option>
              <option value="Thiếu tá Hoàng Văn Sơn (Đội trưởng Đội Phòng cháy PC07)"></option>
              <option value="Đại tá Trần Quốc Tuấn (Trưởng phòng PC04/PA04)"></option>
              <option value="Thượng tá Vũ Minh Đức (Phó Trưởng phòng PC04/PA04)"></option>
              <option value="Trung tá Đỗ Quang Huy (Đội trưởng Nghiệp vụ PC04/PA04)"></option>
              <option value="Đại tá Phạm Hồng Quân (Trưởng phòng PC06)"></option>
              <option value="Thượng tá Đặng Văn Hòa (Phó Trưởng phòng PC06)"></option>
              <option value="Trung tá Nguyễn Hoàng Nam (Trưởng Công an Phường)"></option>
              <option value="Thiếu tá Lê Văn Cường (Phó Trưởng Công an Phường)"></option>
            </datalist>

            <div class="wf-steps-editor">
              <div class="steps-head">
                <label>Cấu hình Luồng các bước phê duyệt & thực hiện động (Chỉ định rõ Phòng ban duyệt & Người duyệt cho từng bước):</label>
                <button mat-stroked-button color="primary" type="button" (click)="addWorkflowStep()">
                  <mat-icon>add</mat-icon> + Thêm bước quy trình động
                </button>
              </div>

              <div class="step-edit-row" *ngFor="let st of workflowForm.steps; let idx = index" style="flex-wrap: wrap; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
                <span class="step-num">Bước {{ idx + 1 }}</span>
                <select class="cids-select" style="width: 155px; height: 34px; font-size: 12px; border: 1px solid #cbd5e1; border-radius: 5px;" [(ngModel)]="st.stepType">
                  <option value="create">1. Lập & Trình KH</option>
                  <option value="review">2. Phòng ban Thẩm định</option>
                  <option value="approve_plan">3. Phê duyệt Kế hoạch</option>
                  <option value="establish_team">4. Duyệt Thành lập Đoàn</option>
                  <option value="inspect">5. Kiểm tra thực địa</option>
                  <option value="accept_result">6. Nghiệm thu kết quả</option>
                </select>
                <input
                  type="text"
                  class="cids-input"
                  style="flex: 1.4; min-width: 220px;"
                  [(ngModel)]="st.name"
                  placeholder="Tên bước (VD: Phê duyệt Kế hoạch Kiểm tra Định kỳ PCCC...)" />
                <input
                  type="text"
                  class="cids-input"
                  style="flex: 1.1; min-width: 190px;"
                  [(ngModel)]="st.approvingDept"
                  list="deptSuggestions"
                  placeholder="🏢 Phòng ban duyệt (VD: Ban Chỉ huy Phòng PC07)" />
                <input
                  type="text"
                  class="cids-input"
                  style="flex: 1.1; min-width: 190px;"
                  [(ngModel)]="st.approverName"
                  list="approverSuggestions"
                  placeholder="👤 Người duyệt (VD: Đại tá Lê Minh Hải - Trưởng phòng)" />
                <div style="display: flex; align-items: center; gap: 4px;">
                  <input
                    type="number"
                    class="cids-input"
                    style="width: 62px; text-align: center;"
                    [(ngModel)]="st.slaHours"
                    min="1"
                    title="Thời hạn xử lý (giờ)" />
                  <span style="font-size: 11px; color: #64748b;">giờ</span>
                </div>
                <label class="req-check">
                  <input type="checkbox" [(ngModel)]="st.required" /> Bắt buộc
                </label>
                <button mat-icon-button color="warn" type="button" (click)="removeWorkflowStep(idx)" *ngIf="workflowForm.steps.length > 1">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            </div>

            <div class="wf-editor-actions">
              <button mat-stroked-button type="button" (click)="closeWorkflowEditor()">Hủy</button>
              <button mat-flat-button class="btn-cids-primary" type="button" (click)="saveWorkflowForm()">
                <mat-icon>save</mat-icon>
                <span>Lưu Cấu hình Quy trình Động</span>
              </button>
            </div>
          </div>

          <!-- Unit Workflows List -->
          <div class="workflows-cards-grid">
            <div class="wf-card" *ngFor="let wf of filteredWorkflows" style="border-left: 4px solid #1e3a8a;">
              <div class="wf-card-top">
                <div>
                  <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px;">
                    <span class="wf-unit-tag" style="background: #1e3a8a; color: #ffffff; font-weight: 800;">🏢 {{ wf.unitCode || 'UNIT' }} — {{ wf.unitName }}</span>
                    <span
                      style="font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 4px;"
                      [style.background]="wf.inspectionType === 'adhoc' ? '#fef2f2' : wf.inspectionType === 'professional_request' ? '#f3e8ff' : '#ecfdf5'"
                      [style.color]="wf.inspectionType === 'adhoc' ? '#dc2626' : wf.inspectionType === 'professional_request' ? '#7c3aed' : '#059669'">
                      {{ wf.inspectionType === 'adhoc' ? '⚡ Quy trình Kiểm tra Đột xuất' : wf.inspectionType === 'professional_request' ? '🎯 Quy trình Yêu cầu Nghiệp vụ' : '📅 Quy trình Kiểm tra Định kỳ / Theo kế hoạch' }}
                    </span>
                    <span class="wf-code-tag">Mã: {{ wf.code }}</span>
                  </div>
                  <h4 class="wf-title">{{ wf.name }}</h4>
                  <p *ngIf="wf.description" style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">{{ wf.description }}</p>
                </div>
                <div class="wf-actions" style="display: flex; gap: 6px; flex-wrap: wrap;">
                  <button mat-stroked-button color="primary" (click)="openWorkflowEditor(wf)">
                    <mat-icon>edit</mat-icon> Cấu hình Phòng ban & Người duyệt
                  </button>
                  <button mat-stroked-button (click)="cloneWorkflowForUnit(wf)" title="Nhân bản thành quy trình mới cho đơn vị">
                    <mat-icon>content_copy</mat-icon> Nhân bản
                  </button>
                </div>
              </div>

              <!-- 3 Milestones: Approving Department + Specific Approver Person -->
              <div class="wf-authorities-strip" style="background: #f8fafc; border: 1px solid #e2e8f0;">
                <div style="border-right: 1px solid #e2e8f0; padding-right: 8px;">
                  <div style="font-size: 11px; font-weight: 700; color: #1d4ed8; text-transform: uppercase;">1. Duyệt Kế hoạch Kiểm tra</div>
                  <div style="margin-top: 2px;">🏢 <strong>Phòng ban:</strong> {{ wf.planApprovalDept || wf.unitName }}</div>
                  <div>👤 <strong>Người duyệt:</strong> <span style="color: #0f172a; font-weight: 700;">{{ wf.planApproverName || wf.planApprovalRole }}</span></div>
                </div>
                <div style="border-right: 1px solid #e2e8f0; padding-right: 8px;">
                  <div style="font-size: 11px; font-weight: 700; color: #6d28d9; text-transform: uppercase;">2. Duyệt Thành lập Đoàn Kiểm tra</div>
                  <div style="margin-top: 2px;">🏢 <strong>Phòng ban:</strong> {{ wf.teamEstablishDept || wf.unitName }}</div>
                  <div>👤 <strong>Người duyệt:</strong> <span style="color: #0f172a; font-weight: 700;">{{ wf.teamApproverName || wf.teamEstablishRole }}</span></div>
                </div>
                <div>
                  <div style="font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase;">3. Nghiệm thu Kết quả Kiểm tra</div>
                  <div style="margin-top: 2px;">🏢 <strong>Phòng ban:</strong> {{ wf.resultAcceptanceDept || wf.unitName }}</div>
                  <div>👤 <strong>Người duyệt:</strong> <span style="color: #0f172a; font-weight: 700;">{{ wf.resultApproverName || wf.resultAcceptanceRole }}</span></div>
                </div>
              </div>

              <!-- Dynamic Steps Flow with Department & Approver on every step -->
              <div class="wf-steps-flow" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(235px, 1fr)); gap: 8px;">
                <div class="wf-step-pill" *ngFor="let s of wf.steps; let i = index" style="align-items: flex-start;">
                  <span class="s-idx" style="margin-top: 2px; flex-shrink: 0;">{{ i + 1 }}</span>
                  <div class="s-info" style="flex: 1;">
                    <div class="s-name" style="line-height: 1.35; margin-bottom: 3px;">{{ s.name }}</div>
                    <div class="s-role" style="color: #1e40af; font-weight: 600;">🏢 {{ s.approvingDept || wf.planApprovalDept }}</div>
                    <div class="s-role" style="color: #0f172a; font-weight: 700;">👤 {{ s.approverName || s.role }} <span style="color: #64748b; font-weight: 400;">(SLA: {{ s.slaHours || 24 }}h)</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: CATALOGS MANAGEMENT -->
      <div class="tab-view-container" *ngIf="activeTab === 'categories'">
        <app-page-header
          title="Quản lý Danh mục Nghiệp vụ"
          subtitle="Danh mục lỗi vi phạm hành chính và danh mục lĩnh vực kiến nghị"
          [actions]="catalogHeaderActions"
          (actionClick)="handleCatalogHeaderAction($event)"
        ></app-page-header>

        <div class="sub-tab-strip">
          <button
            type="button"
            class="sub-tab-btn"
            [class.active]="catalogSubTab === 'violations'"
            (click)="catalogSubTab = 'violations'"
          >
            Danh mục Lỗi vi phạm ({{ violations.length }})
          </button>
          <button
            type="button"
            class="sub-tab-btn"
            [class.active]="catalogSubTab === 'tags'"
            (click)="catalogSubTab = 'tags'"
          >
            Lĩnh vực kiến nghị ({{ recommendationTags.length }})
          </button>
        </div>

        <!-- Violations Table -->
        <app-data-table
          *ngIf="catalogSubTab === 'violations'"
          [columns]="catalogColumns"
          [data]="violations"
          [actions]="catalogRowActions"
          (actionClick)="handleCatalogRowAction($event, 'violation')"
        ></app-data-table>

        <!-- Recommendation Tags Table -->
        <app-data-table
          *ngIf="catalogSubTab === 'tags'"
          [columns]="catalogColumns"
          [data]="recommendationTags"
          [actions]="catalogRowActions"
          (actionClick)="handleCatalogRowAction($event, 'recommendation')"
        ></app-data-table>
      </div>

      <!-- TAB 4: SYSTEM CONFIGS (QUOTA & CUT-OFF & DEADLINE) -->
      <div class="tab-view-container" *ngIf="activeTab === 'config'">
        <app-page-header
          title="Cấu hình Hệ thống (Quota, Cut-off & Deadline)"
          subtitle="Thiết lập chỉ tiêu kiểm tra 5 phường, thời hạn nộp kế hoạch và thời hạn hoàn thành kiểm tra"
        ></app-page-header>

        <div class="config-grid">
          <!-- Quota Configuration Card -->
          <div class="config-card">
            <div class="card-header-bar">
              <div class="title-with-icon">
                <mat-icon>analytics</mat-icon>
                <h3>Chỉ tiêu Quota Kiểm tra theo Phường (Quý II/2026)</h3>
              </div>
              <button mat-flat-button class="btn-cids-primary" (click)="saveAllQuotas()">
                <mat-icon>save</mat-icon>
                <span>Lưu Quota</span>
              </button>
            </div>

            <table class="inline-edit-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Địa bàn Xã / Phường</th>
                  <th>Quý</th>
                  <th style="width: 140px;">Tối thiểu (Min)</th>
                  <th style="width: 140px;">Tối đa (Max)</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let q of quotaList; let i = index">
                  <td>{{ i + 1 }}</td>
                  <td><strong>{{ q.ward }}</strong></td>
                  <td><span class="badge-status badge-in_progress">{{ q.quarter }}</span></td>
                  <td>
                    <input
                      type="number"
                      class="inline-input"
                      [(ngModel)]="q.minCount"
                      min="1"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      class="inline-input"
                      [(ngModel)]="q.maxCount"
                      min="1"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Cut-off Configuration Card -->
          <div class="config-card">
            <div class="card-header-bar">
              <div class="title-with-icon">
                <mat-icon>timer</mat-icon>
                <h3>Thời điểm Chốt sổ Kế hoạch (Cut-off Time)</h3>
              </div>
            </div>

            <div class="cutoff-form-box">
              <div class="form-group">
                <label>Quý áp dụng:</label>
                <select class="cids-select" [(ngModel)]="cutoffForm.quarter">
                  <option value="Q2/2026">Quý II / 2026</option>
                  <option value="Q3/2026">Quý III / 2026</option>
                  <option value="Q4/2026">Quý IV / 2026</option>
                </select>
              </div>

              <div class="form-group">
                <label>Ngày và giờ chốt sổ (Cut-off DateTime):</label>
                <input
                  type="datetime-local"
                  class="cids-input"
                  [(ngModel)]="cutoffForm.cutoffDateTime"
                />
              </div>

              <div class="info-alert">
                <mat-icon>info</mat-icon>
                <span>Sau thời điểm Cut-off, các Phường sẽ bị khóa chức năng nộp kế hoạch và chỉ xem dữ liệu.</span>
              </div>

              <button mat-flat-button class="btn-cids-primary w-100" (click)="saveCutoff()">
                <mat-icon>event_available</mat-icon>
                <span>Cập nhật Thời điểm Chốt sổ</span>
              </button>

              <div class="cutoff-history">
                <h4>Lịch sử cấu hình Cut-off:</h4>
                <div class="history-item" *ngFor="let cut of cutoffList">
                  <span class="q-badge">{{ cut.quarter }}</span>
                  <span class="time-val">{{ cut.cutoffDateTime }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Inspection Deadline Configuration Card -->
          <div class="config-card">
            <div class="card-header-bar">
              <div class="title-with-icon">
                <mat-icon>hourglass_bottom</mat-icon>
                <h3>Thời hạn Hoàn thành Kiểm tra (Inspection Deadline)</h3>
              </div>
            </div>

            <div class="cutoff-form-box">
              <div class="form-group">
                <label>Số ngày hoàn thành kiểm tra (N ngày từ khi duyệt):</label>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <input
                    type="number"
                    class="cids-input"
                    style="max-width: 140px;"
                    [(ngModel)]="inspectionDeadlineDays"
                    min="1"
                    max="365"
                  />
                  <span style="font-weight: 500; color: #4b5563;">ngày</span>
                </div>
              </div>

              <div class="info-alert">
                <mat-icon>info</mat-icon>
                <span>Hồ sơ kiểm tra tự động tính hạn hoàn thành = ngày duyệt + N ngày. Nếu quá hạn hệ thống sẽ đổi cờ quá hạn và phát cảnh báo.</span>
              </div>

              <button mat-flat-button class="btn-cids-primary w-100" (click)="saveInspectionDeadlineDays()">
                <mat-icon>save</mat-icon>
                <span>Cập nhật Thời hạn Kiểm tra</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 5: AUDIT LOGS -->
      <div class="tab-view-container" *ngIf="activeTab === 'logs'">
        <app-page-header
          title="Nhật ký Hoạt động Hệ thống (Audit Log)"
          [subtitle]="'Ghi nhận toàn bộ thao tác thêm, sửa, xóa, duyệt và đăng nhập (' + auditLogs.length + ' bản ghi)'"
          [actions]="auditHeaderActions"
          (actionClick)="handleAuditHeaderAction($event)"
        ></app-page-header>

        <div class="audit-filter-toolbar" style="display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; background: #ffffff; padding: 12px 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <input
            type="text"
            class="cids-input"
            style="flex: 1; min-width: 260px; max-width: 420px;"
            placeholder="Tìm kiếm nhật ký theo người dùng, đối tượng, hành động..."
            [(ngModel)]="logSearchQuery"
            (input)="applyLogFilter()"
          />

          <app-ward-select
            [(ngModel)]="logWardFilter"
            (wardChange)="loadAuditLogs()"
            placeholder="-- Lọc theo Phường --"
            [includeAllOption]="true"
          ></app-ward-select>

          <button mat-button class="btn-reset" (click)="resetLogFilters()" style="border: 1px solid #d1d5db; height: 38px; border-radius: 6px; color: #4b5563;">
            <mat-icon>filter_alt_off</mat-icon> Đặt lại
          </button>
        </div>

        <app-data-table
          [columns]="auditColumns"
          [data]="filteredLogs"
          [actions]="auditRowActions"
          [loading]="isLoadingLogs"
          (actionClick)="handleAuditRowAction($event)"
          (rowClick)="openLogDiff($event)"
        ></app-data-table>
      </div>

      <!-- TAB 6: SYSTEM ALERTS -->
      <div class="tab-view-container" *ngIf="activeTab === 'alerts'">
        <app-page-header
          title="Cảnh báo & Quá hạn Hệ thống"
          [subtitle]="'Theo dõi và xử lý các cảnh báo quá hạn kế hoạch và hồ sơ kiểm tra thực địa (' + alerts.length + ' cảnh báo)'"
          [actions]="alertHeaderActions"
          (actionClick)="handleAlertHeaderAction($event)"
        ></app-page-header>

        <div class="alerts-filters-strip" style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; background: #ffffff; padding: 12px 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <input
            type="text"
            class="cids-input"
            style="max-width: 260px;"
            placeholder="Tìm theo nội dung cảnh báo..."
            [(ngModel)]="alertSearchTerm"
            (input)="filterAlerts()"
          />

          <app-ward-select
            [(ngModel)]="alertWardFilter"
            (wardChange)="loadAlerts()"
            placeholder="-- Tất cả đơn vị --"
            [includeAllOption]="true"
            allOptionValue="all"
          ></app-ward-select>

          <select class="cids-select" style="max-width: 170px;" [(ngModel)]="alertTypeFilter" (change)="loadAlerts()">
            <option value="all">-- Tất cả loại --</option>
            <option value="overdue_inspection">Quá hạn kiểm tra</option>
            <option value="overdue_plan">Quá hạn kế hoạch</option>
            <option value="quota_below">Dưới chỉ tiêu</option>
            <option value="quota_above">Vượt chỉ tiêu</option>
          </select>

          <select class="cids-select" style="max-width: 160px;" [(ngModel)]="alertSeverityFilter" (change)="loadAlerts()">
            <option value="all">-- Mức độ --</option>
            <option value="critical">Nghiêm trọng (Critical)</option>
            <option value="warning">Cảnh báo (Warning)</option>
            <option value="info">Thông tin (Info)</option>
          </select>

          <select class="cids-select" style="max-width: 150px;" [(ngModel)]="alertReadFilter" (change)="loadAlerts()">
            <option value="all">-- Trạng thái đọc --</option>
            <option value="0">Chưa đọc</option>
            <option value="1">Đã đọc</option>
          </select>
        </div>

        <app-data-table
          [columns]="alertColumns"
          [data]="filteredAlerts"
          [actions]="alertRowActions"
          [loading]="isLoadingAlerts"
          (actionClick)="handleAlertRowAction($event)"
        ></app-data-table>
      </div>
    </div>

  `,
  styles: [`
    .admin-management-page {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 1560px;
      margin: 0 auto;
    }

    .admin-nav-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      overflow-x: auto;

      .nav-tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: #4b5563;
        font-size: 13.5px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        white-space: nowrap;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #6b7280;
        }

        &:hover {
          background-color: #f1f5f9;
          color: #1a56db;
          mat-icon { color: #1a56db; }
        }

        &.active {
          background-color: #eaf1ff;
          color: #1a56db;
          font-weight: 600;
          mat-icon { color: #1a56db; }
        }
      }
    }

    .tab-view-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Role Matrix Table */
    .matrix-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      overflow-x: auto;
    }

    .role-matrix-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      thead th {
        background-color: #f8fafc;
        padding: 12px 16px;
        font-weight: 700;
        color: #1e3a8a;
        border-bottom: 2px solid #e2e8f0;
      }

      tbody td {
        padding: 12px 16px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;

        .perm-desc {
          display: block;
          font-size: 11.5px;
          color: #64748b;
          font-weight: 400;
          margin-top: 2px;
        }

        .perm-check {
          color: #cbd5e1;
          font-size: 20px;
          width: 20px;
          height: 20px;

          &.active-perm {
            color: #059669;
          }
        }
      }
    }

    /* Sub Tabs for Catalog */
    .sub-tab-strip {
      display: flex;
      gap: 8px;

      .sub-tab-btn {
        padding: 8px 18px;
        border-radius: 6px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        color: #4b5563;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;

        &:hover {
          background-color: #f8fafc;
        }

        &.active {
          background-color: #1e3a8a;
          color: #ffffff;
          border-color: #1e3a8a;
          font-weight: 600;
        }
      }
    }

    /* Config Grid */
    .config-grid {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 16px;

      .config-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

        .card-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;

          .title-with-icon {
            display: flex;
            align-items: center;
            gap: 8px;

            mat-icon {
              color: #1a56db;
              font-size: 20px;
              width: 20px;
              height: 20px;
            }

            h3 {
              font-size: 14.5px;
              font-weight: 700;
              color: #111827;
              margin: 0;
            }
          }
        }
      }
    }

    .inline-edit-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th {
        padding: 10px 12px;
        background: #f8fafc;
        font-weight: 600;
        color: #4b5563;
        border-bottom: 1px solid #e5e7eb;
      }

      td {
        padding: 10px 12px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }

      .inline-input {
        width: 100%;
        height: 34px;
        padding: 0 10px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 600;
        color: #1e3a8a;
        background-color: #ffffff;

        &:focus {
          border-color: #1a56db;
          outline: none;
          box-shadow: 0 0 0 2px rgba(26, 86, 219, 0.15);
        }
      }
    }

    .cutoff-form-box {
      display: flex;
      flex-direction: column;
      gap: 14px;

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;

        label {
          font-size: 12.5px;
          font-weight: 600;
          color: #374151;
        }

        .cids-select, .cids-input {
          height: 38px;
          padding: 0 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13.5px;
          color: #111827;
          background-color: #ffffff;

          &:focus {
            border-color: #1a56db;
            outline: none;
            box-shadow: 0 0 0 2px rgba(26, 86, 219, 0.15);
          }
        }
      }

      .info-alert {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background-color: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 6px;
        font-size: 12px;
        color: #1e40af;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #2563eb;
          flex-shrink: 0;
        }
      }

      .cutoff-history {
        margin-top: 8px;
        padding-top: 12px;
        border-top: 1px solid #f1f5f9;

        h4 {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .history-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          font-size: 12.5px;

          .q-badge {
            font-weight: 600;
            color: #1e3a8a;
          }

          .time-val {
            color: #64748b;
          }
        }
      }
    }

    .text-center { text-align: center !important; }
    .w-100 { width: 100%; }

    /* 3-Stage Authority Separation Grid */
    .authority-3-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;

      .auth-stage-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-top: 4px solid #1e3a8a;
        border-radius: 8px;
        padding: 14px 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

        &.stage-plan { border-top-color: #2563eb; }
        &.stage-team { border-top-color: #7c3aed; }
        &.stage-accept { border-top-color: #059669; }

        .stage-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;

          .stage-badge {
            font-size: 10.5px;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 999px;
            background: #eff6ff;
            color: #1e40af;
          }

          mat-icon {
            color: #1e3a8a;
            font-size: 20px;
            width: 20px;
            height: 20px;
          }
        }

        h4 {
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 6px 0;
        }

        .stage-desc {
          font-size: 12px;
          color: #475569;
          margin: 0 0 10px 0;
          line-height: 1.4;
        }

        .stage-roles {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;

          .role-chip {
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            background: #f1f5f9;
            color: #334155;
            border: 1px solid #cbd5e1;
          }
        }
      }
    }

    .section-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;

      .sec-title {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        color: #1e3a8a;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: #1a56db;
        }
      }

      .sec-sub {
        margin: 3px 0 0 0;
        font-size: 12px;
        color: #64748b;
      }
    }

    .perm-group-pill {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      background: #eff6ff;
      color: #1e40af;
    }

    .perm-checkbox {
      width: 17px;
      height: 17px;
      accent-color: #059669;
      cursor: pointer;
    }

    /* Workflow Editor & Cards */
    .workflow-editor-panel {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;

      .wf-editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #1e3a8a;
          display: flex;
          align-items: center;
          gap: 6px;
        }
      }

      .wf-form-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 12px;
      }

      .wf-form-grid-3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 12px;
      }

      .wf-field {
        display: flex;
        flex-direction: column;
        gap: 4px;

        label {
          font-size: 11.5px;
          font-weight: 600;
          color: #334155;
        }

        .cids-input, .cids-select {
          height: 36px;
          padding: 0 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 13px;
          background: #ffffff;
        }
      }

      .wf-steps-editor {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 12px;

        .steps-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;

          label {
            font-size: 12.5px;
            font-weight: 700;
            color: #1e293b;
          }
        }

        .step-edit-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;

          .step-num {
            font-size: 12px;
            font-weight: 700;
            color: #1e40af;
            background: #eff6ff;
            padding: 4px 10px;
            border-radius: 4px;
            min-width: 68px;
            text-align: center;
          }

          .cids-input {
            height: 34px;
            padding: 0 10px;
            border: 1px solid #cbd5e1;
            border-radius: 5px;
            font-size: 12.5px;
          }

          .req-check {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #475569;
            white-space: nowrap;
          }
        }
      }

      .wf-editor-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
    }

    .workflows-cards-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .wf-card {
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 14px 16px;
        background: #ffffff;

        .wf-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 8px;

          .wf-code-tag {
            font-family: monospace;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 4px;
            background: #f1f5f9;
            color: #475569;
            margin-right: 6px;
          }

          .wf-unit-tag {
            font-size: 11px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
            background: #ede9fe;
            color: #6d28d9;
          }

          .wf-title {
            margin: 5px 0 0 0;
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
          }
        }

        .wf-authorities-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          background: #f8fafc;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          color: #334155;
          margin-bottom: 10px;
        }

        .wf-steps-flow {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;

          .wf-step-pill {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 6px;
            padding: 6px 10px;

            .s-idx {
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: #1d4ed8;
              color: #ffffff;
              font-size: 11px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .s-info {
              .s-name {
                font-size: 12px;
                font-weight: 600;
                color: #1e3a8a;
              }
              .s-role {
                font-size: 10.5px;
                color: #64748b;
              }
            }
          }
        }
      }
    }

    @media (max-width: 1024px) {
      .config-grid, .authority-3-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AdminComponent implements OnInit {
  activeTab: 'users' | 'roles' | 'categories' | 'config' | 'logs' | 'alerts' = 'users';

  // 1. User Management State
  users: User[] = [];
  filteredUsers: User[] = [];
  isLoadingUsers = false;
  activeUserStatus = 'all';
  userSearchQuery = '';

  userHeaderActions: PageHeaderAction[] = [
    { id: 'create_user', label: 'Thêm mới cán bộ', icon: 'person_add', variant: 'primary' }
  ];

  userStatusTabs: StatusTabItem[] = [
    { key: 'all', label: 'Tất cả', count: 4, color: 'gray' },
    { key: 'admin', label: 'Quản trị viên', count: 1, color: 'red' },
    { key: 'leader_mbf', label: 'Lãnh đạo MBF', count: 1, color: 'purple' },
    { key: 'officer_mbf', label: 'Cán bộ MBF', count: 1, color: 'blue' },
    { key: 'officer_ward', label: 'Cán bộ Phường', count: 1, color: 'green' }
  ];

  userColumns: TableColumn[] = [
    { key: 'username', label: 'Tên đăng nhập', sortable: true, width: '18%' },
    { key: 'fullName', label: 'Họ và tên cán bộ', sortable: true, width: '22%' },
    {
      key: 'role',
      label: 'Vai trò (Role)',
      sortable: true,
      type: 'badge',
      width: '18%',
      badgeMapping: {
        admin: { label: 'Quản trị viên', cssClass: 'badge-danger' },
        leader_mbf: { label: 'Lãnh đạo MBF', cssClass: 'badge-approved' },
        officer_mbf: { label: 'Cán bộ MBF', cssClass: 'badge-in_progress' },
        officer_ward: { label: 'Cán bộ Phường', cssClass: 'badge-new' }
      }
    },
    { key: 'unit', label: 'Đơn vị công tác', sortable: true, width: '24%' },
    {
      key: 'isActive',
      label: 'Trạng thái',
      sortable: true,
      type: 'badge',
      width: '14%',
      badgeMapping: {
        1: { label: 'Đang hoạt động', cssClass: 'badge-new' },
        0: { label: 'Đã khóa', cssClass: 'badge-danger' }
      }
    }
  ];

  userRowActions: TableAction[] = [
    { id: 'edit', label: 'Chỉnh sửa thông tin', icon: 'edit' },
    { id: 'toggle_active', label: 'Khóa / Mở khóa tài khoản', icon: 'lock_open' }
  ];

  // 2. Role Matrix & Unit Workflows State (Requirement 7: Dynamic Workflows by Unit & Plan Type)
  authoritySeparation: any = null;
  detailedPermissions: any[] = [];
  unitWorkflows: any[] = [];
  filteredWorkflows: any[] = [];
  selectedWfUnitCode = 'all';
  selectedWfInspectionType = 'all';

  unitFilterOptions = [
    { code: 'all', label: 'Tất cả Đơn vị' },
    { code: 'PC07', label: 'Phòng CS PCCC & CNCH (PC07)' },
    { code: 'PC04', label: 'Phòng CS Kinh tế / ANKT (PC04 / PA04)' },
    { code: 'PC06', label: 'Phòng CS QLHC về TTXH (PC06)' },
    { code: 'CAP', label: 'Công an / UBND Phường' },
    { code: 'LIEN_NGANH', label: 'Đoàn Liên ngành' }
  ];

  unitPresets = [
    {
      unitCode: 'PC07',
      unitName: 'Phòng Cảnh sát PCCC & CNCH (PC07)',
      planApprovalDept: 'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)',
      planApproverName: 'Đại tá Lê Minh Hải (Trưởng phòng PC07)',
      teamEstablishDept: 'Ban Chỉ huy Phòng PC07 & Đội Tham mưu',
      teamApproverName: 'Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng PC07)',
      resultAcceptanceDept: 'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)',
      resultApproverName: 'Đại tá Lê Minh Hải (Trưởng phòng PC07)'
    },
    {
      unitCode: 'PC04',
      unitName: 'Phòng Cảnh sát Kinh tế / An ninh Kinh tế (PC04 / PA04)',
      planApprovalDept: 'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)',
      planApproverName: 'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)',
      teamEstablishDept: 'Ban Chỉ huy Phòng PC04',
      teamApproverName: 'Thượng tá Vũ Minh Đức (Phó Trưởng phòng PC04)',
      resultAcceptanceDept: 'Ban Chỉ huy Phòng Cảnh sát Kinh tế (PC04)',
      resultApproverName: 'Đại tá Trần Quốc Tuấn (Trưởng phòng PC04)'
    },
    {
      unitCode: 'PC06',
      unitName: 'Phòng Cảnh sát QLHC về TTXH (PC06)',
      planApprovalDept: 'Ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)',
      planApproverName: 'Đại tá Phạm Hồng Quân (Trưởng phòng PC06)',
      teamEstablishDept: 'Ban Chỉ huy Phòng PC06',
      teamApproverName: 'Thượng tá Đặng Văn Hòa (Phó Trưởng phòng PC06)',
      resultAcceptanceDept: 'Ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)',
      resultApproverName: 'Đại tá Phạm Hồng Quân (Trưởng phòng PC06)'
    },
    {
      unitCode: 'CAP',
      unitName: 'Công an / UBND Phường',
      planApprovalDept: 'Ban Chỉ huy Công an Phường / Lãnh đạo UBND Phường',
      planApproverName: 'Trung tá Nguyễn Hoàng Nam (Trưởng Công an Phường)',
      teamEstablishDept: 'Ban Chỉ huy Công an Phường',
      teamApproverName: 'Thiếu tá Lê Văn Cường (Phó Trưởng Công an Phường)',
      resultAcceptanceDept: 'Ban Chỉ huy Công an Phường',
      resultApproverName: 'Trung tá Nguyễn Hoàng Nam (Trưởng Công an Phường)'
    }
  ];

  showWorkflowForm = false;
  workflowForm: any = {
    id: null,
    code: '',
    unitCode: 'PC07',
    name: '',
    unitName: 'Phòng Cảnh sát PCCC & CNCH (PC07)',
    inspectionType: 'planned',
    planApprovalDept: 'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)',
    planApproverName: 'Đại tá Lê Minh Hải (Trưởng phòng PC07)',
    teamEstablishDept: 'Ban Chỉ huy Phòng PC07 & Đội Tham mưu',
    teamApproverName: 'Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng PC07)',
    resultAcceptanceDept: 'Ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)',
    resultApproverName: 'Đại tá Lê Minh Hải (Trưởng phòng PC07)',
    steps: []
  };

  // 3. Catalogs State
  catalogSubTab: 'violations' | 'tags' = 'violations';
  violations: ViolationCatalog[] = [];
  recommendationTags: RecommendationTagCatalog[] = [];

  catalogHeaderActions: PageHeaderAction[] = [
    { id: 'create_cat', label: 'Thêm mục mới', icon: 'add_circle', variant: 'primary' }
  ];

  catalogColumns: TableColumn[] = [
    { key: 'code', label: 'Mã danh mục', sortable: true, width: '25%' },
    { key: 'name', label: 'Tên hành vi / Lĩnh vực kiến nghị', sortable: true, width: '65%' }
  ];

  catalogRowActions: TableAction[] = [
    { id: 'edit', label: 'Sửa danh mục', icon: 'edit' },
    { id: 'delete', label: 'Xóa danh mục', icon: 'delete', color: '#dc2626', dividerBefore: true }
  ];

  // 4. Config State (Quota & Cutoff & Deadline)
  quotaList: QuotaConfig[] = [];
  cutoffList: CutoffConfig[] = [];
  cutoffForm = {
    quarter: 'Q2/2026',
    cutoffDateTime: '2026-06-25T17:00'
  };
  inspectionDeadlineDays: number = 30;

  // 5. Audit Log State
  auditLogs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  isLoadingLogs = false;
  logSearchQuery = '';
  logWardFilter = '';

  auditHeaderActions: PageHeaderAction[] = [
    { id: 'export_logs', label: 'Xuất nhật ký (.csv)', icon: 'download', variant: 'primary' }
  ];

  auditColumns: TableColumn[] = [
    { key: 'createdAt', label: 'Thời gian', sortable: true, width: '14%' },
    { key: 'userName', label: 'Cán bộ thực hiện', sortable: true, width: '15%' },
    {
      key: 'action',
      label: 'Hành động',
      sortable: true,
      type: 'badge',
      width: '15%',
      badgeMapping: {
        CREATE_USER: { label: 'Tạo tài khoản', cssClass: 'badge-new' },
        UPDATE_USER: { label: 'Sửa tài khoản', cssClass: 'badge-in_progress' },
        TOGGLE_USER_ACTIVE: { label: 'Đổi trạng thái', cssClass: 'badge-pending' },
        CREATE_OBJECT: { label: 'Tạo đối tượng', cssClass: 'badge-new' },
        UPDATE_OBJECT: { label: 'Sửa đối tượng', cssClass: 'badge-in_progress' },
        CREATE_PLAN: { label: 'Lập kế hoạch', cssClass: 'badge-in_progress' },
        APPROVE_PLAN: { label: 'Phê duyệt KH', cssClass: 'badge-approved' },
        REJECT_PLAN: { label: 'Từ chối KH', cssClass: 'badge-rejected' },
        COMPLETE_INSPECTION: { label: 'Hoàn thành KT', cssClass: 'badge-won' },
        UPDATE_INSPECTION: { label: 'Cập nhật KT', cssClass: 'badge-in_progress' },
        CREATE_ADHOC_REQUEST: { label: 'Đề xuất đột xuất', cssClass: 'badge-new' },
        APPROVE_ADHOC_REQUEST: { label: 'Duyệt đột xuất', cssClass: 'badge-approved' },
        REJECT_ADHOC_REQUEST: { label: 'Từ chối đột xuất', cssClass: 'badge-rejected' },
        SAVE_QUOTA: { label: 'Cấu hình Quota', cssClass: 'badge-in_progress' },
        SAVE_CUTOFF: { label: 'Cấu hình Cutoff', cssClass: 'badge-in_progress' },
        SAVE_INSPECTION_DEADLINE_DAYS: { label: 'Cấu hình Deadline', cssClass: 'badge-in_progress' }
      }
    },
    { key: 'entityType', label: 'Đối tượng tác động', sortable: true, width: '15%' },
    { key: 'ward', label: 'Đơn vị / Phường', sortable: true, width: '15%', formatter: (val, row) => row.ward || '—' },
    { key: 'ipAddress', label: 'Địa chỉ IP', width: '11%', formatter: (val, row) => row.ipAddress || '—' },
    { key: 'detail', label: 'Chi tiết Snapshot', width: '15%', formatter: (val, row) => (row.beforeData || row.afterData) ? '⚡ Có Snapshot Diff' : 'Payload JSON' }
  ];

  auditRowActions: TableAction[] = [
    { id: 'view_diff', label: 'Xem chi tiết thay đổi (Diff Trước/Sau)', icon: 'difference' },
    { id: 'view_detail', label: 'Xem Request JSON Payload', icon: 'code' }
  ];

  // 6. Alerts State
  alerts: Alert[] = [];
  filteredAlerts: Alert[] = [];
  isLoadingAlerts = false;
  alertSearchTerm = '';
  alertWardFilter = 'all';
  alertTypeFilter = 'all';
  alertSeverityFilter = 'all';
  alertReadFilter = 'all';

  alertHeaderActions: PageHeaderAction[] = [
    { id: 'trigger_check', label: 'Quét hạn ngay (Trigger Check)', icon: 'refresh', variant: 'secondary' },
    { id: 'mark_all_read', label: 'Đánh dấu đã đọc tất cả', icon: 'done_all', variant: 'primary' }
  ];

  alertColumns: TableColumn[] = [
    {
      key: 'isRead',
      label: 'Trạng thái',
      type: 'badge',
      width: '12%',
      badgeMapping: {
        0: { label: 'Chưa đọc', cssClass: 'badge-danger' },
        1: { label: 'Đã đọc', cssClass: 'badge-draft' }
      }
    },
    {
      key: 'severity',
      label: 'Mức độ',
      type: 'badge',
      width: '13%',
      badgeMapping: {
        critical: { label: 'Khẩn cấp', cssClass: 'badge-danger' },
        warning: { label: 'Cảnh báo', cssClass: 'badge-rejected' },
        info: { label: 'Thông tin', cssClass: 'badge-in_progress' }
      }
    },
    {
      key: 'type',
      label: 'Loại cảnh báo',
      width: '16%',
      type: 'badge',
      badgeMapping: {
        overdue_inspection: { label: 'Quá hạn kiểm tra', cssClass: 'badge-danger' },
        overdue_plan: { label: 'Quá hạn kế hoạch', cssClass: 'badge-rejected' },
        quota_below: { label: 'Dưới chỉ tiêu', cssClass: 'badge-pending' },
        quota_above: { label: 'Vượt chỉ tiêu', cssClass: 'badge-approved' }
      }
    },
    { key: 'message', label: 'Nội dung cảnh báo', width: '31%' },
    { key: 'ward', label: 'Đơn vị', width: '14%' },
    { key: 'createdAt', label: 'Thời gian tạo', width: '14%' }
  ];

  alertRowActions: TableAction[] = [
    { id: 'mark_read', label: 'Đánh dấu đã đọc', icon: 'check' }
  ];

  constructor(
    private api: ApiService,
    private alertsService: AlertsService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
    });

    this.loadUsers();
    this.loadPermissionsAndWorkflows();
    this.loadViolations();
    this.loadRecommendationTags();
    this.loadQuotas();
    this.loadCutoffs();
    this.loadInspectionDeadlineDays();
    this.loadAuditLogs();
    this.loadAlerts();
  }

  // --- Requirement 7: Permissions & Unit Workflows Handlers ---
  loadPermissionsAndWorkflows(): void {
    this.api.get<any>('/configs/permissions').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.authoritySeparation = res.data.authoritySeparation || null;
          this.detailedPermissions = res.data.permissions || [];
        }
      }
    });

    this.api.get<any>('/configs/workflows').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.unitWorkflows = res.data;
          this.applyWorkflowFilter();
        }
      }
    });
  }

  applyWorkflowFilter(): void {
    this.filteredWorkflows = this.unitWorkflows.filter(wf => {
      const matchUnit = this.selectedWfUnitCode === 'all' || wf.unitCode === this.selectedWfUnitCode || (wf.unitName && wf.unitName.includes(this.selectedWfUnitCode));
      const matchType = this.selectedWfInspectionType === 'all' || wf.inspectionType === this.selectedWfInspectionType;
      return matchUnit && matchType;
    });
  }

  selectUnitPreset(preset: any): void {
    this.workflowForm.unitCode = preset.unitCode;
    this.workflowForm.unitName = preset.unitName;
    this.workflowForm.planApprovalDept = preset.planApprovalDept;
    this.workflowForm.planApproverName = preset.planApproverName;
    this.workflowForm.teamEstablishDept = preset.teamEstablishDept;
    this.workflowForm.teamApproverName = preset.teamApproverName;
    this.workflowForm.resultAcceptanceDept = preset.resultAcceptanceDept;
    this.workflowForm.resultApproverName = preset.resultApproverName;
    if (!this.workflowForm.id) {
      const typeSuffix = (this.workflowForm.inspectionType || 'planned').toUpperCase();
      this.workflowForm.code = `WF_${preset.unitCode}_${typeSuffix}_${this.unitWorkflows.length + 1}`;
    }
  }

  savePermissionMatrix(): void {
    const payload = {
      authoritySeparation: this.authoritySeparation,
      permissions: this.detailedPermissions
    };
    this.api.put<any>('/configs/permissions', payload).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Đã lưu cấu hình Phân quyền & Thẩm quyền nghiệp vụ thành công!', 'Đóng', { duration: 2500 });
        }
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Lỗi khi lưu phân quyền', 'Đóng', { duration: 3000 });
      }
    });
  }

  openWorkflowEditor(wf?: any): void {
    this.showWorkflowForm = true;
    if (wf) {
      this.workflowForm = {
        id: wf.id,
        code: wf.code,
        unitCode: wf.unitCode || 'PC07',
        name: wf.name,
        unitName: wf.unitName,
        inspectionType: wf.inspectionType || 'planned',
        planApprovalDept: wf.planApprovalDept || `Ban Chỉ huy ${wf.unitName}`,
        planApproverName: wf.planApproverName || wf.planApprovalRole || 'Trưởng đơn vị',
        teamEstablishDept: wf.teamEstablishDept || `Ban Chỉ huy ${wf.unitName}`,
        teamApproverName: wf.teamApproverName || wf.teamEstablishRole || 'Phó Trưởng đơn vị',
        resultAcceptanceDept: wf.resultAcceptanceDept || `Ban Chỉ huy ${wf.unitName}`,
        resultApproverName: wf.resultApproverName || wf.resultAcceptanceRole || 'Trưởng đơn vị',
        description: wf.description || '',
        steps: Array.isArray(wf.steps) && wf.steps.length > 0
          ? wf.steps.map((s: any, i: number) => ({
              step: i + 1,
              stepType: s.stepType || (i === 0 ? 'create' : i === 1 ? 'approve_plan' : i === 2 ? 'establish_team' : i === 3 ? 'inspect' : 'accept_result'),
              name: s.name,
              approvingDept: s.approvingDept || wf.planApprovalDept || wf.unitName,
              approverName: s.approverName || s.role || wf.planApproverName,
              role: s.role || s.approverName || 'Lãnh đạo phê duyệt',
              slaHours: s.slaHours || 24,
              required: s.required !== false
            }))
          : [{ step: 1, stepType: 'approve_plan', name: 'Bước 1: Phê duyệt kế hoạch', approvingDept: wf.planApprovalDept, approverName: wf.planApproverName, role: 'Lãnh đạo duyệt', slaHours: 24, required: true }]
      };
    } else {
      const preset = this.unitPresets.find(p => p.unitCode === (this.selectedWfUnitCode !== 'all' ? this.selectedWfUnitCode : 'PC07')) || this.unitPresets[0];
      const inspType = this.selectedWfInspectionType !== 'all' ? this.selectedWfInspectionType : 'planned';
      const typeLabel = inspType === 'adhoc' ? 'Kiểm tra Đột xuất' : inspType === 'professional_request' ? 'Kiểm tra Yêu cầu Nghiệp vụ' : 'Kiểm tra Định kỳ';
      this.workflowForm = {
        id: null,
        code: `WF_${preset.unitCode}_${inspType.toUpperCase()}_${this.unitWorkflows.length + 1}`,
        unitCode: preset.unitCode,
        name: `Quy trình ${typeLabel} - ${preset.unitName}`,
        unitName: preset.unitName,
        inspectionType: inspType,
        planApprovalDept: preset.planApprovalDept,
        planApproverName: preset.planApproverName,
        teamEstablishDept: preset.teamEstablishDept,
        teamApproverName: preset.teamApproverName,
        resultAcceptanceDept: preset.resultAcceptanceDept,
        resultApproverName: preset.resultApproverName,
        description: '',
        steps: [
          { step: 1, stepType: 'create', name: `Đội nghiệp vụ lập & trình dự thảo Kế hoạch ${typeLabel}`, approvingDept: `Đội Nghiệp vụ - ${preset.unitName}`, approverName: `Đội trưởng Nghiệp vụ (${preset.unitCode})`, role: 'Đội trưởng Nghiệp vụ', slaHours: 24, required: true },
          { step: 2, stepType: 'review', name: 'Đội Tham mưu thẩm định hồ sơ & danh sách cơ sở kiểm tra', approvingDept: `Đội Tham mưu - ${preset.unitName}`, approverName: `Đội trưởng Tham mưu (${preset.unitCode})`, role: 'Trưởng bộ phận Tham mưu', slaHours: 16, required: true },
          { step: 3, stepType: 'approve_plan', name: 'Lãnh đạo đơn vị phê duyệt Kế hoạch kiểm tra', approvingDept: preset.planApprovalDept, approverName: preset.planApproverName, role: 'Lãnh đạo phê duyệt kế hoạch', slaHours: 16, required: true },
          { step: 4, stepType: 'establish_team', name: 'Ra Quyết định thành lập Đoàn kiểm tra & Phân công nhiệm vụ', approvingDept: preset.teamEstablishDept, approverName: preset.teamApproverName, role: 'Lãnh đạo ký QĐ lập đoàn', slaHours: 16, required: true },
          { step: 5, stepType: 'inspect', name: 'Đoàn kiểm tra thực hiện kiểm tra tại cơ sở & Lập biên bản', approvingDept: `Đoàn Kiểm tra ${preset.unitCode}`, approverName: `Trưởng đoàn Kiểm tra (${preset.unitCode})`, role: 'Trưởng đoàn kiểm tra', slaHours: 48, required: true },
          { step: 6, stepType: 'accept_result', name: 'Nghiệm thu kết quả kiểm tra & Đóng hồ sơ', approvingDept: preset.resultAcceptanceDept, approverName: preset.resultApproverName, role: 'Lãnh đạo nghiệm thu kết quả', slaHours: 24, required: true }
        ]
      };
    }
  }

  cloneWorkflowForUnit(wf: any): void {
    this.openWorkflowEditor(wf);
    this.workflowForm.id = null;
    this.workflowForm.code = `${wf.code}_COPY`;
    this.workflowForm.name = `${wf.name} (Bản sao tùy chỉnh)`;
  }

  closeWorkflowEditor(): void {
    this.showWorkflowForm = false;
  }

  addWorkflowStep(): void {
    this.workflowForm.steps.push({
      step: this.workflowForm.steps.length + 1,
      stepType: 'review',
      name: '',
      approvingDept: this.workflowForm.planApprovalDept || this.workflowForm.unitName,
      approverName: this.workflowForm.planApproverName || 'Lãnh đạo đơn vị',
      role: 'Cán bộ phê duyệt',
      slaHours: 24,
      required: true
    });
  }

  removeWorkflowStep(index: number): void {
    this.workflowForm.steps.splice(index, 1);
    this.workflowForm.steps.forEach((s: any, idx: number) => {
      s.step = idx + 1;
    });
  }

  saveWorkflowForm(): void {
    if (!this.workflowForm.name || !this.workflowForm.unitName) {
      this.snackBar.open('Vui lòng nhập đầy đủ Tên quy trình và Đơn vị nghiệp vụ áp dụng!', 'Đóng', { duration: 3000 });
      return;
    }

    const request$ = this.workflowForm.id
      ? this.api.put<any>(`/configs/workflows/${this.workflowForm.id}`, this.workflowForm)
      : this.api.post<any>('/configs/workflows', this.workflowForm);

    request$.subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Đã lưu cấu hình Quy trình Động (Phòng ban duyệt & Người duyệt) thành công!', 'Đóng', { duration: 2500 });
          this.showWorkflowForm = false;
          this.loadPermissionsAndWorkflows();
        }
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Lỗi khi lưu quy trình', 'Đóng', { duration: 3000 });
      }
    });
  }

  switchTab(tabKey: 'users' | 'roles' | 'categories' | 'config' | 'logs' | 'alerts'): void {
    this.activeTab = tabKey;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tabKey },
      queryParamsHandling: 'merge'
    });
  }


  // --- Users Handlers ---
  loadUsers(): void {
    this.isLoadingUsers = true;
    this.api.get<any>('/users').subscribe({
      next: (res) => {
        this.isLoadingUsers = false;
        if (res.success) {
          this.users = res.data;
          this.applyUserFilter();
          this.updateUserTabCounts();
        }
      },
      error: () => {
        this.isLoadingUsers = false;
      }
    });
  }

  updateUserTabCounts(): void {
    this.userStatusTabs.forEach(tab => {
      if (tab.key === 'all') {
        tab.count = this.users.length;
      } else {
        tab.count = this.users.filter(u => u.role === tab.key).length;
      }
    });
  }

  applyUserFilter(): void {
    let result = [...this.users];

    if (this.activeUserStatus !== 'all') {
      result = result.filter(u => u.role === this.activeUserStatus);
    }

    if (this.userSearchQuery.trim()) {
      const q = this.userSearchQuery.trim().toLowerCase();
      result = result.filter(
        u =>
          u.username.toLowerCase().includes(q) ||
          u.fullName.toLowerCase().includes(q) ||
          (u.unit && u.unit.toLowerCase().includes(q))
      );
    }

    this.filteredUsers = result;
  }

  handleUserStatusChange(key: string): void {
    this.activeUserStatus = key;
    this.applyUserFilter();
  }

  handleUserSearch(query: string): void {
    this.userSearchQuery = query;
    this.applyUserFilter();
  }

  handleUserHeaderAction(actionId: string): void {
    if (actionId === 'create_user') {
      const dialogRef = this.dialog.open(UserDialogComponent, {
        width: '520px',
        data: { isEdit: false }
      });

      dialogRef.afterClosed().subscribe(formData => {
        if (formData) {
          this.api.post<any>('/users', formData).subscribe({
            next: (res) => {
              if (res.success) {
                this.snackBar.open('Tạo mới cán bộ thành công!', 'Đóng', { duration: 2500 });
                this.loadUsers();
              }
            },
            error: (err) => {
              this.snackBar.open(err.error?.message || 'Lỗi khi tạo cán bộ', 'Đóng', { duration: 3000 });
            }
          });
        }
      });
    }
  }

  handleUserRowAction(event: { action: string; row: User }): void {
    if (event.action === 'edit') {
      const dialogRef = this.dialog.open(UserDialogComponent, {
        width: '520px',
        data: { isEdit: true, user: event.row }
      });

      dialogRef.afterClosed().subscribe(formData => {
        if (formData) {
          this.api.put<any>(`/users/${event.row.id}`, formData).subscribe({
            next: (res) => {
              if (res.success) {
                this.snackBar.open('Cập nhật cán bộ thành công!', 'Đóng', { duration: 2500 });
                this.loadUsers();
              }
            },
            error: (err) => {
              this.snackBar.open(err.error?.message || 'Lỗi cập nhật', 'Đóng', { duration: 3000 });
            }
          });
        }
      });
    } else if (event.action === 'toggle_active') {
      this.api.patch<any>(`/users/${event.row.id}/toggle-active`, {}).subscribe({
        next: (res) => {
          if (res.success) {
            this.snackBar.open(res.message, 'Đóng', { duration: 2500 });
            this.loadUsers();
          }
        }
      });
    }
  }

  // --- Catalogs Handlers ---
  loadViolations(): void {
    this.api.get<any>('/catalogs/violations').subscribe({
      next: (res) => {
        if (res.success) this.violations = res.data;
      }
    });
  }

  loadRecommendationTags(): void {
    this.api.get<any>('/catalogs/recommendation-tags').subscribe({
      next: (res) => {
        if (res.success) this.recommendationTags = res.data;
      }
    });
  }

  handleCatalogHeaderAction(actionId: string): void {
    if (actionId === 'create_cat') {
      const dialogRef = this.dialog.open(CatalogDialogComponent, {
        width: '480px',
        data: {
          isEdit: false,
          type: this.catalogSubTab === 'violations' ? 'violation' : 'recommendation'
        }
      });

      dialogRef.afterClosed().subscribe(formData => {
        if (formData) {
          const endpoint = this.catalogSubTab === 'violations'
            ? '/catalogs/violations'
            : '/catalogs/recommendation-tags';

          this.api.post<any>(endpoint, formData).subscribe({
            next: (res) => {
              if (res.success) {
                this.snackBar.open('Thêm danh mục thành công!', 'Đóng', { duration: 2500 });
                if (this.catalogSubTab === 'violations') this.loadViolations();
                else this.loadRecommendationTags();
              }
            }
          });
        }
      });
    }
  }

  handleCatalogRowAction(event: { action: string; row: any }, type: 'violation' | 'recommendation'): void {
    const endpointPrefix = type === 'violation' ? '/catalogs/violations' : '/catalogs/recommendation-tags';

    if (event.action === 'edit') {
      const dialogRef = this.dialog.open(CatalogDialogComponent, {
        width: '480px',
        data: { isEdit: true, type, item: event.row }
      });

      dialogRef.afterClosed().subscribe(formData => {
        if (formData) {
          this.api.put<any>(`${endpointPrefix}/${event.row.id}`, formData).subscribe({
            next: (res) => {
              if (res.success) {
                this.snackBar.open('Cập nhật danh mục thành công!', 'Đóng', { duration: 2500 });
                if (type === 'violation') this.loadViolations();
                else this.loadRecommendationTags();
              }
            }
          });
        }
      });
    } else if (event.action === 'delete') {
      if (confirm(`Bạn có chắc muốn xóa danh mục [${event.row.code}]?`)) {
        this.api.delete<any>(`${endpointPrefix}/${event.row.id}`).subscribe({
          next: (res) => {
            if (res.success) {
              this.snackBar.open('Đã xóa danh mục!', 'Đóng', { duration: 2500 });
              if (type === 'violation') this.loadViolations();
              else this.loadRecommendationTags();
            }
          }
        });
      }
    }
  }

  // --- Quota & Cutoff Handlers ---
  loadQuotas(): void {
    this.api.get<any>('/configs/quota?quarter=Q2/2026').subscribe({
      next: (res) => {
        if (res.success) this.quotaList = res.data;
      }
    });
  }

  loadCutoffs(): void {
    this.api.get<any>('/configs/cutoff').subscribe({
      next: (res) => {
        if (res.success) {
          this.cutoffList = res.data;
          if (this.cutoffList.length > 0) {
            this.cutoffForm = {
              quarter: this.cutoffList[0].quarter,
              cutoffDateTime: this.cutoffList[0].cutoffDateTime
            };
          }
        }
      }
    });
  }

  saveAllQuotas(): void {
    let completedCount = 0;
    this.quotaList.forEach(q => {
      this.api.post<any>('/configs/quota', q).subscribe({
        next: () => {
          completedCount++;
          if (completedCount === this.quotaList.length) {
            this.snackBar.open('Đã lưu toàn bộ Quota 5 phường thành công!', 'Đóng', { duration: 2500 });
            this.loadQuotas();
          }
        }
      });
    });
  }

  saveCutoff(): void {
    this.api.post<any>('/configs/cutoff', this.cutoffForm).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Đã cập nhật thời điểm Cut-off thành công!', 'Đóng', { duration: 2500 });
          this.loadCutoffs();
        }
      }
    });
  }

  // --- Audit Log Handlers ---
  loadAuditLogs(): void {
    this.isLoadingLogs = true;
    let endpoint = '/audit-logs?limit=50';
    if (this.logWardFilter && this.logWardFilter !== 'all') {
      endpoint += `&ward=${encodeURIComponent(this.logWardFilter)}`;
    }
    this.api.get<any>(endpoint).subscribe({
      next: (res) => {
        this.isLoadingLogs = false;
        if (res.success) {
          this.auditLogs = res.data;
          this.applyLogFilter();
        }
      },
      error: () => {
        this.isLoadingLogs = false;
      }
    });
  }

  resetLogFilters(): void {
    this.logSearchQuery = '';
    this.logWardFilter = '';
    this.loadAuditLogs();
  }

  applyLogFilter(): void {
    let result = [...this.auditLogs];
    if (this.logSearchQuery.trim()) {
      const q = this.logSearchQuery.trim().toLowerCase();
      result = result.filter(
        l =>
          l.action.toLowerCase().includes(q) ||
          l.entityType.toLowerCase().includes(q) ||
          (l.ward && l.ward.toLowerCase().includes(q)) ||
          (l.ipAddress && l.ipAddress.toLowerCase().includes(q)) ||
          (l.userName && l.userName.toLowerCase().includes(q)) ||
          (l.username && l.username.toLowerCase().includes(q)) ||
          (l.detail && l.detail.toLowerCase().includes(q))
      );
    }
    this.filteredLogs = result;
  }

  handleLogSearch(query: string): void {
    this.logSearchQuery = query;
    this.applyLogFilter();
  }

  handleAuditHeaderAction(actionId: string): void {
    if (actionId === 'export_logs') {
      this.snackBar.open('Đang trích xuất toàn bộ nhật ký hệ thống ra file CSV...', 'Đóng', { duration: 2500 });
    }
  }

  handleAuditRowAction(event: { action: string; row: AuditLog }): void {
    if (event.action === 'view_diff') {
      this.openLogDiff(event.row);
    } else if (event.action === 'view_detail') {
      this.openLogDetail(event.row);
    }
  }

  openLogDiff(log: AuditLog): void {
    this.dialog.open(LogDiffDialogComponent, {
      width: '780px',
      data: { log }
    });
  }

  openLogDetail(log: AuditLog): void {
    this.dialog.open(LogDetailDialogComponent, {
      width: '580px',
      data: { log }
    });
  }

  // --- Inspection Deadline Handlers ---
  loadInspectionDeadlineDays(): void {
    this.api.get<any>('/configs/inspection-deadline-days').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.inspectionDeadlineDays = res.data.days || 30;
        }
      }
    });
  }

  saveInspectionDeadlineDays(): void {
    this.api.put<any>('/configs/inspection-deadline-days', { days: this.inspectionDeadlineDays }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Cập nhật thời hạn kiểm tra thành công!', 'Đóng', { duration: 2500 });
          this.loadInspectionDeadlineDays();
        }
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Lỗi khi lưu thời hạn kiểm tra', 'Đóng', { duration: 3000 });
      }
    });
  }

  // --- Alerts Handlers ---
  loadAlerts(): void {
    this.isLoadingAlerts = true;
    const params: any = { limit: 100 };
    if (this.alertWardFilter !== 'all') params.ward = this.alertWardFilter;
    if (this.alertTypeFilter !== 'all') params.type = this.alertTypeFilter;
    if (this.alertSeverityFilter !== 'all') params.severity = this.alertSeverityFilter;
    if (this.alertReadFilter !== 'all') params.isRead = this.alertReadFilter;

    this.alertsService.getAlerts(params).subscribe({
      next: (res) => {
        this.isLoadingAlerts = false;
        if (res && res.success) {
          this.alerts = res.data || [];
          this.filterAlerts();
        }
      },
      error: () => {
        this.isLoadingAlerts = false;
      }
    });
  }

  filterAlerts(): void {
    if (!this.alertSearchTerm.trim()) {
      this.filteredAlerts = [...this.alerts];
      return;
    }
    const term = this.alertSearchTerm.toLowerCase();
    this.filteredAlerts = this.alerts.filter(a =>
      a.message.toLowerCase().includes(term) ||
      (a.ward && a.ward.toLowerCase().includes(term))
    );
  }

  handleAlertHeaderAction(actionId: string): void {
    if (actionId === 'trigger_check') {
      this.isLoadingAlerts = true;
      this.alertsService.triggerDeadlineCheck().subscribe({
        next: (res) => {
          this.isLoadingAlerts = false;
          const result = res.data;
          this.snackBar.open(`Đã quét hạn: ${result?.overduePlansCount || 0} kế hoạch quá hạn, ${result?.overdueInspectionsCount || 0} hồ sơ quá hạn, tạo mới ${result?.newAlertsCreated || 0} cảnh báo.`, 'Đóng', { duration: 4000 });
          this.loadAlerts();
        },
        error: (err) => {
          this.isLoadingAlerts = false;
          this.snackBar.open(err.error?.message || 'Lỗi khi quét hạn', 'Đóng', { duration: 3000 });
        }
      });
    } else if (actionId === 'mark_all_read') {
      this.alertsService.markAllAsRead().subscribe({
        next: () => {
          this.snackBar.open('Đã đánh dấu tất cả cảnh báo là đã đọc!', 'Đóng', { duration: 2500 });
          this.loadAlerts();
        }
      });
    }
  }

  handleAlertRowAction(event: { action: string; row: Alert }): void {
    if (event.action === 'mark_read') {
      this.alertsService.markAsRead(event.row.id).subscribe({
        next: () => {
          this.snackBar.open('Đã đánh dấu đã đọc!', 'Đóng', { duration: 2000 });
          this.loadAlerts();
        }
      });
    }
  }
}

