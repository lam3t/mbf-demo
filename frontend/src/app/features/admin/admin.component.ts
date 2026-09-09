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
  TableAction
} from '../../shared/components';

import { UserDialogComponent } from './components/user-dialog.component';
import { CatalogDialogComponent } from './components/catalog-dialog.component';
import { LogDetailDialogComponent } from './components/log-detail-dialog.component';
import { ApiService } from '../../core/services/api.service';
import { User, AuditLog, ViolationCatalog, RecommendationTagCatalog, QuotaConfig, CutoffConfig } from '../../core/models';

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
    DataTableComponent
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
          <span>2. Phân quyền</span>
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

      <!-- TAB 2: ROLE & PERMISSION MATRIX -->
      <div class="tab-view-container" *ngIf="activeTab === 'roles'">
        <app-page-header
          title="Ma trận Phân quyền Vai trò"
          subtitle="Thiết lập quyền truy cập chức năng theo 4 nhóm vai trò chuẩn"
        ></app-page-header>

        <div class="matrix-card">
          <table class="role-matrix-table">
            <thead>
              <tr>
                <th style="width: 35%;">Chức năng / Phân hệ nghiệp vụ</th>
                <th class="text-center">Admin Hệ thống</th>
                <th class="text-center">Lãnh đạo TNT</th>
                <th class="text-center">Cán bộ TNT</th>
                <th class="text-center">Cán bộ Xã / Phường</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let perm of permissionMatrix">
                <td>
                  <strong>{{ perm.name }}</strong>
                  <span class="perm-desc">{{ perm.description }}</span>
                </td>
                <td class="text-center">
                  <mat-icon [class.active-perm]="perm.admin" class="perm-check">
                    {{ perm.admin ? 'check_circle' : 'remove' }}
                  </mat-icon>
                </td>
                <td class="text-center">
                  <mat-icon [class.active-perm]="perm.leader" class="perm-check">
                    {{ perm.leader ? 'check_circle' : 'remove' }}
                  </mat-icon>
                </td>
                <td class="text-center">
                  <mat-icon [class.active-perm]="perm.officer" class="perm-check">
                    {{ perm.officer ? 'check_circle' : 'remove' }}
                  </mat-icon>
                </td>
                <td class="text-center">
                  <mat-icon [class.active-perm]="perm.ward" class="perm-check">
                    {{ perm.ward ? 'check_circle' : 'remove' }}
                  </mat-icon>
                </td>
              </tr>
            </tbody>
          </table>
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

      <!-- TAB 4: SYSTEM CONFIGS (QUOTA & CUT-OFF) -->
      <div class="tab-view-container" *ngIf="activeTab === 'config'">
        <app-page-header
          title="Cấu hình Hệ thống (Quota & Cut-off)"
          subtitle="Thiết lập chỉ tiêu kiểm tra 5 phường và thời hạn chốt sổ kế hoạch"
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

        <app-search-filter-bar
          placeholder="Tìm kiếm nhật ký theo người dùng, đối tượng, hành động..."
          (search)="handleLogSearch($event)"
          (searchChange)="handleLogSearch($event)"
          (refresh)="loadAuditLogs()"
        ></app-search-filter-bar>

        <app-data-table
          [columns]="auditColumns"
          [data]="filteredLogs"
          [actions]="auditRowActions"
          [loading]="isLoadingLogs"
          (actionClick)="handleAuditRowAction($event)"
          (rowClick)="openLogDetail($event)"
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

    @media (max-width: 1024px) {
      .config-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AdminComponent implements OnInit {
  activeTab: 'users' | 'roles' | 'categories' | 'config' | 'logs' = 'users';

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
    { key: 'leader_tnt', label: 'Lãnh đạo TNT', count: 1, color: 'purple' },
    { key: 'officer_tnt', label: 'Cán bộ TNT', count: 1, color: 'blue' },
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
        leader_tnt: { label: 'Lãnh đạo TNT', cssClass: 'badge-approved' },
        officer_tnt: { label: 'Cán bộ TNT', cssClass: 'badge-in_progress' },
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

  // 2. Role Matrix State
  permissionMatrix = [
    {
      name: 'Quản lý Đối tượng Kinh doanh',
      description: 'Tra cứu, xem hồ sơ, thêm mới và import danh sách cơ sở kinh doanh',
      admin: true,
      leader: true,
      officer: true,
      ward: true
    },
    {
      name: 'Lập & Nộp Kế hoạch Kiểm tra',
      description: 'Lựa chọn cơ sở theo quota, lập danh sách kiểm tra và gửi trình duyệt',
      admin: true,
      leader: false,
      officer: false,
      ward: true
    },
    {
      name: 'Phê duyệt Kế hoạch Kiểm tra',
      description: 'Xem xét đối chiếu quota, phê duyệt hoặc từ chối kế hoạch của phường',
      admin: true,
      leader: true,
      officer: true,
      ward: false
    },
    {
      name: 'Giám sát Thực địa & Chấm Checklist',
      description: 'Cập nhật biên bản kiểm tra, chấm checklist vi phạm, upload ảnh bằng chứng',
      admin: true,
      leader: false,
      officer: true,
      ward: true
    },
    {
      name: 'Bản đồ Vi phạm (Online / Offline)',
      description: 'Xem bản đồ nhiệt, lọc cơ sở theo mức độ vi phạm và trích xuất tọa độ GPS',
      admin: true,
      leader: true,
      officer: true,
      ward: true
    },
    {
      name: 'Báo cáo & Thống kê Tiến độ',
      description: 'Xuất báo cáo PDF/Excel, thống kê chỉ số hoàn thành toàn thành phố',
      admin: true,
      leader: true,
      officer: true,
      ward: true
    },
    {
      name: 'Cấu hình Quota & Chốt sổ Cut-off',
      description: 'Thiết lập số lượng cơ sở tối thiểu/tối đa và khóa nộp kế hoạch',
      admin: true,
      leader: false,
      officer: false,
      ward: false
    },
    {
      name: 'Quản trị Người dùng & Phân quyền',
      description: 'Tạo tài khoản cán bộ, khóa tài khoản và xem nhật ký Audit Log',
      admin: true,
      leader: false,
      officer: false,
      ward: false
    }
  ];

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

  // 4. Config State (Quota & Cutoff)
  quotaList: QuotaConfig[] = [];
  cutoffList: CutoffConfig[] = [];
  cutoffForm = {
    quarter: 'Q2/2026',
    cutoffDateTime: '2026-06-25T17:00'
  };

  // 5. Audit Log State
  auditLogs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  isLoadingLogs = false;
  logSearchQuery = '';

  auditHeaderActions: PageHeaderAction[] = [
    { id: 'export_logs', label: 'Xuất nhật ký (.csv)', icon: 'download', variant: 'primary' }
  ];

  auditColumns: TableColumn[] = [
    { key: 'createdAt', label: 'Thời gian', sortable: true, width: '18%' },
    { key: 'userName', label: 'Cán bộ thực hiện', sortable: true, width: '20%' },
    {
      key: 'action',
      label: 'Hành động',
      sortable: true,
      type: 'badge',
      width: '20%',
      badgeMapping: {
        CREATE_USER: { label: 'Tạo tài khoản', cssClass: 'badge-new' },
        UPDATE_USER: { label: 'Sửa tài khoản', cssClass: 'badge-in_progress' },
        TOGGLE_USER_ACTIVE: { label: 'Đổi trạng thái', cssClass: 'badge-pending' },
        CREATE_OBJECT: { label: 'Tạo đối tượng', cssClass: 'badge-new' },
        CREATE_PLAN: { label: 'Lập kế hoạch', cssClass: 'badge-in_progress' },
        APPROVE_PLAN: { label: 'Phê duyệt KH', cssClass: 'badge-approved' },
        COMPLETE_INSPECTION: { label: 'Hoàn thành KT', cssClass: 'badge-won' },
        SAVE_QUOTA: { label: 'Cấu hình Quota', cssClass: 'badge-in_progress' },
        SAVE_CUTOFF: { label: 'Cấu hình Cutoff', cssClass: 'badge-in_progress' }
      }
    },
    { key: 'entityType', label: 'Đối tượng tác động', sortable: true, width: '20%' },
    { key: 'detail', label: 'Chi tiết payload', width: '22%' }
  ];

  auditRowActions: TableAction[] = [
    { id: 'view_detail', label: 'Xem chi tiết Request JSON', icon: 'code' }
  ];

  constructor(
    private api: ApiService,
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
    this.loadViolations();
    this.loadRecommendationTags();
    this.loadQuotas();
    this.loadCutoffs();
    this.loadAuditLogs();
  }

  switchTab(tabKey: 'users' | 'roles' | 'categories' | 'config' | 'logs'): void {
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
    this.api.get<any>('/audit-logs?limit=50').subscribe({
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

  applyLogFilter(): void {
    let result = [...this.auditLogs];
    if (this.logSearchQuery.trim()) {
      const q = this.logSearchQuery.trim().toLowerCase();
      result = result.filter(
        l =>
          l.action.toLowerCase().includes(q) ||
          l.entityType.toLowerCase().includes(q) ||
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
    if (event.action === 'view_detail') {
      this.openLogDetail(event.row);
    }
  }

  openLogDetail(log: AuditLog): void {
    this.dialog.open(LogDetailDialogComponent, {
      width: '580px',
      data: { log }
    });
  }
}
