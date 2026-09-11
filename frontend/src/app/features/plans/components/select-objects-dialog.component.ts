import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { BusinessObject } from '../../../core/models';

@Component({
  selector: 'app-select-objects-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="title-box">
          <mat-icon class="header-icon">playlist_add</mat-icon>
          <h2>Chọn đối tượng kiểm tra đưa vào kế hoạch</h2>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-search">
        <input
          type="text"
          class="search-input"
          placeholder="Tìm kiếm cơ sở theo tên, MST, CCCD..."
          [(ngModel)]="searchQuery"
          (input)="filterObjects()"
        />
      </div>

      <div class="dialog-content">
        <div *ngIf="isLoading" class="loading-box">
          <mat-spinner diameter="30"></mat-spinner>
          <span>Đang tải danh sách cơ sở...</span>
        </div>

        <div *ngIf="!isLoading && filteredList.length === 0" class="empty-box">
          <p>Không tìm thấy cơ sở nào phù hợp hoặc tất cả đã được thêm vào kế hoạch.</p>
        </div>

        <div *ngIf="!isLoading && filteredList.length > 0" class="objects-list">
          <div
            class="object-row"
            *ngFor="let obj of filteredList"
            [class.selected]="isSelected(obj.id)"
            [class.blocked-row]="obj.isBlockedThisYear"
            (click)="!obj.isBlockedThisYear && toggleSelect(obj)"
          >
            <mat-checkbox
              [checked]="isSelected(obj.id)"
              [disabled]="!!obj.isBlockedThisYear"
              (change)="toggleSelect(obj)"
              (click)="$event.stopPropagation()"
              color="primary"
            ></mat-checkbox>
            <div class="obj-info">
              <div class="obj-title">
                <strong>{{ obj.name }}</strong>
                <span class="type-badge">{{ obj.type === 'enterprise' ? 'Doanh nghiệp' : (obj.type === 'household' ? 'Hộ KD' : 'Cá nhân') }}</span>
                <span *ngIf="obj.isBlockedThisYear" class="blocked-badge" title="{{ obj.blockReason }}">
                  <mat-icon>block</mat-icon>
                  {{ obj.blockReason ? 'Single Check (Đã khóa)' : 'Đã có kế hoạch' }}
                </span>
              </div>
              <div class="obj-meta">
                <span>Mã: {{ obj.taxCode || obj.idNumber }}</span>
                <span>•</span>
                <span>Địa chỉ: {{ obj.address }}</span>
              </div>
              <div *ngIf="obj.isBlockedThisYear && obj.blockReason" class="blocked-reason-text">
                {{ obj.blockReason }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <div class="select-count">
          Đã chọn: <strong>{{ selectedIds.length }}</strong> cơ sở
        </div>
        <div class="footer-actions">
          <button type="button" class="btn-cancel" (click)="dialogRef.close()">
            Hủy bỏ
          </button>
          <button
            type="button"
            class="btn-save"
            [disabled]="selectedIds.length === 0"
            (click)="onSave()"
          >
            <mat-icon>add</mat-icon>
            <span>Thêm vào kế hoạch ({{ selectedIds.length }})</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 20px;
      min-width: 580px;
      max-width: 680px;
      background: #ffffff;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 10px;
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

    .dialog-search {
      margin-bottom: 12px;

      .search-input {
        width: 100%;
        height: 38px;
        padding: 0 14px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 13px;
        outline: none;

        &:focus {
          border-color: #1a56db;
          box-shadow: 0 0 0 2px rgba(26, 86, 219, 0.15);
        }
      }
    }

    .dialog-content {
      max-height: 360px;
      overflow-y: auto;
      border: 1px solid #e5e7eb;
      border-radius: 6px;

      .loading-box, .empty-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 16px;
        color: #6b7280;
        font-size: 13px;
        gap: 8px;
      }

      .objects-list {
        display: flex;
        flex-direction: column;

        .object-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: background-color 0.15s;

          &:last-child { border-bottom: none; }
          &:hover { background-color: #f8fafc; }
          &.selected { background-color: #eff6ff; }
          &.blocked-row {
            background-color: #fef2f2;
            border-left: 3px solid #ef4444;
            cursor: not-allowed;
            &:hover { background-color: #fee2e2; }
          }

          .obj-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;

            .obj-title {
              display: flex;
              align-items: center;
              gap: 8px;

              strong {
                font-size: 13px;
                color: #111827;
              }

              .type-badge {
                font-size: 10.5px;
                background-color: #e0f2fe;
                color: #0284c7;
                padding: 1px 6px;
                border-radius: 4px;
                font-weight: 600;
              }

              .blocked-badge {
                display: inline-flex;
                align-items: center;
                gap: 3px;
                font-size: 10.5px;
                background-color: #fee2e2;
                color: #b91c1c;
                border: 1px solid #fca5a5;
                padding: 1px 6px;
                border-radius: 4px;
                font-weight: 600;

                mat-icon {
                  font-size: 12px;
                  width: 12px;
                  height: 12px;
                }
              }
            }

            .obj-meta {
              display: flex;
              gap: 6px;
              font-size: 11.5px;
              color: #64748b;
            }

            .blocked-reason-text {
              font-size: 11px;
              color: #dc2626;
              font-weight: 500;
              margin-top: 2px;
            }
          }
        }
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 14px;
      margin-top: 12px;
      border-top: 1px solid #e5e7eb;

      .select-count {
        font-size: 13px;
        color: #4b5563;

        strong { color: #1e3a8a; }
      }

      .footer-actions {
        display: flex;
        gap: 10px;

        .btn-cancel {
          height: 36px;
          padding: 0 16px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          color: #4b5563;
          font-size: 13px;
          cursor: pointer;
        }

        .btn-save {
          height: 36px;
          padding: 0 16px;
          background-color: #1e3a8a;
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
            background-color: #1d4ed8;
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
    }
  `]
})
export class SelectObjectsDialogComponent implements OnInit {
  isLoading = false;
  searchQuery = '';
  allAvailable: BusinessObject[] = [];
  filteredList: BusinessObject[] = [];
  selectedIds: number[] = [];

  constructor(
    public dialogRef: MatDialogRef<SelectObjectsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { ward: string; existingObjectIds: number[] },
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.loadAvailableObjects();
  }

  loadAvailableObjects(): void {
    this.isLoading = true;
    this.api.get<any>('/objects', { ward: this.data.ward, limit: 100 }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          // Filter out already selected objects
          const existingSet = new Set(this.data.existingObjectIds);
          this.allAvailable = res.data.filter((o: any) => !existingSet.has(o.id));
          this.filterObjects();
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  filterObjects(): void {
    if (!this.searchQuery.trim()) {
      this.filteredList = [...this.allAvailable];
      return;
    }
    const q = this.searchQuery.trim().toLowerCase();
    this.filteredList = this.allAvailable.filter(
      o =>
        o.name.toLowerCase().includes(q) ||
        (o.taxCode && o.taxCode.toLowerCase().includes(q)) ||
        (o.idNumber && o.idNumber.toLowerCase().includes(q)) ||
        o.address.toLowerCase().includes(q)
    );
  }

  isSelected(id: number): boolean {
    return this.selectedIds.includes(id);
  }

  toggleSelect(item: BusinessObject | number): void {
    const id = typeof item === 'number' ? item : item.id;
    const isBlocked = typeof item === 'object' ? !!item.isBlockedThisYear : false;
    if (isBlocked) return;

    if (this.isSelected(id)) {
      this.selectedIds = this.selectedIds.filter(i => i !== id);
    } else {
      this.selectedIds.push(id);
    }
  }

  onSave(): void {
    this.dialogRef.close(this.selectedIds);
  }
}
