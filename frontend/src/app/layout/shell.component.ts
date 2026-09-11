import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { AlertsService } from '../core/services/alerts.service';

interface NavItem {

  id: string;
  label: string;
  icon: string;
  route?: string;
  children?: NavSubItem[];
  expanded?: boolean;
}

interface NavSubItem {
  id: string;
  label: string;
  icon?: string;
  route: string;
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule
  ],
  template: `
    <div class="cids-layout-shell">
      <!-- Left Sidebar (~230px) -->
      <aside class="cids-sidebar" [class.collapsed]="isCollapsed">
        <!-- Brand Header -->
        <div class="sidebar-header">
          <div class="brand-container" *ngIf="!isCollapsed">
            <div class="brand-logo-icon">
              <span class="logo-text-c">C</span>
              <span class="logo-text-ids">IDS</span>
              <div class="logo-dots">
                <span class="dot red"></span>
                <span class="dot yellow"></span>
                <span class="dot blue"></span>
              </div>
            </div>
            <div class="brand-title-box">
              <span class="brand-title">TNT - HÀ NỘI</span>
              <span class="brand-subtitle">Quản lý Kiểm tra</span>
            </div>
          </div>

          <div class="collapsed-logo" *ngIf="isCollapsed">
            <mat-icon>shield</mat-icon>
          </div>

          <!-- Collapse/Expand Arrow Button -->
          <button
            type="button"
            class="sidebar-toggle-btn"
            (click)="toggleSidebar()"
            [matTooltip]="isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'"
          >
            <mat-icon>{{ isCollapsed ? 'chevron_right' : 'chevron_left' }}</mat-icon>
          </button>
        </div>

        <!-- Navigation Menu -->
        <nav class="sidebar-menu">
          <ng-container *ngFor="let item of navItems">
            <!-- Direct Item (No Children) -->
            <a
              *ngIf="!item.children"
              [routerLink]="item.route"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }"
              class="menu-item"
              [matTooltip]="isCollapsed ? item.label : ''"
              matTooltipPosition="right"
            >
              <mat-icon class="menu-icon">{{ item.icon }}</mat-icon>
              <span class="menu-label" *ngIf="!isCollapsed">{{ item.label }}</span>
            </a>

            <!-- Accordion Parent Item (With Children) -->
            <div
              *ngIf="item.children"
              class="menu-accordion-group"
              [class.group-expanded]="item.expanded"
              [class.child-active]="isChildActive(item)"
            >
              <div
                class="menu-item parent-item"
                (click)="toggleAccordion(item)"
                [matTooltip]="isCollapsed ? item.label : ''"
                matTooltipPosition="right"
              >
                <mat-icon class="menu-icon">{{ item.icon }}</mat-icon>
                <span class="menu-label" *ngIf="!isCollapsed">{{ item.label }}</span>
                <mat-icon class="accordion-arrow" *ngIf="!isCollapsed">
                  {{ item.expanded ? 'expand_more' : 'chevron_right' }}
                </mat-icon>
              </div>

              <!-- Sub-menu list -->
              <div class="submenu-container" *ngIf="!isCollapsed && item.expanded">
                <a
                  *ngFor="let child of item.children"
                  [routerLink]="child.route"
                  [queryParams]="child.queryParams"
                  routerLinkActive="active"
                  class="submenu-item"
                >
                  <mat-icon class="submenu-icon">{{ child.icon || 'fiber_manual_record' }}</mat-icon>
                  <span class="submenu-label">{{ child.label }}</span>
                </a>
              </div>
            </div>
          </ng-container>
        </nav>

        <!-- Sidebar Footer -->
        <div class="sidebar-bottom" *ngIf="!isCollapsed">
          <div class="system-version-pill">
            <mat-icon>verified</mat-icon>
            <span>Phiên bản Quý II/2026</span>
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <div class="cids-main-container">
        <!-- Top Header -->
        <header class="cids-top-header">
          <!-- Left: Horizontal Module Tabs -->
          <div class="header-left-nav">
            <a
              routerLink="/dashboard"
              routerLinkActive="active-tab"
              class="nav-tab-item"
            >
              DASHBOARD
            </a>
            <a
              routerLink="/objects"
              routerLinkActive="active-tab"
              class="nav-tab-item"
            >
              DANH SÁCH
            </a>
            <a
              routerLink="/reports"
              routerLinkActive="active-tab"
              class="nav-tab-item"
            >
              BÁO CÁO
            </a>
          </div>

          <!-- Right: Badges, Notifications, Avatar -->
          <div class="header-right-tools">
            <!-- Language / Country Flag -->
            <div class="lang-flag" matTooltip="Tiếng Việt">
              <span class="flag-icon">🇻🇳</span>
            </div>

            <!-- Alert Warning Bell with Unread Count Badge -->
            <button
              type="button"
              class="tool-btn alert-bell-btn"
              [matMenuTriggerFor]="alertMenu"
              matTooltip="Cảnh báo & Quá hạn hệ thống"
            >
              <mat-icon [style.color]="((unreadAlertsCount$ | async) ?? 0) > 0 ? '#ef4444' : '#64748b'">warning_amber</mat-icon>
              <span class="noti-badge-pill alert-badge" *ngIf="((unreadAlertsCount$ | async) ?? 0) > 0">
                {{ unreadAlertsCount$ | async }}
              </span>
            </button>

            <mat-menu #alertMenu="matMenu" class="cids-dropdown-menu alert-dropdown-menu">
              <div class="dropdown-header">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <mat-icon style="color: #ef4444; font-size: 18px; width: 18px; height: 18px;">warning</mat-icon>
                  <strong>Cảnh báo quá hạn ({{ (unreadAlertsCount$ | async) || 0 }})</strong>
                </div>
                <a href="javascript:void(0)" class="mark-read" (click)="markAllAlertsRead($event)">Đã đọc tất cả</a>
              </div>
              <mat-divider></mat-divider>
              
              <div class="alerts-list-container">
                <ng-container *ngIf="(recentAlerts$ | async) as alerts">
                  <div *ngIf="alerts.length === 0" class="empty-alerts-p">
                    <mat-icon style="color: #10b981; font-size: 20px; width: 20px; height: 20px;">check_circle</mat-icon>
                    <span>Không có cảnh báo quá hạn nào!</span>
                  </div>
                  <button mat-menu-item *ngFor="let alert of alerts" (click)="handleAlertClick(alert)" class="alert-menu-item" [class.alert-unread]="!alert.isRead">
                    <mat-icon [style.color]="getAlertSeverityColor(alert.severity)" style="margin-right: 8px;">
                      {{ alert.severity === 'critical' ? 'error' : (alert.severity === 'warning' ? 'warning' : 'info') }}
                    </mat-icon>
                    <div class="alert-item-content">
                      <div class="alert-msg">{{ alert.message }}</div>
                      <div class="alert-time">{{ alert.createdAt }}</div>
                    </div>
                  </button>
                </ng-container>
              </div>
              
              <mat-divider></mat-divider>
              <div style="padding: 8px 12px; text-align: center;">
                <a routerLink="/admin" [queryParams]="{ tab: 'alerts' }" class="view-all-alerts-btn">
                  <span>Xem tất cả cảnh báo</span>
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px; margin-left: 4px;">arrow_forward</mat-icon>
                </a>
              </div>
            </mat-menu>

            <!-- Notification Bell with Count Badge -->
            <button
              type="button"
              class="tool-btn noti-btn"
              [matMenuTriggerFor]="notiMenu"
              matTooltip="Thông báo hệ thống"
            >
              <mat-icon>notifications_none</mat-icon>
              <span class="noti-badge-pill">25</span>
            </button>

            <mat-menu #notiMenu="matMenu" class="cids-dropdown-menu">
              <div class="dropdown-header">
                <strong>Thông báo mới (25)</strong>
                <a href="javascript:void(0)" class="mark-read">Đã đọc tất cả</a>
              </div>
              <mat-divider></mat-divider>
              <button mat-menu-item routerLink="/inspections">
                <mat-icon color="warn">warning</mat-icon>
                <span>3 cơ sở có vi phạm cần xử lý gấp</span>
              </button>
              <button mat-menu-item routerLink="/plans">
                <mat-icon color="primary">assignment_turned_in</mat-icon>
                <span>Kế hoạch kiểm tra P. Khương Mai đã duyệt</span>
              </button>
              <button mat-menu-item routerLink="/objects">
                <mat-icon style="color: #10b981;">store</mat-icon>
                <span>5 cơ sở kinh doanh mới đăng ký</span>
              </button>
            </mat-menu>


            <!-- User Avatar & Profile -->
            <div class="user-profile-widget" [matMenuTriggerFor]="userProfileMenu">
              <div class="avatar-circle">
                {{ userInitials }}
              </div>
              <div class="user-meta">
                <span class="user-name">{{ currentUser?.fullName || 'Cán bộ TNT' }}</span>
                <span class="user-role">{{ userRoleName }}</span>
              </div>
              <mat-icon class="dropdown-caret">arrow_drop_down</mat-icon>
            </div>

            <mat-menu #userProfileMenu="matMenu" class="cids-dropdown-menu">
              <div class="dropdown-user-card">
                <div class="user-avatar-large">{{ userInitials }}</div>
                <div class="user-info-text">
                  <div class="full-name">{{ currentUser?.fullName }}</div>
                  <div class="user-unit">{{ currentUser?.unit || 'Phòng Nghiệp vụ TNT - Hà Nội' }}</div>
                  <div class="user-email">{{ currentUser?.email || 'tnt.hanoi@tnt.gov.vn' }}</div>
                </div>
              </div>
              <mat-divider></mat-divider>
              <button mat-menu-item routerLink="/admin" [queryParams]="{ tab: 'users' }">
                <mat-icon>account_circle</mat-icon>
                <span>Hồ sơ cá nhân</span>
              </button>
              <button mat-menu-item routerLink="/admin" [queryParams]="{ tab: 'config' }">
                <mat-icon>settings</mat-icon>
                <span>Cấu hình tài khoản</span>
              </button>
              <mat-divider></mat-divider>
              <button mat-menu-item (click)="logout()" class="logout-btn">
                <mat-icon style="color: #dc2626;">logout</mat-icon>
                <span style="color: #dc2626; font-weight: 600;">Đăng xuất</span>
              </button>
            </mat-menu>
          </div>
        </header>

        <!-- Page Content Outlet -->
        <main class="cids-content-body">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .cids-layout-shell {
      display: flex;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      background-color: #f8fafc;
    }

    /* Left Sidebar */
    .cids-sidebar {
      width: 230px;
      min-width: 230px;
      height: 100vh;
      background: #ffffff;
      border-right: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
      transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 50;
      position: relative;

      &.collapsed {
        width: 68px;
        min-width: 68px;

        .sidebar-header {
          padding: 0 8px;
          justify-content: center;
        }

        .menu-item {
          justify-content: center;
          padding: 10px 0;
          margin: 4px 8px;
        }
      }
    }

    /* Sidebar Header & Brand */
    .sidebar-header {
      height: 58px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px 0 16px;
      border-bottom: 1px solid #f1f5f9;

      .brand-container {
        display: flex;
        align-items: center;
        gap: 10px;
        overflow: hidden;

        .brand-logo-icon {
          display: flex;
          align-items: baseline;
          position: relative;

          .logo-text-c {
            font-size: 20px;
            font-weight: 900;
            color: #1e3a8a;
            letter-spacing: -0.5px;
          }

          .logo-text-ids {
            font-size: 16px;
            font-weight: 800;
            color: #1a56db;
          }

          .logo-dots {
            display: flex;
            gap: 2px;
            margin-left: 2px;
            .dot {
              width: 4px;
              height: 4px;
              border-radius: 50%;
              &.red { background: #ef4444; }
              &.yellow { background: #f59e0b; }
              &.blue { background: #3b82f6; }
            }
          }
        }

        .brand-title-box {
          display: flex;
          flex-direction: column;
          line-height: 1.15;

          .brand-title {
            font-size: 12.5px;
            font-weight: 700;
            color: #1e3a8a;
            letter-spacing: 0.3px;
          }

          .brand-subtitle {
            font-size: 10.5px;
            color: #64748b;
            font-weight: 500;
          }
        }
      }

      .collapsed-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon {
          color: #1e3a8a;
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .sidebar-toggle-btn {
        background: transparent;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 4px;
        transition: all 0.15s;

        &:hover {
          background-color: #f1f5f9;
          color: #1e3a8a;
        }

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }
    }

    /* Sidebar Menu */
    .sidebar-menu {
      flex: 1;
      padding: 12px 8px;
      overflow-y: auto;
      overflow-x: hidden;

      .menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 9px 14px;
        border-radius: 8px;
        color: #4b5563;
        text-decoration: none;
        font-size: 13.5px;
        font-weight: 500;
        margin-bottom: 3px;
        cursor: pointer;
        transition: all 0.15s ease;

        .menu-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
          color: #6b7280;
          flex-shrink: 0;
        }

        .menu-label {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .accordion-arrow {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #9ca3af;
          flex-shrink: 0;
        }

        &:hover:not(.active) {
          background-color: #f8fafc;
          color: #1a56db;

          .menu-icon {
            color: #1a56db;
          }
        }

        /* Active Item Style (CIDS #EAF1FF background, #1A56DB text) */
        &.active {
          background-color: #eaf1ff;
          color: #1a56db;
          font-weight: 600;

          .menu-icon {
            color: #1a56db;
          }
        }
      }

      .menu-accordion-group {
        margin-bottom: 3px;

        &.child-active > .parent-item {
          color: #1e3a8a;
          font-weight: 600;
          .menu-icon {
            color: #1e3a8a;
          }
        }
      }

      .submenu-container {
        display: flex;
        flex-direction: column;
        padding-left: 20px;
        margin: 2px 0 6px;
        border-left: 2px solid #e5e7eb;
        margin-left: 22px;

        .submenu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 6px;
          color: #64748b;
          text-decoration: none;
          font-size: 12.5px;
          font-weight: 500;
          transition: all 0.15s ease;

          .submenu-icon {
            font-size: 14px;
            width: 14px;
            height: 14px;
            color: #9ca3af;
          }

          &:hover {
            color: #1a56db;
            background-color: #f1f5f9;
            .submenu-icon {
              color: #1a56db;
            }
          }

          &.active {
            background-color: #eaf1ff;
            color: #1a56db;
            font-weight: 600;

            .submenu-icon {
              color: #1a56db;
            }
          }
        }
      }
    }

    /* Sidebar Footer */
    .sidebar-bottom {
      padding: 12px;
      border-top: 1px solid #f1f5f9;

      .system-version-pill {
        display: flex;
        align-items: center;
        gap: 6px;
        background-color: #f8fafc;
        border: 1px solid #e5e7eb;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 11px;
        color: #64748b;
        font-weight: 500;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
          color: #1a56db;
        }
      }
    }

    /* Main Container */
    .cids-main-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background-color: #f8fafc;
    }

    /* Top Header */
    .cids-top-header {
      height: 56px;
      min-height: 56px;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      z-index: 20;

      .header-left-nav {
        display: flex;
        align-items: center;
        gap: 24px;
        height: 100%;

        .nav-tab-item {
          height: 100%;
          display: flex;
          align-items: center;
          font-size: 13.5px;
          font-weight: 600;
          color: #6b7280;
          text-decoration: none;
          letter-spacing: 0.5px;
          position: relative;
          transition: color 0.15s ease;

          &:hover {
            color: #1a56db;
          }

          &.active-tab {
            color: #1a56db;

            &::after {
              content: '';
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              height: 3px;
              background-color: #1a56db;
              border-radius: 3px 3px 0 0;
            }
          }
        }
      }

      .header-right-tools {
        display: flex;
        align-items: center;
        gap: 16px;

        .lang-flag {
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 4px;
        }

        .noti-btn {
          position: relative;
          background: transparent;
          border: none;
          color: #4b5563;
          cursor: pointer;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.15s;

          &:hover {
            background-color: #f3f4f6;
            color: #1e3a8a;
          }

          mat-icon {
            font-size: 22px;
            width: 22px;
            height: 22px;
          }

          .noti-badge-pill {
            position: absolute;
            top: 2px;
            right: 0px;
            background-color: #f59e0b;
            color: #ffffff;
            font-size: 10.5px;
            font-weight: 700;
            padding: 1px 5px;
            border-radius: 9999px;
            line-height: 1.2;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
          }
        }

        .user-profile-widget {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.15s;

          &:hover {
            background-color: #f8fafc;
          }

          .avatar-circle {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background-color: #10b981;
            color: #ffffff;
            font-weight: 700;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          .user-meta {
            display: flex;
            flex-direction: column;
            line-height: 1.2;

            .user-name {
              font-size: 13px;
              font-weight: 600;
              color: #1f2937;
            }

            .user-role {
              font-size: 11px;
              color: #6b7280;
            }
          }

          .dropdown-caret {
            color: #9ca3af;
            font-size: 20px;
            width: 20px;
            height: 20px;
          }
        }
      }
    }

    /* Content Body */
    .cids-content-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px 32px;
      background-color: #f8fafc;
    }

    /* User Profile Menu */
    .dropdown-user-card {
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;

      .user-avatar-large {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background-color: #10b981;
        color: #ffffff;
        font-weight: 700;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .user-info-text {
        .full-name {
          font-size: 13.5px;
          font-weight: 700;
          color: #111827;
        }
        .user-unit {
          font-size: 11.5px;
          color: #4b5563;
        }
        .user-email {
          font-size: 11px;
          color: #9ca3af;
        }
      }
    }

    .dropdown-header {
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;

      strong {
        font-size: 13px;
        color: #111827;
      }

      .mark-read {
        font-size: 11.5px;
        color: #1a56db;
        text-decoration: none;
        &:hover { text-decoration: underline; }
      }
    }

    .alert-badge {
      background-color: #ef4444 !important;
      color: #ffffff;
      font-weight: 700;
    }

    .alert-dropdown-menu {
      min-width: 320px;
      max-width: 360px;
    }

    .alerts-list-container {
      max-height: 280px;
      overflow-y: auto;
    }

    .empty-alerts-p {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 20px 16px;
      font-size: 13px;
      color: #64748b;
    }

    .alert-menu-item {
      display: flex !important;
      align-items: flex-start !important;
      padding: 10px 14px !important;
      height: auto !important;
      line-height: normal !important;
      border-bottom: 1px solid #f1f5f9;

      &.alert-unread {
        background-color: #fef2f2;
      }

      .alert-item-content {
        display: flex;
        flex-direction: column;
        white-space: normal;
        text-align: left;
        max-width: 240px;

        .alert-msg {
          font-size: 12px;
          color: #1e293b;
          font-weight: 500;
          line-height: 1.35;
        }

        .alert-time {
          font-size: 10.5px;
          color: #94a3b8;
          margin-top: 3px;
        }
      }
    }

    .view-all-alerts-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      font-size: 12.5px;
      font-weight: 600;
      color: #1a56db;
      text-decoration: none;
      padding: 6px 12px;
      border-radius: 6px;
      transition: background-color 0.15s;

      &:hover {
        background-color: #eff6ff;
      }
    }
  `]
})
export class ShellComponent implements OnInit {
  isCollapsed = false;
  currentUrl = '';

  navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'insights',
      route: '/dashboard'
    },
    {
      id: 'objects',
      label: 'Quản lý đối tượng',
      icon: 'storefront',
      route: '/objects'
    },
    {
      id: 'plans',
      label: 'Lập kế hoạch & Phê duyệt',
      icon: 'event_note',
      route: '/plans',
      expanded: false,
      children: [
        { id: 'plans-official', label: 'Kế hoạch chính thức', icon: 'event_available', route: '/plans', queryParams: { tab: 'official' } },
        { id: 'plans-adhoc', label: 'Đề xuất kiểm tra phát sinh', icon: 'notification_important', route: '/plans', queryParams: { tab: 'adhoc' } }
      ]
    },
    {
      id: 'inspections',
      label: 'Giám sát thực địa',
      icon: 'fact_check',
      route: '/inspections'
    },
    {
      id: 'map',
      label: 'Bản đồ vi phạm',
      icon: 'map',
      route: '/map'
    },
    {
      id: 'reports',
      label: 'Báo cáo',
      icon: 'assessment',
      route: '/reports'
    },
    {
      id: 'admin',
      label: 'Quản trị hệ thống',
      icon: 'settings',
      expanded: false,
      children: [
        { id: 'users', label: 'Người dùng', icon: 'people', route: '/admin', queryParams: { tab: 'users' } },
        { id: 'roles', label: 'Phân quyền', icon: 'security', route: '/admin', queryParams: { tab: 'roles' } },
        { id: 'categories', label: 'Danh mục', icon: 'category', route: '/admin', queryParams: { tab: 'categories' } },
        { id: 'config', label: 'Cấu hình', icon: 'tune', route: '/admin', queryParams: { tab: 'config' } },
        { id: 'alerts', label: 'Cảnh báo hệ thống', icon: 'crisis_alert', route: '/admin', queryParams: { tab: 'alerts' } },
        { id: 'logs', label: 'Nhật ký hệ thống', icon: 'history', route: '/admin', queryParams: { tab: 'logs' } }
      ]
    }
  ];

  constructor(
    private authService: AuthService,
    private alertsService: AlertsService,
    private router: Router
  ) {}

  get unreadAlertsCount$() {
    return this.alertsService.unreadCount$;
  }

  get recentAlerts$() {
    return this.alertsService.recentAlerts$;
  }

  ngOnInit(): void {
    this.currentUrl = this.router.url;
    this.checkAutoCollapse(this.currentUrl);
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentUrl = event.urlAfterRedirects || event.url;
        this.checkAutoCollapse(this.currentUrl);
        this.updateAccordionState();
      });
    this.updateAccordionState();
  }

  checkAutoCollapse(url: string): void {
    // Prompt 16 / CR-12: Auto-collapse sidebar on Dashboard and Map to maximize horizontal workspace
    if (url.startsWith('/dashboard') || url.startsWith('/map')) {
      this.isCollapsed = true;
    }
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  toggleAccordion(item: NavItem): void {
    if (this.isCollapsed) {
      this.isCollapsed = false;
      item.expanded = true;
    } else {
      item.expanded = !item.expanded;
    }
  }

  updateAccordionState(): void {
    const adminItem = this.navItems.find(i => i.id === 'admin');
    if (adminItem && this.currentUrl.startsWith('/admin')) {
      adminItem.expanded = true;
    }
    const plansItem = this.navItems.find(i => i.id === 'plans');
    if (plansItem && this.currentUrl.startsWith('/plans')) {
      plansItem.expanded = true;
    }
  }

  isChildActive(item: NavItem): boolean {
    if (!item.children) return false;
    return item.children.some(child => this.currentUrl.startsWith(child.route));
  }

  get currentUser() {
    return this.authService.currentUser();
  }

  get userInitials(): string {
    const name = this.currentUser?.fullName || 'TNT';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 1).toUpperCase();
  }

  get userRoleName(): string {
    const role = this.currentUser?.role;
    switch (role) {
      case 'admin': return 'Quản trị viên';
      case 'leader_tnt': return 'Lãnh đạo TNT';
      case 'officer_tnt': return 'Cán bộ TNT';
      case 'officer_ward': return 'Cán bộ Xã/Phường';
      default: return 'Cán bộ';
    }
  }

  getAlertSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#3b82f6';
    }
  }

  markAllAlertsRead(event: Event): void {
    event.stopPropagation();
    this.alertsService.markAllAsRead().subscribe();
  }

  handleAlertClick(alert: any): void {
    if (!alert.isRead) {
      this.alertsService.markAsRead(alert.id).subscribe();
    }
    if (alert.type === 'notice_letter_pending' && alert.ward) {
      this.router.navigate(['/dashboard/ward', encodeURIComponent(alert.ward)]);
    } else if (alert.relatedEntityType === 'inspection') {
      this.router.navigate(['/inspections']);
    } else if (alert.relatedEntityType === 'plan') {
      this.router.navigate(['/plans']);
    } else {
      this.router.navigate(['/admin'], { queryParams: { tab: 'alerts' } });
    }
  }

  logout(): void {
    this.authService.logout();
  }
}

