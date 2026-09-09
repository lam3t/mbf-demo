import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';

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

import { RejectDialogComponent } from './components/reject-dialog.component';
import { SelectObjectsDialogComponent } from './components/select-objects-dialog.component';
import { PlanDetailDialogComponent } from './components/plan-detail-dialog.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Plan, BusinessObject } from '../../core/models';

@Component({
  selector: 'app-plans-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatCheckboxModule,
    PageHeaderComponent,
    StatusTabsComponent,
    SearchFilterBarComponent,
    DataTableComponent
  ],
  template: `
    <div class="plans-management-page">
      <!-- Sub-view Navigation Bar -->
      <div class="plans-subnav-bar">
        <button
          type="button"
          class="subnav-btn"
          [class.active]="activeView === 'cart'"
          *ngIf="isWardOfficer || isAdmin"
          (click)="switchView('cart')"
        >
          <mat-icon>shopping_cart</mat-icon>
          <span>1. Giỏ Kế hoạch (Phường)</span>
        </button>

        <button
          type="button"
          class="subnav-btn"
          [class.active]="activeView === 'list'"
          (click)="switchView('list')"
        >
          <mat-icon>format_list_bulleted</mat-icon>
          <span>2. Danh sách Kế hoạch Toàn TP</span>
        </button>

        <button
          type="button"
          class="subnav-btn"
          [class.active]="activeView === 'matrix'"
          *ngIf="isTNT || isAdmin"
          (click)="switchView('matrix')"
        >
          <mat-icon>fact_check</mat-icon>
          <span>3. Ma trận Phê duyệt (TNT)</span>
          <span class="badge-pending-count" *ngIf="pendingGridList.length > 0">{{ pendingGridList.length }}</span>
        </button>
      </div>

      <!-- VIEW 1: PLAN CART (FOR WARD OFFICERS) -->
      <div class="view-container" *ngIf="activeView === 'cart'">
        <app-page-header
          title="Giỏ Lập Kế hoạch Kiểm tra Phường"
          [subtitle]="'Đơn vị: ' + userWard + ' — Quý II/2026'"
          [actions]="cartHeaderActions"
          (actionClick)="handleCartHeaderAction($event)"
        ></app-page-header>

        <!-- Quota & Cut-off Status Banner -->
        <div class="quota-banner-box" [ngClass]="getQuotaBannerClass()">
          <div class="banner-left">
            <mat-icon>{{ getQuotaBannerIcon() }}</mat-icon>
            <div class="banner-text">
              <strong>{{ getQuotaBannerTitle() }}</strong>
              <p>
                Số lượng hiện tại: <strong>{{ currentCartObjects.length }}</strong> cơ sở.
                Chỉ tiêu Quota: Tối thiểu <strong>{{ wardQuota.minCount }}</strong> — Tối đa <strong>{{ wardQuota.maxCount }}</strong> cơ sở.
              </p>
            </div>
          </div>
          <div class="cutoff-countdown-badge">
            <mat-icon>timer</mat-icon>
            <span>Chốt sổ: {{ cutoffTime }}</span>
          </div>
        </div>

        <!-- Action tools for Cart -->
        <div class="cart-toolbar">
          <button type="button" class="btn-cids-primary" (click)="openAddObjectsToCart()">
            <mat-icon>add</mat-icon>
            <span>+ Thêm cơ sở vào giỏ</span>
          </button>

          <button
            type="button"
            class="btn-submit-plan"
            [disabled]="isSubmitDisabled()"
            (click)="submitCartPlan()"
          >
            <mat-icon>send</mat-icon>
            <span>Trình duyệt Kế hoạch lên TNT</span>
          </button>
        </div>

        <!-- Cart Items Table -->
        <div class="cart-table-card">
          <div class="table-header-title">
            <h3>Danh sách cơ sở trong giỏ kế hoạch ({{ currentCartObjects.length }} cơ sở)</h3>
          </div>

          <table class="cart-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Loại hình</th>
                <th>Mã định danh (MST/CCCD)</th>
                <th>Tên cơ sở kinh doanh</th>
                <th>Người đại diện / Chủ hộ</th>
                <th>Địa chỉ kinh doanh</th>
                <th style="width: 80px;" class="text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="currentCartObjects.length === 0">
                <td colspan="7" class="empty-cart-row">
                  <mat-icon>remove_shopping_cart</mat-icon>
                  <p>Giỏ kế hoạch hiện đang trống. Hãy bấm "+ Thêm cơ sở vào giỏ" để chọn cơ sở kiểm tra.</p>
                </td>
              </tr>
              <tr *ngFor="let obj of currentCartObjects; let i = index">
                <td class="text-center">{{ i + 1 }}</td>
                <td>
                  <span class="badge-status badge-in_progress">
                    {{ obj.type === 'enterprise' ? 'Doanh nghiệp' : (obj.type === 'household' ? 'Hộ KD' : 'Cá nhân') }}
                  </span>
                </td>
                <td><strong>{{ obj.taxCode || obj.idNumber }}</strong></td>
                <td>{{ obj.name }}</td>
                <td>{{ obj.representative || '—' }}</td>
                <td>{{ obj.address }}</td>
                <td class="text-center">
                  <button type="button" class="btn-remove-item" (click)="removeFromCart(obj.id)" matTooltip="Xóa khỏi giỏ">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- VIEW 2: PLANS LIST (ALL WARDS) -->
      <div class="view-container" *ngIf="activeView === 'list'">
        <app-page-header
          title="Danh sách Kế hoạch Kiểm tra"
          [subtitle]="'Tổng số ' + plans.length + ' kế hoạch kiểm tra các phường trên toàn thành phố'"
        ></app-page-header>

        <app-search-filter-bar
          placeholder="Tìm kiếm theo tên kế hoạch, đơn vị phường, người trình..."
          (search)="handleListSearch($event)"
          (searchChange)="handleListSearch($event)"
          (refresh)="loadPlans()"
        ></app-search-filter-bar>

        <app-status-tabs
          [tabs]="listStatusTabs"
          [activeKey]="activeListStatus"
          (tabChange)="handleListStatusChange($event)"
        ></app-status-tabs>

        <app-data-table
          [columns]="planColumns"
          [data]="filteredPlans"
          [actions]="planRowActions"
          [loading]="isLoadingPlans"
          (actionClick)="handlePlanRowAction($event)"
          (rowClick)="openPlanDetail($event.id)"
        ></app-data-table>
      </div>

      <!-- VIEW 3: APPROVAL MATRIX (FOR TNT LEADERS & OFFICERS) -->
      <div class="view-container" *ngIf="activeView === 'matrix'">
        <app-page-header
          title="Ma trận Phê duyệt Kế hoạch (TNT)"
          [subtitle]="'Đang có ' + pendingGridList.length + ' cơ sở kiểm tra thuộc các phường chờ phê duyệt'"
          [actions]="matrixHeaderActions"
          (actionClick)="handleMatrixHeaderAction($event)"
        ></app-page-header>

        <div class="matrix-toolbar">
          <div class="selection-info">
            Đã chọn: <strong>{{ selectedGridItems.length }}</strong> / {{ pendingGridList.length }} cơ sở
          </div>
          <div class="matrix-actions-buttons">
            <button
              type="button"
              class="btn-bulk-approve"
              [disabled]="selectedGridItems.length === 0"
              (click)="bulkApproveSelected()"
            >
              <mat-icon>task_alt</mat-icon>
              <span>Duyệt các mục đã chọn ({{ selectedGridItems.length }})</span>
            </button>
          </div>
        </div>

        <div class="matrix-table-card">
          <table class="matrix-grid-table">
            <thead>
              <tr>
                <th style="width: 44px;" class="text-center">
                  <mat-checkbox
                    [checked]="isAllGridSelected()"
                    [indeterminate]="isPartiallyGridSelected()"
                    (change)="toggleSelectAllGrid($event.checked)"
                    color="primary"
                  ></mat-checkbox>
                </th>
                <th>#</th>
                <th>Đơn vị Phường trình</th>
                <th>Quý</th>
                <th>Loại hình</th>
                <th>Mã số (MST/CCCD)</th>
                <th>Tên cơ sở kinh doanh</th>
                <th>Địa chỉ hoạt động</th>
                <th>Người trình</th>
                <th class="text-center" style="width: 110px;">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="pendingGridList.length === 0">
                <td colspan="10" class="empty-cart-row">
                  <mat-icon>done_all</mat-icon>
                  <p>Không có cơ sở nào đang chờ phê duyệt. Tất cả kế hoạch đã được xử lý hoàn tất!</p>
                </td>
              </tr>
              <tr
                *ngFor="let item of pendingGridList; let i = index"
                [class.selected-row]="isGridSelected(item.planItemId)"
              >
                <td class="text-center">
                  <mat-checkbox
                    [checked]="isGridSelected(item.planItemId)"
                    (change)="toggleGridSelection(item.planItemId, $event.checked)"
                    color="primary"
                  ></mat-checkbox>
                </td>
                <td>{{ i + 1 }}</td>
                <td><strong>{{ item.ward }}</strong></td>
                <td><span class="badge-status badge-in_progress">{{ item.quarter }}</span></td>
                <td>
                  <span class="badge-status badge-approved">
                    {{ item.objectType === 'enterprise' ? 'Doanh nghiệp' : (item.objectType === 'household' ? 'Hộ KD' : 'Cá nhân') }}
                  </span>
                </td>
                <td><code>{{ item.taxCode || item.idNumber }}</code></td>
                <td><strong>{{ item.objectName }}</strong></td>
                <td>{{ item.address }}</td>
                <td>{{ item.submittedByName || 'Cán bộ phường' }}</td>
                <td class="text-center">
                  <div class="row-quick-actions">
                    <button type="button" class="btn-quick-approve" (click)="approveSinglePlan(item.planId)" matTooltip="Duyệt cả kế hoạch này">
                      <mat-icon>check</mat-icon>
                    </button>
                    <button type="button" class="btn-quick-reject" (click)="openRejectDialog(item.planId, item.ward)" matTooltip="Từ chối kế hoạch này">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .plans-management-page {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-width: 1560px;
      margin: 0 auto;
    }

    .plans-subnav-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      overflow-x: auto;

      .subnav-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
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

        .badge-pending-count {
          background-color: #ef4444;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 9999px;
          margin-left: 2px;
        }
      }
    }

    .view-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Quota Banner */
    .quota-banner-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;

      .banner-left {
        display: flex;
        align-items: center;
        gap: 12px;

        mat-icon {
          font-size: 26px;
          width: 26px;
          height: 26px;
        }

        .banner-text {
          font-size: 13px;
          strong { font-size: 13.5px; }
          p { margin: 2px 0 0; color: inherit; }
        }
      }

      .cutoff-countdown-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #ffffff;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        color: #1e3a8a;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #1a56db;
        }
      }

      &.banner-below {
        background-color: #fffbeb;
        border-color: #fde68a;
        color: #92400e;
        mat-icon { color: #d97706; }
      }

      &.banner-ok {
        background-color: #ecfdf5;
        border-color: #a7f3d0;
        color: #065f46;
        mat-icon { color: #059669; }
      }

      &.banner-above {
        background-color: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;
        mat-icon { color: #dc2626; }
      }
    }

    .cart-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .btn-submit-plan {
      height: 38px;
      padding: 0 20px;
      background-color: #059669;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 13.5px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      transition: all 0.15s;

      &:hover:not([disabled]) {
        background-color: #047857;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .cart-table-card, .matrix-table-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      overflow: hidden;

      .table-header-title {
        padding: 14px 16px;
        border-bottom: 1px solid #f1f5f9;
        h3 {
          font-size: 14px;
          font-weight: 700;
          color: #1e3a8a;
          margin: 0;
        }
      }
    }

    .cart-table, .matrix-grid-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      thead th {
        background-color: #f8fafc;
        padding: 12px 14px;
        font-weight: 600;
        color: #374151;
        border-bottom: 1px solid #e5e7eb;
        text-align: left;
      }

      tbody tr {
        border-bottom: 1px solid #f1f5f9;
        transition: background-color 0.15s;

        &:last-child { border-bottom: none; }
        &:hover { background-color: #f8fafc; }
        &.selected-row { background-color: #eff6ff; }

        td {
          padding: 12px 14px;
          vertical-align: middle;
        }
      }
    }

    .empty-cart-row {
      text-align: center !important;
      padding: 48px 16px !important;
      color: #9ca3af;

      mat-icon {
        font-size: 38px;
        width: 38px;
        height: 38px;
        color: #cbd5e1;
        margin-bottom: 6px;
      }

      p { margin: 0; font-size: 13.5px; }
    }

    .btn-remove-item {
      background: transparent;
      border: none;
      color: #ef4444;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 4px;

      &:hover {
        background-color: #fee2e2;
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    /* Matrix Toolbar */
    .matrix-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 10px 16px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;

      .selection-info {
        font-size: 13px;
        color: #4b5563;
        strong { color: #1e3a8a; }
      }
    }

    .btn-bulk-approve {
      height: 36px;
      padding: 0 16px;
      background-color: #1e3a8a;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;

      &:hover:not([disabled]) {
        background-color: #1d4ed8;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .row-quick-actions {
      display: flex;
      justify-content: center;
      gap: 4px;

      .btn-quick-approve, .btn-quick-reject {
        width: 28px;
        height: 28px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid transparent;
        cursor: pointer;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      .btn-quick-approve {
        background-color: #ecfdf5;
        color: #059669;
        border-color: #a7f3d0;
        &:hover { background-color: #d1fae5; }
      }

      .btn-quick-reject {
        background-color: #fef2f2;
        color: #dc2626;
        border-color: #fecaca;
        &:hover { background-color: #fee2e2; }
      }
    }

    .text-center { text-align: center !important; }
  `]
})
export class PlansListComponent implements OnInit {
  activeView: 'cart' | 'list' | 'matrix' = 'list';

