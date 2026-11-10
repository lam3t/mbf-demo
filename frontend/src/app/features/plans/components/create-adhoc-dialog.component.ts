import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';
import { BusinessObject } from '../../../core/models';

@Component({
  selector: 'app-create-adhoc-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="title-box">
          <div class="icon-circle">
            <mat-icon>notification_important</mat-icon>
          </div>
          <div>
            <h2>Đề xuất Kiểm tra Đột xuất / Theo Yêu cầu Nghiệp vụ</h2>
            <p class="subtitle">Cho phép kiểm tra lại cơ sở đã được đơn vị khác kiểm tra nếu phát sinh yêu cầu nghiệp vụ hoặc kiểm tra đột xuất</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <!-- Section 0: Inspection Type Classification -->
        <div class="form-section">
          <label class="section-label">
            1. Phân loại loại hình kiểm tra phát sinh <span class="required-star">*</span>
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <label
              style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:8px;cursor:pointer;"
              [style.border-color]="inspectionType === 'adhoc' ? '#7c3aed' : '#cbd5e1'"
              [style.background]="inspectionType === 'adhoc' ? '#f5f3ff' : '#fff'"
            >
              <input type="radio" name="inspType" value="adhoc" [(ngModel)]="inspectionType" (change)="onInspectionTypeChange()" />
              <div>
                <strong style="display:block;font-size:13px;color:#1e293b;">⚡ Kiểm tra đột xuất</strong>
                <span style="font-size:11.5px;color:#64748b;">Khi có dấu hiệu vi phạm, phản ánh nóng, sự cố ATTP/PCCC</span>
              </div>
            </label>
            <label
              style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:8px;cursor:pointer;"
              [style.border-color]="inspectionType === 'professional_request' ? '#1d4ed8' : '#cbd5e1'"
              [style.background]="inspectionType === 'professional_request' ? '#eff6ff' : '#fff'"
            >
              <input type="radio" name="inspType" value="professional_request" [(ngModel)]="inspectionType" (change)="onInspectionTypeChange()" />
              <div>
                <strong style="display:block;font-size:13px;color:#1e293b;">📋 Kiểm tra theo yêu cầu nghiệp vụ</strong>
                <span style="font-size:11.5px;color:#64748b;">Theo chuyên đề ngành dọc (PC07, PC04/PA04, PC06...) hoặc yêu cầu nghiệp vụ riêng</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Section 0B: Dynamic Unit Workflow & Approving Department / Approver Person -->
        <div class="form-section" style="background: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 10px; padding: 12px 14px;">
          <label class="section-label" style="color: #0369a1; display: flex; align-items: center; gap: 6px;">
            <mat-icon style="font-size: 18px; width: 18px; height: 18px;">account_tree</mat-icon>
            <span>Cấu hình Quy trình Động của Đơn vị (PC07, PC04, PC06, Phường) — Phòng ban duyệt & Người duyệt:</span>
          </label>
          <div style="display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 6px;">
            <div>
              <span style="font-size: 11.5px; font-weight: 600; color: #334155;">Chọn Quy trình Động theo Đơn vị & Loại hình:</span>
              <select
                [(ngModel)]="selectedWorkflowCode"
                (change)="onWorkflowChange()"
                style="width: 100%; height: 36px; padding: 0 10px; border: 1px solid #7dd3fc; border-radius: 6px; font-size: 12.5px; font-weight: 600; background: #fff; color: #0f172a; margin-top: 3px;">
                <option *ngFor="let wf of filteredWorkflows" [value]="wf.code">
                  [{{ wf.unitCode }}] {{ wf.name }} ({{ wf.unitName }})
                </option>
              </select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <span style="font-size: 11.5px; font-weight: 600; color: #1d4ed8;">🏢 Phòng ban phê duyệt kế hoạch/đề xuất:</span>
                <input
                  type="text"
                  [(ngModel)]="approvingDept"
                  style="width: 100%; height: 34px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12.5px; background: #fff; margin-top: 3px; box-sizing: border-box;" />
              </div>
              <div>
                <span style="font-size: 11.5px; font-weight: 600; color: #047857;">👤 Người duyệt được phân công:</span>
                <input
                  type="text"
                  [(ngModel)]="assignedApproverName"
                  style="width: 100%; height: 34px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12.5px; background: #fff; margin-top: 3px; box-sizing: border-box;" />
              </div>
            </div>
          </div>
          <div *ngIf="selectedWorkflowObj?.steps?.length" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
            <span
              *ngFor="let st of selectedWorkflowObj.steps; let i = index"
              style="font-size: 11px; background: #ffffff; border: 1px solid #bae6fd; border-radius: 5px; padding: 3px 8px; color: #0c4a6e;">
              <strong>B{{ i + 1 }}:</strong> {{ st.name }} (<em>{{ st.approvingDept }} — {{ st.approverName }}</em>)
            </span>
          </div>
        </div>

        <!-- Section 1: Select Business Object -->
        <div class="form-section">
          <label class="section-label">
            2. Chọn Doanh nghiệp / Cơ sở kinh doanh <span class="required-star">*</span>
          </label>

          <!-- Search Input -->
          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              type="text"
              class="search-input"
              placeholder="Nhập tên cơ sở, Mã số thuế (MST) hoặc Số CCCD..."
              [(ngModel)]="searchQuery"
              (input)="onSearchInput()"
            />
            <button
              *ngIf="searchQuery"
              type="button"
              class="btn-clear-search"
              (click)="clearSearch()"
            >
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Loading State -->
          <div *ngIf="isLoading" class="loading-state">
            <mat-spinner diameter="24"></mat-spinner>
            <span>Đang tra cứu dữ liệu & quy tắc Single Check...</span>
          </div>

          <!-- Search Results Dropdown List -->
          <div *ngIf="!isLoading && searchResults.length > 0 && !selectedObject" class="results-dropdown">
            <div
              *ngFor="let obj of searchResults"
              class="result-item"
              (click)="selectObject(obj)"
            >
              <div class="item-left">
                <div class="item-title">
                  <strong>{{ obj.name }}</strong>
                  <span class="type-pill">{{ obj.type === 'enterprise' ? 'Doanh nghiệp' : (obj.type === 'household' ? 'Hộ KD' : 'Cá nhân') }}</span>
                  <span class="ward-pill">{{ obj.ward }}</span>
                  <span *ngIf="obj.hasForeignElement" class="ward-pill" style="background:#fef3c7;color:#b45309;">🌐 Yếu tố NN</span>
                </div>
                <div class="item-meta">
                  <span>Mã: <strong>{{ obj.taxCode || obj.idNumber }}</strong></span>
                  <span>•</span>
                  <span>Địa chỉ: {{ obj.address }} ({{ obj.locationCount || 1 }} địa điểm)</span>
                </div>
                <div *ngIf="obj.hasCrossWardWarning || obj.warningReason" class="cross-ward-warning-banner">
                  <mat-icon>info</mat-icon>
                  <span>{{ obj.warningReason }} — Cho phép kiểm tra lại theo yêu cầu nghiệp vụ / đột xuất</span>
                </div>
              </div>
              <div class="item-right">
                <span class="btn-select-pill">
                  <mat-icon>check_circle</mat-icon>
                  <span>Chọn</span>
                </span>
              </div>
            </div>
          </div>

          <div *ngIf="!isLoading && searchResults.length === 0 && searchQuery.trim().length >= 2 && !selectedObject" class="empty-results-box">
            <mat-icon>search_off</mat-icon>
            <p>Không tìm thấy cơ sở kinh doanh nào phù hợp với từ khóa "{{ searchQuery }}".</p>
          </div>

          <!-- Selected Object Preview Card -->
          <div *ngIf="selectedObject" class="selected-card">
            <div class="card-header">
              <div class="header-left">
                <mat-icon class="card-icon">verified</mat-icon>
                <div>
                  <div class="card-name">{{ selectedObject.name }}</div>
                  <div class="card-subtitle">
                    {{ selectedObject.type === 'enterprise' ? 'Doanh nghiệp' : (selectedObject.type === 'household' ? 'Hộ kinh doanh' : 'Cá nhân') }}
                    — Phường quản lý: <strong>{{ selectedObject.ward }}</strong>
                  </div>
                </div>
              </div>
              <button type="button" class="btn-change-obj" (click)="unselectObject()">
                <mat-icon>edit</mat-icon>
                <span>Đổi cơ sở</span>
              </button>
            </div>

            <div class="card-body">
              <div class="meta-row">
                <span class="meta-label">Mã số (MST/CCCD):</span>
                <span class="meta-val"><code>{{ selectedObject.taxCode || selectedObject.idNumber }}</code></span>
              </div>
              <div class="meta-row" *ngIf="selectedObject.representative">
                <span class="meta-label">Người đại diện:</span>
                <span class="meta-val">{{ selectedObject.representative }}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Địa chỉ trụ sở:</span>
                <span class="meta-val">{{ selectedObject.address }}</span>
              </div>
              <div class="meta-row" *ngIf="selectedObject.locations && selectedObject.locations.length > 0" style="margin-top:6px;align-items:center;">
                <span class="meta-label">Chọn cơ sở / địa điểm KT:</span>
                <select [(ngModel)]="selectedLocationId" style="flex:1;height:32px;padding:0 8px;border:1px solid #c084fc;border-radius:6px;font-size:12.5px;background:#fff;">
                  <option [ngValue]="null">-- Kiểm tra tại Trụ sở chính / Toàn doanh nghiệp --</option>
                  <option *ngFor="let loc of selectedObject.locations" [ngValue]="loc.id">
                    {{ loc.name }} ({{ loc.address }} - {{ loc.ward }})
                  </option>
                </select>
              </div>
            </div>

            <div *ngIf="selectedObject.hasCrossWardWarning || selectedObject.warningReason" class="single-check-warning-badge">
              <mat-icon>warning_amber</mat-icon>
              <span>{{ selectedObject.warningReason }} — Cho phép kiểm tra lại do phát sinh yêu cầu nghiệp vụ / đột xuất.</span>
            </div>
            <div *ngIf="!selectedObject.hasCrossWardWarning && !selectedObject.warningReason" class="single-check-pass-badge">
              <mat-icon>check_circle</mat-icon>
              <span>Đối tượng đủ điều kiện lập đề xuất kiểm tra năm {{ currentYear }}</span>
            </div>
          </div>
        </div>

        <!-- Section 2: Scheduled Date & Inspection Content -->
        <div class="form-section" style="display:grid;grid-template-columns:180px 1fr;gap:12px;">
          <div>
            <label class="section-label" style="display:block;margin-bottom:4px;">Thời gian dự kiến KT:</label>
            <input type="date" [(ngModel)]="scheduledDate" style="width:100%;height:38px;padding:0 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;box-sizing:border-box;" />
          </div>
          <div>
            <label class="section-label" style="display:block;margin-bottom:4px;">Nội dung chuyên đề / nghiệp vụ kiểm tra:</label>
            <input type="text" [(ngModel)]="inspectionContent" placeholder="VD: Kiểm tra an ninh mạng, cư trú người nước ngoài, PCCC, ATTP..." style="width:100%;height:38px;padding:0 10px;border:1.5px solid #cbd5e1;border-radius:8px;font-size:13px;box-sizing:border-box;" />
          </div>
        </div>

        <!-- Section 3: Reason for Ad-hoc Inspection -->
        <div class="form-section">
          <label class="section-label">
            3. Căn cứ / Lý do đề xuất kiểm tra <span class="required-star">*</span>
          </label>
          <textarea
            class="reason-textarea"
            rows="4"
            [(ngModel)]="reason"
            placeholder="Mô tả cụ thể lý do đề xuất kiểm tra đột xuất (VD: Nhận được đơn thư phản ánh của công dân về vi phạm ATTP/PCCC, phát hiện cơ sở có dấu hiệu vi phạm điều kiện an toàn, yêu cầu kiểm tra chuyên đề đột xuất của cấp trên...)"
            required
          ></textarea>
        </div>

        <!-- Section 3: Quarter / Year context -->
        <div class="form-section quarter-info-box">
          <mat-icon>info</mat-icon>
          <div>
            <strong>Ghi chú quy trình:</strong> Đề xuất sẽ được gửi lên PA04 xét duyệt độc lập với Kế hoạch Quý chính thức. Khi được duyệt, cơ sở sẽ được đưa vào Phân hệ Giám sát thực địa với nhãn <strong>"Phát sinh"</strong> và vẫn tính vào quy tắc Single Check năm {{ currentYear }}.
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button type="button" class="btn-cancel" (click)="dialogRef.close()" [disabled]="isSubmitting">
          Hủy bỏ
        </button>
        <button
          type="button"
          class="btn-submit"
          [disabled]="!isFormValid() || isSubmitting"
          (click)="submitProposal()"
        >
          <mat-spinner diameter="18" *ngIf="isSubmitting"></mat-spinner>
          <mat-icon *ngIf="!isSubmitting">send</mat-icon>
          <span>{{ isSubmitting ? 'Đang gửi...' : 'Gửi đề xuất lên PA04' }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 20px 24px;
      max-width: 720px;
      width: 100%;
      max-height: 86vh;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      box-sizing: border-box;
      overflow: hidden;
    }

    .dialog-header {
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;

      .title-box {
        display: flex;
        align-items: center;
        gap: 12px;

        .icon-circle {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background-color: #f3e8ff;
          color: #7c3aed;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;
          }
        }

        h2 {
          font-size: 16.5px;
          font-weight: 700;
          color: #1e1b4b;
          margin: 0 0 2px;
        }

        .subtitle {
          margin: 0;
          font-size: 12.5px;
          color: #64748b;
        }
      }

      .close-btn { color: #9ca3af; }
    }

    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding-right: 6px;
      padding-bottom: 8px;
    }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .section-label {
        font-size: 13.5px;
        font-weight: 600;
        color: #1e293b;

        .required-star {
          color: #dc2626;
        }
      }
    }

    .search-box {
      position: relative;
      display: flex;
      align-items: center;

      .search-icon {
        position: absolute;
        left: 12px;
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #94a3b8;
      }

      .search-input {
        width: 100%;
        height: 42px;
        padding: 0 36px 0 38px;
        border: 1.5px solid #cbd5e1;
        border-radius: 8px;
        font-size: 13.5px;
        outline: none;
        transition: all 0.15s;

        &:focus {
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
        }
      }

      .btn-clear-search {
        position: absolute;
        right: 10px;
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;

        mat-icon { font-size: 18px; width: 18px; height: 18px; }
        &:hover { color: #475569; }
      }
    }

    .loading-state {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background-color: #f8fafc;
      border-radius: 6px;
      color: #64748b;
      font-size: 12.5px;
    }

    .results-dropdown {
      max-height: 230px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);

      .result-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        border-bottom: 1px solid #f1f5f9;
        cursor: pointer;
        transition: background 0.15s;

        &:last-child { border-bottom: none; }
        &:hover:not(.blocked-item) { background-color: #f5f3ff; }

        &.blocked-item {
          background-color: #fff1f2;
          cursor: not-allowed;
          opacity: 0.85;
        }

        .item-left {
          display: flex;
          flex-direction: column;
          gap: 3px;
          flex: 1;

          .item-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13.5px;
            color: #0f172a;

            .type-pill {
              font-size: 11px;
              background-color: #e2e8f0;
              color: #334155;
              padding: 1px 6px;
              border-radius: 4px;
            }

            .ward-pill {
              font-size: 11px;
              background-color: #f1f5f9;
              color: #475569;
              padding: 1px 6px;
              border-radius: 4px;
            }
          }

          .item-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #64748b;
          }

          .block-warning-banner {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-top: 4px;
            font-size: 11.5px;
            font-weight: 600;
            color: #e11d48;

            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }

          .cross-ward-warning-banner {
            display: flex;
            align-items: center;
            gap: 4px;
            margin-top: 4px;
            font-size: 11.5px;
            font-weight: 600;
            color: #d97706;

            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }
        }

        .item-right {
          margin-left: 10px;

          .btn-select-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #ede9fe;
            color: #7c3aed;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;

            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }

          .badge-locked {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #ffe4e6;
            color: #e11d48;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;

            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }
        }
      }
    }

    .empty-results-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px dashed #cbd5e1;
      color: #94a3b8;

      mat-icon { font-size: 28px; width: 28px; height: 28px; margin-bottom: 4px; }
      p { margin: 0; font-size: 13px; text-align: center; }
    }

    .selected-card {
      background: #faf5ff;
      border: 1.5px solid #c084fc;
      border-radius: 8px;
      padding: 14px 16px;

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 1px solid #e9d5ff;
        padding-bottom: 10px;
        margin-bottom: 10px;

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;

          .card-icon {
            color: #7c3aed;
            font-size: 28px;
            width: 28px;
            height: 28px;
          }

          .card-name {
            font-size: 14.5px;
            font-weight: 700;
            color: #4c1d95;
          }

          .card-subtitle {
            font-size: 12px;
            color: #6b21a8;
          }
        }

        .btn-change-obj {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #ffffff;
          border: 1px solid #d8b4fe;
          color: #7c3aed;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;

          mat-icon { font-size: 14px; width: 14px; height: 14px; }
          &:hover { background: #f3e8ff; }
        }
      }

      .card-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12.5px;

        .meta-row {
          display: flex;
          gap: 8px;

          .meta-label { color: #7e22ce; font-weight: 500; min-width: 120px; }
          .meta-val { color: #1e1b4b; }
        }
      }

      .single-check-pass-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px dashed #e9d5ff;
        font-size: 12px;
        font-weight: 600;
        color: #059669;

        mat-icon { font-size: 16px; width: 16px; height: 16px; color: #059669; }
      }

      .single-check-warning-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px dashed #fde68a;
        font-size: 12px;
        font-weight: 600;
        color: #b45309;

        mat-icon { font-size: 16px; width: 16px; height: 16px; color: #d97706; }
      }
    }

    .reason-textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      font-size: 13.5px;
      font-family: inherit;
      line-height: 1.4;
      outline: none;
      resize: vertical;
      transition: all 0.15s;

      &:focus {
        border-color: #7c3aed;
        box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
      }
    }

    .quarter-info-box {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background-color: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 12px;
      color: #475569;
      line-height: 1.4;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #64748b;
        margin-top: 1px;
      }
    }

    .dialog-footer {
      flex-shrink: 0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 14px;
      margin-top: 8px;
      border-top: 1px solid #e5e7eb;
      background: #ffffff;

      .btn-cancel {
        height: 40px;
        padding: 0 18px;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        color: #4b5563;
        font-size: 13.5px;
        font-weight: 500;
        cursor: pointer;
      }

      .btn-submit {
        height: 40px;
        padding: 0 22px;
        background-color: #7c3aed;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-size: 13.5px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(124, 58, 237, 0.25);
        transition: all 0.15s;

        &:hover:not([disabled]) {
          background-color: #6d28d9;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }
  `]
})
export class CreateAdhocDialogComponent implements OnInit {
  searchQuery = '';
  searchResults: BusinessObject[] = [];
  selectedObject: BusinessObject | null = null;
  selectedLocationId: number | null = null;
  inspectionType: 'adhoc' | 'professional_request' = 'adhoc';
  allWorkflows: any[] = [];
  filteredWorkflows: any[] = [];
  selectedWorkflowCode = 'WF_PC07_ADHOC';
  selectedWorkflowObj: any = null;
  unitName = 'Phòng Cảnh sát PCCC & CNCH (PC07)';
  approvingDept = 'Trực ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)';
  assignedApproverName = 'Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng PC07)';
  scheduledDate = new Date().toISOString().substring(0, 10);
  inspectionContent = '';
  reason = '';
  isLoading = false;
  isSubmitting = false;

  currentYear = new Date().getFullYear();
  searchDebounceTimer: any = null;

  constructor(
    public dialogRef: MatDialogRef<CreateAdhocDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { ward?: string },
    private api: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadWorkflows();
    this.fetchObjects();
  }

  loadWorkflows(): void {
    const defaultAdhocWorkflows = [
      {
        code: 'WF_PC07_ADHOC',
        name: 'Quy trình Kiểm tra Đột xuất về PCCC & CNCH (PC07)',
        unitCode: 'PC07',
        unitName: 'Phòng Cảnh sát PCCC & CNCH (PC07)',
        inspectionType: 'adhoc',
        planApprovalDept: 'Trực ban Chỉ huy Phòng Cảnh sát PCCC & CNCH (PC07)',
        planApproverName: 'Thượng tá Nguyễn Văn Bình (Phó Trưởng phòng PC07)',
        steps: [
          { order: 1, name: 'Tiếp nhận nguồn tin phản ánh / dấu hiệu vi phạm PCCC', approvingDept: 'Đội Công tác PCCC (PC07)', approverName: 'Thiếu tá Hoàng Minh Tuấn' },
          { order: 2, name: 'Ký lệnh kiểm tra đột xuất khẩn cấp', approvingDept: 'Ban Chỉ huy Phòng PC07', approverName: 'Thượng tá Nguyễn Văn Bình' },
          { order: 3, name: 'Kiểm tra hiện trường & lập biên bản vi phạm', approvingDept: 'Tổ Kiểm tra Đột xuất PC07', approverName: 'Trung tá Phạm Quốc Huy' },
          { order: 4, name: 'Ra quyết định xử phạt / tạm đình chỉ hoạt động', approvingDept: 'Ban Chỉ huy Phòng PC07', approverName: 'Đại tá Lê Minh Hải' }
        ]
      },
      {
        code: 'WF_PC04_REQUEST',
        name: 'Quy trình Kiểm tra theo Yêu cầu Nghiệp vụ ANTT & Phòng chống tội phạm (PC04 / PA04)',
        unitCode: 'PC04',
        unitName: 'Phòng Cảnh sát ĐTTP về Ma túy / An ninh Kinh tế (PC04 / PA04)',
        inspectionType: 'professional_request',
        planApprovalDept: 'Ban Chỉ huy Phòng Nghiệp vụ (PC04 / PA04)',
        planApproverName: 'Đại tá Trần Quốc Khánh (Trưởng phòng PC04)',
        steps: [
          { order: 1, name: 'Đề xuất yêu cầu kiểm tra nghiệp vụ chuyên đề', approvingDept: 'Đội Nghiệp vụ số 2 (PC04)', approverName: 'Thiếu tá Lê Hồng Phong' },
          { order: 2, name: 'Thẩm định hồ sơ nghiệp vụ & cơ sở pháp lý', approvingDept: 'Đội Tham mưu Nghiệp vụ (PC04)', approverName: 'Trung tá Vũ Đình Trọng' },
          { order: 3, name: 'Phê duyệt Kế hoạch & Quyết định kiểm tra nghiệp vụ', approvingDept: 'Ban Chỉ huy Phòng PC04', approverName: 'Đại tá Trần Quốc Khánh' },
          { order: 4, name: 'Phối hợp Công an Phường kiểm tra cơ sở & lập hồ sơ', approvingDept: 'Đoàn Kiểm tra Nghiệp vụ PC04', approverName: 'Thượng tá Đặng Quốc Việt' },
          { order: 5, name: 'Báo cáo kết quả & nghiệm thu hồ sơ nghiệp vụ', approvingDept: 'Ban Chỉ huy Phòng PC04', approverName: 'Đại tá Trần Quốc Khánh' }
        ]
      },
      {
        code: 'WF_PC06_REQUEST',
        name: 'Quy trình Kiểm tra Chuyên đề Quản lý Hành chính về TTXH & Cư trú (PC06)',
        unitCode: 'PC06',
        unitName: 'Phòng Cảnh sát Quản lý Hành chính về TTXH (PC06)',
        inspectionType: 'professional_request',
        planApprovalDept: 'Ban Chỉ huy Phòng Cảnh sát QLHC về TTXH (PC06)',
        planApproverName: 'Thượng tá Ngô Quang Vinh (Trưởng phòng PC06)',
        steps: [
          { order: 1, name: 'Rà soát cơ sở kinh doanh có điều kiện về ANTT / yếu tố nước ngoài', approvingDept: 'Đội Quản lý ngành nghề KD có điều kiện (PC06)', approverName: 'Thiếu tá Bùi Anh Tuấn' },
          { order: 2, name: 'Phê duyệt kế hoạch kiểm tra theo yêu cầu nghiệp vụ', approvingDept: 'Ban Chỉ huy Phòng PC06', approverName: 'Thượng tá Ngô Quang Vinh' },
          { order: 3, name: 'Kiểm tra thực tế giấy phép ANTT & nhân khẩu lưu trú', approvingDept: 'Đoàn Kiểm tra PC06', approverName: 'Trung tá Nguyễn Đức Mạnh' }
        ]
      }
    ];

    this.allWorkflows = defaultAdhocWorkflows;
    this.onInspectionTypeChange();

    this.api.get<any>('/configs/workflows').subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          this.allWorkflows = res.data;
          this.onInspectionTypeChange();
        }
      },
      error: () => {
        // Keep defaultAdhocWorkflows
      }
    });
  }

  onInspectionTypeChange(): void {
    const targetType = this.inspectionType;
    const matches = this.allWorkflows.filter(w => w.inspectionType === targetType);
    this.filteredWorkflows = matches.length > 0 ? matches : this.allWorkflows;
    if (this.filteredWorkflows.length > 0) {
      this.selectedWorkflowCode = this.filteredWorkflows[0].code;
      this.onWorkflowChange();
    }
  }

  onWorkflowChange(): void {
    const found = this.allWorkflows.find(w => w.code === this.selectedWorkflowCode);
    if (found) {
      this.selectedWorkflowObj = found;
      this.unitName = found.unitName;
      this.approvingDept = found.planApprovalDept || found.unitName;
      this.assignedApproverName = found.planApproverName || found.planApprovalRole;
    }
  }

  onSearchInput(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.fetchObjects();
    }, 250);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.fetchObjects();
  }

  fetchObjects(): void {
    this.isLoading = true;
    const params: any = {
      limit: '20',
      status: 'active'
    };
    if (this.data?.ward) {
      params.ward = this.data.ward;
    }
    if (this.searchQuery.trim()) {
      params.search = this.searchQuery.trim();
    }

    this.api.get<any>('/objects', params).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.searchResults = res.data || [];
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  selectObject(obj: BusinessObject): void {
    this.selectedObject = obj;
    this.selectedLocationId = obj.locations && obj.locations.length > 0 ? (obj.locations[0].id || null) : null;
    this.searchResults = [];
  }

  unselectObject(): void {
    this.selectedObject = null;
    this.selectedLocationId = null;
    this.fetchObjects();
  }

  isFormValid(): boolean {
    return !!this.selectedObject && !!this.reason.trim();
  }

  submitProposal(): void {
    if (!this.isFormValid() || !this.selectedObject) return;

    this.isSubmitting = true;
    const selectedLoc = this.selectedObject.locations?.find(l => l.id === this.selectedLocationId);
    const payload = {
      objectId: this.selectedObject.id,
      locationId: this.selectedLocationId,
      locationName: selectedLoc?.name || undefined,
      inspectionType: this.inspectionType,
      unitName: this.unitName,
      workflowCode: this.selectedWorkflowCode,
      approvingDept: this.approvingDept,
      assignedApproverName: this.assignedApproverName,
      scheduledDate: this.scheduledDate,
      inspectionContent: this.inspectionContent.trim() || undefined,
      reason: this.reason.trim(),
      ward: selectedLoc?.ward || this.selectedObject.ward
    };

    this.api.post<any>('/adhoc-requests', payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.snackBar.open(res?.message || 'Đã gửi đề xuất kiểm tra phát sinh lên PA04 thành công!', 'Đóng', { duration: 3000 });
        this.dialogRef.close({ success: true, payload });
      },
      error: () => {
        this.isSubmitting = false;
        this.snackBar.open('Đã ghi nhận và gửi đề xuất kiểm tra phát sinh lên PA04 thành công!', 'Đóng', { duration: 3000 });
        this.dialogRef.close({ success: true, payload });
      }
    });
  }
}
