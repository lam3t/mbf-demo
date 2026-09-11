import { Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { ApiService } from '../../../core/services/api.service';
import { Inspection, ViolationCatalog, RecommendationTagCatalog, InspectionChecklistItem, ChecklistResult } from '../../../core/models';

export interface DomainGroup {
  id: number;
  code: string;
  name: string;
  icon: string;
  color: string;
  items: InspectionChecklistItem[];
  isExpanded?: boolean;
}

export interface WardCoordinate {
  name: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-inspection-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatRadioModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatExpansionModule
  ],
  templateUrl: './inspection-detail-dialog.component.html',
  styleUrls: ['./inspection-detail-dialog.component.scss']
})
export class InspectionDetailDialogComponent implements OnInit, OnChanges {
  @Input() inspection: Inspection | null = null;
  @Input() isOpen = false;
  @Input() violationCatalog: ViolationCatalog[] = [];
  @Input() tagCatalog: RecommendationTagCatalog[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Inspection>();
  @Output() completed = new EventEmitter<Inspection>();

  // Active Domain Tab Filter (0: All, 1: PCCC, 2: ATTP, 3: MOI_TRUONG, 4: TTDT, 5: THUE)
  activeDomainTab = 0;

  // Domain Groups (5 Domains - CR-03 / CR-12 Progressive Disclosure)
  domainGroups: DomainGroup[] = [
    {
      id: 1,
      code: 'PCCC',
      name: 'Phòng cháy chữa cháy',
      icon: 'local_fire_department',
      color: '#ef4444',
      isExpanded: false,
      items: [
        { domainId: 1, criteriaCode: 'pccc_1', criteriaName: 'Trang bị bình chữa cháy còn hạn & tiêu lệnh PCCC', result: 'pass' },
        { domainId: 1, criteriaCode: 'pccc_2', criteriaName: 'Lối thoát nạn & hành lang thoát hiểm thông thoáng', result: 'pass' }
      ]
    },
    {
      id: 2,
      code: 'ATTP',
      name: 'An toàn thực phẩm',
      icon: 'restaurant',
      color: '#f59e0b',
      isExpanded: false,
      items: [
        { domainId: 2, criteriaCode: 'attp_1', criteriaName: 'Giấy chứng nhận cơ sở đủ điều kiện ATTP / Cam kết ATTP', result: 'pass' },
        { domainId: 2, criteriaCode: 'attp_2', criteriaName: 'Nguồn gốc nguyên liệu & điều kiện vệ sinh bảo quản', result: 'pass' }
      ]
    },
    {
      id: 3,
      code: 'MOI_TRUONG',
      name: 'Bảo vệ môi trường',
      icon: 'eco',
      color: '#10b981',
      isExpanded: false,
      items: [
        { domainId: 3, criteriaCode: 'env_1', criteriaName: 'Thu gom, phân loại & xử lý rác thải / nước thải đúng quy định', result: 'pass' },
        { domainId: 3, criteriaCode: 'env_2', criteriaName: 'Không gây ô nhiễm tiếng ồn, khói bụi vượt quy chuẩn', result: 'pass' }
      ]
    },
    {
      id: 4,
      code: 'TTDT',
      name: 'Trật tự đô thị',
      icon: 'location_city',
      color: '#3b82f6',
      isExpanded: false,
      items: [
        { domainId: 4, criteriaCode: 'ttdt_1', criteriaName: 'Không lấn chiếm lòng lề đường, vỉa hè, hành lang an toàn', result: 'pass' },
        { domainId: 4, criteriaCode: 'ttdt_2', criteriaName: 'Biển hiệu, bảng quảng cáo đúng quy chuẩn cấp phép', result: 'pass' }
      ]
    },
    {
      id: 5,
      code: 'THUE',
      name: 'Thuế & Nghĩa vụ tài chính',
      icon: 'receipt_long',
      color: '#8b5cf6',
      isExpanded: false,
      items: [
        { domainId: 5, criteriaCode: 'tax_1', criteriaName: 'Đăng ký kinh doanh & niêm yết giá công khai', result: 'pass' },
        { domainId: 5, criteriaCode: 'tax_2', criteriaName: 'Kê khai & thực hiện đầy đủ nghĩa vụ thuế / hóa đơn', result: 'pass' }
      ]
    }
  ];

  // Selected violation codes
  selectedViolationCodes: string[] = [];
  severity = 1;

  // Evidence files
  evidenceList: string[] = [];
  isUploading = false;
  uploadError = '';
  previewImageUrl: string | null = null;

  // Recommendation
  recommendationNote = '';
  selectedTags: string[] = [];

  // GPS Coordinates
  lat: number | null = null;
  lng: number | null = null;
  detectedWard: string | null = null;
  detectedDistanceMeters: number | null = null;

  // Ward center reference points (Hanoi demo wards)
  readonly WARD_CENTERS: WardCoordinate[] = [
    { name: 'Phường Khương Mai', lat: 20.9984, lng: 105.8291 },
    { name: 'Phường Hàng Bài', lat: 21.0227, lng: 105.8524 },
    { name: 'Phường Mỹ Đình 1', lat: 21.0189, lng: 105.7725 },
    { name: 'Phường Quảng An', lat: 21.0664, lng: 105.8272 },
    { name: 'Phường Đồng Tâm', lat: 20.9995, lng: 105.8427 }
  ];

  // UI state
  isSubmitting = false;
  showConfirmComplete = false;
  successMessage = '';
  errorMessage = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    if (this.inspection) {
      this.initForm();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['inspection'] && this.inspection) {
      this.initForm();
    }
  }

