import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface StatusTabItem {
  key: string;
  label: string;
  count?: number;
  color?: 'green' | 'blue' | 'orange' | 'purple' | 'emerald' | 'red' | 'gray' | string;
}

@Component({
  selector: 'app-status-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cids-status-ribbon">
      <div
        *ngFor="let tab of tabs; let i = index; let first = first; let last = last"
        class="status-tab"
        [class.active]="tab.key === activeKey"
        [class.first]="first"
        [class.last]="last"
        [ngClass]="'color-' + (tab.color || 'gray')"
        (click)="selectTab(tab.key)"
      >
        <div class="tab-content">
          <span class="tab-label">{{ tab.label }}</span>
          <span class="tab-count" *ngIf="tab.count !== undefined">({{ tab.count }})</span>
        </div>
        <div class="chevron-tail" *ngIf="!last"></div>
      </div>
    </div>
  `,
  styles: [`
    .cids-status-ribbon {
      display: flex;
      align-items: center;
      background: #f1f5f9;
      border-radius: 20px;
      padding: 3px;
      margin-bottom: 16px;
      overflow-x: auto;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
      user-select: none;
      gap: 2px;

      &::-webkit-scrollbar {
        height: 3px;
      }
    }

    .status-tab {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px 18px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border-radius: 16px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      white-space: nowrap;
      background: transparent;
      color: #64748b;

      .tab-content {
        display: flex;
        align-items: center;
        gap: 4px;
        z-index: 1;

        .tab-label {
          font-weight: 500;
        }

        .tab-count {
          font-weight: 600;
        }
      }

      &:hover:not(.active) {
        background: rgba(255, 255, 255, 0.7);
        color: #1e293b;
      }

      /* Active State */
      &.active {
        background: #1a56db;
        color: #ffffff !important;
        font-weight: 600;
        box-shadow: 0 2px 6px rgba(26, 86, 219, 0.35);

        .tab-count {
          color: #ffffff;
        }
      }

      /* Semantic Color Themes for Inactive States */
      &:not(.active) {
        &.color-green {
          color: #059669;
        }
        &.color-blue {
          color: #2563eb;
        }
        &.color-orange {
          color: #d97706;
        }
        &.color-purple {
          color: #7c3aed;
        }
        &.color-emerald {
          color: #047857;
        }
        &.color-red {
          color: #dc2626;
        }
        &.color-gray {
          color: #4b5563;
        }
      }
    }
  `]
})
export class StatusTabsComponent {
  @Input() tabs: StatusTabItem[] = [];
  @Input() activeKey: string = 'all';
  @Output() tabChange = new EventEmitter<string>();

  selectTab(key: string): void {
    if (this.activeKey !== key) {
      this.activeKey = key;
      this.tabChange.emit(key);
    }
  }
}
