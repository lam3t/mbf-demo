import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { Plan } from '../../../core/models';

@Component({
  selector: 'app-plan-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
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
      min-width: 640px;
      max-width: 800px;
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
      margin-bottom: 16px;

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
    private api: ApiService
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
