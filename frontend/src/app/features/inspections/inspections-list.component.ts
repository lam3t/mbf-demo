import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';
import { Inspection, ViolationCatalog, RecommendationTagCatalog } from '../../core/models';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InspectionDetailDialogComponent } from './components/inspection-detail-dialog.component';

export interface RecommendationItem {
  id: number;
  objectId: number;
  objectName: string;
  objectType: string;
  objectAddress: string;
  ward: string;
  recommendationNote: string;
  recommendationTags?: string;
  completedAt: string;
}

@Component({
  selector: 'app-inspections-list',
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
    PageHeaderComponent,
    InspectionDetailDialogComponent
  ],
  templateUrl: './inspections-list.component.html',
  styleUrls: ['./inspections-list.component.scss']
})
export class InspectionsListComponent implements OnInit {
  // Active main tab: 'inspections' | 'recommendations'
  activeTab: 'inspections' | 'recommendations' = 'inspections';

  // Inspections list data
  inspections: Inspection[] = [];
  filteredInspections: Inspection[] = [];
  isLoading = false;

  // Catalogs
  violationCatalog: ViolationCatalog[] = [];
  tagCatalog: RecommendationTagCatalog[] = [];

  // Filter state for Inspections
  selectedStatus = '';
  selectedWard = '';
  selectedQuarter = '';
  searchTerm = '';

  // Stats
  stats = {
    total: 0,
    not_started: 0,
    in_progress: 0,
    completed: 0,
    overdue: 0
  };

  // Recommendations Tab Data
  recommendationsList: RecommendationItem[] = [];
  filteredRecommendations: RecommendationItem[] = [];
  selectedRecTag = '';
  selectedRecWard = '';

  // Modal State
  selectedInspection: Inspection | null = null;
  isDialogOpen = false;

  // Table Columns
  displayedColumns = ['id', 'objectName', 'ward', 'planQuarter', 'violations', 'evidence', 'status', 'actions'];
  recommendationColumns = ['objectName', 'ward', 'tags', 'recommendationNote', 'completedAt', 'actions'];

  // List of wards for filter dropdown
  readonly WARDS = [
    'Phường Khương Mai',
    'Phường Hàng Bài',
    'Phường M�?Đình 1',
    'Phường Quảng An',
    'Phường Đồng Tâm'
  ];

  readonly QUARTERS = ['Q1/2026', 'Q2/2026', 'Q3/2026', 'Q4/2026'];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadCatalogs();
    this.loadInspections();
    this.loadRecommendations();
  }

  loadCatalogs(): void {
    this.api.get<any>('/violation-catalog').subscribe({
      next: (res) => {
        if (res.success) {
          this.violationCatalog = res.data;
        }
      }
    });

    this.api.get<any>('/recommendation-tag-catalog').subscribe({
      next: (res) => {
        if (res.success) {
          this.tagCatalog = res.data;
        }
      }
    });
  }

  loadInspections(): void {
    this.isLoading = true;
    const params: any = {};
    if (this.selectedStatus) params.status = this.selectedStatus;
    if (this.selectedWard) params.ward = this.selectedWard;
    if (this.selectedQuarter) params.quarter = this.selectedQuarter;
    if (this.searchTerm) params.search = this.searchTerm;

    this.api.get<any>('/inspections', params).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.inspections = res.data;
          this.filteredInspections = res.data;
          this.calculateStats();
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  calculateStats(): void {
    // If we have full list without filter, calculate stats
    this.api.get<any>('/inspections').subscribe({
      next: (res) => {
        if (res.success) {
          const all = res.data as Inspection[];
          this.stats = {
            total: all.length,
            not_started: all.filter(i => i.status === 'not_started' && !i.isOverdue).length,
            in_progress: all.filter(i => i.status === 'in_progress').length,
            completed: all.filter(i => i.status === 'completed').length,
            overdue: all.filter(i => !!i.isOverdue && i.status !== 'completed').length
          };
        }
      }
    });
  }

  loadRecommendations(): void {
    const params: any = {};
    if (this.selectedRecTag) params.tag = this.selectedRecTag;
    if (this.selectedRecWard) params.ward = this.selectedRecWard;

    this.api.get<any>('/recommendations', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.recommendationsList = res.data;
          this.filteredRecommendations = res.data;
        }
      }
    });
  }

  onTabChange(tab: 'inspections' | 'recommendations'): void {
    this.activeTab = tab;
    if (tab === 'recommendations') {
      this.loadRecommendations();
    } else {
      this.loadInspections();
    }
  }

  filterStatus(status: string): void {
    this.selectedStatus = status;
    this.loadInspections();
  }

  onFilterChange(): void {
    this.loadInspections();
  }

  resetFilters(): void {
    this.selectedStatus = '';
    this.selectedWard = '';
    this.selectedQuarter = '';
    this.searchTerm = '';
    this.loadInspections();
  }

  onRecFilterChange(): void {
    this.loadRecommendations();
  }

  openDetailModal(item: Inspection): void {
    // Fetch fresh detail
    this.api.get<any>(`/inspections/${item.id}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.selectedInspection = res.data;
          this.isDialogOpen = true;
        } else {
          this.selectedInspection = { ...item };
          this.isDialogOpen = true;
        }
      },
      error: () => {
        this.selectedInspection = { ...item };
        this.isDialogOpen = true;
      }
    });
  }

  openDetailById(id: number): void {
    this.api.get<any>(`/inspections/${id}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.selectedInspection = res.data;
          this.isDialogOpen = true;
        }
      }
    });
  }

  closeDialog(): void {
    this.isDialogOpen = false;
    this.selectedInspection = null;
  }

  onInspectionSaved(updated: Inspection): void {
    this.loadInspections();
    this.loadRecommendations();
  }

  onInspectionCompleted(completed: Inspection): void {
    this.loadInspections();
    this.loadRecommendations();
  }

  // Helpers
  parseViolations(violationCodes: any): string[] {
    if (!violationCodes) return [];
    try {
      const parsed = typeof violationCodes === 'string' ? JSON.parse(violationCodes) : violationCodes;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  parseEvidence(files: any): string[] {
    if (!files) return [];
    try {
      const parsed = typeof files === 'string' ? JSON.parse(files) : files;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
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