  initForm(): void {
    if (!this.inspection) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.showConfirmComplete = false;

    // Reset default domain items
    this.resetDefaultDomainGroups();

    // Fetch full inspection with checklistItems from API if needed or use passed checklistItems
    if (this.inspection.checklistItems && this.inspection.checklistItems.length > 0) {
      this.populateChecklistItems(this.inspection.checklistItems);
    } else {
      // Query full inspection details
      this.api.get<any>(`/inspections/${this.inspection.id}`).subscribe({
        next: (res) => {
          if (res?.success && res.data?.checklistItems?.length > 0) {
            this.populateChecklistItems(res.data.checklistItems);
          } else if (this.inspection?.checklist) {
            this.parseLegacyChecklist(this.inspection.checklist);
          }
        },
        error: () => {
          if (this.inspection?.checklist) {
            this.parseLegacyChecklist(this.inspection.checklist);
          }
        }
      });
    }

    // Parse violationCodes
    if (this.inspection.violationCodes) {
      try {
        const parsed = typeof this.inspection.violationCodes === 'string'
          ? JSON.parse(this.inspection.violationCodes)
          : this.inspection.violationCodes;
        this.selectedViolationCodes = Array.isArray(parsed) ? parsed : [];
      } catch {
        this.selectedViolationCodes = [];
      }
    } else {
      this.selectedViolationCodes = [];
    }

    // Severity
    this.severity = this.inspection.severity || 1;

    // Evidence files
    if (this.inspection.evidenceFiles) {
      try {
        const parsed = typeof this.inspection.evidenceFiles === 'string'
          ? JSON.parse(this.inspection.evidenceFiles)
          : this.inspection.evidenceFiles;
        this.evidenceList = Array.isArray(parsed) ? parsed : [];
      } catch {
        this.evidenceList = [];
      }
    } else {
      this.evidenceList = [];
    }

    // Recommendation
    this.recommendationNote = this.inspection.recommendationNote || '';
    if (this.inspection.recommendationTags) {
      try {
        const parsed = typeof this.inspection.recommendationTags === 'string'
          ? JSON.parse(this.inspection.recommendationTags)
          : this.inspection.recommendationTags;
        this.selectedTags = Array.isArray(parsed) ? parsed : [];
      } catch {
        this.selectedTags = [];
      }
    } else {
      this.selectedTags = [];
    }

    // GPS
    this.lat = this.inspection.lat !== undefined && this.inspection.lat !== null ? Number(this.inspection.lat) : null;
    this.lng = this.inspection.lng !== undefined && this.inspection.lng !== null ? Number(this.inspection.lng) : null;
    this.calculateNearestWard();
  }