  // Current User
  currentUser: any = null;
  userWard = 'Phường Khương Mai';
  cutoffTime = '25/06/2026 17:00';

  // 1. Cart View State
  currentDraftPlan: Plan | null = null;
  currentCartObjects: BusinessObject[] = [];
  wardQuota = { minCount: 2, maxCount: 10 };

  cartHeaderActions: PageHeaderAction[] = [];

  // 2. Plans List View State
  plans: Plan[] = [];
  filteredPlans: Plan[] = [];
  isLoadingPlans = false;
  activeListStatus = 'all';
  listSearchQuery = '';

  listStatusTabs: StatusTabItem[] = [
    { key: 'all', label: 'Tất cả', count: 0, color: 'gray' },
    { key: 'draft', label: 'Bản nháp', count: 0, color: 'gray' },
    { key: 'pending', label: 'Chờ phê duyệt', count: 0, color: 'orange' },
    { key: 'approved', label: 'Đã phê duyệt', count: 0, color: 'green' },
    { key: 'rejected', label: 'Từ chối', count: 0, color: 'red' }
  ];

  planColumns: TableColumn[] = [
    {
      key: 'planName',
      label: 'Tên kế hoạch',
      sortable: true,
      width: '24%',
      formatter: (val, row) => `Kế hoạch ${row.quarter} - ${row.ward}`
    },
    { key: 'ward', label: 'Đơn vị cơ sở', sortable: true, width: '18%' },
    {
      key: 'totalObjects',
      label: 'Số lượng cơ sở',
      sortable: true,
      type: 'badge',
      width: '14%',
      formatter: (val) => `${val || 0} đối tượng`,
      badgeMapping: {
        '0': { label: '0 đối tượng', cssClass: 'badge-closed' }
      }
    },
    { key: 'submittedByName', label: 'Người trình duyệt', sortable: true, width: '16%' },
    { key: 'submittedAt', label: 'Ngày trình', sortable: true, width: '14%' },
    {
      key: 'status',
      label: 'Trạng thái',
      sortable: true,
      type: 'badge',
      width: '14%',
      badgeMapping: {
        draft: { label: 'Bản nháp', cssClass: 'badge-closed' },
        pending: { label: 'Chờ phê duyệt', cssClass: 'badge-pending' },
        approved: { label: 'Đã phê duyệt', cssClass: 'badge-approved' },
        rejected: { label: 'Từ chối', cssClass: 'badge-danger' }
      }
    }
  ];

