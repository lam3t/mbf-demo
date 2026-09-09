import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  type?: 'text' | 'number' | 'currency' | 'date' | 'badge' | 'custom';
  align?: 'left' | 'center' | 'right';
  width?: string;
  badgeMapping?: Record<string, { label?: string; cssClass?: string }>;
  formatter?: (value: any, row: any) => string;
}

export interface TableAction {
  id: string;
  label: string;
  icon?: string;
  color?: string;
  dividerBefore?: boolean;
  hidden?: (row: any) => boolean;
  disabled?: (row: any) => boolean;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="cids-table-container">
      <!-- Loading Overlay -->
      <div class="loading-overlay" *ngIf="loading">
        <mat-spinner diameter="36"></mat-spinner>
        <span>Đang tải dữ liệu...</span>
      </div>

      <!-- Main Table -->
      <div class="table-scroll-wrapper">
        <table class="cids-table">
          <thead>
            <tr>
              <!-- Index Column -->
              <th *ngIf="showIndex" class="col-index text-center">#</th>

              <!-- Checkbox Column -->
              <th *ngIf="showCheckbox" class="col-checkbox text-center">
                <mat-checkbox
                  [checked]="isAllSelected()"
                  [indeterminate]="isPartiallySelected()"
                  (change)="toggleSelectAll($event.checked)"
                  color="primary"
                ></mat-checkbox>
              </th>

              <!-- Action Column Header -->
              <th *ngIf="actions && actions.length > 0" class="col-action text-center">
                Thao tác
              </th>

              <!-- Dynamic Data Columns -->
              <th
                *ngFor="let col of columns"
                [style.width]="col.width || 'auto'"
                [style.text-align]="col.align || 'left'"
                [class.sortable]="col.sortable"
                (click)="onSort(col)"
              >
                <div class="th-content" [style.justify-content]="getThJustify(col)">
                  <span>{{ col.label }}</span>
                  <span class="sort-icon" *ngIf="col.sortable">
                    <mat-icon *ngIf="sortColumn !== col.key">unfold_more</mat-icon>
                    <mat-icon *ngIf="sortColumn === col.key && sortDirection === 'asc'">arrow_upward</mat-icon>
                    <mat-icon *ngIf="sortColumn === col.key && sortDirection === 'desc'">arrow_downward</mat-icon>
                  </span>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            <!-- Empty State -->
            <tr *ngIf="!loading && (!data || data.length === 0)">
              <td [attr.colspan]="getTotalColumnsCount()" class="empty-state">
                <mat-icon>inbox</mat-icon>
                <p>Không có bản ghi nào phù hợp</p>
              </td>
            </tr>

            <!-- Data Rows -->
            <tr
              *ngFor="let row of paginatedData; let i = index"
              [class.selected-row]="isRowSelected(row)"
              (click)="onRowClick(row, $event)"
            >
              <!-- Index Cell -->
              <td *ngIf="showIndex" class="col-index text-center">
                {{ getRowIndex(i) }}
              </td>

              <!-- Checkbox Cell -->
              <td *ngIf="showCheckbox" class="col-checkbox text-center" (click)="$event.stopPropagation()">
                <mat-checkbox
                  [checked]="isRowSelected(row)"
                  (change)="toggleRowSelection(row, $event.checked)"
                  color="primary"
                ></mat-checkbox>
              </td>

              <!-- Action Cell (3-dots menu) -->
              <td *ngIf="actions && actions.length > 0" class="col-action text-center" (click)="$event.stopPropagation()">
                <button
                  type="button"
                  class="btn-action-dots"
                  [matMenuTriggerFor]="rowMenu"
                  matTooltip="Tùy chọn thao tác"
                >
                  <mat-icon>more_horiz</mat-icon>
                </button>

                <mat-menu #rowMenu="matMenu">
                  <ng-container *ngFor="let act of actions">
                    <div *ngIf="act.dividerBefore" class="menu-divider"></div>
                    <button
                      *ngIf="!act.hidden || !act.hidden(row)"
                      mat-menu-item
                      [disabled]="act.disabled && act.disabled(row)"
                      (click)="onAction(act.id, row)"
                    >
                      <mat-icon *ngIf="act.icon" [style.color]="act.color || 'inherit'">{{ act.icon }}</mat-icon>
                      <span [style.color]="act.color || 'inherit'">{{ act.label }}</span>
                    </button>
                  </ng-container>
                </mat-menu>
              </td>

              <!-- Dynamic Data Cells -->
              <td
                *ngFor="let col of columns"
                [style.text-align]="col.align || 'left'"
              >
                <!-- Badge Type -->
                <ng-container *ngIf="col.type === 'badge'">
                  <span class="badge-status" [ngClass]="getBadgeClass(col, row[col.key])">
                    {{ getBadgeLabel(col, row[col.key]) }}
                  </span>
                </ng-container>

