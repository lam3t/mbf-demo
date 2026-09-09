import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuditLog } from '../../../core/models';

@Component({
  selector: 'app-log-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="title-box">
          <mat-icon class="header-icon">receipt_long</mat-icon>
          <h2>Chi tiết Nhật ký Thao tác (Log #{{ data.log.id }})</h2>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <div class="log-meta-grid">
          <div class="meta-item">
            <span class="label">Thời gian:</span>
            <strong class="value">{{ data.log.createdAt }}</strong>
          </div>
          <div class="meta-item">
            <span class="label">Cán bộ thực hiện:</span>
            <strong class="value">{{ data.log.userName || data.log.username || 'Hệ thống' }}</strong>
          </div>
          <div class="meta-item">
            <span class="label">Hành động:</span>
            <span class="badge-status badge-in_progress">{{ data.log.action }}</span>
          </div>
          <div class="meta-item">
            <span class="label">Đối tượng tác động:</span>
            <strong class="value">{{ data.log.entityType }} (ID: {{ data.log.entityId || 'N/A' }})</strong>
          </div>
        </div>

        <div class="payload-box">
          <span class="payload-title">Dữ liệu chi tiết (Request Details / Payload):</span>
          <pre class="json-content">{{ formatJson(data.log.detail) }}</pre>
        </div>
      </div>

      <div class="dialog-footer">
        <button type="button" class="btn-primary" (click)="dialogRef.close()">
          Đóng
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 20px;
      min-width: 520px;
      max-width: 680px;
      background: #ffffff;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;

      .title-box {
        display: flex;
        align-items: center;
        gap: 10px;

        .header-icon {
          color: #1e3a8a;
          font-size: 24px;
          width: 24px;
          height: 24px;
        }

        h2 {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
      }

      .close-btn { color: #9ca3af; }
    }

    .dialog-content {
      padding: 8px 0;

      .log-meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        background: #f8fafc;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        margin-bottom: 16px;

        .meta-item {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .label {
            font-size: 11.5px;
            color: #64748b;
          }

          .value {
            font-size: 13px;
            color: #1e293b;
          }
        }
      }

      .payload-box {
        .payload-title {
          font-size: 12.5px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
          display: block;
        }

        .json-content {
          background: #0f172a;
          color: #38bdf8;
          padding: 12px 16px;
          border-radius: 6px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          max-height: 240px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;

      .btn-primary {
        height: 36px;
        padding: 0 20px;
        background-color: #1e3a8a;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
    }
  `]
})
export class LogDetailDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<LogDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { log: AuditLog }
  ) {}

  formatJson(detail?: string): string {
    if (!detail) return '{}';
    try {
      const parsed = JSON.parse(detail);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return detail;
    }
  }
}
