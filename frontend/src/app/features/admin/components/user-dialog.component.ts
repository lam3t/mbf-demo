import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { User, UserRole } from '../../../core/models';

export interface UserDialogData {
  isEdit: boolean;
  user?: User;
}

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="title-box">
          <mat-icon class="header-icon">{{ data.isEdit ? 'edit' : 'person_add' }}</mat-icon>
          <h2>{{ data.isEdit ? 'Cập nhật thông tin cán bộ' : 'Thêm mới cán bộ / người dùng' }}</h2>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <form #userForm="ngForm" class="user-form">
          <div class="form-row">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Tên đăng nhập (Username)</mat-label>
              <input
                matInput
                [(ngModel)]="formData.username"
                name="username"
                [disabled]="data.isEdit"
                placeholder="vd: officer_hn"
                required
              />
              <mat-icon matPrefix>account_circle</mat-icon>
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Họ và tên cán bộ</mat-label>
              <input
                matInput
                [(ngModel)]="formData.fullName"
                name="fullName"
                placeholder="vd: Nguyễn Văn A"
                required
              />
              <mat-icon matPrefix>badge</mat-icon>
            </mat-form-field>
          </div>

          <div class="form-row grid-2">
            <mat-form-field appearance="outline">
              <mat-label>Vai trò / Chức danh</mat-label>
              <mat-select [(ngModel)]="formData.role" name="role" required>
                <mat-option value="admin">Quản trị viên (Admin)</mat-option>
                <mat-option value="leader_tnt">Lãnh đạo Phòng TNT</mat-option>
                <mat-option value="officer_tnt">Cán bộ Phòng TNT</mat-option>
                <mat-option value="officer_ward">Cán bộ Xã / Phường</mat-option>
              </mat-select>
              <mat-icon matPrefix>security</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Đơn vị công tác</mat-label>
              <input
                matInput
                [(ngModel)]="formData.unit"
                name="unit"
                placeholder="vd: Phường Khương Mai"
                required
              />
              <mat-icon matPrefix>corporate_fare</mat-icon>
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>{{ data.isEdit ? 'Mật khẩu mới (Để trống nếu giữ nguyên)' : 'Mật khẩu khởi tạo' }}</mat-label>
              <input
                matInput
                [type]="hidePassword ? 'password' : 'text'"
                [(ngModel)]="formData.password"
                name="password"
                placeholder="Tối thiểu 6 ký tự"
                [required]="!data.isEdit"
              />
              <mat-icon matPrefix>lock</mat-icon>
              <button
                type="button"
                mat-icon-button
                matSuffix
                (click)="hidePassword = !hidePassword"
              >
                <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>
          </div>
        </form>
      </div>

      <div class="dialog-footer">
        <button type="button" class="btn-cancel" (click)="dialogRef.close()">
          Hủy bỏ
        </button>
        <button
          type="button"
          class="btn-save"
          [disabled]="!isValid()"
          (click)="onSave()"
        >
          <mat-icon>check</mat-icon>
          <span>{{ data.isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản' }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 20px;
      min-width: 480px;
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
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
      }

      .close-btn {
        color: #9ca3af;
      }
    }

    .dialog-content {
      padding: 8px 0 16px;

      .user-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .w-100 {
        width: 100%;
      }

      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
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
        transition: all 0.15s;

        &:hover {
          background-color: #f3f4f6;
          color: #111827;
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
export class UserDialogComponent {
  hidePassword = true;
  formData: {
    username: string;
    fullName: string;
    role: UserRole;
    unit: string;
    password?: string;
  };

  constructor(
    public dialogRef: MatDialogRef<UserDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserDialogData
  ) {
    if (data.isEdit && data.user) {
      this.formData = {
        username: data.user.username,
        fullName: data.user.fullName,
        role: data.user.role,
        unit: data.user.unit,
        password: ''
      };
    } else {
      this.formData = {
        username: '',
        fullName: '',
        role: 'officer_ward',
        unit: '',
        password: 'password123'
      };
    }
  }

  isValid(): boolean {
    if (!this.formData.username || !this.formData.fullName || !this.formData.role) {
      return false;
    }
    if (!this.data.isEdit && !this.formData.password) {
      return false;
    }
    return true;
  }

  onSave(): void {
    if (this.isValid()) {
      this.dialogRef.close(this.formData);
    }
  }
}
