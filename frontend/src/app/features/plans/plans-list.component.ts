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
import { MatTooltipModule } from '@angular/material/tooltip';

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

import { RejectDialogComponent } from './components/reject-dialog.component';
import { SelectObjectsDialogComponent } from './components/select-objects-dialog.component';
import { PlanDetailDialogComponent } from './components/plan-detail-dialog.component';
import { DigitalSignDialogComponent } from './components/digital-sign-dialog.component';
import { DocumentPreviewDialogComponent } from './components/document-preview-dialog.component';
import { CreateAdhocDialogComponent } from './components/create-adhoc-dialog.component';
import { PlanApprovalConflictDialogComponent, ConflictResolutionResult } from './components/plan-approval-conflict-dialog.component';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Plan, BusinessObject, AdhocInspectionRequest } from '../../core/models';

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
    MatTooltipModule,
    PageHeaderComponent,
    StatusTabsComponent,
    SearchFilterBarComponent,
    DataTableComponent,
    WardSelectComponent
  ],
  template: `
    <div class="plans-management-page">
      <!-- TOP-LEVEL PRIMARY TABS: KẾ HOẠCH CHÍNH THỨC vs ĐỀ XUẤT PHÁT SINH -->
      <div class="plans-main-tabs-bar">
        <button
          type="button"
          class="main-tab-btn"
          [class.active]="activeMainTab === 'official'"
          (click)="switchMainTab('official')"
        >
          <mat-icon>event_available</mat-icon>
          <span>Kế hoạch chính thức</span>
        </button>

        <button
          type="button"
          class="main-tab-btn adhoc-tab"
          [class.active]="activeMainTab === 'adhoc'"
          (click)="switchMainTab('adhoc')"
        >
          <mat-icon>notification_important</mat-icon>
          <span>Đề xuất phát sinh ngoài kế hoạch</span>
          <span class="badge-pending-count" *ngIf="pendingAdhocCount > 0">{{ pendingAdhocCount }}</span>
        </button>
      </div>

      <!-- ============================================================= -->
      <!-- TAB 1: KẾ HOẠCH CHÍNH THỨC (CART / LIST / MATRIX)            -->
      <!-- ============================================================= -->
      <ng-container *ngIf="activeMainTab === 'official'">
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

          <!-- Signed Scan Document Upload Section -->
          <div class="signed-doc-upload-box" [class.has-file]="!!selectedFile || !!currentDraftPlan?.signedDocumentUrl">
            <div class="upload-box-left">
              <mat-icon class="upload-icon">upload_file</mat-icon>
              <div class="upload-box-text">
                <div class="upload-title">
                  <strong>Đính kèm văn bản đã ký (Scan/Ảnh có chữ ký + Dấu) <span class="required-star">*</span></strong>
                </div>
                <p class="upload-hint">Định dạng hỗ trợ: .PDF, .JPG, .PNG (Dung lượng tối đa 10MB). Bắt buộc phải đính kèm trước khi trình duyệt.</p>
                
                <!-- File status / preview if selected -->
                <div *ngIf="selectedFile || currentDraftPlan?.signedDocumentUrl" class="file-chip-badge">
                  <mat-icon>attachment</mat-icon>
                  <span class="file-name">{{ selectedFile ? selectedFile.name : 'Van_ban_trinh_duyet_da_ky.pdf' }}</span>
                  <span class="file-size" *ngIf="selectedFile">({{ (selectedFile.size / (1024 * 1024)).toFixed(2) }} MB)</span>
                  <button type="button" class="btn-preview-chip" (click)="previewCurrentCartDocument()" matTooltip="Xem văn bản đã đính kèm">
                    <mat-icon>visibility</mat-icon>
                    <span>Xem</span>
                  </button>
                  <button
                    type="button"
                    class="btn-clear-chip"
                    (click)="removeSelectedFile()"
                    *ngIf="currentDraftPlan?.status === 'draft'"
                    matTooltip="Xóa file đã chọn"
                  >
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              </div>
            </div>

            <div class="upload-box-right">
              <input
                type="file"
                #scanFileInput
                (change)="onFileSelected($event)"
                accept=".pdf,.jpg,.jpeg,.png"
                style="display: none"
              />
              <button
                type="button"
                class="btn-choose-file"
                (click)="scanFileInput.click()"
                [disabled]="currentDraftPlan?.status !== 'draft' || isUploadingScan"
              >
                <mat-icon>cloud_upload</mat-icon>
                <span>{{ selectedFile || currentDraftPlan?.signedDocumentUrl ? 'Thay đổi file' : 'Chọn file văn bản scan' }}</span>
              </button>
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
              [matTooltip]="getSubmitTooltip()"
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

          <div class="plans-filter-bar" style="display: flex; gap: 12px; margin-bottom: 8px; align-items: center; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 280px;">
              <app-search-filter-bar
                placeholder="Tìm kiếm theo tên kế hoạch, đơn vị phường, người trình..."
                (search)="handleListSearch($event)"
                (searchChange)="handleListSearch($event)"
                (refresh)="loadPlans()"
                [showFilter]="false"
              ></app-search-filter-bar>
            </div>
            <div style="min-width: 220px; margin-bottom: 16px;">
              <app-ward-select
                [(ngModel)]="listWardFilter"
                (wardChange)="applyListFilters()"
                placeholder="-- Tất cả các Phường --"
                [includeAllOption]="true"
              ></app-ward-select>
            </div>
          </div>

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
                <span>Duyệt thường các mục đã chọn ({{ selectedGridItems.length }})</span>
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
                  <th>Văn bản scan</th>
                  <th>Người trình</th>
                  <th class="text-center" style="width: 140px;">Thao tác phê duyệt</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngIf="pendingGridList.length === 0">
                  <td colspan="11" class="empty-cart-row">
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
                  <td>
                    <button
                      *ngIf="item.signedDocumentUrl"
                      type="button"
                      class="btn-view-scan-pill"
                      (click)="openDocumentPreview(item.signedDocumentUrl, 'Văn bản đã ký - ' + item.ward, 'Kế hoạch ' + item.quarter)"
                      matTooltip="Xem văn bản scan đã ký"
                    >
                      <mat-icon>picture_as_pdf</mat-icon>
                      <span>Xem scan</span>
                    </button>
                    <span *ngIf="!item.signedDocumentUrl" class="text-muted-empty">Chưa có</span>
                  </td>
                  <td>{{ item.submittedByName || 'Cán bộ phường' }}</td>
                  <td class="text-center">
                    <div class="row-quick-actions">
                      <!-- Standard Approve Button (Available to all TNT roles) -->
                      <button
                        type="button"
                        class="btn-quick-approve"
                        (click)="approveSinglePlan(item.planId)"
                        matTooltip="Phê duyệt thường (không ký số)"
                      >
                        <mat-icon>check</mat-icon>
                      </button>

                      <!-- Digital Token Signing Button (Only for leader_tnt and admin) -->
                      <button
                        *ngIf="isLeaderTNT"
                        type="button"
                        class="btn-quick-sign"
                        (click)="openDigitalSignDialog(item.planId, 'Kế hoạch ' + item.quarter + ' - ' + item.ward, item.quarter, item.ward)"
                        matTooltip="Phê duyệt & Ký số điện tử (Token CA)"
                      >
                        <mat-icon>approval</mat-icon>
                      </button>

                      <!-- Disabled Token Button with Tooltip for Officer TNT -->
                      <button
                        *ngIf="!isLeaderTNT"
                        type="button"
                        class="btn-quick-sign disabled"
                        matTooltip="Chỉ Trưởng phòng/Giám đốc mới có quyền ký số"
                        disabled
                      >
                        <mat-icon>lock</mat-icon>
                      </button>

                      <!-- Reject Plan Button -->
                      <button
                        type="button"
                        class="btn-quick-reject"
                        (click)="openRejectDialog(item.planId, item.ward)"
                        matTooltip="Từ chối kế hoạch này"
                      >
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>

      <!-- ============================================================= -->
      <!-- TAB 2: ĐỀ XUẤT PHÁT SINH NGOÀI KẾ HOẠCH (AD-HOC PROPOSALS)    -->
      <!-- ============================================================= -->
      <div class="view-container" *ngIf="activeMainTab === 'adhoc'">
        <app-page-header
          title="Đề xuất Kiểm tra Phát sinh (Ngoài kế hoạch)"
          subtitle="Cán bộ Phường đề xuất kiểm tra đột xuất đối tượng chưa có trong kế hoạch chính thức; PA04 xem xét và phê duyệt độc lập"
          [actions]="adhocHeaderActions"
          (actionClick)="handleAdhocHeaderAction($event)"
        ></app-page-header>

        <!-- Status Filter Tabs -->
        <app-status-tabs
          [tabs]="adhocStatusTabs"
          [activeKey]="activeAdhocStatus"
          (tabChange)="handleAdhocStatusChange($event)"
        ></app-status-tabs>

        <!-- Search & Filter Controls -->
        <div class="adhoc-filter-card">
          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              type="text"
              class="search-input"
              placeholder="Tìm theo tên cơ sở, MST, CCCD, lý do, người đề xuất..."
              [(ngModel)]="adhocSearchQuery"
              (input)="applyAdhocFilters()"
            />
            <button *ngIf="adhocSearchQuery" class="clear-btn" (click)="adhocSearchQuery = ''; applyAdhocFilters()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="filter-group" *ngIf="isTNT || isAdmin" style="min-width: 220px;">
            <label class="filter-label">Lọc Phường:</label>
            <app-ward-select
              [(ngModel)]="adhocFilterWard"
              (wardChange)="loadAdhocRequests()"
              placeholder="-- Tất cả các Phường --"
              [includeAllOption]="true"
            ></app-ward-select>
          </div>

          <button type="button" class="btn-refresh-adhoc" (click)="loadAdhocRequests()" matTooltip="Làm mới danh sách">
            <mat-icon>refresh</mat-icon>
            <span>Làm mới</span>
          </button>
        </div>

        <!-- Ad-hoc Requests Table Card -->
        <div class="matrix-table-card">
          <div class="table-header-title">
            <h3>Danh sách đề xuất kiểm tra phát sinh ({{ filteredAdhocRequests.length }} đề xuất)</h3>
          </div>

          <table class="matrix-grid-table">
            <thead>
              <tr>
                <th style="width: 40px;" class="text-center">#</th>
                <th style="width: 140px;">Đơn vị đề xuất</th>
                <th style="width: 100px;">Loại hình</th>
                <th style="width: 120px;">Mã định danh</th>
                <th>Tên cơ sở kinh doanh</th>
                <th>Địa chỉ kinh doanh</th>
                <th style="min-width: 240px;">Lý do đề xuất kiểm tra đột xuất</th>
                <th style="width: 90px;" class="text-center">Quý/Năm</th>
                <th style="width: 140px;">Người đề xuất</th>
                <th style="width: 120px;" class="text-center">Trạng thái</th>
                <th *ngIf="isTNT || isAdmin" style="width: 130px;" class="text-center">Thao tác PA04</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="isLoadingAdhoc">
                <td [attr.colspan]="(isTNT || isAdmin) ? 11 : 10" class="empty-cart-row">
                  <mat-icon>sync</mat-icon>
                  <p>Đang tải danh sách đề xuất phát sinh...</p>
                </td>
              </tr>
              <tr *ngIf="!isLoadingAdhoc && filteredAdhocRequests.length === 0">
                <td [attr.colspan]="(isTNT || isAdmin) ? 11 : 10" class="empty-cart-row">
                  <mat-icon>inbox</mat-icon>
                  <p>Không có đề xuất kiểm tra phát sinh nào trong danh mục này.</p>
                </td>
              </tr>
              <tr *ngFor="let req of filteredAdhocRequests; let i = index">
                <td class="text-center">{{ i + 1 }}</td>
                <td><strong>{{ req.wardRequestedBy }}</strong></td>
                <td>
                  <span class="badge-status" [ngClass]="req.objectType === 'enterprise' ? 'badge-approved' : 'badge-in_progress'">
                    {{ req.objectType === 'enterprise' ? 'Doanh nghiệp' : (req.objectType === 'household' ? 'Hộ KD' : 'Cá nhân') }}
                  </span>
                </td>
                <td><code>{{ req.taxCode || req.idNumber }}</code></td>
                <td><strong>{{ req.objectName }}</strong></td>
                <td>{{ req.objectAddress }}</td>
                <td>
                  <div class="adhoc-reason-box">
                    <mat-icon class="reason-icon">report_problem</mat-icon>
                    <span class="reason-text">{{ req.reason }}</span>
                  </div>
                  <div *ngIf="req.status === 'rejected' && req.rejectReason" class="adhoc-reject-box">
                    <mat-icon>cancel</mat-icon>
                    <span>Lý do từ chối: {{ req.rejectReason }}</span>
                  </div>
                </td>
                <td class="text-center">
                  <span class="badge-status badge-in_progress">{{ req.relatedQuarter }}/{{ req.relatedYear }}</span>
                </td>
                <td>
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <span>{{ req.requestedByName || 'Cán bộ phường' }}</span>
                    <span style="font-size: 11px; color: #94a3b8;">{{ req.requestedAt | date:'dd/MM/yyyy' }}</span>
                  </div>
                </td>
                <td class="text-center">
                  <span class="badge-status" [ngClass]="{
                    'badge-pending': req.status === 'pending',
                    'badge-approved': req.status === 'approved',
                    'badge-danger': req.status === 'rejected'
                  }">
                    {{ req.status === 'pending' ? 'Chờ duyệt' : (req.status === 'approved' ? 'Đã duyệt' : 'Từ chối') }}
                  </span>
                </td>
                <td *ngIf="isTNT || isAdmin" class="text-center">
                  <div class="row-quick-actions" *ngIf="req.status === 'pending'">
                    <button
                      type="button"
                      class="btn-quick-approve"
                      (click)="approveAdhocRequest(req)"
                      matTooltip="Phê duyệt đề xuất (Tự sinh hồ sơ kiểm tra)"
                    >
                      <mat-icon>check</mat-icon>
                    </button>
                    <button
                      type="button"
                      class="btn-quick-reject"
                      (click)="rejectAdhocRequest(req)"
                      matTooltip="Từ chối đề xuất này"
                    >
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                  <span *ngIf="req.status !== 'pending'" class="text-muted-empty">Đã xử lý</span>
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

    /* Primary Main Tabs Bar */
    .plans-main-tabs-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #ffffff;
      padding: 8px 16px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

      .main-tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 20px;
        border-radius: 8px;
        border: 1px solid transparent;
        background: #f8fafc;
        color: #475569;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: #64748b;
        }

        &:hover {
          background-color: #eff6ff;
          color: #1a56db;
          mat-icon { color: #1a56db; }
        }

        &.active {
          background-color: #1a56db;
          color: #ffffff;
          box-shadow: 0 2px 4px rgba(26, 86, 219, 0.25);
          mat-icon { color: #ffffff; }
        }

        &.adhoc-tab {
          &.active {
            background-color: #7c3aed;
            box-shadow: 0 2px 4px rgba(124, 58, 237, 0.25);
          }
        }

        .badge-pending-count {
          background-color: #ef4444;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          padding: 1px 7px;
          border-radius: 9999px;
          margin-left: 2px;
        }
      }
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

    /* Adhoc Filter Card */
    .adhoc-filter-card {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #ffffff;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;

      .search-box {
        position: relative;
        flex: 1;
        display: flex;
        align-items: center;

        .search-icon {
          position: absolute;
          left: 10px;
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #94a3b8;
        }

        .search-input {
          width: 100%;
          height: 38px;
          padding: 0 32px 0 34px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 13px;
          outline: none;
          &:focus { border-color: #7c3aed; }
        }

        .clear-btn {
          position: absolute;
          right: 8px;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 6px;

        .filter-label {
          font-size: 12.5px;
          font-weight: 600;
          color: #475569;
          white-space: nowrap;
        }

        .custom-select {
          height: 38px;
          padding: 0 10px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          font-size: 13px;
          color: #1e293b;
          outline: none;
          cursor: pointer;
        }
      }

      .btn-refresh-adhoc {
        height: 38px;
        padding: 0 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        color: #475569;
        font-size: 13px;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        &:hover { background: #f1f5f9; color: #1e293b; }
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    .adhoc-reason-box {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      background: #faf5ff;
      border: 1px solid #e9d5ff;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 12.5px;
      color: #4c1d95;

      .reason-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #7c3aed;
        margin-top: 1px;
        flex-shrink: 0;
      }

      .reason-text {
        line-height: 1.35;
      }
    }

    .adhoc-reject-box {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      font-size: 11.5px;
      color: #dc2626;
      font-weight: 500;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #dc2626; }
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

    /* Signed Document Upload Section */
    .signed-doc-upload-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      background: #f8fafc;
      border: 1.5px dashed #94a3b8;
      border-radius: 8px;
      transition: all 0.2s;

      &.has-file {
        background: #f0fdf4;
        border-color: #86efac;
        border-style: solid;
      }

      .upload-box-left {
        display: flex;
        align-items: center;
        gap: 14px;

        .upload-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
          color: #1e40af;
        }

        .upload-box-text {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .upload-title {
            font-size: 13.5px;
            color: #1e293b;
            .required-star { color: #dc2626; font-weight: 700; }
          }

          .upload-hint {
            margin: 0;
            font-size: 12px;
            color: #64748b;
          }

          .file-chip-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 4px 10px;
            border-radius: 6px;
            margin-top: 6px;
            font-size: 12.5px;
            color: #0f172a;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

            mat-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
              color: #059669;
            }

            .file-name { font-weight: 600; color: #1e3a8a; }
            .file-size { color: #64748b; font-size: 11px; }

            .btn-preview-chip {
              display: inline-flex;
              align-items: center;
              gap: 2px;
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              border-radius: 4px;
              color: #1d4ed8;
              padding: 2px 6px;
              font-size: 11px;
              cursor: pointer;
              margin-left: 6px;

              mat-icon { font-size: 14px; width: 14px; height: 14px; color: #1d4ed8; }
              &:hover { background: #dbeafe; }
            }

            .btn-clear-chip {
              background: transparent;
              border: none;
              color: #dc2626;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              padding: 2px;
              margin-left: 2px;

              mat-icon { font-size: 16px; width: 16px; height: 16px; color: #dc2626; }
              &:hover { background: #fee2e2; border-radius: 4px; }
            }
          }
        }
      }

      .upload-box-right {
        .btn-choose-file {
          height: 38px;
          padding: 0 16px;
          background-color: #ffffff;
          border: 1.5px solid #1a56db;
          color: #1a56db;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s;

          &:hover:not([disabled]) {
            background-color: #eff6ff;
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

    .btn-view-scan-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      border-radius: 4px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;

      mat-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
        color: #dc2626;
      }

      &:hover {
        background: #dbeafe;
      }
    }

    .text-muted-empty {
      font-size: 12px;
      color: #9ca3af;
      font-style: italic;
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

      .btn-quick-approve, .btn-quick-sign, .btn-quick-reject {
        width: 28px;
        height: 28px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.15s;

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

      .btn-quick-sign {
        background-color: #eef2ff;
        color: #4338ca;
        border-color: #c7d2fe;
        &:hover:not(:disabled) { background-color: #e0e7ff; color: #3730a3; }

        &.disabled {
          background-color: #f3f4f6;
          color: #9ca3af;
          border-color: #e5e7eb;
          cursor: not-allowed;
        }
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
  activeMainTab: 'official' | 'adhoc' = 'official';
  activeView: 'cart' | 'list' | 'matrix' = 'list';

  // Current User
  currentUser: any = null;
  userWard = 'Phường Khương Mai';
  cutoffTime = '25/06/2026 17:00';
  availableWards = ['Phường Khương Mai', 'Phường Hàng Bài', 'Phường Đồng Tâm', 'Phường Quảng An', 'Phường Bách Khoa'];

  // 1. Cart View State
  currentDraftPlan: Plan | null = null;
  currentCartObjects: BusinessObject[] = [];
  wardQuota = { minCount: 2, maxCount: 10 };

  // Scan Document State
  selectedFile: File | null = null;
  uploadedScanUrl: string | null = null;
  isUploadingScan = false;

  cartHeaderActions: PageHeaderAction[] = [];

  // 2. Plans List View State
  plans: Plan[] = [];
  filteredPlans: Plan[] = [];
  isLoadingPlans = false;
  activeListStatus = 'all';
  listSearchQuery = '';
  listWardFilter = '';

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
      width: '22%',
      formatter: (val, row) => `Kế hoạch ${row.quarter} - ${row.ward}`
    },
    { key: 'ward', label: 'Đơn vị cơ sở', sortable: true, width: '16%' },
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
    {
      key: 'dueDate',
      label: 'Hạn trình duyệt (Cut-off)',
      sortable: true,
      width: '18%',
      formatter: (val, row) => {
        if (!val) return '--';
        const formatted = val.substring(0, 16).replace('T', ' ');
        return row.isOverdue && row.status === 'draft' ? `⏰ ${formatted} (Quá hạn)` : formatted;
      }
    },
    {
      key: 'signedDocumentUrl',
      label: 'Văn bản scan',
      width: '14%',
      formatter: (val) => val ? 'Đã đính kèm' : 'Chưa có',
      type: 'badge',
      badgeMapping: {
        'Đã đính kèm': { label: 'Đã đính kèm', cssClass: 'badge-approved' },
        'Chưa có': { label: 'Chưa có', cssClass: 'badge-closed' }
      }
    },
    {
      key: 'status',
      label: 'Trạng thái',
      sortable: true,
      type: 'badge',
      width: '16%',
      formatter: (val, row) => {
        if (row.status === 'draft' && row.isOverdue) {
          return 'Quá hạn trình duyệt';
        }
        switch (row.status) {
          case 'draft': return 'Bản nháp';
          case 'pending': return 'Chờ phê duyệt';
          case 'approved': return 'Đã phê duyệt';
          case 'rejected': return 'Từ chối';
          default: return row.status;
        }
      },
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
      id: 'view_signed_doc',
      label: 'Xem văn bản scan đã ký',
      icon: 'picture_as_pdf',
      hidden: (row) => !row.signedDocumentUrl
    },
    {
      id: 'submit_plan',
      label: 'Trình duyệt lên TNT',
      icon: 'send',
      color: '#059669',
      hidden: (row) => row.status !== 'draft'
    },
    {
      id: 'sign_digital',
      label: 'Duyệt & Ký số điện tử',
      icon: 'approval',
      color: '#4338ca',
      hidden: (row) => row.status !== 'pending' || !this.isLeaderTNT
    },
    {
      id: 'approve_plan',
      label: 'Phê duyệt thường',
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

  // 4. Ad-hoc Inspection Requests State
  adhocRequests: AdhocInspectionRequest[] = [];
  filteredAdhocRequests: AdhocInspectionRequest[] = [];
  isLoadingAdhoc = false;
  activeAdhocStatus = 'all';
  adhocSearchQuery = '';
  adhocFilterWard = '';
  pendingAdhocCount = 0;

  adhocStatusTabs: StatusTabItem[] = [
    { key: 'all', label: 'Tất cả', count: 0, color: 'gray' },
    { key: 'pending', label: 'Chờ duyệt', count: 0, color: 'orange' },
    { key: 'approved', label: 'Đã duyệt', count: 0, color: 'green' },
    { key: 'rejected', label: 'Từ chối', count: 0, color: 'red' }
  ];

  adhocHeaderActions: PageHeaderAction[] = [];

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

    // Setup action buttons
    this.setupHeaderActions();

    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeMainTab = params['tab'] === 'adhoc' ? 'adhoc' : 'official';
      }
      if (params['view']) {
        this.activeView = params['view'];
      }
    });

    this.loadPlans();
    this.loadCartPlan();
    this.loadPendingGrid();
    this.loadAdhocRequests();
  }

  setupHeaderActions(): void {
    if (this.isWardOfficer || this.isAdmin) {
      this.adhocHeaderActions = [
        {
          id: 'create_adhoc',
          label: '+ Đề xuất kiểm tra mới',
          icon: 'add_alert',
          variant: 'primary'
        }
      ];
    }
  }

  get isWardOfficer(): boolean {
    return this.currentUser?.role === 'officer_ward';
  }

  get isTNT(): boolean {
    const r = this.currentUser?.role;
    return r === 'leader_tnt' || r === 'officer_tnt';
  }

  get isLeaderTNT(): boolean {
    return this.currentUser?.role === 'leader_tnt' || this.currentUser?.role === 'admin';
  }

  get isOfficerTNT(): boolean {
    return this.currentUser?.role === 'officer_tnt';
  }

  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  switchMainTab(tab: 'official' | 'adhoc'): void {
    this.activeMainTab = tab;
    if (tab === 'adhoc') {
      this.loadAdhocRequests();
    } else {
      if (this.activeView === 'cart') this.loadCartPlan();
      else if (this.activeView === 'list') this.loadPlans();
      else if (this.activeView === 'matrix') this.loadPendingGrid();
    }
  }

  switchView(view: 'cart' | 'list' | 'matrix'): void {
    this.activeView = view;
    if (view === 'cart') this.loadCartPlan();
    else if (view === 'list') this.loadPlans();
    else if (view === 'matrix') this.loadPendingGrid();
  }

  // --- Ad-hoc Inspection Requests Logic ---
  loadAdhocRequests(): void {
    this.isLoadingAdhoc = true;
    const params: any = { limit: '100' };
    if (this.adhocFilterWard) {
      params.ward = this.adhocFilterWard;
    }

    this.api.get<any>('/adhoc-requests', params).subscribe({
      next: (res) => {
        this.isLoadingAdhoc = false;
        if (res.success) {
          this.adhocRequests = res.data || [];
          this.updateAdhocTabCounts();
          this.applyAdhocFilters();
        }
      },
      error: () => {
        this.isLoadingAdhoc = false;
      }
    });
  }

  updateAdhocTabCounts(): void {
    const pending = this.adhocRequests.filter(r => r.status === 'pending').length;
    this.pendingAdhocCount = pending;

    this.adhocStatusTabs.forEach(tab => {
      if (tab.key === 'all') tab.count = this.adhocRequests.length;
      else tab.count = this.adhocRequests.filter(r => r.status === tab.key).length;
    });
  }

  applyAdhocFilters(): void {
    let result = [...this.adhocRequests];

    if (this.activeAdhocStatus !== 'all') {
      result = result.filter(r => r.status === this.activeAdhocStatus);
    }

    if (this.adhocSearchQuery.trim()) {
      const q = this.adhocSearchQuery.trim().toLowerCase();
      result = result.filter(
        r =>
          (r.objectName && r.objectName.toLowerCase().includes(q)) ||
          (r.taxCode && r.taxCode.toLowerCase().includes(q)) ||
          (r.idNumber && r.idNumber.toLowerCase().includes(q)) ||
          (r.reason && r.reason.toLowerCase().includes(q)) ||
          (r.wardRequestedBy && r.wardRequestedBy.toLowerCase().includes(q)) ||
          (r.requestedByName && r.requestedByName.toLowerCase().includes(q))
      );
    }

    this.filteredAdhocRequests = result;
  }

  handleAdhocStatusChange(key: string): void {
    this.activeAdhocStatus = key;
    this.applyAdhocFilters();
  }

  handleAdhocHeaderAction(id: string): void {
    if (id === 'create_adhoc') {
      this.openCreateAdhocDialog();
    }
  }

  openCreateAdhocDialog(): void {
    const dialogRef = this.dialog.open(CreateAdhocDialogComponent, {
      width: '680px',
      data: { ward: this.isWardOfficer ? this.userWard : undefined }
    });

    dialogRef.afterClosed().subscribe((created: boolean) => {
      if (created) {
        this.loadAdhocRequests();
      }
    });
  }

  approveAdhocRequest(req: AdhocInspectionRequest): void {
    if (!confirm(`Xác nhận PHÊ DUYỆT đề xuất kiểm tra phát sinh cơ sở "${req.objectName}" (${req.wardRequestedBy})?\n\nHệ thống sẽ tự động tạo hồ sơ kiểm tra thực địa mới có nhãn "Phát sinh".`)) {
      return;
    }

    this.api.post<any>(`/adhoc-requests/${req.id}/approve`, {}).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Phê duyệt đề xuất kiểm tra phát sinh thành công! Đã tạo hồ sơ kiểm tra thực địa.', 'Đóng', { duration: 3500 });
          this.loadAdhocRequests();
        }
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Lỗi khi phê duyệt đề xuất.', 'Đóng', { duration: 4000 });
      }
    });
  }

  rejectAdhocRequest(req: AdhocInspectionRequest): void {
    const dialogRef = this.dialog.open(RejectDialogComponent, {
      width: '520px',
      data: {
        title: 'Từ chối Đề xuất Kiểm tra Phát sinh',
        message: `Từ chối đề xuất kiểm tra đột xuất đối tượng "${req.objectName}" (${req.wardRequestedBy}). Vui lòng nhập lý do từ chối để cán bộ phường nắm thông tin.`,
        placeholder: 'vd: Chưa đủ căn cứ kiểm tra đột xuất theo quy định...'
      }
    });

    dialogRef.afterClosed().subscribe((reason: string) => {
      if (reason) {
        this.api.post<any>(`/adhoc-requests/${req.id}/reject`, { rejectReason: reason }).subscribe({
          next: (res) => {
            if (res.success) {
              this.snackBar.open('Đã từ chối đề xuất kiểm tra phát sinh.', 'Đóng', { duration: 2500 });
              this.loadAdhocRequests();
            }
          },
          error: (err) => {
            this.snackBar.open(err.error?.message || 'Lỗi khi từ chối đề xuất.', 'Đóng', { duration: 3500 });
          }
        });
      }
    });
  }

  // --- Cart View Logic ---
  loadCartPlan(): void {
    this.api.get<any>('/plans', { quarter: 'Q2/2026', ward: this.userWard }).subscribe({
      next: (res) => {
        if (res.success && res.data.length > 0) {
          const plan = res.data[0];
          this.currentDraftPlan = plan;
          this.uploadedScanUrl = plan.signedDocumentUrl || null;
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

  onFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (!file) return;

    // Validate size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      this.snackBar.open('Dung lượng file vượt quá giới hạn cho phép (10MB).', 'Đóng', { duration: 3500 });
      return;
    }

    // Validate format
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    const fileName = file.name.toLowerCase();
    const isAllowed = allowed.some(ext => fileName.endsWith(ext));
    if (!isAllowed) {
      this.snackBar.open('Định dạng file không hợp lệ. Vui lòng chọn file .PDF, .JPG hoặc .PNG.', 'Đóng', { duration: 3500 });
      return;
    }

    this.selectedFile = file;
    this.uploadedScanUrl = null;
    this.snackBar.open(`Đã chọn file: ${file.name}`, 'Đóng', { duration: 2500 });
  }

  removeSelectedFile(): void {
    this.selectedFile = null;
    this.uploadedScanUrl = null;
    if (this.currentDraftPlan) {
      this.currentDraftPlan.signedDocumentUrl = undefined;
    }
  }

  previewCurrentCartDocument(): void {
    if (this.selectedFile) {
      const objUrl = URL.createObjectURL(this.selectedFile);
      this.openDocumentPreview(objUrl, 'Văn bản đã ký đính kèm (Bản xem trước)', `File: ${this.selectedFile.name}`);
    } else if (this.currentDraftPlan?.signedDocumentUrl) {
      this.openDocumentPreview(this.currentDraftPlan.signedDocumentUrl, 'Văn bản đã ký đính kèm', `Đơn vị: ${this.userWard}`);
    }
  }

  isSubmitDisabled(): boolean {
    const hasObjects = this.currentCartObjects.length > 0;
    const isDraft = this.currentDraftPlan?.status === 'draft';
    const hasDocument = !!(this.selectedFile || this.uploadedScanUrl || this.currentDraftPlan?.signedDocumentUrl);
    return !hasObjects || !isDraft || !hasDocument || this.isUploadingScan;
  }

  getSubmitTooltip(): string {
    if (this.currentCartObjects.length === 0) return 'Giỏ kế hoạch chưa có cơ sở nào';
    if (!this.selectedFile && !this.uploadedScanUrl && !this.currentDraftPlan?.signedDocumentUrl) {
      return 'Bắt buộc đính kèm văn bản đã ký trước khi trình duyệt';
    }
    return 'Trình duyệt kế hoạch lên cấp trên';
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
          },
          error: (err) => {
            const errorMsg = err.error?.message || 'Lỗi: Không thể thêm cơ sở vào kế hoạch do vi phạm quy tắc Single Check.';
            this.snackBar.open(errorMsg, 'Đã hiểu', { duration: 6000 });
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

    // 1. If user selected a new file, upload it first
    if (this.selectedFile) {
      this.isUploadingScan = true;
      const formData = new FormData();
      formData.append('file', this.selectedFile);

      this.api.post<any>('/plans/upload-scan', formData).subscribe({
        next: (uploadRes) => {
          this.isUploadingScan = false;
          if (uploadRes.success && uploadRes.fileUrl) {
            this.uploadedScanUrl = uploadRes.fileUrl;
            this.executeSubmitPlan(uploadRes.fileUrl);
          } else {
            this.snackBar.open('Lỗi tải file văn bản scan. Vui lòng thử lại.', 'Đóng', { duration: 3500 });
          }
        },
        error: (uploadErr) => {
          this.isUploadingScan = false;
          this.snackBar.open(uploadErr.error?.message || 'Lỗi khi tải file văn bản lên hệ thống.', 'Đóng', { duration: 3500 });
        }
      });
    } else {
      const docUrl = this.uploadedScanUrl || this.currentDraftPlan.signedDocumentUrl;
      if (!docUrl) {
        this.snackBar.open('Vui lòng đính kèm văn bản đã ký trước khi trình duyệt.', 'Đóng', { duration: 3500 });
        return;
      }
      this.executeSubmitPlan(docUrl);
    }
  }

  private executeSubmitPlan(signedDocumentUrl: string): void {
    if (!this.currentDraftPlan) return;

    this.api.post<any>(`/plans/${this.currentDraftPlan.id}/submit`, { signedDocumentUrl }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Đã trình duyệt Kế hoạch Quý II/2026 kèm văn bản đã ký lên TNT thành công!', 'Đóng', { duration: 3000 });
          this.selectedFile = null;
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

    if (this.listWardFilter && this.listWardFilter !== 'all') {
      result = result.filter(p => p.ward === this.listWardFilter);
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
    } else if (event.action === 'view_signed_doc') {
      if (event.row.signedDocumentUrl) {
        this.openDocumentPreview(event.row.signedDocumentUrl, `Văn bản đã ký - ${event.row.ward}`, `Kế hoạch ${event.row.quarter}`);
      }
    } else if (event.action === 'submit_plan') {
      this.api.post<any>(`/plans/${event.row.id}/submit`, { signedDocumentUrl: event.row.signedDocumentUrl || '/uploads/signed_plan_doc.pdf' }).subscribe({
        next: (res) => {
          if (res.success) {
            this.snackBar.open('Đã trình duyệt kế hoạch thành công!', 'Đóng', { duration: 2500 });
            this.loadPlans();
          }
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Lỗi khi trình duyệt', 'Đóng', { duration: 3500 });
        }
      });
    } else if (event.action === 'sign_digital') {
      this.openDigitalSignDialog(event.row.id, `Kế hoạch ${event.row.quarter} - ${event.row.ward}`, event.row.quarter, event.row.ward);
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

  openDocumentPreview(fileUrl: string, title?: string, subtitle?: string): void {
    this.dialog.open(DocumentPreviewDialogComponent, {
      width: '760px',
      data: { fileUrl, title, subtitle }
    });
  }

  openDigitalSignDialog(planId: number, planTitle?: string, quarter?: string, ward?: string): void {
    const targetPlan = this.plans.find(p => p.id === planId);
    const planWard = ward || targetPlan?.ward || 'Phường';
    const planQuarter = quarter || targetPlan?.quarter || 'Q2/2026';
    const title = planTitle || `Kế hoạch ${planQuarter} - ${planWard}`;

    this.api.get<any>(`/plans/${planId}/cross-ward-conflicts`).subscribe({
      next: (conflictRes) => {
        if (conflictRes.success && conflictRes.hasConflicts) {
          // Open Conflict Resolution Dialog first
          const conflictRef = this.dialog.open(PlanApprovalConflictDialogComponent, {
            width: '760px',
            data: {
              planId,
              planTitle: title,
              ward: planWard,
              quarter: planQuarter,
              conflicts: conflictRes.conflicts,
              isDigitalSign: true
            }
          });

          conflictRef.afterClosed().subscribe((res: ConflictResolutionResult) => {
            if (res && res.confirmed) {
              this.launchDigitalSignModal(planId, title, planQuarter, planWard, res.resolutionMode, res.jointDate, res.participatingWards);
            }
          });
        } else {
          // Direct digital sign
          this.launchDigitalSignModal(planId, title, planQuarter, planWard, 'standard');
        }
      },
      error: () => {
        this.launchDigitalSignModal(planId, title, planQuarter, planWard, 'standard');
      }
    });
  }

  private launchDigitalSignModal(
    planId: number,
    planTitle: string,
    quarter: string,
    ward: string,
    resolutionMode: 'merge_joint' | 'select_single' | 'standard',
    jointDate?: string,
    participatingWards?: string[]
  ): void {
    const dialogRef = this.dialog.open(DigitalSignDialogComponent, {
      width: '640px',
      data: { 
        planId, 
        planTitle, 
        quarter, 
        ward,
        resolutionMode,
        jointDate,
        participatingWards
      }
    });

    dialogRef.afterClosed().subscribe((signed: boolean) => {
      if (signed) {
        this.loadPendingGrid();
        this.loadPlans();
      }
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
    const targetPlan = this.plans.find(p => p.id === planId);
    const planWard = targetPlan?.ward || 'Phường';
    const planQuarter = targetPlan?.quarter || 'Q2/2026';
    const title = `Kế hoạch ${planQuarter} - ${planWard}`;

    this.api.get<any>(`/plans/${planId}/cross-ward-conflicts`).subscribe({
      next: (conflictRes) => {
        if (conflictRes.success && conflictRes.hasConflicts) {
          // Open Conflict Resolution Dialog first
          const conflictRef = this.dialog.open(PlanApprovalConflictDialogComponent, {
            width: '760px',
            data: {
              planId,
              planTitle: title,
              ward: planWard,
              quarter: planQuarter,
              conflicts: conflictRes.conflicts,
              isDigitalSign: false
            }
          });

          conflictRef.afterClosed().subscribe((res: ConflictResolutionResult) => {
            if (res && res.confirmed) {
              this.executeApprovePlan(planId, res.resolutionMode, res.jointDate, res.participatingWards);
            }
          });
        } else {
          // Direct approve
          this.executeApprovePlan(planId, 'standard');
        }
      },
      error: () => {
        this.executeApprovePlan(planId, 'standard');
      }
    });
  }

  private executeApprovePlan(
    planId: number, 
    resolutionMode: 'merge_joint' | 'select_single' | 'standard',
    jointDate?: string,
    participatingWards?: string[]
  ): void {
    const payload = { resolutionMode, jointDate, participatingWards };
    this.api.post<any>(`/plans/${planId}/approve`, payload).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open(res.message || 'Đã phê duyệt kế hoạch thành công!', 'Đóng', { duration: 3500 });
          this.loadPendingGrid();
          this.loadPlans();
        }
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Lỗi khi phê duyệt kế hoạch.', 'Đóng', { duration: 4000 });
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
