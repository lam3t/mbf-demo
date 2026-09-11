import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DomainStats, RankingItem, InspectionDomain, Ward, WardInspectionAlertItem, WardInspectionAlertsResponse, BusinessNotice } from '../../core/models';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    PageHeaderComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('timelineCanvas') timelineCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('complianceCanvas') complianceCanvas!: ElementRef<HTMLCanvasElement>;

  selectedQuarter = 'Q2/2026';
  isLoading = false;
  isRefreshing = false;

  // Progressive Disclosure Tabs (Prompt 16 / CR-12)
  activeDashboardTab: 'overview' | 'domains' | 'map' = 'overview';
  activeRankingTab: 'slowest' | 'fastest' = 'slowest';
  showExtraKpis = false;
  maxAlertsToShow = 5;

  // Ward Drill-down State (CR-05)
  wardsList: Ward[] = [];
  currentWard: Ward | null = null;
  isWardDrillDown = false;
  activeWardSelectValue = 'all';

  // Ward Inspection Alerts & Notice Dispatch State (PROMPT 13)
  wardAlerts: WardInspectionAlertItem[] = [];
  wardAlertsSummary = {
    totalCompleted: 0,
    totalWithViolations: 0,
    pendingNoticesCount: 0,
    sentNoticesCount: 0
  };
  isLoadingWardAlerts = false;
  showCompletedAlerts = false;
  isNoticeDialogOpen = false;
  selectedAlertForNotice: WardInspectionAlertItem | null = null;
  noticeForm = {
    method: 'van_ban_giay' as 'van_ban_giay' | 'khac',
    sentAt: '',
    note: '',
    fileUrl: ''
  };
  isSubmittingNotice = false;
  noticeSuccessMessage = '';

  // Data states
  summary: any = {
    targetCount: 9960,
    completedCount: 18,
    inProgressCount: 5,
    notStartedCount: 5,
    overdueCount: 2,
    totalInspections: 28,
    totalObjects: 28,
    activeObjects: 27,
    suspendedObjects: 1,
    targetCompletionRate: 0.18,
    taskCompletionRate: 64.3,
    completedWards: 1,
    inProgressWards: 3,
    notStartedWards: 1,
    totalWards: 5
  };

  // Domain Statistics (CR-03 / Prompt 11)
  domainStats: DomainStats[] = [
    { domainId: 1, domainCode: 'PCCC', domainName: 'Phòng cháy chữa cháy', icon: 'local_fire_department', color: '#ef4444', totalChecked: 73, totalPass: 39, totalFail: 34, passRate: 53.4, failRate: 46.6, completionRate: 53.4 },
    { domainId: 2, domainCode: 'ATTP', domainName: 'An toàn thực phẩm', icon: 'restaurant', color: '#f59e0b', totalChecked: 73, totalPass: 61, totalFail: 12, passRate: 83.6, failRate: 16.4, completionRate: 83.6 },
    { domainId: 3, domainCode: 'MOI_TRUONG', domainName: 'Bảo vệ môi trường', icon: 'eco', color: '#10b981', totalChecked: 73, totalPass: 60, totalFail: 13, passRate: 82.2, failRate: 17.8, completionRate: 82.2 },
    { domainId: 4, domainCode: 'TTDT', domainName: 'Trật tự đô thị', icon: 'location_city', color: '#3b82f6', totalChecked: 66, totalPass: 59, totalFail: 7, passRate: 89.4, failRate: 10.6, completionRate: 89.4 },
    { domainId: 5, domainCode: 'THUE', domainName: 'Thuế & Nghĩa vụ tài chính', icon: 'receipt_long', color: '#8b5cf6', totalChecked: 66, totalPass: 52, totalFail: 14, passRate: 78.8, failRate: 21.2, completionRate: 78.8 }
  ];
  domainsList: InspectionDomain[] = [];
  selectedDomainForDetails: DomainStats | null = null;
  failedInspectionsForDomain: any[] = [];
  isLoadingDomainDetails = false;

  // Parallel Rankings (CR-04)
  selectedRankingScope = 'overall';
  fastestRankings: RankingItem[] = [];
  slowestRankings: RankingItem[] = [];
  isLoadingRankings = false;

  overdueRankings: any[] = [];
  complianceGroups: any[] = [];
  timelineData: any[] = [];

  // Chart instances
  private timelineChart: Chart | null = null;
  private complianceChart: Chart | null = null;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  get currentUser() {
    return this.auth.currentUser();
  }

  get isOfficerWard(): boolean {
    return this.currentUser?.role === 'officer_ward';
  }

  get pageTitle(): string {
    if (this.currentWard) {
      return `Dashboard - ${this.currentWard.name}`;
    }
    return 'Trung tâm Chỉ huy & Điều hành BI Dashboard';
  }

  get pageSubtitle(): string {
    if (this.currentWard) {
      return `Chi tiết chỉ số KPI, tiến độ thực hiện và phân loại vi phạm tại địa bàn ${this.currentWard.name}`;
    }
    return 'Tổng hợp chỉ số KPI, tỷ lệ hoàn thành mục tiêu kiểm tra và phân tích vi phạm toàn TP Hà Nội';
  }

  ngOnInit(): void {
    // 1. Load Wards Catalog first
    this.api.get<any>('/wards').subscribe({
      next: (res) => {
        if (res?.success) {
          this.wardsList = res.data;
        }
        // 2. Listen to route params for drill-down
        this.route.params.subscribe(params => {
          const wardParam = params['wardId'];
          this.setupWardContext(wardParam);
        });
      },
      error: () => {
        this.route.params.subscribe(params => {
          const wardParam = params['wardId'];
          this.setupWardContext(wardParam);
        });
      }
    });
  }

  setupWardContext(wardParam?: string): void {
    // Role-based automatic lock for officer_ward
    if (this.isOfficerWard && this.currentUser?.unit) {
      const wardUnit = this.currentUser.unit;
      const found = this.wardsList.find(w => w.name === wardUnit || w.name.includes(wardUnit));
      this.currentWard = found || {
        id: 0,
        code: 'WARD',
        name: wardUnit,
        lat: 21.0318,
        lng: 105.8528
      };
      this.isWardDrillDown = true;
      this.activeWardSelectValue = this.currentWard.id.toString();
    } else if (wardParam) {
      // Find ward from param (id, code, or name)
      const parsedId = parseInt(wardParam, 10);
      const found = this.wardsList.find(w => 
        (!isNaN(parsedId) && w.id === parsedId) ||
        w.code.toLowerCase() === wardParam.toLowerCase() ||
        w.name.toLowerCase() === wardParam.toLowerCase() ||
        encodeURIComponent(w.name) === encodeURIComponent(wardParam)
      );

      if (found) {
        this.currentWard = found;
        this.activeWardSelectValue = found.id.toString();
      } else {
        this.currentWard = {
          id: !isNaN(parsedId) ? parsedId : 1,
          code: 'WARD',
          name: decodeURIComponent(wardParam),
          lat: 21.0318,
          lng: 105.8528
        };
        this.activeWardSelectValue = this.currentWard.name;
      }
      this.isWardDrillDown = true;
    } else {
      // City-level dashboard
      this.currentWard = null;
      this.isWardDrillDown = false;
      this.activeWardSelectValue = 'all';
    }

    this.loadAllDashboardData();
  }

  navigateToWard(wardNameOrId: string | number): void {
    const found = this.wardsList.find(w => w.name === wardNameOrId || w.id === wardNameOrId || w.code === wardNameOrId);
    const targetId = found ? found.id : encodeURIComponent(wardNameOrId.toString());
    this.router.navigate(['/dashboard/ward', targetId]);
  }

  navigateToCityDashboard(): void {
    if (this.isOfficerWard) return;
    this.router.navigate(['/dashboard']);
  }

  onQuickWardChange(): void {
    if (this.activeWardSelectValue === 'all') {
      this.navigateToCityDashboard();
    } else {
      this.navigateToWard(this.activeWardSelectValue);
    }
  }

  switchDashboardTab(tab: 'overview' | 'domains' | 'map'): void {
    this.activeDashboardTab = tab;
    if (tab === 'overview') {
      setTimeout(() => {
        this.initCharts();
      }, 100);
    } else if (tab === 'domains') {
      this.loadDomainStats();
    }
  }

  toggleRankingTab(tab: 'slowest' | 'fastest'): void {
    this.activeRankingTab = tab;
  }

  toggleExtraKpis(): void {
    this.showExtraKpis = !this.showExtraKpis;
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initCharts();
    }, 150);
  }

  ngOnDestroy(): void {
    if (this.timelineChart) {
      this.timelineChart.destroy();
    }
    if (this.complianceChart) {
      this.complianceChart.destroy();
    }
  }

  loadAllDashboardData(): void {
    this.isLoading = true;
    const wardParam = this.currentWard ? this.currentWard.name : undefined;

    // 1. Summary
    this.api.get<any>('/dashboard/summary', { ward: wardParam, quarter: this.selectedQuarter }).subscribe({
      next: (res) => {
        if (res?.success) {
          this.summary = res.data;
        }
      }
    });

    // 2. Domain Statistics (CR-03)
    this.loadDomainStats();

    // 3. Parallel Fast/Slow Rankings (CR-04)
    this.loadRankings();

    // 4. Domain Catalog
    this.loadDomainCatalog();

    // 5. Overdue Rankings
    this.api.get<any>('/dashboard/overdue-ranking', { limit: 5, ward: wardParam }).subscribe({
      next: (res) => {
        if (res?.success) {
          this.overdueRankings = res.data;
        }
      }
    });

    // 6. Compliance Pie Data
    this.api.get<any>('/dashboard/compliance-pie', { ward: wardParam }).subscribe({
      next: (res) => {
        if (res?.success) {
          this.complianceGroups = res.data;
          this.updateComplianceChart();
        }
      }
    });

    // 7. Progress Timeline Data
    this.api.get<any>('/dashboard/progress-by-day', { days: 14, ward: wardParam }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res?.success) {
          this.timelineData = res.data;
          this.updateTimelineChart();
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });

    // 8. Ward-Level Inspection Alerts (PROMPT 13)
    if (this.isWardDrillDown) {
      this.loadWardInspectionAlerts();
    }
  }

  loadWardInspectionAlerts(): void {
    if (!this.currentWard) return;
    this.isLoadingWardAlerts = true;
    const wardParam = this.currentWard.id || encodeURIComponent(this.currentWard.name);
    const filterParam = this.showCompletedAlerts ? 'all' : 'needs_action';

    this.api.get<WardInspectionAlertsResponse>(`/wards/${wardParam}/inspection-alerts`, { filter: filterParam }).subscribe({
      next: (res) => {
        this.isLoadingWardAlerts = false;
        if (res?.success) {
          this.wardAlerts = res.data || [];
          if (res.summary) {
            this.wardAlertsSummary = res.summary;
          }
        }
      },
      error: (err) => {
        this.isLoadingWardAlerts = false;
        console.error('Failed to load ward inspection alerts:', err);
      }
    });
  }

  toggleShowCompletedAlerts(): void {
    this.showCompletedAlerts = !this.showCompletedAlerts;
    this.loadWardInspectionAlerts();
  }

  openNoticeDialog(alertItem: WardInspectionAlertItem): void {
    this.selectedAlertForNotice = alertItem;
    this.noticeSuccessMessage = '';
    this.noticeForm = {
      method: 'van_ban_giay',
      sentAt: new Date().toISOString().substring(0, 10),
      note: '',
      fileUrl: ''
    };
    this.isNoticeDialogOpen = true;
  }

  closeNoticeDialog(): void {
    this.isNoticeDialogOpen = false;
    this.selectedAlertForNotice = null;
    this.noticeSuccessMessage = '';
  }

  submitNoticeSent(): void {
    if (!this.selectedAlertForNotice || !this.currentWard) return;
    this.isSubmittingNotice = true;
    const wardParam = this.currentWard.id || encodeURIComponent(this.currentWard.name);
    const inspectionId = this.selectedAlertForNotice.inspectionId;

    this.api.post<any>(`/wards/${wardParam}/inspection-alerts/${inspectionId}/mark-notice-sent`, this.noticeForm).subscribe({
      next: (res) => {
        this.isSubmittingNotice = false;
        if (res?.success) {
          this.noticeSuccessMessage = 'Đã xác nhận gửi văn bản thông báo thành công!';
          setTimeout(() => {
            this.closeNoticeDialog();
            this.loadWardInspectionAlerts();
          }, 600);
        }
      },
      error: (err) => {
        this.isSubmittingNotice = false;
        console.error('Failed to mark notice sent:', err);
      }
    });
  }

  loadDomainCatalog(): void {
    this.api.get<any>('/catalogs/domains').subscribe({
      next: (res) => {
        if (res?.success) {
          this.domainsList = res.data;
        }
      }
    });
  }

  loadDomainStats(): void {
    const wardParam = this.currentWard ? this.currentWard.name : undefined;
    this.api.get<any>('/dashboard/by-domain', { quarter: this.selectedQuarter, ward: wardParam }).subscribe({
      next: (res) => {
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          this.domainStats = res.data;
        }
      },
      error: (err) => {
        console.warn('Could not load domain stats from API:', err);
      }
    });
  }

  loadRankings(): void {
    this.isLoadingRankings = true;
    const isDomain = this.selectedRankingScope !== 'overall';
    const wardParam = this.currentWard ? this.currentWard.name : undefined;

    const paramsFastest: any = {
      scope: isDomain ? 'domain' : 'overall',
      domainId: isDomain ? this.selectedRankingScope : undefined,
      order: 'fastest',
      limit: 5,
      quarter: this.selectedQuarter,
      ward: wardParam
    };

    const paramsSlowest: any = {
      scope: isDomain ? 'domain' : 'overall',
      domainId: isDomain ? this.selectedRankingScope : undefined,
      order: 'slowest',
      limit: 5,
      quarter: this.selectedQuarter,
      ward: wardParam
    };

    // Fastest
    this.api.get<any>('/dashboard/ranking', paramsFastest).subscribe({
      next: (res) => {
        if (res?.success) {
          this.fastestRankings = res.data;
        }
      }
    });

    // Slowest
    this.api.get<any>('/dashboard/ranking', paramsSlowest).subscribe({
      next: (res) => {
        this.isLoadingRankings = false;
        if (res?.success) {
          this.slowestRankings = res.data;
        }
      },
      error: () => {
        this.isLoadingRankings = false;
      }
    });
  }

  onRankingScopeChange(): void {
    this.loadRankings();
  }

  selectDomainDetails(domain: DomainStats): void {
    this.selectedDomainForDetails = domain;
    this.isLoadingDomainDetails = true;
    // Load list of inspections having failed criteria in this domain
    this.api.get<any>('/inspections', { limit: 20 }).subscribe({
      next: (res) => {
        this.isLoadingDomainDetails = false;
        if (res?.success && Array.isArray(res.data)) {
          // Filter inspections relevant to this domain or with violations
          this.failedInspectionsForDomain = res.data.filter((i: any) => {
            if (i.violationCodes && i.violationCodes !== '[]') return true;
            return i.status !== 'completed';
          });
        }
      },
      error: () => {
        this.isLoadingDomainDetails = false;
      }
    });
  }

  closeDomainDetails(): void {
    this.selectedDomainForDetails = null;
    this.failedInspectionsForDomain = [];
  }

  getScopeTitle(): string {
    if (this.selectedRankingScope === 'overall') {
      return 'Tổng thể (Tất cả lĩnh vực)';
    }
    const found = this.domainsList.find(d => d.id.toString() === this.selectedRankingScope || d.code === this.selectedRankingScope);
    return found ? `${found.code} - ${found.name}` : 'Theo lĩnh vực';
  }

  handleRefresh(): void {
    this.isRefreshing = true;
    this.loadAllDashboardData();
    setTimeout(() => {
      this.isRefreshing = false;
    }, 600);
  }

  // Charts Initialization
  private initCharts(): void {
    this.initTimelineChart();
    this.initComplianceChart();
  }

  private initTimelineChart(): void {
    if (!this.timelineCanvas?.nativeElement) return;
    const ctx = this.timelineCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.timelineChart) {
      this.timelineChart.destroy();
    }

    const labels = this.timelineData.length > 0
      ? this.timelineData.map(d => d.date)
      : ['01/04', '04/04', '07/04', '10/04', '13/04', '16/04', '19/04', '22/04'];

    const completedValues = this.timelineData.length > 0
      ? this.timelineData.map(d => d.completed)
      : [2, 5, 8, 12, 15, 18, 22, 25];

    const targetValues = this.timelineData.length > 0
      ? this.timelineData.map(d => d.target)
      : [10, 20, 30, 40, 50, 60, 70, 80];

    this.timelineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Đã hoàn thành kiểm tra',
            data: completedValues,
            borderColor: '#1e3a8a',
            backgroundColor: 'rgba(30, 58, 138, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#1e3a8a',
            pointRadius: 3,
            pointHoverRadius: 6
          },
          {
            label: 'Chỉ tiêu phân bổ theo ngày',
            data: targetValues,
            borderColor: '#94a3b8',
            borderDash: [5, 5],
            borderWidth: 1.5,
            fill: false,
            tension: 0.2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { family: 'Inter', size: 12 },
              color: '#475569'
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            titleFont: { family: 'Inter', size: 12, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 12 }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b' }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: { font: { family: 'Inter', size: 11 }, color: '#64748b' }
          }
        }
      }
    });
  }

  private initComplianceChart(): void {
    if (!this.complianceCanvas?.nativeElement) return;
    const ctx = this.complianceCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.complianceChart) {
      this.complianceChart.destroy();
    }

    const labels = this.complianceGroups.length > 0
      ? this.complianceGroups.map(g => g.name)
      : ['Chấp hành tốt', 'Có vi phạm', 'Đình chỉ'];

    const dataValues = this.complianceGroups.length > 0
      ? this.complianceGroups.map(g => g.count)
      : [12, 15, 1];

    const colors = this.complianceGroups.length > 0
      ? this.complianceGroups.map(g => g.color)
      : ['#10B981', '#F59E0B', '#EF4444'];

    this.complianceChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: dataValues,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              padding: 12,
              font: { family: 'Inter', size: 11 },
              color: '#334155'
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 8
          }
        }
      }
    });
  }

  private updateTimelineChart(): void {
    if (!this.timelineChart || this.timelineData.length === 0) return;
    this.timelineChart.data.labels = this.timelineData.map(d => d.date);
    this.timelineChart.data.datasets[0].data = this.timelineData.map(d => d.completed);
    this.timelineChart.data.datasets[1].data = this.timelineData.map(d => d.target);
    this.timelineChart.update();
  }

  private updateComplianceChart(): void {
    if (!this.complianceChart || this.complianceGroups.length === 0) return;
    this.complianceChart.data.labels = this.complianceGroups.map(g => g.name);
    this.complianceChart.data.datasets[0].data = this.complianceGroups.map(g => g.count);
    this.complianceChart.data.datasets[0].backgroundColor = this.complianceGroups.map(g => g.color);
    this.complianceChart.update();
  }
}
