import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface CrossWardConflictItem {
  objectId: number;
  objectName: string;
  taxCode?: string;
  address?: string;
  otherPlanId: number;
  otherWard: string;
  otherQuarter: string;
  otherStatus: string;
}

export interface ConflictDialogData {
  planId: number;
  planTitle?: string;
  ward: string;
  quarter: string;
  conflicts: CrossWardConflictItem[];
  isDigitalSign?: boolean;
}

export interface ConflictResolutionResult {
  confirmed: boolean;
  resolutionMode: 'merge_joint' | 'select_single';
  jointDate?: string;
  participatingWards?: string[];
  leaderComment?: string;
}

@Component({
  selector: 'app-plan-approval-conflict-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="title-box">
          <div class="header-icon-wrap">
            <mat-icon>handshake</mat-icon>
          </div>
          <div>
            <h2>Cảnh báo trùng lặp kế hoạch kiểm tra liên phường</h2>
            <p class="subtitle">
              Phát hiện <strong>{{ data.conflicts.length }} doanh nghiệp</strong> trong {{ data.planTitle || ('Kế hoạch ' + data.ward) }} 
              đồng thời nằm trong kế hoạch chưa kiểm tra của Phường/Xã khác.
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <!-- Conflicting Objects List -->
        <div class="conflicts-card">
          <div class="card-title">
            <mat-icon>warning_amber</mat-icon>
            <span>Danh sách đối tượng trùng kế hoạch:</span>
          </div>
          <div class="conflicts-table-wrap">
            <table class="conflicts-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cơ sở kinh doanh</th>
                  <th>Mã số thuế</th>
                  <th>Đơn vị lập kế hoạch hiện tại</th>
                  <th>Đơn vị trùng kế hoạch khác</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let c of data.conflicts; let i = index">
                  <td>{{ i + 1 }}</td>
                  <td><strong>{{ c.objectName }}</strong></td>
                  <td><code>{{ c.taxCode || 'N/A' }}</code></td>
                  <td><span class="ward-tag current">{{ data.ward }} ({{ data.quarter }})</span></td>
                  <td><span class="ward-tag other">{{ c.otherWard }} ({{ c.otherQuarter }})</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Resolution Options Selection -->
        <div class="options-section">
          <h3 class="section-title">Lựa chọn phương án xử lý phê duyệt:</h3>

          <!-- Option 1: Merge Joint Plan (Recommended) -->
          <div 
            class="option-card" 
            [class.active]="selectedMode === 'merge_joint'"
            (click)="selectedMode = 'merge_joint'">
            <div class="option-header">
              <mat-radio-button 
                [checked]="selectedMode === 'merge_joint'" 
                (change)="selectedMode = 'merge_joint'"
                color="primary">
              </mat-radio-button>
              <div class="option-title-block">
                <div class="title-row">
                  <strong class="option-name">Phương án 1: Gộp thành 1 Kế hoạch Kiểm tra Liên ngành (2 Phường cùng làm)</strong>
                  <span class="badge-recommended">Khuyến nghị</span>
                </div>
                <p class="option-desc">
                  Phê duyệt kế hoạch với tư cách Đoàn kiểm tra liên ngành. Hệ thống sẽ tự động gửi thông báo điều phối 
                  tới <strong>{{ data.ward }}</strong> và các Phường liên quan để thống nhất 1 ngày kiểm tra duy nhất, tránh gây phiền hà cho doanh nghiệp.
                </p>
              </div>
            </div>

            <!-- Option 1 Sub-inputs -->
            <div class="option-inputs-wrap" *ngIf="selectedMode === 'merge_joint'">
              <div class="form-row">
                <div class="form-field-group">
                  <label class="field-label">Ngày kiểm tra chung dự kiến:</label>
                  <input 
                    type="date" 
                    class="custom-date-input" 
                    [(ngModel)]="jointDate"
                    [min]="todayStr"
                  />
                </div>
                <div class="form-field-group flex-2">
                  <label class="field-label">Các đơn vị phối hợp tham gia:</label>
                  <div class="participating-chips">
                    <span *ngFor="let w of participatingWards" class="unit-chip">
                      <mat-icon>apartment</mat-icon>
                      {{ w }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Option 2: Select Single Ward Plan -->
          <div 
            class="option-card" 
            [class.active]="selectedMode === 'select_single'"
            (click)="selectedMode = 'select_single'">
            <div class="option-header">
              <mat-radio-button 
                [checked]="selectedMode === 'select_single'" 
                (change)="selectedMode = 'select_single'"
                color="primary">
              </mat-radio-button>
              <div class="option-title-block">
                <strong class="option-name">Phương án 2: Duyệt kế hoạch của {{ data.ward }} & Từ chối ở các Phường khác</strong>
                <p class="option-desc">
                  Ưu tiên phê duyệt kế hoạch cho <strong>{{ data.ward }}</strong>. Các đối tượng trùng lặp trong kế hoạch của 
                  các Phường khác sẽ tự động bị từ chối/loại bỏ để đảm bảo nguyên tắc Single Check (1 năm/1 lần).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button type="button" class="btn-cancel" (click)="dialogRef.close()" [disabled]="isSubmitting">
          Hủy bỏ
        </button>
        <button 
          type="button" 
          class="btn-confirm-approve"
          [class.btn-joint]="selectedMode === 'merge_joint'"
          [class.btn-single]="selectedMode === 'select_single'"
          (click)="confirmApproval()"
          [disabled]="isSubmitting">
          <mat-spinner diameter="18" *ngIf="isSubmitting"></mat-spinner>
          <mat-icon *ngIf="!isSubmitting">{{ selectedMode === 'merge_joint' ? 'handshake' : 'done_all' }}</mat-icon>
          <span>
            {{ data.isDigitalSign ? 'Ký số điện tử &' : 'Xác nhận' }} 
            {{ selectedMode === 'merge_joint' ? 'Phê duyệt Liên ngành' : 'Duyệt ưu tiên' }}
          </span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 24px;
      max-width: 780px;
      background: #ffffff;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid #e2e8f0;

      .title-box {
        display: flex;
        align-items: flex-start;
        gap: 14px;

        .header-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          color: #b45309;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          mat-icon {
            font-size: 26px;
            width: 26px;
            height: 26px;
          }
        }

        h2 {
          font-size: 16.5px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 4px 0;
        }

        .subtitle {
          font-size: 13px;
          color: #475569;
          margin: 0;
          line-height: 1.4;

          strong { color: #b45309; }
        }
      }

      .close-btn { color: #94a3b8; }
    }

    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      max-height: 520px;
      overflow-y: auto;
    }

    .conflicts-card {
      background: #fffdf5;
      border: 1.5px solid #fef08a;
      border-radius: 8px;
      padding: 12px 14px;

      .card-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 700;
        color: #854d0e;
        margin-bottom: 8px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #d97706;
        }
      }

      .conflicts-table-wrap {
        max-height: 140px;
        overflow-y: auto;
        background: #ffffff;
        border-radius: 6px;
        border: 1px solid #fef08a;
      }

      .conflicts-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;

        th {
          background: #fefce8;
          padding: 6px 10px;
          font-weight: 600;
          color: #713f12;
          text-align: left;
          border-bottom: 1px solid #fef08a;
        }

        td {
          padding: 6px 10px;
          border-bottom: 1px solid #fef9c3;
          color: #1e293b;
        }

        .ward-tag {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 11px;

          &.current {
            background: #dbeafe;
            color: #1d4ed8;
          }

          &.other {
            background: #fee2e2;
            color: #b91c1c;
          }
        }
      }
    }

    .options-section {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .section-title {
        font-size: 13.5px;
        font-weight: 700;
        color: #1e293b;
        margin: 0;
      }

      .option-card {
        border: 1.5px solid #e2e8f0;
        border-radius: 8px;
        padding: 14px;
        background: #ffffff;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }

        &.active {
          border-color: #2563eb;
          background: #f8faff;
          box-shadow: 0 0 0 1px #2563eb;
        }

        .option-header {
          display: flex;
          align-items: flex-start;
          gap: 10px;

          .option-title-block {
            flex: 1;

            .title-row {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 4px;

              .option-name {
                font-size: 13.5px;
                color: #0f172a;
              }

              .badge-recommended {
                font-size: 10.5px;
                font-weight: 700;
                background: #dcfce7;
                color: #15803d;
                border: 1px solid #86efac;
                padding: 1px 6px;
                border-radius: 4px;
              }
            }

            .option-desc {
              font-size: 12.5px;
              color: #475569;
              margin: 0;
              line-height: 1.4;
            }
          }
        }

        .option-inputs-wrap {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px dashed #e2e8f0;

          .form-row {
            display: flex;
            gap: 14px;
            align-items: flex-start;

            .form-field-group {
              display: flex;
              flex-direction: column;
              gap: 4px;
              flex: 1;

              &.flex-2 { flex: 2; }

              .field-label {
                font-size: 11.5px;
                font-weight: 600;
                color: #475569;
              }

              .custom-date-input {
                height: 34px;
                padding: 0 10px;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                font-size: 12.5px;
                outline: none;

                &:focus { border-color: #2563eb; }
              }

              .participating-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;

                .unit-chip {
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  background: #e0e7ff;
                  color: #3730a3;
                  padding: 4px 8px;
                  border-radius: 4px;
                  font-size: 11.5px;
                  font-weight: 600;

                  mat-icon {
                    font-size: 14px;
                    width: 14px;
                    height: 14px;
                  }
                }
              }
            }
          }
        }
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;

      .btn-cancel {
        height: 38px;
        padding: 0 16px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        border-radius: 6px;
        font-size: 13px;
        color: #475569;
        cursor: pointer;
      }

      .btn-confirm-approve {
        height: 38px;
        padding: 0 20px;
        border-radius: 6px;
        border: none;
        color: #ffffff;
        font-size: 13px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;

        &.btn-joint {
          background: #1e3a8a;
          &:hover { background: #1e40af; }
        }

        &.btn-single {
          background: #d97706;
          &:hover { background: #b45309; }
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
export class PlanApprovalConflictDialogComponent implements OnInit {
  selectedMode: 'merge_joint' | 'select_single' = 'merge_joint';
  jointDate: string = '';
  todayStr: string = '';
  participatingWards: string[] = [];
  isSubmitting = false;

  constructor(
    public dialogRef: MatDialogRef<PlanApprovalConflictDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConflictDialogData
  ) {}

  ngOnInit(): void {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    this.jointDate = d.toISOString().substring(0, 10);
    this.todayStr = new Date().toISOString().substring(0, 10);

    const wardsSet = new Set<string>();
    wardsSet.add(this.data.ward);
    this.data.conflicts.forEach(c => wardsSet.add(c.otherWard));
    this.participatingWards = Array.from(wardsSet);
  }

  confirmApproval(): void {
    this.dialogRef.close({
      confirmed: true,
      resolutionMode: this.selectedMode,
      jointDate: this.jointDate,
      participatingWards: this.participatingWards
    });
  }
}
