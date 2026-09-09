import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-search-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="cids-search-bar-wrapper">
      <!-- Search Input -->
      <div class="search-input-box">
        <input
          type="text"
          class="search-input"
          [placeholder]="placeholder"
          [(ngModel)]="searchValue"
          (input)="onInputChange()"
          (keyup.enter)="onSearch()"
        />
        <button
          *ngIf="searchValue"
          type="button"
          class="clear-btn"
          (click)="clearSearch()"
          matTooltip="Xóa tìm kiếm"
        >
          <mat-icon>close</mat-icon>
        </button>
        <mat-icon class="search-icon" (click)="onSearch()">search</mat-icon>
      </div>

      <!-- Right Action Tools -->
      <div class="filter-actions">
        <!-- Refresh Button -->
        <button
          *ngIf="showRefresh"
          type="button"
          class="btn-icon-refresh"
          (click)="onRefresh()"
          matTooltip="Làm mới danh sách"
        >
          <mat-icon [class.spinning]="isRefreshing">refresh</mat-icon>
        </button>

        <!-- Filter Button -->
        <button
          *ngIf="showFilter"
          type="button"
          class="btn-filter"
          [class.has-filter]="filterCount > 0"
          (click)="onFilter()"
        >
          <mat-icon>filter_alt</mat-icon>
          <span>Bộ lọc</span>
          <span class="filter-badge" *ngIf="filterCount > 0">{{ filterCount }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .cids-search-bar-wrapper {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }

    .search-input-box {
      position: relative;
      flex: 1;
      max-width: 480px;
      display: flex;
      align-items: center;

      .search-input {
        width: 100%;
        height: 38px;
        padding: 0 40px 0 14px;
        font-size: 13.5px;
        color: #1f2937;
        background-color: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        outline: none;
        transition: all 0.2s ease;

        &::placeholder {
          color: #9ca3af;
        }

        &:focus {
          border-color: #1a56db;
          box-shadow: 0 0 0 3px rgba(26, 86, 219, 0.12);
        }
      }

      .search-icon {
        position: absolute;
        right: 12px;
        color: #9ca3af;
        font-size: 20px;
        width: 20px;
        height: 20px;
        cursor: pointer;
        transition: color 0.15s;

        &:hover {
          color: #1a56db;
        }
      }

      .clear-btn {
        position: absolute;
        right: 36px;
        background: transparent;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }

        &:hover {
          color: #4b5563;
        }
      }
    }

    .filter-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-icon-refresh {
      width: 38px;
      height: 38px;
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #4b5563;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background-color: #f9fafb;
        color: #1a56db;
        border-color: #93c5fd;
      }

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        transition: transform 0.4s ease;

        &.spinning {
          animation: spin 0.7s linear infinite;
        }
      }
    }

    .btn-filter {
      height: 38px;
      padding: 0 16px;
      background-color: #1e3a8a;
      color: #ffffff;
      border: 1px solid #1e3a8a;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      transition: all 0.2s;

      &:hover {
        background-color: #1d4ed8;
        border-color: #1d4ed8;
        box-shadow: 0 4px 10px rgba(30, 58, 138, 0.25);
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .filter-badge {
        background-color: #ef4444;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 9999px;
        margin-left: 2px;
      }

      &.has-filter {
        background-color: #1a56db;
      }
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `]
})
export class SearchFilterBarComponent {
  @Input() placeholder: string = 'Tìm kiếm trong danh sách';
  @Input() showRefresh: boolean = true;
  @Input() showFilter: boolean = true;
  @Input() filterCount: number = 0;
  @Input() isRefreshing: boolean = false;

  @Output() search = new EventEmitter<string>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();
  @Output() filter = new EventEmitter<void>();

  searchValue: string = '';

  onInputChange(): void {
    this.searchChange.emit(this.searchValue);
  }

  onSearch(): void {
    this.search.emit(this.searchValue);
  }

  clearSearch(): void {
    this.searchValue = '';
    this.searchChange.emit('');
    this.search.emit('');
  }

  onRefresh(): void {
    this.refresh.emit();
  }

  onFilter(): void {
    this.filter.emit();
  }
}
