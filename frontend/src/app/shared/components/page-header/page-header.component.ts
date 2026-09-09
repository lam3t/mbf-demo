import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface PageHeaderAction {
  id: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
  tooltip?: string;
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="cids-page-header">
      <div class="header-left">
        <h1 class="page-title">{{ title }}</h1>
        <p class="page-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
      </div>

      <div class="header-actions" *ngIf="actions && actions.length > 0">
        <button
          *ngFor="let action of actions"
          type="button"
          [matTooltip]="action.tooltip || ''"
          [disabled]="action.disabled"
          [ngClass]="getButtonClass(action)"
          (click)="onActionClick(action)"
        >
          <mat-icon *ngIf="action.icon">{{ action.icon }}</mat-icon>
          <span>{{ action.label }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .cids-page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 2px;

      .header-left {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .page-title {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          line-height: 1.25;
          letter-spacing: -0.01em;
        }

        .page-subtitle {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
          font-weight: 400;
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
    }

    .btn-action-primary {
      background-color: #1e3a8a;
      color: #ffffff;
      border-radius: 6px;
      font-weight: 500;
      font-size: 13px;
      padding: 0 16px;
      height: 36px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid #1e3a8a;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      transition: all 0.15s ease;

      &:hover:not([disabled]) {
        background-color: #1d4ed8;
        border-color: #1d4ed8;
        box-shadow: 0 4px 10px rgba(30, 58, 138, 0.25);
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

    .btn-action-secondary {
      background-color: #ffffff;
      color: #1e3a8a;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-weight: 500;
      font-size: 13px;
      padding: 0 14px;
      height: 36px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover:not([disabled]) {
        background-color: #f8fafc;
        border-color: #cbd5e1;
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #1e3a8a;
      }
    }

    .btn-action-outline {
      background-color: transparent;
      color: #4b5563;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-weight: 500;
      font-size: 13px;
      padding: 0 12px;
      height: 36px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover:not([disabled]) {
        background-color: #f3f4f6;
        color: #111827;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .btn-action-danger {
      background-color: #fee2e2;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-radius: 6px;
      font-weight: 500;
      font-size: 13px;
      padding: 0 14px;
      height: 36px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover:not([disabled]) {
        background-color: #fecaca;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }
  `]
})
export class PageHeaderComponent {
  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() actions: PageHeaderAction[] = [];
  @Output() actionClick = new EventEmitter<string>();

  getButtonClass(action: PageHeaderAction): string {
    switch (action.variant) {
      case 'secondary':
        return 'btn-action-secondary';
      case 'outline':
        return 'btn-action-outline';
      case 'danger':
        return 'btn-action-danger';
      case 'primary':
      default:
        return 'btn-action-primary';
    }
  }

  onActionClick(action: PageHeaderAction): void {
    if (!action.disabled) {
      this.actionClick.emit(action.id);
    }
  }
}
