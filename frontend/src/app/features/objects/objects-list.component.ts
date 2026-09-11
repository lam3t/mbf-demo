import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  PageHeaderComponent,
  PageHeaderAction,
  StatusTabsComponent,
  StatusTabItem,
  SearchFilterBarComponent,
  DataTableComponent,
  TableColumn,
  TableAction,
  WardSelectComponent
} from '../../shared/components';

import { ObjectDialogComponent } from './components/object-dialog.component';
import { ImportDialogComponent } from './components/import-dialog.component';
import { ObjectDetailDialogComponent, ObjectDetailResult } from './components/object-detail-dialog.component';
import { ApiService } from '../../core/services/api.service';
import { BusinessObject } from '../../core/models';

@Component({
  selector: 'app-objects-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatSnackBarModule,
    PageHeaderComponent,
    StatusTabsComponent,
    SearchFilterBarComponent,
    DataTableComponent,
    WardSelectComponent
  ],
  template: `
    <div class="objects-page-container">
      <!-- 1. Page Header -->
      <app-page-header
        title="Danh sách đối tượng"
        [subtitle]="'Tổng số ' + objects.length + ' cơ sở kinh doanh, doanh nghiệp và hộ cá thể tại 5 phường Hà Nội'"
        [actions]="headerActions"
        (actionClick)="handleHeaderAction($event)"
      ></app-page-header>

      <!-- 2. Search & Filter Bar -->
      <app-search-filter-bar
        placeholder="Tìm kiếm theo tên cơ sở, MST, số CCCD, địa chỉ, người đại diện..."
        [isRefreshing]="isLoading"
        (search)="handleSearch($event)"
        (searchChange)="handleSearch($event)"
        (refresh)="loadObjects()"
        (filter)="toggleAdvancedFilter()"
      ></app-search-filter-bar>

      <!-- Advanced Filter Row (Collapsible) -->
      <div class="advanced-filter-panel" *ngIf="showAdvancedFilter">
        <div class="filter-item">
          <label>Loại hình đối tượng:</label>
          <select class="cids-select" [(ngModel)]="selectedType" (change)="applyFilters()">
            <option value="">Tất cả loại hình</option>
            <option value="enterprise">Doanh nghiệp</option>
            <option value="household">Hộ kinh doanh</option>
            <option value="individual">Cá nhân kinh doanh</option>
          </select>
        </div>

        <div class="filter-item">
          <label>Địa bàn Phường:</label>
          <app-ward-select
            [(ngModel)]="selectedWard"
            (wardChange)="applyFilters()"
            placeholder="Tất cả 5 phường demo"
            [includeAllOption]="true"
          ></app-ward-select>
        </div>
      </div>

      <!-- 3. Status Tabs Ribbon -->
      <app-status-tabs
        [tabs]="statusTabs"
        [activeKey]="activeStatusKey"
        (tabChange)="handleStatusTabChange($event)"
      ></app-status-tabs>

      <!-- 4. Data Table -->
      <app-data-table
        [columns]="tableColumns"
        [data]="filteredObjects"
        [actions]="rowActions"
        [loading]="isLoading"
        [pageSize]="10"
        [pageSizeOptions]="[5, 10, 20, 50]"
        (actionClick)="handleRowAction($event)"
        (rowClick)="handleRowClick($event)"
      ></app-data-table>
    </div>
  `,
  styles: [`
    .objects-page-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 1560px;
      margin: 0 auto;
    }

    .advanced-filter-panel {
      display: flex;
      align-items: center;
      gap: 16px;
      background: #ffffff;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      margin-bottom: 4px;

      .filter-item {
        display: flex;
        align-items: center;
        gap: 8px;

        label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
        }

        .cids-select {
          height: 36px;
          padding: 0 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
          color: #111827;
          background-color: #ffffff;
          outline: none;

          &:focus {
            border-color: #1a56db;
          }
        }
      }
    }
  `]
})
export class ObjectsListComponent implements OnInit {
  objects: BusinessObject[] = [];
  filteredObjects: BusinessObject[] = [];
  isLoading = false;
  searchQuery = '';
  activeStatusKey = 'all';
  selectedType = '';
  selectedWard = '';
  showAdvancedFilter = false;

  wardOptions = [
    'Phường Khương Mai',
    'Phường Hàng Bài',
    'Phường Mỹ Đình 1',
    'Phường Quảng An',
    'Phường Đồng Tâm'
  ];

  headerActions: PageHeaderAction[] = [
    { id: 'import_excel', label: 'Import Excel', icon: 'upload_file', variant: 'secondary' },
    { id: 'create_object', label: 'Thêm mới đối tượng', icon: 'add', variant: 'primary' }
  ];

  statusTabs: StatusTabItem[] = [
    { key: 'all', label: 'Tất cả', count: 0, color: 'gray' },
    { key: 'active', label: 'Đang hoạt động', count: 0, color: 'green' },
    { key: 'suspended', label: 'Tạm ngừng', count: 0, color: 'red' }
  ];

