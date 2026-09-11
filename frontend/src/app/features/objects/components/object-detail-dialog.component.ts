import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../../core/services/api.service';
import { BusinessObject, Inspection } from '../../../core/models';

export interface ObjectDetailDialogData {
  objectId: number;
  object?: BusinessObject;
}

export interface ObjectDetailResult {
  action: 'close' | 'edit';
  object?: BusinessObject;
}

@Component({
  selector: 'app-object-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule
  ],
  template: `
    <div class="dialog-container">
      <!-- 1. Header -->
      <div class="dialog-header">
        <div class="title-box">
          <div class="icon-avatar" [ngClass]="getTypeAvatarClass(object?.type)">
            <mat-icon>{{ getTypeIcon(object?.type) }}</mat-icon>
          </div>
          <div>
            <h2>Chi tiết Hồ sơ Đối tượng Kinh doanh</h2>
            <p class="subtitle" *ngIf="object">
              Mã định danh: <code>{{ object.taxCode || object.idNumber || '—' }}</code>
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="onClose()" class="close-btn" title="Đóng">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- 2. Body -->
      <div class="dialog-content">
        <!-- Loading Spinner -->
        <div *ngIf="isLoading" class="loading-box">
          <mat-spinner diameter="32"></mat-spinner>
          <span>Đang tải thông tin chi tiết hồ sơ...</span>
        </div>

        <div *ngIf="!isLoading && object" class="detail-body">
          <!-- Hero Banner -->
          <div class="hero-banner">
            <div class="hero-main">
              <h1 class="hero-title">{{ object.name }}</h1>
              <div class="hero-tags">
                <span class="type-pill" [ngClass]="getTypeBadgeClass(object.type)">
                  <mat-icon>{{ getTypeIcon(object.type) }}</mat-icon>
                  {{ getTypeLabel(object.type) }}
                </span>
                <span class="badge-status" [ngClass]="object.status === 'active' ? 'badge-new' : 'badge-closed'">
                  {{ object.status === 'active' ? 'Đang hoạt động' : 'Tạm ngừng hoạt động' }}
                </span>
                <span class="ward-pill">
                  <mat-icon>location_on</mat-icon>
                  {{ object.ward }}
                </span>
              </div>
            </div>
          </div>

          <!-- Section: Thông tin định danh & Pháp lý -->
          <div class="section-card">
            <div class="section-header">
              <mat-icon class="section-icon">badge</mat-icon>
              <h3>Thông tin Định danh & Pháp lý</h3>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">{{ object.type === 'enterprise' ? 'Mã số thuế (MST):' : 'Số CCCD chủ cơ sở:' }}</span>
                <span class="value code-val">{{ object.taxCode || object.idNumber || '—' }}</span>
              </div>
              <div class="info-item" *ngIf="object.type === 'household' && object.taxCode">
                <span class="label">Mã số thuế hộ KD:</span>
                <span class="value code-val">{{ object.taxCode }}</span>
              </div>
              <div class="info-item">
                <span class="label">{{ object.type === 'enterprise' ? 'Người đại diện pháp luật:' : 'Chủ hộ / Cá nhân đại diện:' }}</span>
                <span class="value font-semibold">{{ object.representative || 'Chưa cập nhật' }}</span>
              </div>
              <div class="info-item full-width">
                <span class="label">Địa chỉ trụ sở / Hoạt động kinh doanh:</span>
                <span class="value">{{ object.address }}, {{ object.ward }}</span>
              </div>
              <div class="info-item">
                <span class="label">Cán bộ phụ trách khởi tạo:</span>
                <span class="value">{{ object.createdByName || 'Quản trị viên hệ thống' }}</span>
              </div>
              <div class="info-item">
                <span class="label">Thời điểm ghi nhận hồ sơ:</span>
                <span class="value">{{ formatDateTime(object.createdAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Section: Trạng thái Kế hoạch & Quy định kiểm tra (RULE-01) -->
          <div class="section-card">
            <div class="section-header">
              <mat-icon class="section-icon">rule</mat-icon>
              <h3>Trạng thái Kế hoạch & Quy định (RULE-01)</h3>
            </div>
            <div class="compliance-grid">
              <div class="compliance-box" [class.highlight]="isInspectedThisYear">
                <div class="comp-label">Năm kiểm tra gần nhất</div>
                <div class="comp-value">
                  <mat-icon class="comp-icon" [ngClass]="isInspectedThisYear ? 'text-green' : 'text-gray'">
                    {{ isInspectedThisYear ? 'verified' : 'history' }}
                  </mat-icon>
                  <span>{{ object.lastCheckedYear ? 'Năm ' + object.lastCheckedYear : 'Chưa có dữ liệu' }}</span>
                </div>
                <div class="comp-sub" *ngIf="isInspectedThisYear">
                  <span class="badge-status badge-new">Đã hoàn thành kiểm tra năm {{ currentYear }} (Đạt chỉ tiêu)</span>
                </div>
                <div class="comp-sub" *ngIf="!isInspectedThisYear">
                  <span class="badge-status badge-closed">Chưa kiểm tra trong năm tài chính {{ currentYear }}</span>
                </div>
              </div>

              <div class="compliance-box">
                <div class="comp-label">Kế hoạch quý gán hiện tại</div>
                <div class="comp-value">
                  <mat-icon class="comp-icon text-blue">event_available</mat-icon>
                  <span>{{ object.planQuarter ? object.planQuarter : 'Chưa xếp kế hoạch' }}</span>
                </div>
                <div class="comp-sub" *ngIf="object.planQuarter">
                  <span>Đơn vị lập: <strong>{{ object.planWard || object.ward }}</strong></span>
                </div>
                <div class="comp-sub text-muted" *ngIf="!object.planQuarter">
                  <span>Có thể thêm vào giỏ kế hoạch quý tới</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section: Lịch sử Kế hoạch & Kiểm tra trong năm (Single Check) -->
          <div class="section-card">
            <div class="section-header space-between">
              <div class="header-left">
                <mat-icon class="section-icon">timeline</mat-icon>
                <h3>Lịch sử Kế hoạch & Kiểm tra trong năm (Single Check)</h3>
              </div>
              <div class="year-filter-pills">
                <button
                  type="button"
                  class="year-pill"
                  [class.active]="selectedHistoryYear === currentYear"
                  (click)="selectedHistoryYear = currentYear"
                >
                  Năm {{ currentYear }} (Hiện tại)
                </button>
                <button
                  type="button"
                  class="year-pill"
                  [class.active]="selectedHistoryYear === 'all'"
                  (click)="selectedHistoryYear = 'all'"
                >
                  Tất cả các năm ({{ planHistory.length }})
                </button>
              </div>
            </div>

            <!-- Single Check Status Alert Banner -->
            <div *ngIf="singleCheckSummary?.isBlocked" class="single-check-alert blocked">
              <div class="alert-icon-wrap">
                <mat-icon>{{ singleCheckSummary.conflictType === 'COMPLETED_INSPECTION' ? 'task_alt' : 'block' }}</mat-icon>
              </div>
              <div class="alert-content">
                <strong>{{ singleCheckSummary.conflictType === 'COMPLETED_INSPECTION' ? 'ĐÃ HOÀN THÀNH KIỂM TRA TRONG NĂM' : 'ĐÃ ĐƯỢC LẬP KẾ HOẠCH KIỂM TRA (SINGLE CHECK)' }}</strong>
                <p>{{ singleCheckSummary.blockReason }}</p>
              </div>
            </div>

            <div *ngIf="!singleCheckSummary?.isBlocked" class="single-check-alert ready">
              <div class="alert-icon-wrap">
                <mat-icon>verified</mat-icon>
              </div>
              <div class="alert-content">
                <strong>ĐỦ ĐIỀU KIỆN ĐƯA VÀO KẾ HOẠCH MỚI</strong>
                <p>Cơ sở chưa hoàn thành kiểm tra và chưa thuộc kế hoạch kiểm tra nào trong năm {{ currentYear }}. Cán bộ có thể lập kế hoạch mới theo nguyên tắc 1 năm/1 lần.</p>
              </div>
            </div>

            <!-- Timeline of Plan History -->
            <div *ngIf="filteredPlanHistory.length === 0" class="empty-inspection-box">
              <mat-icon class="empty-icon">event_available</mat-icon>
              <div class="empty-text">
                <strong>Chưa ghi nhận kế hoạch kiểm tra nào</strong>
                <p>Đối tượng kinh doanh chưa được đưa vào kế hoạch kiểm tra trong giai đoạn được chọn.</p>
              </div>
            </div>

            <div *ngIf="filteredPlanHistory.length > 0" class="timeline-container">
              <div *ngFor="let item of filteredPlanHistory" class="timeline-item" [ngClass]="getTimelineItemClass(item)">
                <div class="timeline-marker">
                  <mat-icon>{{ getTimelineMarkerIcon(item) }}</mat-icon>
                </div>
                <div class="timeline-card">
                  <div class="t-card-header">
                    <div class="t-title-row">
                      <span class="quarter-tag">{{ formatQuarterDisplay(item.quarter, item.year) }}</span>
                      <span class="ward-owner">Đơn vị lập: <strong>{{ item.ward }}</strong></span>
                    </div>
                    <span class="badge-status" [ngClass]="getPlanStatusBadgeClass(item.planStatus)">
                      {{ getPlanStatusLabel(item.planStatus) }}
                    </span>
                  </div>

                  <!-- Rejection Reason if Rejected -->
                  <div *ngIf="item.planStatus === 'rejected'" class="reject-reason-box">
                    <mat-icon>cancel</mat-icon>
                    <span><strong>Lý do từ chối:</strong> {{ item.rejectReason || 'Không đạt yêu cầu phê duyệt.' }}</span>
                  </div>

                  <!-- Plan Workflow Metadata -->
                  <div class="t-card-meta">
                    <div class="t-meta-col" *ngIf="item.submittedAt">
                      <span class="meta-label">Trình duyệt:</span>
                      <span>{{ formatDateTime(item.submittedAt) }} {{ item.submittedByName ? '(' + item.submittedByName + ')' : '' }}</span>
                    </div>
                    <div class="t-meta-col" *ngIf="item.approvedAt">
                      <span class="meta-label">Phê duyệt:</span>
                      <span>{{ formatDateTime(item.approvedAt) }} {{ item.approvedByName ? '(' + item.approvedByName + ')' : '' }}</span>
                    </div>
                    <div class="t-meta-col" *ngIf="!item.submittedAt && item.planStatus === 'draft'">
                      <span class="meta-label">Khởi tạo:</span>
                      <span>{{ formatDateTime(item.planCreatedAt) }}</span>
                    </div>
                  </div>

                  <!-- Field Inspection Record Details if present -->
                  <div *ngIf="item.inspectionId" class="t-inspection-result">
                    <div class="insp-status-strip" [ngClass]="getInspectionStatusClass(item.inspectionStatus)">
                      <mat-icon>{{ item.inspectionStatus === 'completed' ? 'check_circle' : (item.inspectionStatus === 'in_progress' ? 'pending' : 'schedule') }}</mat-icon>
                      <span>Kiểm tra thực địa: <strong>{{ getInspectionStatusLabel(item.inspectionStatus) }}</strong></span>
                      <span *ngIf="item.inspectionCompletedAt" class="insp-date-tag">• Hoàn thành: {{ formatDateTime(item.inspectionCompletedAt) }}</span>
                    </div>

                    <div *ngIf="item.violationCodes && getParsedList(item.violationCodes).length > 0" class="violation-mini-row">
                      <span class="mini-label">Vi phạm:</span>
                      <span *ngFor="let code of getParsedList(item.violationCodes)" class="chip-violation-mini">{{ code }}</span>
                    </div>

                    <div *ngIf="item.recommendationNote" class="rec-mini-note">
                      <mat-icon>notes</mat-icon>
                      <span>{{ item.recommendationNote }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Footer -->
      <div class="dialog-footer">
        <div class="footer-left">
          <button type="button" class="btn-secondary" (click)="viewOnMap()" [disabled]="!object">
            <mat-icon>map</mat-icon>
            <span>Xem trên bản đồ</span>
          </button>
        </div>
        <div class="footer-right">
          <button type="button" class="btn-cancel" (click)="onClose()">
            Đóng
          </button>
          <button type="button" class="btn-primary" (click)="onEdit()" [disabled]="!object">
            <mat-icon>edit</mat-icon>
            <span>Chỉnh sửa thông tin</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 680px;
      max-width: 760px;
      max-height: 88vh;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
    }

    /* Dialog Header */
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #e5e7eb;
      background-color: #ffffff;

      .title-box {
        display: flex;
        align-items: center;
        gap: 12px;

        .icon-avatar {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon {
            font-size: 22px;
            width: 22px;
            height: 22px;
          }

          &.avatar-enterprise {
            background-color: #eff6ff;
            color: #1a56db;
          }

          &.avatar-household {
            background-color: #f0fdf4;
            color: #16a34a;
          }

          &.avatar-individual {
            background-color: #faf5ff;
            color: #9333ea;
          }
        }

        h2 {
          font-size: 16.5px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.3;
        }

        .subtitle {
          font-size: 12px;
          color: #64748b;
          margin: 2px 0 0;

          code {
            font-family: monospace;
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            color: #1e3a8a;
            font-weight: 600;
          }
        }
      }

      .close-btn {
        color: #94a3b8;
        &:hover { color: #334155; }
      }
    }

    /* Dialog Content */
    .dialog-content {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background-color: #f8fafc;
    }

    .loading-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      gap: 12px;
      color: #64748b;
      font-size: 13.5px;
    }

    .detail-body {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Hero Banner */
    .hero-banner {
      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
      border-radius: 10px;
      padding: 16px 20px;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(30, 58, 138, 0.15);

      .hero-title {
        font-size: 18px;
        font-weight: 700;
        margin: 0 0 10px 0;
        letter-spacing: -0.2px;
      }

      .hero-tags {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;

        .type-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11.5px;
          font-weight: 600;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }

          &.pill-enterprise {
            background-color: rgba(255, 255, 255, 0.22);
            color: #ffffff;
          }

          &.pill-household {
            background-color: #dcfce7;
            color: #15803d;
          }

          &.pill-individual {
            background-color: #f3e8ff;
            color: #7e22ce;
          }
        }

        .ward-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11.5px;
          background-color: rgba(255, 255, 255, 0.15);
          color: #f1f5f9;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }
        }
      }
    }

    /* Section Cards */
    .section-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);

      .section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 14px;
        padding-bottom: 8px;
        border-bottom: 1px solid #f1f5f9;

        &.space-between {
          justify-content: space-between;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .section-icon {
          color: #1e3a8a;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }

        h3 {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .count-pill {
          font-size: 11.5px;
          font-weight: 600;
          color: #1e3a8a;
          background-color: #eff6ff;
          padding: 2px 8px;
          border-radius: 12px;
          border: 1px solid #bfdbfe;
        }
      }
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 16px;

      .info-item {
        display: flex;
        flex-direction: column;
        gap: 3px;

        &.full-width {
          grid-column: 1 / -1;
        }

        .label {
          font-size: 11.5px;
          font-weight: 500;
          color: #64748b;
        }

        .value {
          font-size: 13px;
          color: #1e293b;

          &.font-semibold { font-weight: 600; }

          &.code-val {
            font-family: monospace;
            font-weight: 600;
            color: #1e3a8a;
            background: #f8fafc;
            padding: 2px 6px;
            border-radius: 4px;
            display: inline-block;
            width: fit-content;
          }
        }
      }
    }

    /* Compliance Grid */
    .compliance-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;

      .compliance-box {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;

        &.highlight {
          background-color: #f0fdf4;
          border-color: #bbf7d0;
        }

        .comp-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #64748b;
        }

        .comp-value {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;

          .comp-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;

            &.text-green { color: #16a34a; }
            &.text-gray { color: #94a3b8; }
            &.text-blue { color: #2563eb; }
          }
        }

        .comp-sub {
          font-size: 11.5px;
          color: #475569;
        }
      }
    }

    /* Empty Inspection Box */
    .empty-inspection-box {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px;
      background-color: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;

      .empty-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #94a3b8;
      }

      .empty-text {
        strong {
          display: block;
          font-size: 13px;
          color: #334155;
          margin-bottom: 2px;
        }
        p {
          margin: 0;
          font-size: 12px;
          color: #64748b;
        }
      }
    }

    /* Inspections List */
    .inspections-list {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .inspection-card {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 14px;
        transition: all 0.15s;

        &:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }

        &.locked {
          border-left: 3px solid #7c3aed;
        }

        .insp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;

          .insp-title-box {
            display: flex;
            align-items: center;
            gap: 8px;

            .insp-number {
              font-family: monospace;
              font-size: 11px;
              font-weight: 700;
              background: #f1f5f9;
              color: #475569;
              padding: 2px 6px;
              border-radius: 4px;
            }

            .insp-quarter {
              font-size: 13px;
              color: #1e293b;
            }

            .insp-date {
              font-size: 11.5px;
              color: #94a3b8;
            }
          }

          .insp-badges {
            display: flex;
            align-items: center;
            gap: 6px;

            .locked-tag {
              display: inline-flex;
              align-items: center;
              gap: 2px;
              font-size: 11px;
              color: #7c3aed;
              font-weight: 600;
              background-color: #ede9fe;
              padding: 2px 6px;
              border-radius: 4px;

              mat-icon {
                font-size: 13px;
                width: 13px;
                height: 13px;
              }
            }
          }
        }

        .insp-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 12.5px;

          .insp-meta-row {
            display: flex;
            gap: 20px;

            .meta-col {
              display: flex;
              align-items: center;
              gap: 6px;

              .meta-label {
                font-size: 11.5px;
                color: #64748b;
              }
            }
          }

          .meta-label {
            font-size: 11.5px;
            font-weight: 600;
            color: #64748b;
            display: block;
            margin-bottom: 4px;
          }

          .severity-tag {
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;

            &.sev-1 {
              background-color: #f0fdf4;
              color: #15803d;
            }
            &.sev-2 {
              background-color: #fffbeb;
              color: #b45309;
            }
            &.sev-3 {
              background-color: #fef2f2;
              color: #b91c1c;
            }
          }

          .chips-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;

            .chip-violation {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              background-color: #fef2f2;
              border: 1px solid #fecaca;
              color: #dc2626;
              font-size: 11px;
              font-weight: 600;
              padding: 2px 8px;
              border-radius: 4px;

              mat-icon {
                font-size: 13px;
                width: 13px;
                height: 13px;
              }
            }

            .chip-tag {
              background-color: #f1f5f9;
              color: #475569;
              font-size: 11px;
              padding: 2px 6px;
              border-radius: 4px;
            }
          }

          .rec-note {
            margin: 0 0 6px 0;
            font-style: italic;
            color: #334155;
            background-color: #f8fafc;
            padding: 6px 10px;
            border-radius: 6px;
            border-left: 3px solid #3b82f6;
          }
        }
      }
    }

    /* Timeline Styles */
    .year-filter-pills {
      display: flex;
      gap: 6px;

      .year-pill {
        padding: 3px 10px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        border-radius: 14px;
        font-size: 11px;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        transition: all 0.15s;

        &:hover { background-color: #f1f5f9; }
        &.active {
          background-color: #1e3a8a;
          color: #ffffff;
          border-color: #1e3a8a;
        }
      }
    }

    .single-check-alert {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 8px;
      margin-bottom: 14px;

      &.blocked {
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;

        .alert-icon-wrap mat-icon {
          color: #dc2626;
          font-size: 22px;
          width: 22px;
          height: 22px;
        }

        strong { color: #b91c1c; }
      }

      &.ready {
        background-color: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;

        .alert-icon-wrap mat-icon {
          color: #16a34a;
          font-size: 22px;
          width: 22px;
          height: 22px;
        }

        strong { color: #15803d; }
      }

      .alert-content {
        flex: 1;
        font-size: 12px;
        line-height: 1.4;

        strong {
          display: block;
          font-size: 12.5px;
          margin-bottom: 2px;
        }

        p { margin: 0; }
      }
    }

    .timeline-container {
      display: flex;
      flex-direction: column;
      position: relative;
      padding-left: 28px;
      gap: 14px;

      &::before {
        content: '';
        position: absolute;
        top: 10px;
        bottom: 10px;
        left: 11px;
        width: 2px;
        background-color: #e2e8f0;
      }

      .timeline-item {
        position: relative;
        display: flex;
        flex-direction: column;

        .timeline-marker {
          position: absolute;
          left: -28px;
          top: 8px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: #ffffff;
          border: 2px solid #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
            color: #64748b;
          }
        }

        &.item-completed .timeline-marker {
          border-color: #16a34a;
          background-color: #dcfce7;
          mat-icon { color: #16a34a; }
        }

        &.item-approved .timeline-marker {
          border-color: #2563eb;
          background-color: #eff6ff;
          mat-icon { color: #2563eb; }
        }

        &.item-pending .timeline-marker {
          border-color: #d97706;
          background-color: #fef3c7;
          mat-icon { color: #d97706; }
        }

        &.item-rejected .timeline-marker {
          border-color: #dc2626;
          background-color: #fee2e2;
          mat-icon { color: #dc2626; }
        }

        .timeline-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);

          .t-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;

            .t-title-row {
              display: flex;
              align-items: center;
              gap: 8px;

              .quarter-tag {
                font-size: 12px;
                font-weight: 700;
                color: #1e3a8a;
                background-color: #eff6ff;
                padding: 2px 8px;
                border-radius: 4px;
                border: 1px solid #bfdbfe;
              }

              .ward-owner {
                font-size: 12px;
                color: #475569;
                strong { color: #0f172a; }
              }
            }
          }

          .reject-reason-box {
            display: flex;
            align-items: center;
            gap: 6px;
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            padding: 6px 10px;
            color: #991b1b;
            font-size: 11.5px;

            mat-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
              color: #dc2626;
            }
          }

          .t-card-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            font-size: 11.5px;
            color: #64748b;

            .t-meta-col {
              display: flex;
              gap: 4px;

              .meta-label {
                font-weight: 600;
                color: #475569;
              }
            }
          }

          .t-inspection-result {
            margin-top: 4px;
            padding-top: 8px;
            border-top: 1px dashed #e2e8f0;
            display: flex;
            flex-direction: column;
            gap: 6px;

            .insp-status-strip {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 12px;
              color: #334155;

              mat-icon {
                font-size: 16px;
                width: 16px;
                height: 16px;
              }

              .insp-date-tag {
                color: #64748b;
                font-size: 11.5px;
              }
            }

            .violation-mini-row {
              display: flex;
              align-items: center;
              gap: 6px;
              flex-wrap: wrap;
              font-size: 11px;

              .mini-label {
                font-weight: 600;
                color: #b91c1c;
              }

              .chip-violation-mini {
                background-color: #fee2e2;
                color: #dc2626;
                padding: 1px 6px;
                border-radius: 4px;
                font-weight: 600;
                border: 1px solid #fca5a5;
              }
            }

            .rec-mini-note {
              display: flex;
              align-items: flex-start;
              gap: 4px;
              font-size: 11.5px;
              color: #475569;
              background-color: #f8fafc;
              padding: 4px 8px;
              border-radius: 4px;

              mat-icon {
                font-size: 14px;
                width: 14px;
                height: 14px;
                color: #3b82f6;
                margin-top: 2px;
              }
            }
          }
        }
      }
    }

    /* Dialog Footer */
    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 24px;
      border-top: 1px solid #e5e7eb;
      background-color: #ffffff;

      .footer-left {
        display: flex;
        gap: 8px;
      }

      .footer-right {
        display: flex;
        gap: 10px;
      }

      .btn-cancel {
        height: 38px;
        padding: 0 16px;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        color: #4b5563;
        font-size: 13.5px;
        font-weight: 500;
        cursor: pointer;

        &:hover { background-color: #f3f4f6; }
      }

      .btn-secondary {
        height: 38px;
        padding: 0 14px;
        background: #ffffff;
        border: 1px solid #bfdbfe;
        color: #1a56db;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;

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

      .btn-primary {
        height: 38px;
        padding: 0 18px;
        background-color: #1e3a8a;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-size: 13.5px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        transition: all 0.15s;

        &:hover:not([disabled]) {
          background-color: #1d4ed8;
          box-shadow: 0 4px 10px rgba(30, 58, 138, 0.25);
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
  `]
})
export class ObjectDetailDialogComponent implements OnInit {
  isLoading = true;
  object: BusinessObject | null = null;
  inspections: Inspection[] = [];
  planHistory: any[] = [];
  singleCheckSummary: any = null;
  currentYear = new Date().getFullYear();
  selectedHistoryYear: number | 'all' = this.currentYear;

