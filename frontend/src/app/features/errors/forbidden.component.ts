import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="error-page-container">
      <div class="error-card">
        <div class="error-code text-danger">403</div>
        <div class="error-icon-wrap bg-danger">
          <mat-icon>gavel</mat-icon>
        </div>
        <h1 class="error-title">Không Có Quyền Truy Cập</h1>
        <p class="error-desc">
          Tài khoản <strong>{{ currentUser?.fullName || currentUser?.username }}</strong> 
          (Vai trò: <span class="role-tag">{{ roleLabel }}</span>) không được cấp quyền thực hiện thao tác hoặc truy cập phân hệ này theo phân quyền RULE.
        </p>
        <div class="error-actions">
          <button mat-flat-button color="primary" routerLink="/dashboard" class="btn-home">
            <mat-icon>dashboard</mat-icon>
            <span>Về Trung tâm Dashboard</span>
          </button>
          <button mat-stroked-button (click)="logout()" class="btn-logout">
            <mat-icon>switch_account</mat-icon>
            <span>Đổi tài khoản khác</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .error-page-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 70vh;
      padding: 20px;
    }
    .error-card {
      background: #ffffff;
      border: 1px solid #fee2e2;
      border-radius: 16px;
      padding: 48px 36px;
      text-align: center;
      max-width: 520px;
      width: 100%;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
    }
    .error-code {
      font-size: 72px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -2px;
      margin-bottom: 8px;
      &.text-danger { color: #fca5a5; }
    }
    .error-icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      &.bg-danger { background: #fef2f2; color: #dc2626; }
      mat-icon { font-size: 36px; width: 36px; height: 36px; }
    }
    .error-title {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 8px;
    }
    .error-desc {
      font-size: 13.5px;
      color: #64748b;
      line-height: 1.5;
      margin: 0 0 24px;
    }
    .role-tag {
      font-weight: 700;
      color: #b91c1c;
      background: #fee2e2;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .error-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      .btn-home { background: #1e3a8a; color: #ffffff; mat-icon { margin-right: 4px; } }
      .btn-logout { color: #dc2626; border-color: #fca5a5; mat-icon { margin-right: 4px; } }
    }
  `]
})
export class ForbiddenComponent implements OnInit {
  currentUser: User | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUser();
  }

  get roleLabel(): string {
    const role = this.currentUser?.role;
    switch (role) {
      case 'admin': return 'Quản trị viên';
      case 'leader_mbf': return 'Lãnh đạo MBF';
      case 'officer_mbf': return 'Cán bộ MBF';
      case 'officer_ward': return 'Cán bộ Xã / Phường';
      default: return role || 'Chưa xác định';
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