  tableColumns: TableColumn[] = [
    {
      key: 'type',
      label: 'Loại hình',
      sortable: true,
      type: 'badge',
      width: '14%',
      badgeMapping: {
        enterprise: { label: 'Doanh nghiệp', cssClass: 'badge-in_progress' },
        household: { label: 'Hộ kinh doanh', cssClass: 'badge-approved' },
        individual: { label: 'Cá nhân KD', cssClass: 'badge-pending' }
      }
    },
    {
      key: 'identifier',
      label: 'Mã định danh (MST/CCCD)',
      sortable: true,
      width: '16%',
      formatter: (val, row) => row.taxCode || row.idNumber || '-'
    },
    {
      key: 'name',
      label: 'Tên cơ sở / Tổ chức kinh doanh',
      sortable: true,
      width: '38%'
    },
    {
      key: 'ward',
      label: 'Phường quản lý',
      sortable: true,
      width: '18%'
    },
    {
      key: 'status',
      label: 'Trạng thái',
      sortable: true,
      type: 'badge',
      width: '14%',
      badgeMapping: {
        active: { label: 'Hoạt động', cssClass: 'badge-new' },
        suspended: { label: 'Tạm ngừng', cssClass: 'badge-closed' }
      }
    }
  ];

  rowActions: TableAction[] = [
    { id: 'view', label: 'Xem chi tiết hồ sơ', icon: 'visibility' },
    { id: 'edit', label: 'Chỉnh sửa thông tin', icon: 'edit' }
  ];

  constructor(
    private api: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadObjects();
  }

  loadObjects(): void {
    this.isLoading = true;
    this.api.get<any>('/objects?limit=100').subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.objects = res.data;
          this.updateTabCounts();
          this.applyFilters();
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  updateTabCounts(): void {
    const activeCount = this.objects.filter(o => o.status === 'active').length;
    const suspendedCount = this.objects.filter(o => o.status === 'suspended').length;

    this.statusTabs.forEach(tab => {
      if (tab.key === 'all') tab.count = this.objects.length;
      else if (tab.key === 'active') tab.count = activeCount;
      else if (tab.key === 'suspended') tab.count = suspendedCount;
    });
  }

  applyFilters(): void {
    let result = [...this.objects];

    // Status filter
    if (this.activeStatusKey && this.activeStatusKey !== 'all') {
      result = result.filter(o => o.status === this.activeStatusKey);
    }

    // Type filter
    if (this.selectedType) {
      result = result.filter(o => o.type === this.selectedType);
    }

    // Ward filter
    if (this.selectedWard) {
      result = result.filter(o => o.ward === this.selectedWard);
    }

    // Search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter(
        o =>
          o.name.toLowerCase().includes(q) ||
          (o.taxCode && o.taxCode.toLowerCase().includes(q)) ||
          (o.idNumber && o.idNumber.toLowerCase().includes(q)) ||
          (o.representative && o.representative.toLowerCase().includes(q)) ||
          o.address.toLowerCase().includes(q)
      );
    }

    this.filteredObjects = result;
  }

  handleStatusTabChange(key: string): void {
    this.activeStatusKey = key;
    this.applyFilters();
  }

  handleSearch(query: string): void {
    this.searchQuery = query;
    this.applyFilters();
  }

  toggleAdvancedFilter(): void {
    this.showAdvancedFilter = !this.showAdvancedFilter;
  }

  handleHeaderAction(actionId: string): void {
    if (actionId === 'create_object') {
      const dialogRef = this.dialog.open(ObjectDialogComponent, {
        width: '600px',
        data: { isEdit: false }
      });

      dialogRef.afterClosed().subscribe(formData => {
        if (formData) {
          this.api.post<any>('/objects', formData).subscribe({
            next: (res) => {
              if (res.success) {
                this.snackBar.open('Thêm mới đối tượng thành công!', 'Đóng', { duration: 2500 });
                this.loadObjects();
              }
            },
            error: (err) => {
              this.snackBar.open(err.error?.message || 'Lỗi thêm mới đối tượng', 'Đóng', { duration: 3000 });
            }
          });
        }
      });
    } else if (actionId === 'import_excel') {
      const dialogRef = this.dialog.open(ImportDialogComponent, {
        width: '640px'
      });

      dialogRef.afterClosed().subscribe(hasImported => {
        if (hasImported) {
          this.loadObjects();
        }
      });
    }
  }

  handleRowAction(event: { action: string; row: BusinessObject }): void {
    if (event.action === 'edit') {
      this.openEditDialog(event.row);
    } else if (event.action === 'view') {
      this.openDetailDialog(event.row);
    }
  }

  handleRowClick(row: BusinessObject): void {
    this.openDetailDialog(row);
  }

  openDetailDialog(row: BusinessObject): void {
    const dialogRef = this.dialog.open<ObjectDetailDialogComponent, any, ObjectDetailResult>(
      ObjectDetailDialogComponent,
      {
        width: '740px',
        data: { objectId: row.id, object: row }
      }
    );

    dialogRef.afterClosed().subscribe(res => {
      if (res && res.action === 'edit') {
        this.openEditDialog(res.object || row);
      }
    });
  }

  openEditDialog(row: BusinessObject): void {
    const dialogRef = this.dialog.open(ObjectDialogComponent, {
      width: '600px',
      data: { isEdit: true, object: row }
    });

    dialogRef.afterClosed().subscribe(formData => {
      if (formData) {
        this.api.put<any>(`/objects/${row.id}`, formData).subscribe({
          next: (res) => {
            if (res.success) {
              this.snackBar.open('Cập nhật đối tượng thành công!', 'Đóng', { duration: 2500 });
              this.loadObjects();
            }
          },
          error: (err) => {
            this.snackBar.open(err.error?.message || 'Lỗi cập nhật đối tượng', 'Đóng', { duration: 3000 });
          }
        });
      }
    });
  }
}