                <!-- Currency Type -->
                <ng-container *ngIf="col.type === 'currency'">
                  <span class="currency-text">{{ row[col.key] | number:'1.0-0' }} ₫</span>
                </ng-container>

                <!-- Number Type -->
                <ng-container *ngIf="col.type === 'number'">
                  <span>{{ row[col.key] | number }}</span>
                </ng-container>

                <!-- Date Type -->
                <ng-container *ngIf="col.type === 'date'">
                  <span>{{ row[col.key] ? (row[col.key] | date:'dd/MM/yyyy') : '-' }}</span>
                </ng-container>

                <!-- Default Text / Formatter -->
                <ng-container *ngIf="!col.type || col.type === 'text'">
                  <span *ngIf="col.formatter">{{ col.formatter(row[col.key], row) }}</span>
                  <span *ngIf="!col.formatter">{{ row[col.key] !== null && row[col.key] !== undefined && row[col.key] !== '' ? row[col.key] : '-' }}</span>
                </ng-container>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="table-footer">
        <div class="footer-left">
          <span class="selection-summary" *ngIf="selectedRows.length > 0">
            Đã chọn <strong>{{ selectedRows.length }}</strong> / {{ totalItemsCount }} bản ghi
          </span>
          <span class="records-summary" *ngIf="selectedRows.length === 0">
            Tổng số <strong>{{ totalItemsCount }}</strong> bản ghi
          </span>
        </div>

        <mat-paginator
          [length]="totalItemsCount"
          [pageSize]="pageSize"
          [pageSizeOptions]="pageSizeOptions"
          [pageIndex]="pageIndex"
          (page)="onPageChange($event)"
          showFirstLastButtons
        ></mat-paginator>
      </div>
    </div>
  `,
  styles: [`
    .cids-table-container {
      position: relative;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      z-index: 10;
      font-size: 13px;
      color: #1e3a8a;
      font-weight: 500;
    }

    .table-scroll-wrapper {
      overflow-x: auto;
      width: 100%;
    }

    .cids-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;

