import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="login-wrapper">
      <div class="login-box-container">
        <!-- Brand Header -->
        <div class="login-brand-header">
          <div class="brand-shield-logo">
            <mat-icon>shield</mat-icon>
          </div>
          <h1 class="portal-title">PA04 - HÀ NỘI</h1>
          <p class="portal-sub">Hệ thống Quản lý Đăng ký & Kiểm tra Cơ sở Kinh doanh</p>
          <span class="portal-version-tag">PHIÊN BẢN QUÝ II/2026</span>
        </div>

        <!-- Main Card -->
        <div class="login-card-surface">
          <form (ngSubmit)="onLogin()" class="login-form-content">
            <div *ngIf="errorMessage" class="login-error-alert">
              <mat-icon>error_outline</mat-icon>
              <span>{{ errorMessage }}</span>
            </div>

            <!-- Username -->
            <div class="input-field-group">
              <label class="field-label">Tên đăng nhập</label>
              <div class="custom-input-wrap">
                <mat-icon class="input-icon">person</mat-icon>
                <input
                  type="text"
                  class="styled-input"
                  [(ngModel)]="username"
                  name="username"
                  placeholder="Nhập tài khoản"
                  required
                />
              </div>
            </div>

            <!-- Password -->
            <div class="input-field-group">
              <label class="field-label">Mật khẩu</label>
              <div class="custom-input-wrap">
                <mat-icon class="input-icon">lock</mat-icon>
                <input
                  [type]="hidePassword ? 'password' : 'text'"
                  class="styled-input"
                  [(ngModel)]="password"
                  name="password"
                  placeholder="Nhập mật khẩu"
                  required
                />
                <button
                  type="button"
                  class="btn-eye"
                  (click)="hidePassword = !hidePassword"
                >
                  <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              class="btn-submit-login"
              [disabled]="isLoading"
            >
              <mat-spinner diameter="20" *ngIf="isLoading" class="spinner"></mat-spinner>
              <span *ngIf="!isLoading">ĐĂNG NHẬP HỆ THỐNG</span>
              <mat-icon *ngIf="!isLoading">arrow_forward</mat-icon>
            </button>
          </form>

          <!-- 4 Quick Login Demo Accounts -->
          <div class="quick-login-section">
            <div class="divider-line">
              <span>ĐĂNG NHẬP NHANH (4 TÀI KHOẢN DEMO ĐÃ SEED)</span>
            </div>

            <div class="quick-cards-grid">
              <button
                type="button"
                class="quick-account-card admin"
                (click)="quickLogin('admin')"
              >
                <div class="acc-icon-box">
                  <mat-icon>admin_panel_settings</mat-icon>
                </div>
                <div class="acc-info">
                  <strong class="acc-role">1. Quản trị viên</strong>
                  <span class="acc-name">admin / 123456</span>
                  <small class="acc-unit">Toàn quyền hệ thống</small>
                </div>
              </button>

              <button
                type="button"
                class="quick-account-card leader"
                (click)="quickLogin('leader')"
              >
                <div class="acc-icon-box">
                  <mat-icon>verified_user</mat-icon>
                </div>
                <div class="acc-info">
                  <strong class="acc-role">2. Lãnh đạo PA04</strong>
                  <span class="acc-name">leader / 123456</span>
                  <small class="acc-unit">Phê duyệt kế hoạch</small>
                </div>
              </button>

              <button
                type="button"
                class="quick-account-card officer"
                (click)="quickLogin('officer1')"
              >
                <div class="acc-icon-box">
                  <mat-icon>badge</mat-icon>
                </div>
                <div class="acc-info">
                  <strong class="acc-role">3. Cán bộ PA04</strong>
                  <span class="acc-name">officer1 / 123456</span>
                  <small class="acc-unit">Thực địa & Giám sát</small>
                </div>
              </button>

              <button
                type="button"
                class="quick-account-card ward"
                (click)="quickLogin('ward1')"
              >
                <div class="acc-icon-box">
                  <mat-icon>holiday_village</mat-icon>
                </div>
                <div class="acc-info">
                  <strong class="acc-role">4. Cán bộ Phường</strong>
                  <span class="acc-name">ward1 / 123456</span>
                  <small class="acc-unit">Lập KH P. Khương Mai</small>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top, #1e3a8a 0%, #0f172a 75%, #090d16 100%);
      padding: 24px;
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        width: 600px;
        height: 600px;
        background: rgba(37, 99, 235, 0.08);
        border-radius: 50%;
        top: -150px;
        left: -150px;
        filter: blur(80px);
      }
    }

    .login-box-container {
      width: 100%;
      max-width: 520px;
      z-index: 1;
    }

    .login-brand-header {
      text-align: center;
      margin-bottom: 24px;
      color: #ffffff;

      .brand-shield-logo {
        width: 68px;
        height: 68px;
        margin: 0 auto 14px;
        background: linear-gradient(135deg, #1e3a8a, #2563eb);
        border: 2px solid rgba(255, 255, 255, 0.25);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);

        mat-icon {
          font-size: 38px;
          width: 38px;
          height: 38px;
          color: #93c5fd;
        }
      }

      .portal-title {
        font-size: 24px;
        font-weight: 800;
        letter-spacing: 1.5px;
        margin: 0 0 6px;
      }

      .portal-sub {
        font-size: 13.5px;
        color: #cbd5e1;
        margin: 0 0 10px;
      }

      .portal-version-tag {
        display: inline-block;
        font-size: 10.5px;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        padding: 2px 10px;
        border-radius: 20px;
        color: #93c5fd;
        letter-spacing: 0.5px;
      }
    }

    .login-card-surface {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.4);
      padding: 28px 24px 24px;
    }

    .login-form-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .login-error-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background-color: #fee2e2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      color: #b91c1c;
      font-size: 13px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .input-field-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .field-label {
        font-size: 12.5px;
        font-weight: 600;
        color: #374151;
      }

      .custom-input-wrap {
        position: relative;
        display: flex;
        align-items: center;

        .input-icon {
          position: absolute;
          left: 12px;
          color: #9ca3af;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }

        .styled-input {
          width: 100%;
          height: 42px;
          padding: 0 40px 0 40px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          color: #111827;
          background-color: #ffffff;
          transition: all 0.15s ease;

          &:focus {
            border-color: #1a56db;
            outline: none;
            box-shadow: 0 0 0 3px rgba(26, 86, 219, 0.15);
          }
        }

        .btn-eye {
          position: absolute;
          right: 10px;
          background: transparent;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }

          &:hover {
            color: #4b5563;
          }
        }
      }
    }

    .btn-submit-login {
      height: 44px;
      background-color: #1e3a8a;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(30, 58, 138, 0.3);
      transition: all 0.15s ease;
      margin-top: 4px;

      &:hover:not([disabled]) {
        background-color: #1d4ed8;
        box-shadow: 0 6px 16px rgba(30, 58, 138, 0.4);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .quick-login-section {
      margin-top: 24px;

      .divider-line {
        position: relative;
        text-align: center;
        margin-bottom: 16px;

        &::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background-color: #e5e7eb;
        }

        span {
          position: relative;
          background-color: #ffffff;
          padding: 0 10px;
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          letter-spacing: 0.4px;
        }
      }

      .quick-cards-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;

        .quick-account-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;

          .acc-icon-box {
            width: 36px;
            height: 36px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;

            mat-icon {
              font-size: 20px;
              width: 20px;
              height: 20px;
            }
          }

          .acc-info {
            display: flex;
            flex-direction: column;
            line-height: 1.25;

            .acc-role {
              font-size: 12px;
              color: #111827;
            }

            .acc-name {
              font-size: 11px;
              color: #1e3a8a;
              font-weight: 600;
            }

            .acc-unit {
              font-size: 10px;
              color: #64748b;
            }
          }

          &.admin .acc-icon-box { background: #fee2e2; color: #dc2626; }
          &.leader .acc-icon-box { background: #f3e8ff; color: #7c3aed; }
          &.officer .acc-icon-box { background: #eff6ff; color: #2563eb; }
          &.ward .acc-icon-box { background: #ecfdf5; color: #059669; }

          &:hover {
            background-color: #ffffff;
            border-color: #1a56db;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
            transform: translateY(-1px);
          }
        }
      }
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  hidePassword = true;
  isLoading = false;
  errorMessage = '';

  constructor(private authService: AuthService, private router: Router) {}

  onLogin(): void {
    if (!this.username || !this.password) {
      this.errorMessage = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.username, this.password).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.';
      }
    });
  }

  quickLogin(roleKey: string): void {
    const credentials: Record<string, string> = {
      admin: 'admin',
      leader: 'leader',
      officer1: 'officer1',
      ward1: 'ward1'
    };

    this.username = credentials[roleKey] || 'admin';
    this.password = '123456';
    this.onLogin();
  }
}
