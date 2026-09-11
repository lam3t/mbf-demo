import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { Plan, DigitalCertificateInfo } from '../../../core/models';
import { DocumentPreviewDialogComponent } from './document-preview-dialog.component';

@Component({
  selector: 'app-plan-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="title-box">
          <mat-icon class="header-icon">event_note</mat-icon>
          <h2>Chi tiết Kế hoạch {{ plan?.quarter }} - {{ plan?.ward }}</h2>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <div *ngIf="isLoading" class="loading-box">
          <mat-spinner diameter="30"></mat-spinner>
          <span>Đang tải thông tin chi tiết...</span>
        </div>

        <div *ngIf="!isLoading && plan" class="plan-info-body">
          <div class="meta-grid">
            <div class="meta-item">
              <span class="label">Trạng thái:</span>
              <span class="badge-status" [ngClass]="getBadgeClass(plan.status)">
                {{ getStatusLabel(plan.status) }}
              </span>
            </div>
            <div class="meta-item">
              <span class="label">Đơn vị quản lý:</span>
              <strong>{{ plan.ward }}</strong>
            </div>
            <div class="meta-item">
              <span class="label">Người trình duyệt:</span>
              <span>{{ plan.submittedByName || 'Chưa trình' }}</span>
            </div>
            <div class="meta-item">
              <span class="label">Thời điểm trình:</span>
              <span>{{ plan.submittedAt || '—' }}</span>
            </div>
          </div>

          <!-- Digital Signature / Approval Status Card -->
          <div class="signature-section" *ngIf="plan.status === 'approved'">
            <!-- Token Digital Signature Details -->
            <div *ngIf="hasDigitalTokenSignature()" class="digital-cert-banner">
              <div class="cert-banner-header">
                <div class="badge-signed-token">
                  <mat-icon>verified</mat-icon>
                  <span>ĐÃ KÝ SỐ ĐIỆN TỬ</span>
                </div>
                <span class="cert-issuer-badge">
                  <mat-icon>shield</mat-icon>
                  <span>{{ getCertInfo()?.issuer || 'Ban Cơ yếu Chính phủ (demo)' }}</span>
                </span>
              </div>

              <div class="cert-meta-grid">
                <div class="cert-field">
                  <span class="cert-label">Mã chứng thư (Serial Number):</span>
                  <code class="cert-code">{{ getCertInfo()?.serialNumber || '54:02:AA:7E:2026' }}</code>
                </div>
                <div class="cert-field">
                  <span class="cert-label">Người ký số & chức vụ:</span>
                  <strong>{{ plan.digitalSignature?.signedByName || plan.approvedByName || 'Lãnh đạo TNT' }} ({{ plan.digitalSignature?.signedByRole === 'admin' ? 'Quản trị viên' : 'Trưởng phòng / Giám đốc' }})</strong>
                </div>
                <div class="cert-field">
                  <span class="cert-label">Thời gian đóng dấu số:</span>
                  <span>{{ getCertInfo()?.signedAt || plan.approvedAt || '—' }}</span>
                </div>
                <div class="cert-field">
                  <span class="cert-label">Phương thức xác thực:</span>
                  <span class="text-success">USB PKCS#11 Token CA (Chuyên dùng Công vụ)</span>
                </div>
              </div>
            </div>

            <!-- Standard Approval Badge -->
            <div *ngIf="!hasDigitalTokenSignature()" class="standard-approve-banner">
              <div class="badge-standard-approve">
                <mat-icon>check_circle</mat-icon>
                <span>Duyệt thường (Chưa ký số điện tử)</span>
              </div>
              <p class="standard-note">
                Kế hoạch được phê duyệt bởi: <strong>{{ plan.approvedByName || 'Cán bộ TNT' }}</strong> vào ngày {{ plan.approvedAt || '—' }}.
              </p>
            </div>
          </div>

          <!-- Signed Scan Document Attachment Box -->
          <div class="attachment-section">
            <div class="attach-header">
              <mat-icon>attachment</mat-icon>
              <strong>Văn bản scan đã ký đính kèm:</strong>
            </div>
            
            <div *ngIf="plan.signedDocumentUrl" class="attach-card">
              <div class="attach-info">
                <mat-icon class="pdf-icon">picture_as_pdf</mat-icon>
                <div class="attach-names">
                  <strong>Van_ban_trinh_duyet_{{ plan.ward.replace(' ', '_') }}.pdf</strong>
                  <span>Tải lên lúc: {{ plan.signedDocumentUploadedAt || plan.submittedAt || '—' }}</span>
                </div>
              </div>
              <button type="button" class="btn-preview-doc" (click)="openDocumentPreview()">
                <mat-icon>visibility</mat-icon>
                <span>Xem văn bản scan</span>
              </button>
            </div>

            <div *ngIf="!plan.signedDocumentUrl" class="no-attach-note">
              <mat-icon>info_outline</mat-icon>
              <span>Chưa có văn bản scan đính kèm cho kế hoạch này.</span>
            </div>
          </div>

          <div *ngIf="plan.rejectReason" class="reject-banner">
            <mat-icon>info</mat-icon>
            <div>
              <strong>Lý do từ chối:</strong>
              <p>{{ plan.rejectReason }}</p>
            </div>
          </div>

          <div class="objects-section">
            <h3>Danh sách cơ sở kiểm tra ({{ plan.items?.length || 0 }} đối tượng):</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Loại hình</th>
                  <th>Mã số (MST/CCCD)</th>
                  <th>Tên cơ sở kinh doanh</th>
                  <th>Địa chỉ</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let it of plan.items; let i = index">
                  <td>{{ i + 1 }}</td>
                  <td>
                    <span class="type-pill">{{ it.type === 'enterprise' ? 'Doanh nghiệp' : (it.type === 'household' ? 'Hộ KD' : 'Cá nhân') }}</span>
                  </td>
                  <td><code>{{ it.taxCode || it.idNumber }}</code></td>
                  <td><strong>{{ it.name }}</strong></td>
                  <td>{{ it.address }}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
      padding: 24px;
      min-width: 680px;
      max-width: 840px;
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
        gap: 8px;

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

    .loading-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      gap: 10px;
      color: #64748b;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background-color: #f8fafc;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      margin-bottom: 14px;

      .meta-item {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .label {
          font-size: 11px;
          color: #64748b;
        }

        strong, span {
          font-size: 12.5px;
          color: #1f2937;
        }
      }
    }

    /* Signature Section */
    .signature-section {
      margin-bottom: 14px;

      .digital-cert-banner {
        background: #f0fdf4;
        border: 1.5px solid #86efac;
        border-radius: 8px;
        padding: 14px 16px;

        .cert-banner-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 10px;
          border-bottom: 1px solid #bbf7d0;
          margin-bottom: 10px;

          .badge-signed-token {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #059669;
            color: #ffffff;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
            letter-spacing: 0.5px;

            mat-icon { font-size: 16px; width: 16px; height: 16px; }
          }

          .cert-issuer-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #166534;
            font-weight: 600;

            mat-icon { font-size: 15px; width: 15px; height: 15px; color: #059669; }
          }
        }

        .cert-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px 16px;

          .cert-field {
            display: flex;
            flex-direction: column;
            gap: 1px;
            font-size: 12px;

            .cert-label { color: #64748b; font-size: 11px; }
            .cert-code { background: #dcfce7; padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 11px; color: #14532d; }
            .text-success { color: #047857; font-weight: 600; }
          }
        }
      }

      .standard-approve-banner {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 12px 14px;
        display: flex;
        align-items: center;
        gap: 12px;

        .badge-standard-approve {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #e2e8f0;
          color: #334155;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;

          mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; }
        }

        .standard-note {
          margin: 0;
          font-size: 12.5px;
          color: #475569;
        }
      }
    }

    /* Attachment Section */
    .attachment-section {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;

      .attach-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: #1e3a8a;
        margin-bottom: 8px;

        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .attach-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        padding: 8px 12px;
        border-radius: 6px;

        .attach-info {
          display: flex;
          align-items: center;
          gap: 10px;

          .pdf-icon { color: #dc2626; font-size: 24px; width: 24px; height: 24px; }
          .attach-names {
            display: flex;
            flex-direction: column;
            gap: 1px;

            strong { font-size: 12.5px; color: #1e293b; }
            span { font-size: 11px; color: #64748b; }
          }
        }

        .btn-preview-doc {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          background-color: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;

          &:hover { background-color: #dbeafe; }
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }

      .no-attach-note {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #94a3b8;

        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
    }

    .reject-banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      color: #991b1b;
      margin-bottom: 16px;
      font-size: 12.5px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #dc2626;
      }

      p { margin: 2px 0 0; }
    }

    .objects-section {
      h3 {
        font-size: 13.5px;
        font-weight: 700;
        color: #1e3a8a;
        margin-bottom: 8px;
      }

      .items-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12.5px;
        max-height: 280px;

        th {
          background-color: #f8fafc;
          padding: 8px 10px;
          border-bottom: 1px solid #e5e7eb;
          color: #4b5563;
          font-weight: 600;
          text-align: left;
        }

        td {
          padding: 8px 10px;
          border-bottom: 1px solid #f1f5f9;
        }

        .type-pill {
          background-color: #e0f2fe;
          color: #0284c7;
          font-size: 11px;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 4px;
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
export class PlanDetailDialogComponent implements OnInit {
  isLoading = true;
  plan: Plan | null = null;

  constructor(
    public dialogRef: MatDialogRef<PlanDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { planId: number },
    private api: ApiService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.api.get<any>(`/plans/${this.data.planId}`).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.plan = res.data;
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  hasDigitalTokenSignature(): boolean {
    return this.plan?.digitalSignature?.signatureType === 'digital_token';
  }

  getCertInfo(): DigitalCertificateInfo | null {
    const cert = this.plan?.digitalSignature?.certificateInfo;
    if (!cert) return null;
    if (typeof cert === 'string') {
      try {
        return JSON.parse(cert) as DigitalCertificateInfo;
      } catch {
        return null;
      }
    }
    return cert as DigitalCertificateInfo;
  }

  openDocumentPreview(): void {
    if (this.plan?.signedDocumentUrl) {
      this.dialog.open(DocumentPreviewDialogComponent, {
        width: '760px',
        data: {
          fileUrl: this.plan.signedDocumentUrl,
          title: `Văn bản đã ký - ${this.plan.ward}`,
          subtitle: `Kế hoạch ${this.plan.quarter}`
        }
      });
    }
  }

  getBadgeClass(status?: string): string {
    switch (status) {
      case 'approved': return 'badge-approved';
      case 'pending': return 'badge-pending';
      case 'rejected': return 'badge-danger';
      case 'draft': default: return 'badge-closed';
    }
  }

  getStatusLabel(status?: string): string {
    switch (status) {
      case 'approved': return 'Đã phê duyệt';
      case 'pending': return 'Chờ phê duyệt';
      case 'rejected': return 'Từ chối (Bản nháp)';
      case 'draft': default: return 'Bản nháp';
    }
  }
}

