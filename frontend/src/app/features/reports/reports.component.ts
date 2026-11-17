import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { RecommendationTagCatalog } from '../../core/models';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
    MatSnackBarModule,
    PageHeaderComponent
  ],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit {
  // 0: Phụ lục 02 (Đầu quý & Lọc trùng), 1: Phụ lục 01 (Kết quả cuối quý), 2: Phụ lục 03 (Chuyển quý sau), 3: Kiến nghị
  activeTab = 0;

  readonly QUARTERS = ['Q1/2026', 'Q2/2026', 'Q3/2026', 'Q4/2026'];
  readonly WARDS = [
    'Phường Hoàn Kiếm',
    'Phường Ba Đình',
    'Phường Đống Đa',
    'Phường Hai Bà Trưng',
    'Phường Cầu Giấy'
  ];

  // --- PHỤ LỤC 02 ---
  app02Quarter = 'Q2/2026';
  app02Ward = '';
  app02Deduplicate = true;
  app02ExcludeOutOfScope = true;
  app02Items: any[] = [];
  app02FilteredOut: any[] = [];
  app02Stats = { totalRaw: 0, duplicateRemoved: 0, outOfScopeRemoved: 0, totalValid: 0 };
  showFilteredOut = false;
  isExporting02 = false;
  isImporting02 = false;
  importWard = 'Phường Hoàn Kiếm';
  app02Columns = [
    'stt',
    'objectName',
    'taxCode',
    'address',
    'inspectionContent',
    'inspectionMethod',
    'leadUnit',
    'coordinatingUnit',
    'note'
  ];

  // --- PHỤ LỤC 01 ---
  app01Quarter = 'Q2/2026';
  app01Ward = '';
  app01Data: any = null;
  isExporting01 = false;

  // --- PHỤ LỤC 03 ---
  app03Quarter = 'Q2/2026';
  app03Ward = '';
  app03TargetQuarter = 'Q3/2026';
  app03Items: any[] = [];
  isExporting03 = false;
  isCarryingOver = false;
  app03Columns = [
    'stt',
    'objectName',
    'taxCode',
    'address',
    'inspectionContent',
    'leadUnit',
    'uninspectedReason'
  ];

  // --- KIẾN NGHỊ ---
  recommendations: any[] = [];
  selectedRecQuarter = '';
  selectedRecWard = '';
  selectedRecTag = '';
  tagCatalog: RecommendationTagCatalog[] = [];
  isExportingRec = false;
  recColumns = ['id', 'objectName', 'ward', 'tags', 'recommendationNote', 'completedAt'];

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadAppendix02();
    this.loadAppendix01();
    this.loadAppendix03();
    this.loadTagCatalog();
    this.loadRecommendations();
  }

  // ==================== PHỤ LỤC 02 ====================
  loadAppendix02(): void {
    this.api
      .get<any>('/reports/appendix-02', {
        quarter: this.app02Quarter,
        ward: this.app02Ward,
        deduplicate: String(this.app02Deduplicate),
        excludeOutOfScope: String(this.app02ExcludeOutOfScope)
      })
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.app02Items = res.data.items || [];
            this.app02FilteredOut = res.data.filteredOutItems || [];
            this.app02Stats = res.data.stats || {
              totalRaw: 0,
              duplicateRemoved: 0,
              outOfScopeRemoved: 0,
              totalValid: 0
            };
          }
        }
      });
  }

  exportAppendix02(format: 'excel' | 'doc'): void {
    this.isExporting02 = true;
    this.api
      .getBlob('/reports/appendix-02/export', {
        quarter: this.app02Quarter,
        ward: this.app02Ward,
        deduplicate: String(this.app02Deduplicate),
        excludeOutOfScope: String(this.app02ExcludeOutOfScope),
        format
      })
      .subscribe({
        next: (blob) => {
          const ext = format === 'doc' ? 'doc' : 'xlsx';
          this.saveBlob(blob, `Phu_luc_02_${this.app02Quarter.replace('/', '_')}.${ext}`);
          this.isExporting02 = false;
        },
        error: () => {
          this.isExporting02 = false;
          this.notify('Lỗi khi xuất Phụ lục 02');
        }
      });
  }

  onImportAppendix02File(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isImporting02 = true;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('quarter', this.app02Quarter);
    formData.append('ward', this.app02Ward || this.importWard);

    this.api.post<any>('/reports/appendix-02/import', formData).subscribe({
      next: (res) => {
        this.isImporting02 = false;
        input.value = '';
        if (res.success) {
          const d = res.data;
          this.notify(`Đã nhập ${d.importedCount} cơ sở vào Phụ lục 02 (bỏ qua ${d.skippedDuplicates} trùng).`);
          this.loadAppendix02();
        }
      },
      error: () => {
        this.isImporting02 = false;
        input.value = '';
        this.notify('Lỗi khi đọc file Excel Phụ lục 02');
      }
    });
  }

  // ==================== PHỤ LỤC 01 ====================
  loadAppendix01(): void {
    this.api
      .get<any>('/reports/appendix-01', {
        quarter: this.app01Quarter,
        ward: this.app01Ward
      })
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.app01Data = res.data;
          }
        }
      });
  }

  exportAppendix01(format: 'doc' | 'excel'): void {
    if (!this.app01Data) return;
    this.isExporting01 = true;
    this.api
      .getBlob('/reports/appendix-01/export', {
        quarter: this.app01Quarter,
        ward: this.app01Ward,
        format,
        securityIssuesNote: this.app01Data.securityIssuesNote || '',
        assessmentNote: this.app01Data.assessmentNote || '',
        proposalLegal: this.app01Data.proposalLegal || '',
        proposalSolution: this.app01Data.proposalSolution || '',
        proposalOther: this.app01Data.proposalOther || ''
      })
      .subscribe({
        next: (blob) => {
          const ext = format === 'doc' ? 'doc' : 'xlsx';
          this.saveBlob(blob, `Phu_luc_01_${this.app01Quarter.replace('/', '_')}.${ext}`);
          this.isExporting01 = false;
        },
        error: () => {
          this.isExporting01 = false;
          this.notify('Lỗi khi xuất Phụ lục 01');
        }
      });
  }

  // ==================== PHỤ LỤC 03 ====================
  loadAppendix03(): void {
    this.api
      .get<any>('/reports/appendix-03', {
        quarter: this.app03Quarter,
        ward: this.app03Ward
      })
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.app03Items = res.data || [];
          }
        }
      });
  }

  exportAppendix03(format: 'doc' | 'excel'): void {
    this.isExporting03 = true;
    this.api
      .getBlob('/reports/appendix-03/export', {
        quarter: this.app03Quarter,
        ward: this.app03Ward,
        format
      })
      .subscribe({
        next: (blob) => {
          const ext = format === 'doc' ? 'doc' : 'xlsx';
          this.saveBlob(blob, `Phu_luc_03_${this.app03Quarter.replace('/', '_')}.${ext}`);
          this.isExporting03 = false;
        },
        error: () => {
          this.isExporting03 = false;
          this.notify('Lỗi khi xuất Phụ lục 03');
        }
      });
  }

  carryOverToNextQuarter(): void {
    if (this.app03Items.length === 0) return;
    if (this.app03Quarter === this.app03TargetQuarter) {
      this.notify('Quý đích phải khác Quý hiện tại');
      return;
    }
    this.isCarryingOver = true;
    this.api
      .post<any>('/reports/appendix-03/carry-over', {
        fromQuarter: this.app03Quarter,
        toQuarter: this.app03TargetQuarter,
        ward: this.app03Ward || undefined
      })
      .subscribe({
        next: (res) => {
          this.isCarryingOver = false;
          if (res.success) {
            this.notify(
              `Đã chuyển ${res.data.carriedCount} cơ sở chưa kiểm tra từ ${this.app03Quarter} sang ${this.app03TargetQuarter}`
            );
            this.app02Quarter = this.app03TargetQuarter;
            this.loadAppendix02();
            this.loadAppendix03();
          }
        },
        error: () => {
          this.isCarryingOver = false;
          this.notify('Lỗi khi chuyển danh sách sang Quý sau');
        }
      });
  }

  // ==================== KIẾN NGHỊ ====================
  loadTagCatalog(): void {
    this.api.get<any>('/recommendation-tag-catalog').subscribe({
      next: (res) => {
        if (res.success) this.tagCatalog = res.data;
      }
    });
  }

  loadRecommendations(): void {
    this.api
      .get<any>('/reports/recommendations', {
        quarter: this.selectedRecQuarter,
        ward: this.selectedRecWard,
        tag: this.selectedRecTag
      })
      .subscribe({
        next: (res) => {
          if (res.success) this.recommendations = res.data || [];
        }
      });
  }

  exportRecommendationsExcel(): void {
    this.isExportingRec = true;
    this.api
      .getBlob('/reports/recommendations/export', {
        quarter: this.selectedRecQuarter,
        ward: this.selectedRecWard,
        tag: this.selectedRecTag
      })
      .subscribe({
        next: (blob) => {
          this.saveBlob(blob, `Bao_cao_Kien_nghi_${Date.now()}.xlsx`);
          this.isExportingRec = false;
        },
        error: () => {
          this.isExportingRec = false;
          this.notify('Lỗi khi xuất báo cáo kiến nghị');
        }
      });
  }

  parseTags(tagsStr: string): string[] {
    if (!tagsStr) return [];
    try {
      const parsed = JSON.parse(tagsStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  getTagLabel(code: string): string {
    return this.tagCatalog.find((t) => t.code === code)?.name || code;
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private notify(msg: string): void {
    this.snackBar.open(msg, 'Đóng', { duration: 3500 });
  }
}