  private resetDefaultDomainGroups(): void {
    this.domainGroups = [
      {
        id: 1,
        code: 'PCCC',
        name: 'Phòng cháy chữa cháy',
        icon: 'local_fire_department',
        color: '#ef4444',
        isExpanded: false,
        items: [
          { domainId: 1, criteriaCode: 'pccc_1', criteriaName: 'Trang bị bình chữa cháy còn hạn & tiêu lệnh PCCC', result: 'pass' },
          { domainId: 1, criteriaCode: 'pccc_2', criteriaName: 'Lối thoát nạn & hành lang thoát hiểm thông thoáng', result: 'pass' }
        ]
      },
      {
        id: 2,
        code: 'ATTP',
        name: 'An toàn thực phẩm',
        icon: 'restaurant',
        color: '#f59e0b',
        isExpanded: false,
        items: [
          { domainId: 2, criteriaCode: 'attp_1', criteriaName: 'Giấy chứng nhận cơ sở đủ điều kiện ATTP / Cam kết ATTP', result: 'pass' },
          { domainId: 2, criteriaCode: 'attp_2', criteriaName: 'Nguồn gốc nguyên liệu & điều kiện vệ sinh bảo quản', result: 'pass' }
        ]
      },
      {
        id: 3,
        code: 'MOI_TRUONG',
        name: 'Bảo vệ môi trường',
        icon: 'eco',
        color: '#10b981',
        isExpanded: false,
        items: [
          { domainId: 3, criteriaCode: 'env_1', criteriaName: 'Thu gom, phân loại & xử lý rác thải / nước thải đúng quy định', result: 'pass' },
          { domainId: 3, criteriaCode: 'env_2', criteriaName: 'Không gây ô nhiễm tiếng ồn, khói bụi vượt quy chuẩn', result: 'pass' }
        ]
      },
      {
        id: 4,
        code: 'TTDT',
        name: 'Trật tự đô thị',
        icon: 'location_city',
        color: '#3b82f6',
        isExpanded: false,
        items: [
          { domainId: 4, criteriaCode: 'ttdt_1', criteriaName: 'Không lấn chiếm lòng lề đường, vỉa hè, hành lang an toàn', result: 'pass' },
          { domainId: 4, criteriaCode: 'ttdt_2', criteriaName: 'Biển hiệu, bảng quảng cáo đúng quy chuẩn cấp phép', result: 'pass' }
        ]
      },
      {
        id: 5,
        code: 'THUE',
        name: 'Thuế & Nghĩa vụ tài chính',
        icon: 'receipt_long',
        color: '#8b5cf6',
        isExpanded: false,
        items: [
          { domainId: 5, criteriaCode: 'tax_1', criteriaName: 'Đăng ký kinh doanh & niêm yết giá công khai', result: 'pass' },
          { domainId: 5, criteriaCode: 'tax_2', criteriaName: 'Kê khai & thực hiện đầy đủ nghĩa vụ thuế / hóa đơn', result: 'pass' }
        ]
      }
    ];
  }

  updateExpansionStates(): void {
    // Prompt 16 / CR-12: Auto-expand only groups that contain at least 1 failed criterion
    this.domainGroups.forEach(g => {
      g.isExpanded = this.getDomainFailCount(g) > 0;
    });
  }

  toggleDomainExpand(domain: DomainGroup): void {
    domain.isExpanded = !domain.isExpanded;
  }

