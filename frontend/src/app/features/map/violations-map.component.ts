import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ApiService } from '../../core/services/api.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InspectionDetailDialogComponent } from '../inspections/components/inspection-detail-dialog.component';
import { Inspection, ViolationCatalog, RecommendationTagCatalog } from '../../core/models';

import * as L from 'leaflet';
import 'leaflet.heat';
import 'leaflet.markercluster';

export interface ViolationGeoPoint {
  inspectionId: number;
  lat: number;
  lng: number;
  ward: string;
  severity: number;
  violationCodes: string;
  completedAt?: string;
  status: string;
  objectName: string;
  objectType: string;
  objectAddress: string;
  planQuarter?: string;
}

@Component({
  selector: 'app-violations-map',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatSlideToggleModule,
    PageHeaderComponent,
    InspectionDetailDialogComponent
  ],
  templateUrl: './violations-map.component.html',
  styleUrls: ['./violations-map.component.scss']
})
export class ViolationsMapComponent implements OnInit, AfterViewInit, OnDestroy {
  private map: L.Map | null = null;
  private heatLayer: any = null;
  private markerClusterGroup: any = null;

  // Filter state
  selectedTimeRange = 'all';
  selectedViolationType = '';
  selectedWard = '';

  // Layer visibility toggles
  showHeatmap = true;
  showMarkers = true;

  // Data
  points: ViolationGeoPoint[] = [];
  isLoading = false;

  // Catalogs
  violationCatalog: ViolationCatalog[] = [];
  tagCatalog: RecommendationTagCatalog[] = [];

  // Detail Modal
  selectedInspection: Inspection | null = null;
  isDialogOpen = false;

  // Hotspots Summary
  hotspotsSummary = {
    total: 0,
    severe: 0,
    medium: 0,
    topWard: 'Phường Hoàn Kiếm'
  };

  readonly WARD_OPTIONS = [
    'Phường Hoàn Kiếm',
    'Phường Ba Đình',
    'Phường Đống Đa',
    'Phường Hai Bà Trưng',
    'Phường Cầu Giấy'
  ];

