import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-document-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="doc-preview-modal">
      <div class="dialog-header">
        <div class="title-box">
          <mat-icon class="header-icon">description</mat-icon>
          <div>
            <h2>{{ data.title || 'Văn bản đã ký đính kèm (Bản Scan / Chữ ký + Dấu)' }}</h2>
            <span class="sub-title">{{ data.subtitle || 'Kế hoạch kiểm tra cơ sở' }}</span>
          </div>
        </div>
        <div class="header-actions">
          <a [href]="data.fileUrl" target="_blank" class="btn-open-external" matTooltip="Mở tab mới">
            <mat-icon>open_in_new</mat-icon>
            <span>Mở tab mới</span>
          </a>
          <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="preview-body">
        <!-- Image Preview -->
        <div *ngIf="isImage" class="image-container">
          <img [src]="data.fileUrl" alt="Văn bản đã ký" class="scanned-image" />
        </div>

        <!-- PDF Preview -->
        <div *ngIf="isPdf" class="pdf-container">
          <iframe [src]="data.fileUrl" class="pdf-frame" title="PDF Preview"></iframe>
        </div>

        <!-- Fallback if unknown format -->
        <div *ngIf="!isImage && !isPdf" class="fallback-container">
          <mat-icon class="file-icon">attach_file</mat-icon>
          <p>Không thể xem trước định dạng này trực tiếp trong trình duyệt.</p>
          <a [href]="data.fileUrl" target="_blank" download class="btn-download">
            <mat-icon>download</mat-icon>
            <span>Tải xuống văn bản</span>
          </a>
        </div>
      </div>

      <div class="dialog-footer">
        <div class="footer-note">
          <mat-icon>verified</mat-icon>
          <span>Văn bản lưu trữ có giá trị pháp lý làm căn cứ đối chiếu phê duyệt kế hoạch.</span>
        </div>
        <button type="button" class="btn-close" (click)="dialogRef.close()">
          Đóng
        </button>
      </div>
    </div>
  `,
  styles: [`
    .doc-preview-modal {
      padding: 20px;
      min-width: 680px;
      max-width: 900px;
      background: #ffffff;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 14px;

      .title-box {
        display: flex;
        align-items: center;
        gap: 10px;

        .header-icon {
          color: #1a56db;
          font-size: 26px;
          width: 26px;
          height: 26px;
        }

        h2 {
          font-size: 15.5px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .sub-title {
          font-size: 12px;
          color: #6b7280;
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;

        .btn-open-external {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12.5px;
          font-weight: 600;
          color: #1a56db;
          text-decoration: none;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid #bfdbfe;
          background-color: #eff6ff;
          transition: all 0.15s;

          &:hover {
            background-color: #dbeafe;
          }

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }
        }

        .close-btn { color: #9ca3af; }
      }
    }

    .preview-body {
      max-height: 520px;
      overflow-y: auto;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      justify-content: center;
      align-items: center;

      .image-container {
        width: 100%;
        display: flex;
        justify-content: center;

        .scanned-image {
          max-width: 100%;
          max-height: 480px;
          object-fit: contain;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
      }

      .pdf-container {
        width: 100%;
        height: 480px;

        .pdf-frame {
          width: 100%;
          height: 100%;
          border: none;
          border-radius: 4px;
        }
      }

      .fallback-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 40px 20px;
        gap: 12px;
        color: #4b5563;

        .file-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          color: #94a3b8;
        }

        .btn-download {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background-color: #1a56db;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
        }
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;

      .footer-note {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #059669;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #059669;
        }
      }

      .btn-close {
        height: 36px;
        padding: 0 20px;
        background-color: #f3f4f6;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;

        &:hover { background-color: #e5e7eb; }
      }
    }
  `]
})
export class DocumentPreviewDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<DocumentPreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { fileUrl: string; title?: string; subtitle?: string }
  ) {}

  get isImage(): boolean {
    const url = (this.data.fileUrl || '').toLowerCase();
    return url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.jpeg');
  }

  get isPdf(): boolean {
    const url = (this.data.fileUrl || '').toLowerCase();
    return url.endsWith('.pdf');
  }
}