  get isInspectedThisYear(): boolean {
    return this.object?.lastCheckedYear === this.currentYear || this.singleCheckSummary?.conflictType === 'COMPLETED_INSPECTION';
  }

  get filteredPlanHistory(): any[] {
    if (this.selectedHistoryYear === 'all') {
      return this.planHistory;
    }
    return this.planHistory.filter(p => (p.year || this.currentYear) === this.selectedHistoryYear);
  }

  constructor(
    public dialogRef: MatDialogRef<ObjectDetailDialogComponent, ObjectDetailResult>,
    @Inject(MAT_DIALOG_DATA) public data: ObjectDetailDialogData,
    private api: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.data.object) {
      this.object = this.data.object;
    }

    const objectId = this.data.objectId || this.data.object?.id;
    if (objectId) {
      this.loadDetails(objectId);
    } else {
      this.isLoading = false;
    }
  }

  loadDetails(id: number): void {
    this.isLoading = true;
    this.api.get<any>(`/objects/${id}`).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.object = res.data;
          this.inspections = res.data.inspections || [];
          this.planHistory = res.data.planHistory || [];
          this.singleCheckSummary = res.data.singleCheckSummary || null;
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  getTypeLabel(type?: string): string {
    switch (type) {
      case 'enterprise': return 'Doanh nghiệp';
      case 'household': return 'Hộ kinh doanh';
      case 'individual': return 'Cá nhân KD';
      default: return 'Đối tượng kinh doanh';
    }
  }

  getTypeIcon(type?: string): string {
    switch (type) {
      case 'enterprise': return 'business';
      case 'household': return 'storefront';
      case 'individual': return 'person';
      default: return 'domain';
    }
  }

  getTypeAvatarClass(type?: string): string {
    switch (type) {
      case 'enterprise': return 'avatar-enterprise';
      case 'household': return 'avatar-household';
      case 'individual': return 'avatar-individual';
      default: return 'avatar-enterprise';
    }
  }

  getTypeBadgeClass(type?: string): string {
    switch (type) {
      case 'enterprise': return 'pill-enterprise';
      case 'household': return 'pill-household';
      case 'individual': return 'pill-individual';
      default: return 'pill-enterprise';
    }
  }

  getInspectionStatusClass(status?: string): string {
    switch (status) {
      case 'completed': return 'badge-approved';
      case 'in_progress': return 'badge-in_progress';
      case 'not_started': default: return 'badge-closed';
    }
  }

  getInspectionStatusLabel(status?: string): string {
    switch (status) {
      case 'completed': return 'Đã hoàn thành';
      case 'in_progress': return 'Đang thực hiện';
      case 'not_started': default: return 'Chưa bắt đầu';
    }
  }

  getPlanStatusLabel(status?: string): string {
    switch (status) {
      case 'approved': return 'Đã phê duyệt';
      case 'pending': return 'Đang chờ duyệt';
      case 'rejected': return 'Bị từ chối';
      case 'draft': default: return 'Bản nháp';
    }
  }

  getPlanStatusBadgeClass(status?: string): string {
    switch (status) {
      case 'approved': return 'badge-approved';
      case 'pending': return 'badge-in_progress';
      case 'rejected': return 'badge-rejected';
      case 'draft': default: return 'badge-closed';
    }
  }

  getTimelineItemClass(item: any): string {
    if (item.inspectionStatus === 'completed') return 'item-completed';
    if (item.planStatus === 'rejected') return 'item-rejected';
    if (item.planStatus === 'approved') return 'item-approved';
    if (item.planStatus === 'pending') return 'item-pending';
    return 'item-draft';
  }

  getTimelineMarkerIcon(item: any): string {
    if (item.inspectionStatus === 'completed') return 'check';
    if (item.planStatus === 'rejected') return 'close';
    if (item.planStatus === 'approved') return 'assignment_turned_in';
    if (item.planStatus === 'pending') return 'hourglass_empty';
    return 'edit';
  }

  formatQuarterDisplay(quarter?: string, year?: number): string {
    if (!quarter) return year ? `Năm ${year}` : '';
    if (/^Q([1-4])/i.test(quarter)) {
      return quarter.replace(/^Q([1-4])/i, 'Quý $1');
    }
    return quarter;
  }

  getSeverityClass(severity?: number): string {
    switch (severity) {
      case 3: return 'sev-3';
      case 2: return 'sev-2';
      case 1: default: return 'sev-1';
    }
  }

  getSeverityLabel(severity?: number): string {
    switch (severity) {
      case 3: return 'Nghiêm trọng (Mức 3)';
      case 2: return 'Trung bình (Mức 2)';
      case 1: default: return 'Nhẹ / Nhắc nhở (Mức 1)';
    }
  }

  getParsedList(raw?: string): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string') return [parsed];
    } catch {
      if (typeof raw === 'string' && raw.includes(',')) {
        return raw.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [raw];
    }
    return [];
  }

  formatDateTime(isoDate?: string): string {
    if (!isoDate) return '—';
    try {
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return isoDate;
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoDate;
    }
  }

  viewOnMap(): void {
    if (!this.object) return;
    this.dialogRef.close({ action: 'close' });
    this.router.navigate(['/map'], {
      queryParams: { search: this.object.name || this.object.taxCode || this.object.idNumber }
    });
  }

  onEdit(): void {
    if (!this.object) return;
    this.dialogRef.close({ action: 'edit', object: this.object });
  }

  onClose(): void {
    this.dialogRef.close({ action: 'close' });
  }
}