  readonly TIME_RANGES = [
    { value: 'all', label: 'Tất cả thời gian' },
    { value: 'week', label: 'Trong tuần này' },
    { value: 'month', label: 'Trong tháng này' },
    { value: 'quarter', label: 'Trong quý này (Q2/2026)' }
  ];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadCatalogs();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initLeafletMap();
      this.fetchViolationsGeo();
    }, 150);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  loadCatalogs(): void {
    this.api.get<any>('/violation-catalog').subscribe({
      next: (res) => {
        if (res.success) this.violationCatalog = res.data;
      }
    });
    this.api.get<any>('/recommendation-tag-catalog').subscribe({
      next: (res) => {
        if (res.success) this.tagCatalog = res.data;
      }
    });
  }

  private initLeafletMap(): void {
    const mapElement = document.getElementById('violationsLeafletMap');
    if (!mapElement) return;

    // Center Hanoi coordinates: 21.0285, 105.8542
    this.map = L.map('violationsLeafletMap', {
      center: [21.0285, 105.8542],
      zoom: 13,
      zoomControl: true
    });

    // Online OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Initialize MarkerClusterGroup
    this.markerClusterGroup = (L as any).markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 45,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let sizeClass = 'small';
        if (count > 5) sizeClass = 'medium';
        if (count > 10) sizeClass = 'large';

        return L.divIcon({
          html: `<div class="custom-cluster-marker ${sizeClass}"><span>${count}</span></div>`,
          className: 'cluster-icon-wrap',
          iconSize: L.point(40, 40)
        });
      }
    });

    if (this.showMarkers) {
      this.map.addLayer(this.markerClusterGroup);
    }

    // Expose global callback for popup inspect button click
    (window as any).openInspectionDetail = (id: number) => {
      this.openInspectionModal(id);
    };
  }

  fetchViolationsGeo(): void {
    this.isLoading = true;
    const params: any = {};
    if (this.selectedTimeRange && this.selectedTimeRange !== 'all') {
      params.timeRange = this.selectedTimeRange;
    }
    if (this.selectedViolationType) {
      params.violationType = this.selectedViolationType;
    }
    if (this.selectedWard) {
      params.ward = this.selectedWard;
    }

    this.api.get<any>('/dashboard/violations-geo', params).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.points = res.data;
          this.calculateHotspotsSummary();
          this.renderMapLayers();
        }
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  private calculateHotspotsSummary(): void {
    const total = this.points.length;
    const severe = this.points.filter(p => p.severity >= 4).length;
    const medium = this.points.filter(p => p.severity === 2 || p.severity === 3).length;

    // Find ward with most violations
    const wardCounts: Record<string, number> = {};
    this.points.forEach(p => {
      wardCounts[p.ward] = (wardCounts[p.ward] || 0) + 1;
    });

    let topWard = 'Phường Hoàn Kiếm';
    let maxC = 0;
    for (const [w, c] of Object.entries(wardCounts)) {
      if (c > maxC) {
        maxC = c;
        topWard = w;
      }
    }

    this.hotspotsSummary = { total, severe, medium, topWard };
  }

  private renderMapLayers(): void {
    if (!this.map) return;

    // 1. Render Heatmap Layer
    if (this.heatLayer) {
      this.map.removeLayer(this.heatLayer);
      this.heatLayer = null;
    }

    const heatPoints = this.points
      .filter(p => p.lat && p.lng)
      .map(p => [p.lat, p.lng, (p.severity || 1) * 0.35]);

    if (heatPoints.length > 0) {
      this.heatLayer = (L as any).heatLayer(heatPoints, {
        radius: 28,
        blur: 18,
        maxZoom: 16,
        max: 1.5,
        gradient: {
          0.2: '#3b82f6',
          0.4: '#10b981',
          0.6: '#eab308',
          0.8: '#f97316',
          1.0: '#dc2626'
        }
      });

      if (this.showHeatmap) {
        this.map.addLayer(this.heatLayer);
      }
    }

    // 2. Render Marker Cluster Layer
    if (this.markerClusterGroup) {
      this.markerClusterGroup.clearLayers();

      this.points.forEach(pt => {
        if (pt.lat && pt.lng) {
          const isSevere = pt.severity >= 4;
          const markerColor = isSevere ? '#dc2626' : (pt.severity >= 2 ? '#f59e0b' : '#3b82f6');

          const iconHtml = `
            <div class="custom-violation-pin" style="background: ${markerColor};">
              <span class="pin-inner">${pt.severity || '!'}</span>
            </div>
          `;

          const customIcon = L.divIcon({
            className: 'violation-pin-wrap',
            html: iconHtml,
            iconSize: [28, 28],
            iconAnchor: [14, 28],
            popupAnchor: [0, -28]
          });

          const marker = L.marker([pt.lat, pt.lng], { icon: customIcon });

          const violationTagsHtml = this.parseViolations(pt.violationCodes)
            .map(code => `<span class="popup-violation-chip">${code}</span>`)
            .join(' ');

          const popupContent = `
            <div class="leaflet-popup-card">
              <div class="popup-header">
                <span class="popup-ward">${pt.ward}</span>
                <span class="popup-severity-badge severity-${pt.severity}">Mức ${pt.severity}/5</span>
              </div>
              <h4 class="popup-name">${pt.objectName}</h4>
              <p class="popup-address"><i class="popup-icon">📍</i> ${pt.objectAddress}</p>
              
              <div class="popup-violations-box">
                <span class="popup-label">Lỗi vi phạm:</span>
                <div class="chips-row">${violationTagsHtml || '<span class="text-muted">Lỗi quy định</span>'}</div>
              </div>

              <div class="popup-footer">
                <span class="popup-time">Mã HS: #${pt.inspectionId}</span>
                <button class="popup-btn" onclick="window.openInspectionDetail(${pt.inspectionId})">
                  Xem chi tiết hồ sơ →
                </button>
              </div>
            </div>
          `;

          marker.bindPopup(popupContent, { minWidth: 260, maxWidth: 320 });
          this.markerClusterGroup.addLayer(marker);
        }
      });
    }
  }

  toggleHeatmapLayer(): void {
    if (!this.map || !this.heatLayer) return;
    if (this.showHeatmap) {
      this.map.addLayer(this.heatLayer);
    } else {
      this.map.removeLayer(this.heatLayer);
    }
  }

  toggleMarkersLayer(): void {
    if (!this.map || !this.markerClusterGroup) return;
    if (this.showMarkers) {
      this.map.addLayer(this.markerClusterGroup);
    } else {
      this.map.removeLayer(this.markerClusterGroup);
    }
  }

  onFilterChange(): void {
    this.fetchViolationsGeo();
  }

  resetFilters(): void {
    this.selectedTimeRange = 'all';
    this.selectedViolationType = '';
    this.selectedWard = '';
    this.fetchViolationsGeo();
    this.resetView();
  }

  resetView(): void {
    if (this.map) {
      this.map.setView([21.0285, 105.8542], 13);
    }
  }

  focusWard(wardName: string): void {
    this.selectedWard = wardName;
    this.fetchViolationsGeo();

    const wardCenters: Record<string, [number, number]> = {
      'Phường Hoàn Kiếm': [21.0318, 105.8528],
      'Phường Ba Đình': [21.0340, 105.8280],
      'Phường Đống Đa': [21.0180, 105.8260],
      'Phường Hai Bà Trưng': [21.0090, 105.8500],
      'Phường Cầu Giấy': [21.0330, 105.7880]
    };

    if (this.map && wardCenters[wardName]) {
      this.map.setView(wardCenters[wardName], 14);
    }
  }

  openInspectionModal(id: number): void {
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

  parseViolations(violationCodes: string): string[] {
    if (!violationCodes) return [];
    try {
      const parsed = typeof violationCodes === 'string' ? JSON.parse(violationCodes) : violationCodes;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [violationCodes];
    }
  }
}
