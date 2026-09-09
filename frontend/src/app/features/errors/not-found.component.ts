import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="error-page-container">
      <div class="error-card">
        <div class="error-code">404</div>
        <div class="error-icon-wrap">
          <mat-icon>travel_explore</mat-icon>
        </div>
        <h1 class="error-title">Không Tìm Thấy Trang Yêu Cầu</h1>
        <p class="error-desc">
          Đường dẫn bạn truy cập không tồn tại trên hệ thống PA04 hoặc đã được di dời sang vị trí mới.
        </p>
        <div class="error-actions">
          <button mat-flat-button color="primary" routerLink="/dashboard" class="btn-home">
            <mat-icon>dashboard</mat-icon>
            <span>Về Trung tâm Dashboard</span>
          </button>
          <button mat-stroked-button routerLink="/objects" class="btn-back">
            <mat-icon>arrow_back</mat-icon>
            <span>Quản lý đối tượng</span>
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
      border: 1px solid #e2e8f0;
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
      color: #cbd5e1;
      line-height: 1;
      letter-spacing: -2px;
      margin-bottom: 8px;
    }
    .error-icon-wrap {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #eff6ff;
      color: #1e3a8a;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
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
    .error-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      .btn-home { background: #1e3a8a; color: #ffffff; mat-icon { margin-right: 4px; } }
      .btn-back { mat-icon { margin-right: 4px; } }
    }
  `]
})
export class NotFoundComponent {}
