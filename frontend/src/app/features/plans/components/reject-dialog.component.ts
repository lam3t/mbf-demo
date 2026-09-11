import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-reject-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="title-box">
          <mat-icon class="header-icon">cancel</mat-icon>
          <h2>{{ data.title || 'Từ chối Kế hoạch Kiểm tra' }}</h2>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <p class="desc-text" *ngIf="data.message">
          {{ data.message }}
        </p>
        <p class="desc-text" *ngIf="!data.message && data.planName">
          Kế hoạch <strong>{{ data.planName }}</strong> sẽ được chuyển về trạng thái <strong>Bản nháp</strong> để đơn vị phường chỉnh sửa lại.
        </p>

        <mat-form-field appearance="outline" class="w-100">
          <mat-label>Lý do từ chối (Bắt buộc) *</mat-label>
          <textarea
            matInput
            rows="4"
            [(ngModel)]="reason"
            [placeholder]="data.placeholder || 'vd: Chưa đạt đủ điều kiện theo quy chế, danh sách có đối tượng đã kiểm tra trong năm...'"
            required
          ></textarea>
        </mat-form-field>
      </div>

      <div class="dialog-footer">
        <button type="button" class="btn-cancel" (click)="dialogRef.close()">
          Hủy bỏ
        </button>
        <button
          type="button"
          class="btn-reject"
          [disabled]="!reason.trim()"
          (click)="onConfirm()"
        >
          <mat-icon>send</mat-icon>
          <span>Xác nhận Từ chối</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 20px;
      min-width: 440px;
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
          color: #dc2626;
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

    .desc-text {
      font-size: 13px;
      color: #4b5563;
      margin-bottom: 14px;
      line-height: 1.4;
    }

    .w-100 { width: 100%; }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 14px;
      border-top: 1px solid #e5e7eb;

      .btn-cancel {
        height: 38px;
        padding: 0 16px;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        color: #4b5563;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
      }

      .btn-reject {
        height: 38px;
        padding: 0 18px;
        background-color: #dc2626;
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
          background-color: #b91c1c;
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
export class RejectDialogComponent {
  reason = '';

  constructor(
    public dialogRef: MatDialogRef<RejectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { planName?: string; title?: string; message?: string; placeholder?: string }
  ) {}

  onConfirm(): void {
    if (this.reason.trim()) {
      this.dialogRef.close(this.reason.trim());
    }
  }
}