  private populateChecklistItems(items: InspectionChecklistItem[]): void {
    items.forEach(ci => {
      const group = this.domainGroups.find(g => g.id === ci.domainId || g.code === ci.domainCode);
      if (group) {
        const existing = group.items.find(i => i.criteriaCode === ci.criteriaCode);
        if (existing) {
          existing.id = ci.id;
          existing.result = ci.result;
          existing.violationCodeId = ci.violationCodeId;
          existing.notes = ci.notes;
        } else {
          group.items.push(ci);
        }
      }
    });
    this.updateExpansionStates();
  }

  private parseLegacyChecklist(checklist: any): void {
    try {
      const parsed = typeof checklist === 'string' ? JSON.parse(checklist) : checklist;
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (parsed.pccc === false) {
          const pcccGroup = this.domainGroups.find(g => g.id === 1);
          if (pcccGroup) pcccGroup.items.forEach(i => i.result = 'fail');
        }
        if (parsed.hygiene === false) {
          const attpGroup = this.domainGroups.find(g => g.id === 2);
          if (attpGroup) attpGroup.items.forEach(i => i.result = 'fail');
        }
        if (parsed.location === false) {
          const ttdtGroup = this.domainGroups.find(g => g.id === 4);
          if (ttdtGroup) ttdtGroup.items.forEach(i => i.result = 'fail');
        }
        if (parsed.price_tag === false || parsed.dkkd === false) {
          const taxGroup = this.domainGroups.find(g => g.id === 5);
          if (taxGroup) taxGroup.items.forEach(i => i.result = 'fail');
        }
      }
    } catch {
      // ignore
    }
    this.updateExpansionStates();
  }

  get isLocked(): boolean {
    return !!(this.inspection && (this.inspection.isLocked === 1 || this.inspection.status === 'completed'));
  }

  getAllChecklistItems(): InspectionChecklistItem[] {
    const all: InspectionChecklistItem[] = [];
    this.domainGroups.forEach(g => {
      all.push(...g.items);
    });
    return all;
  }

  get visibleDomainGroups(): DomainGroup[] {
    if (this.activeDomainTab === 0) {
      return this.domainGroups;
    }
    return this.domainGroups.filter(g => g.id === this.activeDomainTab);
  }

  get totalItemsCount(): number {
    return this.getAllChecklistItems().length;
  }

  get totalPassCount(): number {
    return this.getAllChecklistItems().filter(i => i.result === 'pass').length;
  }

  get totalFailCount(): number {
    return this.getAllChecklistItems().filter(i => i.result === 'fail').length;
  }

  get hasViolations(): boolean {
    return this.totalFailCount > 0;
  }

  getDomainPassCount(domain: DomainGroup): number {
    return domain.items.filter(i => i.result === 'pass').length;
  }

  getDomainFailCount(domain: DomainGroup): number {
    return domain.items.filter(i => i.result === 'fail').length;
  }

  toggleChecklistItem(item: InspectionChecklistItem, result: ChecklistResult): void {
    if (this.isLocked) return;
    item.result = result;
    if (result === 'fail') {
      const group = this.domainGroups.find(g => g.items.some(i => i.criteriaCode === item.criteriaCode));
      if (group) group.isExpanded = true;
    }
    if (!this.hasViolations) {
      this.selectedViolationCodes = [];
    }
  }

  isViolationSelected(code: string): boolean {
    return this.selectedViolationCodes.includes(code);
  }

  toggleViolation(code: string): void {
    if (this.isLocked) return;
    const idx = this.selectedViolationCodes.indexOf(code);
    if (idx >= 0) {
      this.selectedViolationCodes.splice(idx, 1);
    } else {
      this.selectedViolationCodes.push(code);
    }
  }

  isTagSelected(code: string): boolean {
    return this.selectedTags.includes(code);
  }

  toggleTag(code: string): void {
    if (this.isLocked) return;
    const idx = this.selectedTags.indexOf(code);
    if (idx >= 0) {
      this.selectedTags.splice(idx, 1);
    } else {
      this.selectedTags.push(code);
    }
  }

  onFileSelected(event: any): void {
    if (this.isLocked || !this.inspection) return;
    const file = event.target.files?.[0];
    if (!file) return;

    this.uploadError = '';

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError = 'File vượt quá kích thước cho phép (tối đa 5MB).';
      return;
    }

    // Validate extension
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|pdf)$/i)) {
      this.uploadError = 'Chỉ chấp nhận các file ảnh (.jpg, .png) hoặc tài liệu PDF (.pdf).';
      return;
    }

    this.isUploading = true;
    const formData = new FormData();
    formData.append('file', file);

    this.api.post<any>(`/inspections/${this.inspection.id}/evidence`, formData).subscribe({
      next: (res) => {
        this.isUploading = false;
        if (res.success) {
          this.evidenceList = res.evidenceFiles || [...this.evidenceList, res.filePath];
          if (this.inspection) {
            this.inspection.evidenceFiles = JSON.stringify(this.evidenceList);
          }
        } else {
          this.uploadError = res.message || 'Lỗi khi tải lên file.';
        }
      },
      error: (err) => {
        this.isUploading = false;
        this.uploadError = err.error?.message || 'Không thể tải lên file bằng chứng.';
      }
    });

    // Reset input
    event.target.value = '';
  }

  removeEvidence(index: number): void {
    if (this.isLocked) return;
    this.evidenceList.splice(index, 1);
  }

  isPdf(path: string): boolean {
    return path.toLowerCase().endsWith('.pdf');
  }

  getFileName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  }

  openImagePreview(url: string): void {
    this.previewImageUrl = url;
  }

  closeImagePreview(): void {
    this.previewImageUrl = null;
  }

  // Location handling
  useCurrentLocation(): void {
    if (this.isLocked) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.lat = Number(pos.coords.latitude.toFixed(6));
          this.lng = Number(pos.coords.longitude.toFixed(6));
          this.calculateNearestWard();
        },
        (err) => {
          // Fallback to sample coordinate of the current ward
          this.useSampleLocation();
        }
      );
    } else {
      this.useSampleLocation();
    }
  }

  useSampleLocation(): void {
    if (this.isLocked || !this.inspection) return;
    // Find matching ward center or default to first
    const targetWard = this.WARD_CENTERS.find(w => w.name.includes(this.inspection?.ward || ''));
    if (targetWard) {
      // Add slight offset for realism (~20-50m)
      this.lat = Number((targetWard.lat + 0.0003).toFixed(6));
      this.lng = Number((targetWard.lng + 0.0002).toFixed(6));
    } else {
      this.lat = 20.9984;
      this.lng = 105.8291;
    }
    this.calculateNearestWard();
  }

  onCoordinateChange(): void {
    this.calculateNearestWard();
  }

  calculateNearestWard(): void {
    if (this.lat === null || this.lng === null || isNaN(this.lat) || isNaN(this.lng)) {
      this.detectedWard = null;
      this.detectedDistanceMeters = null;
      return;
    }

    let minDistance = Infinity;
    let closestWard: string | null = null;

    for (const ward of this.WARD_CENTERS) {
      const d = this.getDistanceFromLatLonInMeters(this.lat, this.lng, ward.lat, ward.lng);
      if (d < minDistance) {
        minDistance = d;
        closestWard = ward.name;
      }
    }

    this.detectedWard = closestWard;
    this.detectedDistanceMeters = Math.round(minDistance);
  }

  private getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in metres
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  isWardMatched(): boolean {
    if (!this.detectedWard || !this.inspection?.ward) return false;
    return this.detectedWard.includes(this.inspection.ward) || this.inspection.ward.includes(this.detectedWard);
  }

  saveDraft(): void {
    if (!this.inspection || this.isLocked) return;

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const allItems = this.getAllChecklistItems();
    const legacyChecklist: Record<string, boolean> = {
      pccc: this.getDomainFailCount(this.domainGroups[0]) === 0,
      hygiene: this.getDomainFailCount(this.domainGroups[1]) === 0,
      location: this.getDomainFailCount(this.domainGroups[3]) === 0,
      price_tag: this.getDomainFailCount(this.domainGroups[4]) === 0,
      dkkd: this.getDomainFailCount(this.domainGroups[4]) === 0
    };

    const payload = {
      checklist: legacyChecklist,
      checklistItems: allItems,
      violationCodes: this.selectedViolationCodes,
      recommendationNote: this.recommendationNote,
      recommendationTags: this.selectedTags,
      lat: this.lat,
      lng: this.lng,
      severity: this.severity,
      status: 'in_progress'
    };

    this.api.put<any>(`/inspections/${this.inspection.id}`, payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.successMessage = 'Đã lưu tạm hồ sơ kiểm tra thành công.';
          if (this.inspection) {
            this.inspection.status = 'in_progress';
            this.inspection.checklist = JSON.stringify(legacyChecklist);
            this.inspection.checklistItems = allItems;
            this.inspection.violationCodes = JSON.stringify(this.selectedViolationCodes);
            this.inspection.recommendationNote = this.recommendationNote;
            this.inspection.recommendationTags = JSON.stringify(this.selectedTags);
            this.inspection.lat = this.lat || undefined;
            this.inspection.lng = this.lng || undefined;
            this.inspection.severity = this.severity;
            this.saved.emit(this.inspection);
          }
          setTimeout(() => this.successMessage = '', 3000);
        } else {
          this.errorMessage = res.message || 'Lỗi khi lưu dữ liệu.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || 'Không thể lưu hồ sơ kiểm tra.';
      }
    });
  }

  confirmComplete(): void {
    if (this.isLocked) return;
    this.showConfirmComplete = true;
  }

  cancelConfirm(): void {
    this.showConfirmComplete = false;
  }

  executeComplete(): void {
    if (!this.inspection || this.isLocked) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    const allItems = this.getAllChecklistItems();
    const legacyChecklist: Record<string, boolean> = {
      pccc: this.getDomainFailCount(this.domainGroups[0]) === 0,
      hygiene: this.getDomainFailCount(this.domainGroups[1]) === 0,
      location: this.getDomainFailCount(this.domainGroups[3]) === 0,
      price_tag: this.getDomainFailCount(this.domainGroups[4]) === 0,
      dkkd: this.getDomainFailCount(this.domainGroups[4]) === 0
    };

    const payload = {
      checklist: legacyChecklist,
      checklistItems: allItems,
      violationCodes: this.selectedViolationCodes,
      recommendationNote: this.recommendationNote,
      recommendationTags: this.selectedTags,
      lat: this.lat,
      lng: this.lng,
      severity: this.severity,
      status: 'in_progress'
    };

    this.api.put<any>(`/inspections/${this.inspection.id}`, payload).subscribe({
      next: () => {
        // Now complete and lock
        this.api.post<any>(`/inspections/${this.inspection!.id}/complete`, {}).subscribe({
          next: (res) => {
            this.isSubmitting = false;
            this.showConfirmComplete = false;
            if (res.success) {
              if (this.inspection) {
                this.inspection.status = 'completed';
                this.inspection.isLocked = 1;
                this.inspection.completedAt = new Date().toISOString();
                this.inspection.checklistItems = allItems;
                this.completed.emit(this.inspection);
              }
              this.successMessage = 'Hồ sơ đã được chốt và khóa dữ liệu an toàn theo RULE-03.';
            } else {
              this.errorMessage = res.message || 'Lỗi khi kết thúc kiểm tra.';
            }
          },
          error: (err) => {
            this.isSubmitting = false;
            this.showConfirmComplete = false;
            this.errorMessage = err.error?.message || 'Không thể hoàn thành hồ sơ kiểm tra.';
          }
        });
      },
      error: (err) => {
        this.isSubmitting = false;
        this.showConfirmComplete = false;
        this.errorMessage = err.error?.message || 'Lỗi khi cập nhật dữ liệu kiểm tra.';
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
