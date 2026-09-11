import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { AuditLog, AuditDiffResponse, DiffItem } from '../../../core/models';

@Component({
  selector: 'app-log-diff-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="diff-dialog-container">
      <!-- Header -->
      <div class="dialog-header">
        <div class="title-with-badge">
          <mat-icon class="header-icon">difference</mat-icon>
          <div>
            <h2>Chi tiết So sánh Thay đổi (Audit Diff #{{ data.log.id }})</h2>
            <p class="subtitle">Truy vết snapshot dữ liệu trước & sau khi cập nhật trên hệ thống</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Loading State -->
      <div class="loading-box" *ngIf="isLoading">
        <mat-spinner diameter="36"></mat-spinner>
        <span>Đang phân tích và so sánh snapshot dữ liệu...</span>
      </div>

      <!-- Error State -->
      <div class="error-box" *ngIf="!isLoading && errorMessage">
        <mat-icon>error_outline</mat-icon>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Main Diff Content -->
      <div class="dialog-body" *ngIf="!isLoading && diffResponse">
        <!-- Metadata Chips Strip -->
        <div class="meta-strip">
          <div class="meta-chip">
            <span class="chip-label">Hành động:</span>
            <span class="badge-action">{{ diffResponse.log.action }}</span>
          </div>
          <div class="meta-chip">
            <span class="chip-label">Đối tượng:</span>
            <strong>{{ diffResponse.log.entityType }} (ID: {{ diffResponse.log.entityId || 'N/A' }})</strong>
          </div>
          <div class="meta-chip" *ngIf="diffResponse.log.ward">
            <span class="chip-label">Địa bàn Phường:</span>
            <span class="badge-ward"><mat-icon>location_on</mat-icon> {{ diffResponse.log.ward }}</span>
          </div>
          <div class="meta-chip">
            <span class="chip-label">Cán bộ thực hiện:</span>
            <strong>{{ diffResponse.log.userName }}</strong>
          </div>
          <div class="meta-chip" *ngIf="diffResponse.log.ipAddress">
            <span class="chip-label">IP:</span>
            <code>{{ diffResponse.log.ipAddress }}</code>
          </div>
          <div class="meta-chip">
            <span class="chip-label">Thời gian:</span>
            <span>{{ diffResponse.log.createdAt }}</span>
          </div>
        </div>

        <!-- Summary Banner -->
        <div class="summary-banner" [ngClass]="getSummaryBannerClass()">
          <div class="banner-icon-title">
            <mat-icon>{{ getSummaryIcon() }}</mat-icon>
            <div>
              <strong>{{ getSummaryTitle() }}</strong>
              <p *ngIf="diffResponse.summary.isUpdate">
                Phát hiện <strong>{{ diffResponse.summary.changedCount }}</strong> trường dữ liệu bị thay đổi trên tổng số <strong>{{ diffResponse.summary.totalFields }}</strong> trường được theo dõi.
              </p>
              <p *ngIf="diffResponse.summary.isCreate">
                Tạo mới bản ghi thành công với <strong>{{ diffResponse.summary.totalFields }}</strong> trường thông tin ban đầu.
              </p>
              <p *ngIf="diffResponse.summary.isDelete">
                Đã xóa bản ghi khỏi hệ thống. Dưới đây là snapshot dữ liệu trước khi xóa.
              </p>
            </div>
          </div>
          <span class="count-tag" *ngIf="diffResponse.summary.isUpdate">
            {{ diffResponse.summary.changedCount }} Thay đổi
          </span>
        </div>

        <!-- 2-Column Before/After Diff Table -->
        <div class="diff-table-card">
          <table class="diff-table">
            <thead>
              <tr>
                <th style="width: 26%;">Trường thông tin</th>
                <th style="width: 37%;">Trước khi sửa (Before)</th>
                <th style="width: 37%;">Sau khi sửa (After)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of diffResponse.diff" [class.row-changed]="item.isChanged">
                <td class="col-field">
                  <div class="field-title-wrap">
                    <mat-icon *ngIf="item.isChanged" class="changed-indicator-icon" matTooltip="Trường dữ liệu đã bị sửa đổi">
                      edit
                    </mat-icon>
                    <div>
                      <strong class="field-label">{{ item.label }}</strong>
                      <span class="field-key">{{ item.field }}</span>
                    </div>
                  </div>
                </td>
                <td class="col-val col-before" [class.val-highlight-old]="item.isChanged">
                  <div class="val-box">
                    <span *ngIf="item.oldValue === null || item.oldValue === undefined" class="empty-val">[Trống / Chưa có]</span>
                    <span *ngIf="item.oldValue !== null && item.oldValue !== undefined">{{ item.oldDisplay }}</span>
                  </div>
                </td>
                <td class="col-val col-after" [class.val-highlight-new]="item.isChanged">
                  <div class="val-box">
                    <span *ngIf="item.newValue === null || item.newValue === undefined" class="empty-val">[Đã xóa / Trống]</span>
                    <span *ngIf="item.newValue !== null && item.newValue !== undefined">{{ item.newDisplay }}</span>
                    <span *ngIf="item.isChanged" class="badge-changed-pill">Đổi mới</span>
                  </div>
                </td>
              </tr>
              <tr *ngIf="diffResponse.diff.length === 0">
                <td colspan="3" class="text-center py-4 text-muted">
                  Không có trường dữ liệu nào để so sánh.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <button mat-flat-button class="btn-close" (click)="dialogRef.close()">
          Đóng cửa sổ
        </button>
      </div>
    </div>
  `,
  styles: [`
    .diff-dialog-container {
      padding: 24px;
      min-width: 680px;
      max-width: 880px;
      background: #ffffff;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;

      .title-with-badge {
        display: flex;
        align-items: center;
        gap: 12px;

        .header-icon {
          color: #1e3a8a;
          font-size: 28px;
          width: 28px;
          height: 28px;
        }

        h2 {
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .subtitle {
          font-size: 12.5px;
          color: #64748b;
          margin: 2px 0 0 0;
        }
      }

      .close-btn { color: #9ca3af; }
    }

    .loading-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px 0;
      color: #64748b;
      font-size: 14px;
    }

    .error-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background-color: #fee2e2;
      color: #991b1b;
      border-radius: 6px;
      font-size: 13.5px;
    }

    .meta-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      background: #f8fafc;
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      margin-bottom: 14px;

      .meta-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12.5px;
        color: #334155;

        .chip-label {
          color: #64748b;
        }

        .badge-action {
          background: #dbeafe;
          color: #1e40af;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11.5px;
        }

        .badge-ward {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: #ecfdf5;
          color: #065f46;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11.5px;

          mat-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
          }
        }

        code {
          background: #f1f5f9;
          padding: 1px 6px;
          border-radius: 4px;
          font-family: monospace;
          color: #0f172a;
        }
      }
    }

    .summary-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;

      &.banner-update {
        background-color: #fffbeb;
        border: 1px solid #fde68a;
        color: #92400e;
      }

      &.banner-create {
        background-color: #ecfdf5;
        border: 1px solid #a7f3d0;
        color: #065f46;
      }

      &.banner-delete {
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
      }

      .banner-icon-title {
        display: flex;
        align-items: center;
        gap: 10px;

        mat-icon {
          font-size: 24px;
          width: 24px;
          height: 24px;
          flex-shrink: 0;
        }

        strong {
          font-size: 13.5px;
          display: block;
        }

        p {
          font-size: 12px;
          margin: 2px 0 0 0;
          opacity: 0.9;
        }
      }

      .count-tag {
        background: #f59e0b;
        color: #ffffff;
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 9999px;
        white-space: nowrap;
      }
    }

    .diff-table-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      max-height: 380px;
      overflow-y: auto;
    }

    .diff-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      thead th {
        position: sticky;
        top: 0;
        background-color: #f1f5f9;
        color: #1e3a8a;
        font-weight: 700;
        padding: 10px 14px;
        text-align: left;
        border-bottom: 2px solid #cbd5e1;
        z-index: 2;
      }

      tbody td {
        padding: 10px 14px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
      }

      /* Changed Row: Highlight in Yellow / Amber */
      .row-changed {
        background-color: #fef9c3 !important; /* Soft yellow highlight */

        .col-field {
          background-color: #fef08a;
          border-left: 4px solid #f59e0b;
        }

        .val-highlight-old {
          background-color: #fef3c7;
          color: #78350f;
          text-decoration: line-through;
          opacity: 0.85;
        }

        .val-highlight-new {
          background-color: #fef08a;
          color: #78350f;
          font-weight: 600;
        }
      }

      .field-title-wrap {
        display: flex;
        align-items: flex-start;
        gap: 6px;

        .changed-indicator-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #d97706;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .field-label {
          display: block;
          font-size: 12.5px;
          color: #1e293b;
        }

        .field-key {
          display: block;
          font-size: 11px;
          color: #64748b;
          font-family: monospace;
        }
      }

      .val-box {
        display: flex;
        flex-direction: column;
        gap: 4px;
        word-break: break-word;
        white-space: pre-wrap;
      }

      .empty-val {
        color: #94a3b8;
        font-style: italic;
      }

      .badge-changed-pill {
        display: inline-block;
        background: #f59e0b;
        color: #ffffff;
        font-size: 10.5px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
        width: fit-content;
        margin-top: 2px;
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      padding-top: 16px;
      margin-top: 16px;
      border-top: 1px solid #e5e7eb;

      .btn-close {
        height: 38px;
        padding: 0 22px;
        background-color: #1e3a8a;
        color: #ffffff;
        font-weight: 600;
        border-radius: 6px;
      }
    }
  `]
})
export class LogDiffDialogComponent implements OnInit {
  isLoading = true;
  errorMessage = '';
  diffResponse: AuditDiffResponse | null = null;

  constructor(
    public dialogRef: MatDialogRef<LogDiffDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { log: AuditLog },
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.fetchDiff();
  }

  fetchDiff(): void {
    if (!this.data?.log?.id) {
      this.errorMessage = 'Không có ID bản ghi nhật ký để so sánh.';
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.api.get<any>(`/audit-logs/${this.data.log.id}/diff`).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.success) {
          this.diffResponse = res;
        } else {
          this.errorMessage = res?.message || 'Không thể lấy dữ liệu so sánh.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Lỗi kết nối khi lấy so sánh nhật ký.';
      }
    });
  }

  getSummaryBannerClass(): string {
    if (!this.diffResponse) return 'banner-update';
    if (this.diffResponse.summary.isCreate) return 'banner-create';
    if (this.diffResponse.summary.isDelete) return 'banner-delete';
    return 'banner-update';
  }

  getSummaryIcon(): string {
    if (!this.diffResponse) return 'compare';
    if (this.diffResponse.summary.isCreate) return 'add_circle';
    if (this.diffResponse.summary.isDelete) return 'delete_forever';
    return 'edit_note';
  }

  getSummaryTitle(): string {
    if (!this.diffResponse) return 'So sánh dữ liệu';
    if (this.diffResponse.summary.isCreate) return 'Thao tác: Tạo mới bản ghi (CREATE)';
    if (this.diffResponse.summary.isDelete) return 'Thao tác: Xóa bản ghi (DELETE)';
    return 'Thao tác: Chỉnh sửa / Cập nhật dữ liệu (UPDATE)';
  }
}