      thead {
        background-color: #f8fafc;
        border-bottom: 1px solid #e5e7eb;

        tr th {
          padding: 12px 14px;
          font-weight: 600;
          color: #374151;
          font-size: 13px;
          white-space: nowrap;
          user-select: none;

          &.sortable {
            cursor: pointer;
            &:hover {
              background-color: #f1f5f9;
              color: #1a56db;
            }
          }

          .th-content {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            width: 100%;
          }

          .sort-icon {
            display: inline-flex;
            align-items: center;
            mat-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
              color: #9ca3af;
            }
          }
        }
      }

      tbody {
        tr {
          border-bottom: 1px solid #f1f5f9;
          transition: background-color 0.15s ease;

          &:last-child {
            border-bottom: none;
          }

          &:hover {
            background-color: #f8fafc;
          }

          &.selected-row {
            background-color: #eff6ff;
          }

          td {
            padding: 12px 14px;
            color: #1f2937;
            vertical-align: middle;
            font-size: 13px;
            line-height: 1.4;
          }
        }
      }
    }

    .col-index {
      width: 48px;
      min-width: 48px;
      color: #6b7280 !important;
      font-weight: 500;
    }

    .col-checkbox {
      width: 44px;
      min-width: 44px;
    }

    .col-action {
      width: 72px;
      min-width: 72px;
    }

    .text-center {
      text-align: center !important;
    }

    .text-right {
      text-align: right !important;
    }

    .btn-action-dots {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 1px solid #e5e7eb;
      background-color: #f9fafb;
      color: #4b5563;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background-color: #eaf1ff;
        color: #1a56db;
        border-color: #bfdbfe;
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .menu-divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 4px 0;
    }

    .empty-state {
      text-align: center !important;
      padding: 48px 16px !important;
      color: #9ca3af;

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        margin-bottom: 8px;
        color: #cbd5e1;
      }

      p {
        margin: 0;
        font-size: 14px;
      }
    }

    .table-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 16px;
      border-top: 1px solid #e5e7eb;
      background-color: #ffffff;
      flex-wrap: wrap;

      .footer-left {
        font-size: 13px;
        color: #4b5563;
        padding: 8px 0;

        strong {
          color: #1e3a8a;
        }
      }

      mat-paginator {
        background: transparent;
      }
    }

    .currency-text {
      font-weight: 600;
      color: #111827;
    }
  `]
})
export class DataTableComponent implements OnChanges {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() loading: boolean = false;
  @Input() showCheckbox: boolean = true;
  @Input() showIndex: boolean = true;
  @Input() actions: TableAction[] = [];
  @Input() pageSize: number = 10;
  @Input() pageSizeOptions: number[] = [5, 10, 20, 50];
  @Input() totalRecords?: number;
  @Input() isServerSidePagination: boolean = false;

  @Output() selectionChange = new EventEmitter<any[]>();
  @Output() actionClick = new EventEmitter<{ action: string; row: any }>();
  @Output() sortChange = new EventEmitter<{ column: string; direction: 'asc' | 'desc' | '' }>();
  @Output() pageChange = new EventEmitter<{ pageIndex: number; pageSize: number }>();
  @Output() rowClick = new EventEmitter<any>();

  selectedRows: any[] = [];
  pageIndex: number = 0;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' | '' = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      // Clear selections if data was refreshed
      this.selectedRows = this.selectedRows.filter(sel =>
        this.data.some(d => (d.id && d.id === sel.id) || d === sel)
      );
    }
  }

  get totalItemsCount(): number {
    return this.totalRecords !== undefined ? this.totalRecords : (this.data ? this.data.length : 0);
  }

  get paginatedData(): any[] {
    if (!this.data) return [];
    if (this.isServerSidePagination) {
      return this.data;
    }
    const startIndex = this.pageIndex * this.pageSize;
    return this.data.slice(startIndex, startIndex + this.pageSize);
  }

  getTotalColumnsCount(): number {
    let count = this.columns.length;
    if (this.showIndex) count++;
    if (this.showCheckbox) count++;
    if (this.actions && this.actions.length > 0) count++;
    return count;
  }

  getRowIndex(indexInPage: number): number {
    return this.pageIndex * this.pageSize + indexInPage + 1;
  }

  getThJustify(col: TableColumn): string {
    switch (col.align) {
      case 'center': return 'center';
      case 'right': return 'flex-end';
      default: return 'flex-start';
    }
  }

  // Selection methods
  isAllSelected(): boolean {
    const currentRows = this.paginatedData;
    if (currentRows.length === 0) return false;
    return currentRows.every(row => this.isRowSelected(row));
  }

  isPartiallySelected(): boolean {
    const currentRows = this.paginatedData;
    const selectedCount = currentRows.filter(row => this.isRowSelected(row)).length;
    return selectedCount > 0 && selectedCount < currentRows.length;
  }

  isRowSelected(row: any): boolean {
    return this.selectedRows.some(r => (r.id && row.id ? r.id === row.id : r === row));
  }

  toggleRowSelection(row: any, checked: boolean): void {
    if (checked) {
      if (!this.isRowSelected(row)) {
        this.selectedRows.push(row);
      }
    } else {
      this.selectedRows = this.selectedRows.filter(r => (r.id && row.id ? r.id !== row.id : r !== row));
    }
    this.selectionChange.emit([...this.selectedRows]);
  }

  toggleSelectAll(checked: boolean): void {
    const currentRows = this.paginatedData;
    if (checked) {
      currentRows.forEach(row => {
        if (!this.isRowSelected(row)) {
          this.selectedRows.push(row);
        }
      });
    } else {
      this.selectedRows = this.selectedRows.filter(
        sel => !currentRows.some(row => (row.id && sel.id ? row.id === sel.id : row === sel))
      );
    }
    this.selectionChange.emit([...this.selectedRows]);
  }

  // Action methods
  onAction(actionId: string, row: any): void {
    this.actionClick.emit({ action: actionId, row });
  }

  onRowClick(row: any, event: MouseEvent): void {
    this.rowClick.emit(row);
  }

  // Sorting
  onSort(col: TableColumn): void {
    if (!col.sortable) return;

    if (this.sortColumn !== col.key) {
      this.sortColumn = col.key;
      this.sortDirection = 'asc';
    } else {
      if (this.sortDirection === 'asc') {
        this.sortDirection = 'desc';
      } else if (this.sortDirection === 'desc') {
        this.sortDirection = '';
        this.sortColumn = '';
      }
    }

    this.sortChange.emit({
      column: this.sortColumn,
      direction: this.sortDirection
    });
  }

  // Pagination
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.pageChange.emit({
      pageIndex: this.pageIndex,
      pageSize: this.pageSize
    });
  }

  // Badge mapping helpers
  getBadgeClass(col: TableColumn, value: any): string {
    if (!col.badgeMapping || !value) {
      const normalized = String(value || '').toLowerCase().replace(/[\s-]/g, '_');
      return 'badge-' + normalized;
    }
    const mapping = col.badgeMapping[value];
    return mapping?.cssClass || 'badge-' + String(value).toLowerCase();
  }

  getBadgeLabel(col: TableColumn, value: any): string {
    if (!col.badgeMapping || !value) {
      return value || '-';
    }
    const mapping = col.badgeMapping[value];
    return mapping?.label || value || '-';
  }
}
