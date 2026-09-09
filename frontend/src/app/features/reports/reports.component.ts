import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
    MatTabsModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatSnackBarModule,
    PageHeaderComponent
  ],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit {
  activeTab = 0; // 0: Recommendations, 1: Quarterly Summary

  // Tab 1 Data & Filters
  recommendations: any[] = [];
  selectedRecQuarter = '';
  selectedRecWard = '';
  selectedRecTag = '';
  isExportingRec = false;

  // Tab 2 Data & Filters
  quarterlySummaries: any[] = [];
  selectedQuarter = 'Q2/2026';
  isExportingQuarterly = false;

  // Catalogs
  tagCatalog: RecommendationTagCatalog[] = [];
  readonly WARDS = [
    'Phường Hoàn Kiếm',
    'Phường Ba Đình',
    'Phường Đống Đa',
    'Phường Hai Bà Trưng',
    'Phường Cầu Giấy'
  ];

  readonly QUARTERS = ['Q1/2026', 'Q2/2026', 'Q3/2026', 'Q4/2026'];

  // Table Columns
  recColumns = ['id', 'objectName', 'ward', 'tags', 'recommendationNote', 'completedAt'];
  quarterlyColumns = ['quarter', 'ward', 'total', 'completed', 'inProgress', 'notStarted', 'violations', 'rate'];

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadTagCatalog();
    this.loadRecommendations();
    this.loadQuarterlySummary();
  }

  loadTagCatalog(): void {
    this.api.get<any>('/recommendation-tag-catalog').subscribe({
      next: (res) => {
        if (res.success) this.tagCatalog = res.data;
      }
    });
  }

  loadRecommendations(): void {
    const params: any = {};
    if (this.selectedRecQuarter) params.quarter = this.selectedRecQuarter;
    if (this.selectedRecWard) params.ward = this.selectedRecWard;
    if (this.selectedRecTag) params.tag = this.selectedRecTag;

    this.api.get<any>('/reports/recommendations', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.recommendations = res.data;
        }
      }
    });
  }

  loadQuarterlySummary(): void {
    const params: any = {};
    if (this.selectedQuarter) params.quarter = this.selectedQuarter;

    this.api.get<any>('/reports/quarterly', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.quarterlySummaries = res.data;
        }
      }
    });
  }

  onRecFilterChange(): void {
    this.loadRecommendations();
  }

  onQuarterlyFilterChange(): void {
    this.loadQuarterlySummary();
  }

  exportRecommendationsExcel(): void {
    this.isExportingRec = true;
    const params: any = {};
    if (this.selectedRecQuarter) params.quarter = this.selectedRecQuarter;
    if (this.selectedRecWard) params.ward = this.selectedRecWard;
    if (this.selectedRecTag) params.tag = this.selectedRecTag;

    this.snackBar.open('Đang tạo và tải file Báo cáo Kiến nghị...', '', { duration: 2000 });

    this.api.getBlob('/reports/recommendations/export', params).subscribe({
      next: (blob) => {
        this.isExportingRec = false;
        const qStr = (this.selectedRecQuarter || 'Tat_ca').replace(/[/\\?%*:|"<>]/g, '_');
        const filename = `Bao_cao_Kien_nghi_${qStr}_${Date.now()}.xlsx`;
        this.saveBlob(blob, filename);
        this.snackBar.open('Xuất Báo cáo Excel thành công!', 'Đóng', { duration: 3000 });
      },
      error: (err) => {
        this.isExportingRec = false;
        console.error('Export recommendations error:', err);
        this.snackBar.open('Lỗi khi xuất file Excel. Vui lòng thử lại!', 'Đóng', { duration: 3000 });
      }
    });
  }

  exportQuarterlySummaryExcel(): void {
    this.isExportingQuarterly = true;
    const params: any = {};
    if (this.selectedQuarter) params.quarter = this.selectedQuarter;

    this.snackBar.open('Đang tạo và tải file Báo cáo Tổng kết Quý...', '', { duration: 2000 });

    this.api.getBlob('/reports/quarterly/export', params).subscribe({
      next: (blob) => {
        this.isExportingQuarterly = false;
        const qStr = (this.selectedQuarter || 'Tat_ca').replace(/[/\\?%*:|"<>]/g, '_');
        const filename = `Bao_cao_Tong_ket_${qStr}_${Date.now()}.xlsx`;
        this.saveBlob(blob, filename);
        this.snackBar.open('Xuất Báo cáo Tổng kết Excel thành công!', 'Đóng', { duration: 3000 });
      },
      error: (err) => {
        this.isExportingQuarterly = false;
        console.error('Export quarterly summary error:', err);
        this.snackBar.open('Lỗi khi xuất file Excel. Vui lòng thử lại!', 'Đóng', { duration: 3000 });
      }
    });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const cleanFilename = filename.replace(/[/\\?%*:|"<>]/g, '_');
    const excelBlob = new Blob([blob], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = dataUrl;
      a.setAttribute('download', cleanFilename);
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) {
          document.body.removeChild(a);
        }
      }, 500);
    };
    reader.readAsDataURL(excelBlob);
  }

  parseTags(tags: any): string[] {
    if (!tags) return [];
    try {
      const parsed = typeof tags === 'string' ? JSON.parse(tags) : tags;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  getTagLabel(code: string): string {
    const found = this.tagCatalog.find(t => t.code === code);
    return found ? found.name : code;
  }
}
