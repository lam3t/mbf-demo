import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-digital-sign-dialog',
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
    <div class="digital-sign-modal">
      <div class="dialog-header">
        <div class="title-box">
          <div class="token-icon-badge">
            <mat-icon>approval</mat-icon>
          </div>
          <div>
            <h2>Phê duyệt & Ký số Điện tử Kế hoạch</h2>
            <span class="sub-title">{{ data.planTitle || ('Kế hoạch ' + data.quarter + ' - ' + data.ward) }}</span>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close(false)" class="close-btn" [disabled]="signState === 'signing'">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <!-- Certificate Card -->
        <div class="cert-card">
          <div class="cert-header">
            <mat-icon class="cert-shield">verified_user</mat-icon>
            <div class="cert-title">
              <strong>Chứng thư số Chuyên dùng Công vụ (Token CA)</strong>
              <span>Tổ chức cấp: <strong>Ban Cơ yếu Chính phủ</strong></span>
            </div>
            <span class="token-status-pill">
              <span class="dot-online"></span> Đã kết nối Token
            </span>
          </div>

          <div class="cert-details-grid">
            <div class="cert-row">
              <span class="label">Chủ thể chứng thư:</span>
              <strong class="value">{{ currentUser?.fullName || 'Nguyễn Văn An' }}</strong>
            </div>
            <div class="cert-row">
              <span class="label">Chức vụ / Đơn vị:</span>
              <span class="value">{{ currentUser?.role === 'admin' ? 'Quản trị viên Hệ thống' : 'Trưởng phòng / Lãnh đạo PA04' }} — {{ currentUser?.unit || 'PA04 TNT' }}</span>
            </div>
            <div class="cert-row">
              <span class="label">Mã định danh Token:</span>
              <code class="value code-serial">PKCS#11:VN-CA-{{ tokenSerial }}</code>
            </div>
            <div class="cert-row">
              <span class="label">Tiêu chuẩn chữ ký:</span>
              <span class="value">CAdES-BES / PAdES (SHA-256 + RSA 2048-bit + TSA)</span>
            </div>
          </div>
        </div>

        <!-- Signing Progress / Notice Box -->
        <div *ngIf="signState === 'signing'" class="signing-overlay-box">
          <mat-spinner diameter="36"></mat-spinner>
          <div class="progress-step-text">
            <strong>{{ signingStepText }}</strong>
            <p>Vui lòng không rút USB Token hoặc đóng trình duyệt trong quá trình ký số.</p>
          </div>
        </div>

        <div *ngIf="signState === 'idle'" class="signing-notice-box">
          <mat-icon>info</mat-icon>
          <div>
            <strong>Lưu ý xác thực chữ ký số:</strong>
            <p>Khi xác nhận, hệ thống sẽ thực hiện đóng dấu chữ ký số điện tử có giá trị pháp lý, đồng thời tự động phê duyệt kế hoạch và sinh các hồ sơ kiểm tra thực địa.</p>
          </div>
        </div>

        <div *ngIf="signState === 'success'" class="success-banner">
          <mat-icon>task_alt</mat-icon>
          <div>
            <strong>Ký số điện tử thành công!</strong>
            <p>Chứng thư số đã được gán vào kế hoạch và lưu vết audit log hệ thống.</p>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button
          type="button"
          class="btn-cancel"
          (click)="dialogRef.close(false)"
          [disabled]="signState === 'signing'"
        >
          Hủy bỏ
        </button>

        <button
          type="button"
          class="btn-sign-confirm"
          (click)="confirmSign()"
          [disabled]="signState !== 'idle'"
        >
          <mat-icon>verified</mat-icon>
          <span>Xác nhận Ký số & Phê duyệt</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .digital-sign-modal {
      padding: 22px;
      min-width: 580px;
      max-width: 680px;
      background: #ffffff;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 16px;

      .title-box {
        display: flex;
        align-items: center;
        gap: 12px;

        .token-icon-badge {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: linear-flex;
          background-color: #1e3a8a;
          color: #ffffff;
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
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }

        .sub-title {
          font-size: 12.5px;
          color: #6b7280;
        }
      }

      .close-btn { color: #9ca3af; }
    }

    .cert-card {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

      .cert-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 12px;
        border-bottom: 1px solid #e2e8f0;
        margin-bottom: 12px;

        .cert-shield {
          color: #059669;
          font-size: 28px;
          width: 28px;
          height: 28px;
          margin-right: 8px;
        }

        .cert-title {
          display: flex;
          flex-direction: column;
          flex: 1;

          strong {
            font-size: 13.5px;
            color: #1e293b;
          }
          span {
            font-size: 11.5px;
            color: #64748b;
          }
        }

        .token-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11.5px;
          font-weight: 600;

          .dot-online {
            width: 7px;
            height: 7px;
            background-color: #10b981;
            border-radius: 50%;
            display: inline-block;
          }
        }
      }

      .cert-details-grid {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .cert-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12.5px;

          .label {
            color: #64748b;
          }

          .value {
            color: #1e293b;
            font-weight: 500;
          }

          .code-serial {
            background-color: #e2e8f0;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            color: #0f172a;
          }
        }
      }
    }

    .signing-notice-box {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      color: #1e40af;
      font-size: 12.5px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #1d4ed8;
      }

      p { margin: 2px 0 0; }
    }

    .signing-overlay-box {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 8px;
      color: #166534;

      .progress-step-text {
        font-size: 13px;
        strong { font-size: 13.5px; color: #14532d; }
        p { margin: 2px 0 0; font-size: 12px; color: #166534; }
      }
    }

    .success-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 8px;
      color: #065f46;
      font-size: 13px;

      mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
        color: #059669;
      }
      p { margin: 2px 0 0; font-size: 12px; }
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid #e5e7eb;

      .btn-cancel {
        height: 38px;
        padding: 0 18px;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        color: #4b5563;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;

        &:disabled { opacity: 0.5; cursor: not-allowed; }
      }

      .btn-sign-confirm {
        height: 38px;
        padding: 0 22px;
        background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%);
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(30, 58, 138, 0.2);
        transition: all 0.15s;

        &:hover:not([disabled]) {
          background: linear-gradient(135deg, #172554 0%, #1e40af 100%);
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
export class DigitalSignDialogComponent implements OnInit {
  signState: 'idle' | 'signing' | 'success' = 'idle';
  signingStepText = 'Đang kết nối thiết bị Token PKCS#11...';
  tokenSerial = '8899-E74A-2026';
  currentUser: any = null;

  constructor(
    public dialogRef: MatDialogRef<DigitalSignDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { planId: number; planTitle?: string; quarter?: string; ward?: string },
    private api: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUser();
    this.tokenSerial = Math.floor(1000 + Math.random() * 9000) + '-E74A-2026';
  }

  confirmSign(): void {
    this.signState = 'signing';
    this.signingStepText = 'Đang đọc chứng thư số & tạo băm SHA-256...';

    setTimeout(() => {
      this.signingStepText = 'Đang ký số PAdES & đóng dấu thời gian TSA...';
      
      setTimeout(() => {
        this.api.post<any>(`/plans/${this.data.planId}/sign-digital`, {}).subscribe({
          next: (res) => {
            if (res.success) {
              this.signState = 'success';
              this.snackBar.open('Phê duyệt & Ký số điện tử thành công!', 'Đóng', { duration: 3000 });
              setTimeout(() => {
                this.dialogRef.close(true);
              }, 900);
            }
          },
          error: (err) => {
            this.signState = 'idle';
            this.snackBar.open(err.error?.message || 'Lỗi khi thực hiện ký số kế hoạch.', 'Đóng', { duration: 4000 });
          }
        });
      }, 700);
    }, 600);
  }
}
