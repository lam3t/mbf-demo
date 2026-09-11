import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="import-dialog-container">
      <div class="dialog-header">
        <div class="title-with-icon">
          <mat-icon class="header-icon">upload_file</mat-icon>
          <h2>Import Danh sách Đối tượng từ File Excel</h2>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <!-- Step 1: Download Template -->
        <div class="step-card">
          <div class="step-badge">Bước 1</div>
          <div class="step-content">
            <strong>Tải xuống file mẫu chuẩn Excel (.xlsx):</strong>
            <p>File mẫu gồm 3 sheet tương ứng 3 loại hình: Doanh nghiệp, Hộ kinh doanh, Cá nhân kinh doanh.</p>
            <button type="button" class="btn-download-tpl" (click)="downloadTemplate()">
              <mat-icon>cloud_download</mat-icon>
              <span>Tải file Excel mẫu</span>
            </button>
          </div>
        </div>

        <!-- Step 2: Upload File -->
        <div class="step-card">
          <div class="step-badge">Bước 2</div>
          <div class="step-content">
            <strong>Chọn file dữ liệu để tải lên:</strong>
            <div
              class="drop-zone"
              [class.has-file]="!!selectedFile"
              (click)="fileInput.click()"
              (dragover)="onDragOver($event)"
              (drop)="onDrop($event)"
            >
              <input
                #fileInput
                type="file"
                accept=".xlsx, .xls, .csv"
                style="display: none;"
                (change)="onFileSelected($event)"
              />
              <mat-icon class="upload-icon">{{ selectedFile ? 'task' : 'upload' }}</mat-icon>
              <span *ngIf="!selectedFile">Kéo thả file vào đây hoặc bấm để chọn file (.xlsx, .xls, .csv)</span>
              <strong *ngIf="selectedFile" class="file-name">{{ selectedFile.name }} ({{ formatFileSize(selectedFile.size) }})</strong>
            </div>
          </div>
        </div>

        <!-- Step 3: Result View -->
        <div *ngIf="importResult" class="result-section">
          <div class="result-summary" [class.success]="importResult.successCount > 0">
            <mat-icon>{{ importResult.successCount > 0 ? 'check_circle' : 'error' }}</mat-icon>
            <div>
              <strong>Kết quả Import:</strong>
              <p>Đã thêm thành công <strong>{{ importResult.successCount }}</strong> bản ghi hợp lệ.</p>
            </div>
          </div>

          <!-- Error Rows Table -->
          <div *ngIf="importResult.errors && importResult.errors.length > 0" class="error-table-box">
            <span class="error-title">Danh sách các dòng lỗi không được thêm ({{ importResult.errors.length }} dòng):</span>
            <div class="error-table-scroll">
              <table class="error-table">
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Sheet / Loại</th>
                    <th>Mã định danh</th>
                    <th>Lý do lỗi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let err of importResult.errors">
                    <td class="text-center">{{ err.row }}</td>
                    <td>{{ err.sheet || 'Doanh nghiệp' }}</td>
                    <td><code>{{ err.identifier || '-' }}</code></td>
                    <td class="text-danger">{{ err.reason }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button type="button" class="btn-cancel" (click)="dialogRef.close(hasImported)">
          {{ importResult ? 'Đóng' : 'Hủy bỏ' }}
        </button>
        <button
          *ngIf="!importResult"
          type="button"
          class="btn-import-submit"
          [disabled]="!selectedFile || isUploading"
          (click)="uploadAndImport()"
        >
          <mat-spinner diameter="18" *ngIf="isUploading"></mat-spinner>
          <mat-icon *ngIf="!isUploading">cloud_upload</mat-icon>
          <span>{{ isUploading ? 'Đang xử lý...' : 'Tiến hành Import' }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .import-dialog-container {
      padding: 24px;
      min-width: 560px;
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

      .title-with-icon {
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
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
      }

      .close-btn { color: #9ca3af; }
    }

    .dialog-body {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .step-card {
      display: flex;
      gap: 14px;
      padding: 14px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;

      .step-badge {
        height: 26px;
        padding: 0 8px;
        background-color: #1e3a8a;
        color: #ffffff;
        font-size: 11.5px;
        font-weight: 700;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .step-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;

        strong {
          font-size: 13px;
          color: #1f2937;
        }

        p {
          font-size: 12px;
          color: #64748b;
          margin: 0;
        }

        .btn-download-tpl {
          margin-top: 4px;
          align-self: flex-start;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 14px;
          background-color: #ffffff;
          border: 1px solid #1e3a8a;
          border-radius: 6px;
          color: #1e3a8a;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;

          &:hover {
            background-color: #eff6ff;
          }

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }
      }
    }

    .drop-zone {
      margin-top: 4px;
      border: 2px dashed #cbd5e1;
      border-radius: 8px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      background-color: #ffffff;
      transition: all 0.15s ease;

      .upload-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #94a3b8;
      }

      span {
        font-size: 12.5px;
        color: #64748b;
      }

      .file-name {
        color: #1e3a8a;
        font-size: 13px;
      }

      &:hover, &.has-file {
        border-color: #1a56db;
        background-color: #f0f7ff;
        .upload-icon { color: #1a56db; }
      }
    }

    .result-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 6px;

      .result-summary {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 8px;
        background-color: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;

        mat-icon {
          font-size: 26px;
          width: 26px;
          height: 26px;
          color: #16a34a;
        }

        strong { font-size: 13.5px; }
        p { margin: 2px 0 0; font-size: 12.5px; }
      }

      .error-table-box {
        .error-title {
          font-size: 12.5px;
          font-weight: 700;
          color: #dc2626;
          margin-bottom: 6px;
          display: block;
        }

        .error-table-scroll {
          max-height: 180px;
          overflow-y: auto;
          border: 1px solid #fee2e2;
          border-radius: 6px;
        }

        .error-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;

          th {
            background-color: #fef2f2;
            padding: 8px 10px;
            color: #991b1b;
            font-weight: 600;
            border-bottom: 1px solid #fecaca;
          }

          td {
            padding: 8px 10px;
            border-bottom: 1px solid #fef2f2;
          }

          .text-danger { color: #dc2626; }
          .text-center { text-align: center; }
        }
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;

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

      .btn-import-submit {
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
export class ImportDialogComponent {
  selectedFile: File | null = null;
  isUploading = false;
  hasImported = false;
  importResult: { successCount: number; errors: any[] } | null = null;

  constructor(
    public dialogRef: MatDialogRef<ImportDialogComponent>,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.importResult = null;
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.selectedFile = event.dataTransfer.files[0];
      this.importResult = null;
    }
  }

  downloadTemplate(): void {
    this.http.get('/api/objects/import/template', { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = reader.result as string;
          a.setAttribute('download', 'Mau_Import_Doi_Tuong_MBF.xlsx');
          a.download = 'Mau_Import_Doi_Tuong_MBF.xlsx';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            if (a.parentNode) {
              document.body.removeChild(a);
            }
          }, 500);
        };
        reader.readAsDataURL(blob);
      },
      error: () => {
        this.snackBar.open('Lỗi tải file mẫu', 'Đóng', { duration: 2500 });
      }
    });
  }

  uploadAndImport(): void {
    if (!this.selectedFile) return;

    this.isUploading = true;
    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.http.post<any>('/api/objects/import', formData).subscribe({
      next: (res) => {
        this.isUploading = false;
        if (res.success) {
          this.hasImported = true;
          this.importResult = {
            successCount: res.successCount,
            errors: res.errors || []
          };
          this.snackBar.open(`Import hoàn tất! Thành công ${res.successCount} bản ghi.`, 'Đóng', { duration: 3000 });
        }
      },
      error: (err) => {
        this.isUploading = false;
        this.snackBar.open(err.error?.message || 'Lỗi khi import file', 'Đóng', { duration: 3000 });
      }
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }
}