  planRowActions: TableAction[] = [
    { id: 'view_detail', label: 'Xem chi tiết kế hoạch', icon: 'visibility' },
    {
      id: 'submit_plan',
      label: 'Trình duyệt lên TNT',
      icon: 'send',
      color: '#059669',
      hidden: (row) => row.status !== 'draft'
    },
    {
      id: 'approve_plan',
      label: 'Phê duyệt kế hoạch',
      icon: 'task_alt',
      color: '#1a56db',
      hidden: (row) => row.status !== 'pending' || (!this.isTNT && !this.isAdmin)
    },
    {
      id: 'reject_plan',
      label: 'Từ chối kế hoạch',
      icon: 'close',
      color: '#dc2626',
      dividerBefore: true,
      hidden: (row) => row.status !== 'pending' || (!this.isTNT && !this.isAdmin)
    }
  ];

  // 3. Approval Matrix View State
  pendingGridList: any[] = [];
  selectedGridItems: number[] = []; // array of planItemIds

  matrixHeaderActions: PageHeaderAction[] = [];

  constructor(
    private api: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUser();
    if (this.currentUser?.unit && this.currentUser.unit.includes('Phường')) {
      this.userWard = this.currentUser.unit;
    }

    // Default view based on role
    if (this.isWardOfficer) {
      this.activeView = 'cart';
    } else if (this.isTNT) {
      this.activeView = 'matrix';
    } else {
      this.activeView = 'list';
    }

    this.route.queryParams.subscribe(params => {
      if (params['view']) {
        this.activeView = params['view'];
      }
    });

    this.loadPlans();
    this.loadCartPlan();
    this.loadPendingGrid();
  }

