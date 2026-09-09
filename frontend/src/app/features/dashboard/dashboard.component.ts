import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../core/services/api.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

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

  overdueRankings: any[] = [];
  complianceGroups: any[] = [];
  timelineData: any[] = [];

  // Chart instances
  private timelineChart: Chart | null = null;
  private complianceChart: Chart | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadAllDashboardData();
  }

  ngAfterViewInit(): void {
    // Delay slightly to ensure canvas elements are ready in DOM
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

    // 1. Summary
    this.api.get<any>('/dashboard/summary').subscribe({
      next: (res) => {
        if (res?.success) {
          this.summary = res.data;
        }
      }
    });

    // 2. Overdue Rankings
    this.api.get<any>('/dashboard/overdue-ranking', { limit: 5 }).subscribe({
      next: (res) => {
        if (res?.success) {
          this.overdueRankings = res.data;
        }
      }
    });

    // 3. Compliance Pie Data
    this.api.get<any>('/dashboard/compliance-pie').subscribe({
      next: (res) => {
        if (res?.success) {
          this.complianceGroups = res.data;
          this.updateComplianceChart();
        }
      }
    });

    // 4. Progress Timeline Data
    this.api.get<any>('/dashboard/progress-by-day', { days: 14 }).subscribe({
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
