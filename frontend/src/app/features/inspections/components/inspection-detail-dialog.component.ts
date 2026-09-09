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
import { ApiService } from '../../../core/services/api.service';
import { Inspection, ViolationCatalog, RecommendationTagCatalog } from '../../../core/models';

export interface ChecklistCriterion {
  id: string;
  title: string;
  desc: string;
  passed: boolean;
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
    MatProgressBarModule
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

  // Checklist criteria
  checklist: ChecklistCriterion[] = [
    {
      id: 'dkkd',
      title: 'Có giấy chứng nhận ĐKKD / Đăng ký ngành nghề hợp lệ',
      desc: 'Cơ sở có giấy phép kinh doanh đúng quy định, phù hợp với ngành nghề đang hoạt động thực tế.',
      passed: true
    },
    {
      id: 'pccc',
      title: 'Đảm bảo điều kiện An toàn PCCC & Cứu nạn cứu hộ',
      desc: 'Trang bị bình chữa cháy còn hạn sử dụng, tiêu lệnh PCCC, lối thoát nạn thông thoáng không bị che chắn.',
      passed: true
    },
    {
      id: 'location',
      title: 'Kinh doanh đúng địa điểm, phạm vi đã đăng ký',
      desc: 'Hoạt động đúng địa chỉ được cấp phép, không lấn chiếm vỉa hè, lòng đường, đất công cộng.',
      passed: true
    },
    {
      id: 'price_tag',
      title: 'Niêm yết công khai giá hàng hóa, dịch vụ theo quy định',
      desc: 'Bảng giá rõ ràng, minh bạch, bán đúng giá niêm yết, không có hành vi gian lận thương mại.',
      passed: true
    },
    {
      id: 'hygiene',
      title: 'Vệ sinh an toàn thực phẩm & Giữ gìn ANTT cơ sở',
      desc: 'Đảm bảo điều kiện vệ sinh môi trường, an toàn thực phẩm (nếu kinh doanh ăn uống), không gây rối trật tự.',
      passed: true
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

    // Parse checklist
    if (this.inspection.checklist) {
      try {
        const parsed = typeof this.inspection.checklist === 'string'
          ? JSON.parse(this.inspection.checklist)
          : this.inspection.checklist;
        
        if (Array.isArray(parsed)) {
          this.checklist = parsed;
        } else if (typeof parsed === 'object') {
          this.checklist.forEach(item => {
            if (item.id in parsed) {
              item.passed = !!parsed[item.id];
            }
          });
        }
      } catch (e) {
        console.error('Error parsing checklist:', e);
      }
    } else {
      // Default all pass
      this.checklist.forEach(c => c.passed = true);
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

  get isLocked(): boolean {
    return !!(this.inspection && (this.inspection.isLocked === 1 || this.inspection.status === 'completed'));
  }

  get hasViolations(): boolean {
    return this.checklist.some(c => !c.passed);
  }

  get passedCount(): number {
    return this.checklist.filter(c => c.passed).length;
  }

  get failedCount(): number {
    return this.checklist.filter(c => !c.passed).length;
  }

  toggleChecklist(item: ChecklistCriterion, passed: boolean): void {
    if (this.isLocked) return;
    item.passed = passed;
    if (!this.hasViolations) {
      // If all passed, clear violation codes
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

    const payload = {
      checklist: this.checklist,
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
            this.inspection.checklist = JSON.stringify(this.checklist);
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

    // First update the latest form state
    const payload = {
      checklist: this.checklist,
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
