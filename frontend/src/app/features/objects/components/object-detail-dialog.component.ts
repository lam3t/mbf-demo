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

          <!-- Section: Lịch sử kiểm tra thực địa & Vi phạm -->
          <div class="section-card">
            <div class="section-header space-between">
              <div class="header-left">
                <mat-icon class="section-icon">fact_check</mat-icon>
                <h3>Lịch sử Kiểm tra Thực địa & Xử lý Vi phạm</h3>
              </div>
              <span class="count-pill">{{ inspections.length }} đợt kiểm tra</span>
            </div>

            <!-- Empty State -->
            <div *ngIf="inspections.length === 0" class="empty-inspection-box">
              <mat-icon class="empty-icon">verified_user</mat-icon>
              <div class="empty-text">
                <strong>Chưa có đợt kiểm tra thực địa nào</strong>
                <p>Đối tượng kinh doanh này chưa phát sinh biên bản hoặc đợt kiểm tra thực địa trên hệ thống.</p>
              </div>
            </div>

            <!-- Inspection List -->
            <div *ngIf="inspections.length > 0" class="inspections-list">
              <div *ngFor="let insp of inspections; let i = index" class="inspection-card" [class.locked]="insp.isLocked">
                <div class="insp-header">
                  <div class="insp-title-box">
                    <span class="insp-number">#{{ insp.id }}</span>
                    <strong class="insp-quarter">{{ insp.planQuarter || 'Kế hoạch kiểm tra' }}</strong>
                    <span class="insp-date">{{ formatDateTime(insp.completedAt || insp.createdAt) }}</span>
                  </div>
                  <div class="insp-badges">
                    <span class="badge-status" [ngClass]="getInspectionStatusClass(insp.status)">
                      {{ getInspectionStatusLabel(insp.status) }}
                    </span>
                    <span *ngIf="insp.isLocked" class="locked-tag" title="Hồ sơ đã chốt & khóa theo RULE-03">
                      <mat-icon>lock</mat-icon> Đã khóa
                    </span>
                  </div>
                </div>

                <div class="insp-body">
                  <div class="insp-meta-row">
                    <div class="meta-col">
                      <span class="meta-label">Mức độ vi phạm:</span>
                      <span class="severity-tag" [ngClass]="getSeverityClass(insp.severity)">
                        {{ getSeverityLabel(insp.severity) }}
                      </span>
                    </div>
                    <div class="meta-col" *ngIf="insp.ward">
                      <span class="meta-label">Địa bàn kiểm tra:</span>
                      <span>{{ insp.ward }}</span>
                    </div>
                  </div>

                  <!-- Violation Codes -->
                  <div class="violation-codes-box" *ngIf="getParsedList(insp.violationCodes).length > 0">
                    <span class="meta-label">Hành vi vi phạm ghi nhận:</span>
                    <div class="chips-row">
                      <span *ngFor="let code of getParsedList(insp.violationCodes)" class="chip-violation">
                        <mat-icon>warning_amber</mat-icon>
                        {{ code }}
                      </span>
                    </div>
                  </div>

                  <!-- Recommendation & Tags -->
                  <div class="recommendation-box" *ngIf="insp.recommendationNote">
                    <span class="meta-label">Ghi chú & Đề xuất kiến nghị:</span>
                    <p class="rec-note">{{ insp.recommendationNote }}</p>
                    <div class="chips-row" *ngIf="getParsedList(insp.recommendationTags).length > 0">
                      <span *ngFor="let tag of getParsedList(insp.recommendationTags)" class="chip-tag">
                        #{{ tag }}
                      </span>
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
  currentYear = new Date().getFullYear();

  get isInspectedThisYear(): boolean {
    return this.object?.lastCheckedYear === this.currentYear;
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