  get isWardOfficer(): boolean {
    return this.currentUser?.role === 'officer_ward';
  }

  get isTNT(): boolean {
    const r = this.currentUser?.role;
    return r === 'leader_tnt' || r === 'officer_tnt';
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  switchView(view: 'cart' | 'list' | 'matrix'): void {
    this.activeView = view;
    if (view === 'cart') this.loadCartPlan();
    else if (view === 'list') this.loadPlans();
    else if (view === 'matrix') this.loadPendingGrid();
  }

  // --- Cart View Logic ---
  loadCartPlan(): void {
    this.api.get<any>('/plans', { quarter: 'Q2/2026', ward: this.userWard }).subscribe({
      next: (res) => {
        if (res.success && res.data.length > 0) {
          const plan = res.data[0];
          this.currentDraftPlan = plan;
          this.api.get<any>(`/plans/${plan.id}`).subscribe({
            next: (d) => {
              if (d.success) {
                this.currentCartObjects = d.data.items || [];
              }
            }
          });
        } else {
          // If no plan exists yet for this ward & quarter, create one
          this.api.post<any>('/plans', { quarter: 'Q2/2026', ward: this.userWard, objectIds: [] }).subscribe({
            next: (createRes) => {
              if (createRes.success) {
                this.loadCartPlan();
              }
            }
          });
        }
      }
    });

    // Load ward quota
    this.api.get<any>(`/configs/quota?quarter=Q2/2026&ward=${this.userWard}`).subscribe({
      next: (qRes) => {
        if (qRes.success && qRes.data.length > 0) {
          this.wardQuota = qRes.data[0];
        }
      }
    });
  }

  getQuotaBannerClass(): string {
    const count = this.currentCartObjects.length;
    if (count < this.wardQuota.minCount) return 'banner-below';
    if (count > this.wardQuota.maxCount) return 'banner-above';
    return 'banner-ok';
  }

  getQuotaBannerIcon(): string {
    const count = this.currentCartObjects.length;
    if (count < this.wardQuota.minCount) return 'warning';
    if (count > this.wardQuota.maxCount) return 'error';
    return 'check_circle';
  }

  getQuotaBannerTitle(): string {
    const count = this.currentCartObjects.length;
    if (count < this.wardQuota.minCount) return 'CẢNH BÁO QUOTA (CHƯA ĐẠT CHỈ TIÊU TỐI THIỂU)';
    if (count > this.wardQuota.maxCount) return 'CẢNH BÁO QUOTA (VƯỢT QUÁ CHỈ TIÊU TỐI ĐA)';
    return 'CHỈ TIÊU QUOTA HỢP LỆ';
  }

  isSubmitDisabled(): boolean {
    return this.currentCartObjects.length === 0 || this.currentDraftPlan?.status !== 'draft';
  }

  handleCartHeaderAction(id: string): void {}

  openAddObjectsToCart(): void {
    const existingIds = this.currentCartObjects.map(o => o.id);
    const dialogRef = this.dialog.open(SelectObjectsDialogComponent, {
      width: '640px',
      data: {
        ward: this.userWard,
        existingObjectIds: existingIds
      }
    });

    dialogRef.afterClosed().subscribe((selectedIds: number[]) => {
      if (selectedIds && selectedIds.length > 0 && this.currentDraftPlan) {
        const allIds = [...existingIds, ...selectedIds];
        this.api.put<any>(`/plans/${this.currentDraftPlan.id}/items`, { objectIds: allIds }).subscribe({
          next: (res) => {
            if (res.success) {
              this.snackBar.open(`Đã thêm ${selectedIds.length} cơ sở vào giỏ kế hoạch!`, 'Đóng', { duration: 2500 });
              this.loadCartPlan();
            }
          }
        });
      }
    });
  }

  removeFromCart(objectId: number): void {
    if (!this.currentDraftPlan) return;
    const remainingIds = this.currentCartObjects.filter(o => o.id !== objectId).map(o => o.id);
    this.api.put<any>(`/plans/${this.currentDraftPlan.id}/items`, { objectIds: remainingIds }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Đã xóa cơ sở khỏi giỏ kế hoạch', 'Đóng', { duration: 2000 });
          this.loadCartPlan();
        }
      }
    });
  }

  submitCartPlan(): void {
    if (!this.currentDraftPlan) return;
    this.api.post<any>(`/plans/${this.currentDraftPlan.id}/submit`, {}).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Đã trình duyệt Kế hoạch Quý II/2026 lên TNT thành công!', 'Đóng', { duration: 3000 });
          this.loadCartPlan();
          this.loadPlans();
        }
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Lỗi khi trình duyệt kế hoạch', 'Đóng', { duration: 3500 });
      }
    });
  }

  // --- Plans List Logic ---
  loadPlans(): void {
    this.isLoadingPlans = true;
    this.api.get<any>('/plans?limit=100').subscribe({
      next: (res) => {
        this.isLoadingPlans = false;
        if (res.success) {
          this.plans = res.data;
          this.updateListTabCounts();
          this.applyListFilters();
        }
      },
      error: () => {
        this.isLoadingPlans = false;
      }
    });
  }

  updateListTabCounts(): void {
    this.listStatusTabs.forEach(tab => {
      if (tab.key === 'all') tab.count = this.plans.length;
      else tab.count = this.plans.filter(p => p.status === tab.key).length;
    });
  }

  applyListFilters(): void {
    let result = [...this.plans];

    if (this.activeListStatus !== 'all') {
      result = result.filter(p => p.status === this.activeListStatus);
    }

    if (this.listSearchQuery.trim()) {
      const q = this.listSearchQuery.trim().toLowerCase();
      result = result.filter(
        p =>
          p.ward.toLowerCase().includes(q) ||
          p.quarter.toLowerCase().includes(q) ||
          (p.submittedByName && p.submittedByName.toLowerCase().includes(q))
      );
    }

    this.filteredPlans = result;
  }

  handleListStatusChange(key: string): void {
    this.activeListStatus = key;
    this.applyListFilters();
  }

  handleListSearch(query: string): void {
    this.listSearchQuery = query;
    this.applyListFilters();
  }

  handlePlanRowAction(event: { action: string; row: Plan }): void {
    if (event.action === 'view_detail') {
      this.openPlanDetail(event.row.id);
    } else if (event.action === 'submit_plan') {
      this.api.post<any>(`/plans/${event.row.id}/submit`, {}).subscribe({
        next: (res) => {
          if (res.success) {
            this.snackBar.open('Đã trình duyệt kế hoạch thành công!', 'Đóng', { duration: 2500 });
            this.loadPlans();
          }
        }
      });
    } else if (event.action === 'approve_plan') {
      this.approveSinglePlan(event.row.id);
    } else if (event.action === 'reject_plan') {
      this.openRejectDialog(event.row.id, event.row.ward);
    }
  }

  openPlanDetail(planId: number): void {
    this.dialog.open(PlanDetailDialogComponent, {
      width: '760px',
      data: { planId }
    });
  }

  // --- Approval Matrix Logic ---
  loadPendingGrid(): void {
    this.api.get<any>('/plans/pending-grid').subscribe({
      next: (res) => {
        if (res.success) {
          this.pendingGridList = res.data;
          this.selectedGridItems = [];
        }
      }
    });
  }

  isGridSelected(planItemId: number): boolean {
    return this.selectedGridItems.includes(planItemId);
  }

  toggleGridSelection(planItemId: number, checked: boolean): void {
    if (checked) {
      if (!this.isGridSelected(planItemId)) {
        this.selectedGridItems.push(planItemId);
      }
    } else {
      this.selectedGridItems = this.selectedGridItems.filter(id => id !== planItemId);
    }
  }

  isAllGridSelected(): boolean {
    return this.pendingGridList.length > 0 && this.selectedGridItems.length === this.pendingGridList.length;
  }

  isPartiallyGridSelected(): boolean {
    return this.selectedGridItems.length > 0 && this.selectedGridItems.length < this.pendingGridList.length;
  }

  toggleSelectAllGrid(checked: boolean): void {
    if (checked) {
      this.selectedGridItems = this.pendingGridList.map(item => item.planItemId);
    } else {
      this.selectedGridItems = [];
    }
  }

  bulkApproveSelected(): void {
    if (this.selectedGridItems.length === 0) return;

    this.api.post<any>('/plans/approve-bulk', { planItemIds: this.selectedGridItems }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open(res.message || 'Đã phê duyệt các cơ sở kiểm tra thành công!', 'Đóng', { duration: 3000 });
          this.loadPendingGrid();
          this.loadPlans();
        }
      }
    });
  }

  approveSinglePlan(planId: number): void {
    this.api.post<any>(`/plans/${planId}/approve`, {}).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Đã phê duyệt kế hoạch thành công! Đã tạo các hồ sơ kiểm tra thực địa.', 'Đóng', { duration: 3000 });
          this.loadPendingGrid();
          this.loadPlans();
        }
      }
    });
  }

  openRejectDialog(planId: number, ward: string): void {
    const dialogRef = this.dialog.open(RejectDialogComponent, {
      width: '480px',
      data: { planName: `Kế hoạch ${ward}` }
    });

    dialogRef.afterClosed().subscribe((reason: string) => {
      if (reason) {
        this.api.post<any>(`/plans/${planId}/reject`, { reason }).subscribe({
          next: (res) => {
            if (res.success) {
              this.snackBar.open('Đã trả kế hoạch về Bản nháp thành công!', 'Đóng', { duration: 2500 });
              this.loadPendingGrid();
              this.loadPlans();
            }
          }
        });
      }
    });
  }

  handleMatrixHeaderAction(id: string): void {}
}
