import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface CatalogDialogData {
  isEdit: boolean;
  type: 'violation' | 'recommendation';
  item?: { id?: number; code: string; name: string };
}

@Component({
  selector: 'app-catalog-dialog',
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
          <mat-icon class="header-icon">{{ data.isEdit ? 'edit' : 'add_circle' }}</mat-icon>
          <h2>
            {{ data.isEdit ? 'Chỉnh sửa' : 'Thêm mới' }}
            {{ data.type === 'violation' ? 'Lỗi vi phạm' : 'Lĩnh vực kiến nghị' }}
          </h2>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <form #catForm="ngForm" class="cat-form">
          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Mã danh mục</mat-label>
            <input
              matInput
              [(ngModel)]="formData.code"
              name="code"
              placeholder="vd: VIO_01 hoặc TAG_FIRE"
              required
            />
            <mat-icon matPrefix>tag</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-100">
            <mat-label>Tên / Nội dung danh mục</mat-label>
            <textarea
              matInput
              rows="3"
              [(ngModel)]="formData.name"
              name="name"
              placeholder="Nhập tên chi tiết hành vi hoặc lĩnh vực kiến nghị..."
              required
            ></textarea>
            <mat-icon matPrefix>label</mat-icon>
          </mat-form-field>
        </form>
      </div>

      <div class="dialog-footer">
        <button type="button" class="btn-cancel" (click)="dialogRef.close()">
          Hủy bỏ
        </button>
        <button
          type="button"
          class="btn-save"
          [disabled]="!formData.code || !formData.name"
          (click)="onSave()"
        >
          <mat-icon>check</mat-icon>
          <span>Lưu thông tin</span>
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
      margin-bottom: 20px;
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
      padding: 8px 0 16px;

      .cat-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .w-100 { width: 100%; }
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

        &:hover {
          background-color: #f3f4f6;
        }
      }

      .btn-save {
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
  `]
})
export class CatalogDialogComponent {
  formData = {
    code: '',
    name: ''
  };

  constructor(
    public dialogRef: MatDialogRef<CatalogDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CatalogDialogData
  ) {
    if (data.isEdit && data.item) {
      this.formData = {
        code: data.item.code,
        name: data.item.name
      };
    }
  }

  onSave(): void {
    if (this.formData.code && this.formData.name) {
      this.dialogRef.close(this.formData);
    }
  }
}
