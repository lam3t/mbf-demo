import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { BusinessObject, BusinessObjectType, BusinessLocation, LocationType } from '../../../core/models';

export interface ObjectDialogData {
  isEdit: boolean;
  object?: BusinessObject;
}

@Component({
  selector: 'app-object-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-wrapper">
      <div class="dialog-header">
        <div class="title-with-icon">
          <mat-icon class="header-icon">{{ data.isEdit ? 'edit_note' : 'domain_add' }}</mat-icon>
          <h2>{{ data.isEdit ? 'Chỉnh sửa hồ sơ cơ sở' : 'Thêm mới đối tượng kinh doanh' }}</h2>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <!-- Step 1: Type Selection Tabs (Only in Create Mode) -->
        <div class="type-selector-strip" *ngIf="!data.isEdit">
          <button
            type="button"
            class="type-tab-btn"
            [class.active]="formData.type === 'enterprise'"
            (click)="setType('enterprise')"
          >
            <mat-icon>business</mat-icon>
            <span>1. Doanh nghiệp</span>
          </button>
          <button
            type="button"
            class="type-tab-btn"
            [class.active]="formData.type === 'household'"
            (click)="setType('household')"
          >
            <mat-icon>storefront</mat-icon>
            <span>2. Hộ kinh doanh</span>
          </button>
          <button
            type="button"
            class="type-tab-btn"
            [class.active]="formData.type === 'individual'"
            (click)="setType('individual')"
          >
            <mat-icon>person</mat-icon>
            <span>3. Cá nhân KD</span>
          </button>
        </div>

        <!-- Warning Banner: CẢNH BÁO TRÙNG NHƯNG KHÔNG CHẶN -->
        <div *ngIf="warningMessage" class="alert-banner-warning">
          <div class="alert-icon-box">
            <mat-icon>warning_amber</mat-icon>
          </div>
          <div class="alert-text">
            <strong>CẢNH BÁO TRÙNG LẶP / ĐÃ CÓ LỊCH SỬ KIỂM TRA (KHÔNG CHẶN):</strong>
            <p>{{ warningMessage }}</p>
          </div>
        </div>

        <!-- Info Banner: AUTO-FILLED -->
        <div *ngIf="isAutoFilled" class="alert-banner-info">
          <mat-icon>info</mat-icon>
          <span>Đã tìm thấy thông tin đối tượng trên hệ thống. Bạn vẫn có thể cập nhật hoặc bổ sung thêm chi nhánh/cơ sở mới.</span>
        </div>

        <form class="object-form">
          <!-- Identifier Input (MST or CCCD) with Live Checking Debounce -->
          <div class="form-row">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>{{ formData.type === 'enterprise' ? 'Mã số thuế doanh nghiệp (10 số) *' : 'Số CCCD chủ cơ sở (12 số) *' }}</mat-label>
              <input
                matInput
                [(ngModel)]="identifierInput"
                name="identifier"
                (ngModelChange)="onIdentifierInput($event)"
                [disabled]="data.isEdit"
                [placeholder]="formData.type === 'enterprise' ? 'vd: 0101234567' : 'vd: 001090012345'"
                required
              />
              <mat-icon matPrefix>{{ formData.type === 'enterprise' ? 'corporate_fare' : 'badge' }}</mat-icon>
              <span matSuffix *ngIf="isChecking" class="spinner-suffix">
                <mat-spinner diameter="18"></mat-spinner>
              </span>
            </mat-form-field>
          </div>

          <!-- Name of Organization -->
          <div class="form-row">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Tên cơ sở / Tổ chức kinh doanh *</mat-label>
              <input
                matInput
                [(ngModel)]="formData.name"
                name="name"
                [disabled]="isAutoFilled"
                placeholder="Nhập tên đầy đủ của doanh nghiệp hoặc hộ kinh doanh"
                required
              />
              <mat-icon matPrefix>store</mat-icon>
            </mat-form-field>
          </div>

          <!-- Representative / Owner -->
          <div class="form-row grid-2">
            <mat-form-field appearance="outline">
              <mat-label>{{ formData.type === 'enterprise' ? 'Người đại diện pháp luật *' : 'Họ và tên chủ hộ / cá nhân *' }}</mat-label>
              <input
                matInput
                [(ngModel)]="formData.representative"
                name="representative"
                [disabled]="isAutoFilled"
                placeholder="vd: Nguyễn Văn A"
                required
              />
              <mat-icon matPrefix>person_outline</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" *ngIf="formData.type === 'household'">
              <mat-label>Mã số thuế hộ kinh doanh</mat-label>
              <input
                matInput
                [(ngModel)]="formData.taxCode"
                name="taxCode"
                [disabled]="isAutoFilled"
                placeholder="vd: 8012345678"
              />
              <mat-icon matPrefix>receipt</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" *ngIf="formData.type === 'individual'">
              <mat-label>Lĩnh vực hoạt động kinh doanh</mat-label>
              <input
                matInput
                [(ngModel)]="formData.field"
                name="field"
                [disabled]="isAutoFilled"
                placeholder="vd: Dịch vụ ăn uống, Bán lẻ"
              />
              <mat-icon matPrefix>work_outline</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" *ngIf="formData.type === 'enterprise'">
              <mat-label>Trạng thái hoạt động</mat-label>
              <mat-select [(ngModel)]="formData.status" name="status">
                <mat-option value="active">Đang hoạt động</mat-option>
                <mat-option value="suspended">Tạm ngừng hoạt động</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Address -->
          <div class="form-row">
            <mat-form-field appearance="outline" class="w-100">
              <mat-label>Địa chỉ hoạt động kinh doanh *</mat-label>
              <input
                matInput
                [(ngModel)]="formData.address"
                name="address"
                [disabled]="isAutoFilled"
                placeholder="Số nhà, đường phố, thôn xóm"
                required
              />
              <mat-icon matPrefix>location_on</mat-icon>
            </mat-form-field>
          </div>

          <!-- Ward Selection -->
          <div class="form-row grid-2">
            <mat-form-field appearance="outline">
              <mat-label>Phường quản lý địa bàn *</mat-label>
              <mat-select [(ngModel)]="formData.ward" name="ward" required>
                <mat-option *ngFor="let w of wardList" [value]="w">{{ w }}</mat-option>
              </mat-select>
              <mat-icon matPrefix>holiday_village</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" *ngIf="formData.type !== 'enterprise'">
              <mat-label>Trạng thái hoạt động</mat-label>
              <mat-select [(ngModel)]="formData.status" name="status">
                <mat-option value="active">Đang hoạt động</mat-option>
                <mat-option value="suspended">Tạm ngừng hoạt động</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" *ngIf="formData.type === 'enterprise'">
              <mat-label>Ngành nghề / Lĩnh vực chính</mat-label>
              <input
                matInput
                [(ngModel)]="formData.field"
                name="entField"
                placeholder="vd: Thương mại, Khách sạn, Viễn thông, F&B..."
              />
              <mat-icon matPrefix>category</mat-icon>
            </mat-form-field>
          </div>

          <!-- Foreign Element Section (Yếu tố nước ngoài) -->
          <div class="foreign-element-box">
            <label class="foreign-checkbox-label">
              <input
                type="checkbox"
                [(ngModel)]="formData.hasForeignElement"
                name="hasForeignElement"
              />
              <mat-icon class="foreign-icon">public</mat-icon>
              <span>Doanh nghiệp / Dịch vụ có yếu tố nước ngoài (Vốn FDI, lao động nước ngoài, dịch vụ xuyên biên giới...)</span>
            </label>
            <div *ngIf="formData.hasForeignElement" class="foreign-detail-row">
              <input
                type="text"
                class="foreign-input"
                [(ngModel)]="formData.foreignElementDetail"
                name="foreignElementDetail"
                placeholder="Nhập chi tiết yếu tố nước ngoài (VD: Vốn đầu tư Nhật Bản 100%, có chuyên gia nước ngoài lưu trú/làm việc...)"
              />
            </div>
          </div>

          <!-- Multi-Location Management Section (Trụ sở, Chi nhánh, Cơ sở, Địa điểm KD) -->
          <div class="locations-section">
            <div class="locations-header">
              <div class="loc-title">
                <mat-icon>account_tree</mat-icon>
                <span>Danh sách Trụ sở, Chi nhánh, Cơ sở & Địa điểm kinh doanh ({{ formData.locations.length }})</span>
              </div>
              <button type="button" class="btn-add-loc" (click)="addLocationRow()">
                <mat-icon>add_location_alt</mat-icon>
                <span>+ Thêm cơ sở / địa điểm</span>
              </button>
            </div>

            <div class="locations-list">
              <div *ngFor="let loc of formData.locations; let i = index" class="location-item-card">
                <div class="loc-row-top">
                  <select [(ngModel)]="loc.locationType" [name]="'locType_' + i" class="loc-select-type">
                    <option value="headquarters">🏢 Trụ sở chính</option>
                    <option value="branch">🏛️ Chi nhánh</option>
                    <option value="facility">🏭 Cơ sở sản xuất / Dịch vụ</option>
                    <option value="business_location">🏪 Địa điểm kinh doanh</option>
                  </select>
                  <input
                    type="text"
                    [(ngModel)]="loc.name"
                    [name]="'locName_' + i"
                    placeholder="Tên trụ sở / chi nhánh / cơ sở / địa điểm KD *"
                    class="loc-input-name"
                  />
                  <button
                    *ngIf="formData.locations.length > 1"
                    type="button"
                    class="btn-remove-loc"
                    (click)="removeLocationRow(i)"
                    title="Xóa địa điểm này"
                  >
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
                <div class="loc-row-bottom">
                  <input
                    type="text"
                    [(ngModel)]="loc.address"
                    [name]="'locAddr_' + i"
                    placeholder="Địa chỉ chi tiết của cơ sở / địa điểm này *"
                    class="loc-input-addr"
                  />
                  <select [(ngModel)]="loc.ward" [name]="'locWard_' + i" class="loc-select-ward">
                    <option *ngFor="let w of wardList" [value]="w">{{ w }}</option>
                  </select>
                  <input
                    type="text"
                    [(ngModel)]="loc.contactPerson"
                    [name]="'locContact_' + i"
                    placeholder="Người phụ trách cơ sở"
                    class="loc-input-contact"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      <div class="dialog-footer">
        <button type="button" class="btn-cancel" (click)="dialogRef.close()">
          Hủy bỏ
        </button>
        <button
          type="button"
          class="btn-save"
          [disabled]="isSaveDisabled()"
          (click)="onSave()"
        >
          <mat-icon>check</mat-icon>
          <span>{{ data.isEdit ? 'Lưu thay đổi' : 'Lưu đối tượng' }}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      padding: 20px 24px;
      min-width: 620px;
      max-width: 760px;
      max-height: 88vh;
      overflow-y: auto;
      background: #ffffff;
    }

    .alert-banner-warning {
      display: flex;
      gap: 12px;
      padding: 10px 14px;
      background-color: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      color: #92400e;
      margin-bottom: 14px;

      .alert-icon-box mat-icon {
        color: #d97706;
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      .alert-text {
        font-size: 12.5px;
        line-height: 1.4;
        strong { display: block; margin-bottom: 2px; color: #b45309; }
        p { margin: 0; }
      }
    }

    .foreign-element-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 10px;

      .foreign-checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: #1e293b;
        cursor: pointer;

        input[type="checkbox"] {
          width: 16px;
          height: 16px;
          accent-color: #1e3a8a;
        }

        .foreign-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #0284c7;
        }
      }

      .foreign-detail-row {
        margin-top: 8px;

        .foreign-input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #93c5fd;
          border-radius: 6px;
          font-size: 12.5px;
          background: #ffffff;
          box-sizing: border-box;
        }
      }
    }

    .locations-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;

      .locations-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;

        .loc-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 700;
          color: #1e3a8a;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }

        .btn-add-loc {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;

          mat-icon { font-size: 15px; width: 15px; height: 15px; }
          &:hover { background: #dbeafe; }
        }
      }

      .locations-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 210px;
        overflow-y: auto;

        .location-item-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;

          .loc-row-top {
            display: grid;
            grid-template-columns: 185px 1fr auto;
            gap: 6px;
            align-items: center;
          }

          .loc-row-bottom {
            display: grid;
            grid-template-columns: 1fr 150px 150px;
            gap: 6px;
            align-items: center;
          }

          .loc-select-type, .loc-select-ward, .loc-input-name, .loc-input-addr, .loc-input-contact {
            height: 32px;
            padding: 0 8px;
            border: 1px solid #cbd5e1;
            border-radius: 5px;
            font-size: 12px;
            color: #1e293b;
            background: #ffffff;
            box-sizing: border-box;
          }

          .btn-remove-loc {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            border-radius: 5px;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;

            mat-icon { font-size: 16px; width: 16px; height: 16px; }
          }
        }
      }
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;

      .title-with-icon {
        display: flex;
        align-items: center;
        gap: 10px;

        .header-icon {
          color: #1e3a8a;
          font-size: 24px;
          width: 24px;
          height: 24px;
        }

        h2 {
          font-size: 17px;
          font-weight: 700;
          color: #111827;
          margin: 0;
        }
      }

      .close-btn { color: #9ca3af; }
    }

    .type-selector-strip {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;

      .type-tab-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        height: 38px;
        border: 1px solid #d1d5db;
        background: #ffffff;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        color: #4b5563;
        cursor: pointer;
        transition: all 0.15s;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #6b7280;
        }

        &:hover {
          background-color: #f8fafc;
        }

        &.active {
          background-color: #1e3a8a;
          color: #ffffff;
          border-color: #1e3a8a;
          font-weight: 600;

          mat-icon {
            color: #ffffff;
          }
        }
      }
    }

    .alert-banner-danger {
      display: flex;
      gap: 12px;
      padding: 12px 14px;
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      color: #991b1b;
      margin-bottom: 16px;

      .alert-icon-box mat-icon {
        color: #dc2626;
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      .alert-text {
        font-size: 12.5px;
        line-height: 1.4;

        strong {
          display: block;
          margin-bottom: 2px;
          color: #b91c1c;
        }

        p {
          margin: 0;
        }
      }
    }

    .alert-banner-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background-color: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      color: #1e40af;
      font-size: 12.5px;
      margin-bottom: 16px;

      mat-icon {
        color: #2563eb;
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .object-form {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .w-100 { width: 100%; }

      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
    }

    .spinner-suffix {
      display: flex;
      align-items: center;
      margin-right: 8px;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;

      .btn-cancel {
        height: 38px;
        padding: 0 16px;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        color: #4b5563;
        font-size: 13.5px;
        font-weight: 500;
        cursor: pointer;

        &:hover { background-color: #f3f4f6; }
      }

      .btn-save {
        height: 38px;
        padding: 0 18px;
        background-color: #1e3a8a;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-size: 13.5px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        transition: all 0.15s;

        &:hover:not([disabled]) {
          background-color: #1d4ed8;
          box-shadow: 0 4px 10px rgba(30, 58, 138, 0.25);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    }
  `]
})
export class ObjectDialogComponent implements OnInit, OnDestroy {
  identifierInput = '';
  isChecking = false;
  isAutoFilled = false;
  isBlocked = false;
  blockReason: string | null = null;
  warningMessage: string | null = null;
  lockedByWard: string | null = null;
  isCompletedThisYear = false;
  currentYear = new Date().getFullYear();

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  wardList = [
    'Phường Hoàn Kiếm',
    'Phường Ba Đình',
    'Phường Đống Đa',
    'Phường Hai Bà Trưng',
    'Phường Cầu Giấy'
  ];

  formData: {
    type: BusinessObjectType;
    taxCode?: string;
    idNumber?: string;
    name: string;
    representative?: string;
    field?: string;
    address: string;
    ward: string;
    status: 'active' | 'suspended';
    hasForeignElement: boolean;
    foreignElementDetail: string;
    locations: BusinessLocation[];
  } = {
    type: 'enterprise',
    taxCode: '',
    idNumber: '',
    name: '',
    representative: '',
    field: '',
    address: '',
    ward: 'Phường Hoàn Kiếm',
    status: 'active',
    hasForeignElement: false,
    foreignElementDetail: '',
    locations: [
      {
        locationType: 'headquarters',
        name: 'Trụ sở chính',
        address: '',
        ward: 'Phường Hoàn Kiếm',
        contactPerson: ''
      }
    ]
  };

  constructor(
    public dialogRef: MatDialogRef<ObjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ObjectDialogData,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    if (this.data.isEdit && this.data.object) {
      const obj = this.data.object;
      const existingLocations = Array.isArray(obj.locations) && obj.locations.length > 0
        ? obj.locations.map(l => ({ ...l }))
        : [
            {
              locationType: 'headquarters' as LocationType,
              name: `Trụ sở chính - ${obj.name}`,
              address: obj.address,
              ward: obj.ward,
              contactPerson: obj.representative || ''
            }
          ];

      this.formData = {
        type: obj.type,
        taxCode: obj.taxCode || '',
        idNumber: obj.idNumber || '',
        name: obj.name,
        representative: obj.representative || '',
        field: obj.field || '',
        address: obj.address,
        ward: obj.ward,
        status: obj.status,
        hasForeignElement: Boolean(obj.hasForeignElement),
        foreignElementDetail: obj.foreignElementDetail || '',
        locations: existingLocations
      };
      this.identifierInput = obj.taxCode || obj.idNumber || '';
    } else {
      // Setup Debounce 400ms for live checking identifier
      this.searchSubscription = this.searchSubject
        .pipe(
          debounceTime(400),
          distinctUntilChanged()
        )
        .subscribe(val => {
          this.executeCheck(val);
        });
    }
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  addLocationRow(): void {
    this.formData.locations.push({
      locationType: this.formData.locations.length === 0 ? 'headquarters' : 'business_location',
      name: `Cơ sở / Địa điểm KD số ${this.formData.locations.length + 1}`,
      address: this.formData.address || '',
      ward: this.formData.ward || 'Phường Hoàn Kiếm',
      contactPerson: this.formData.representative || ''
    });
  }

  removeLocationRow(index: number): void {
    if (this.formData.locations.length <= 1) return;
    this.formData.locations.splice(index, 1);
  }

  setType(type: BusinessObjectType): void {
    this.formData.type = type;
    this.isBlocked = false;
    this.blockReason = null;
    this.warningMessage = null;
    this.lockedByWard = null;
    this.isCompletedThisYear = false;
    this.isAutoFilled = false;
    if (this.identifierInput) {
      this.onIdentifierInput(this.identifierInput);
    }
  }

  onIdentifierInput(val: string): void {
    const clean = val?.trim();
    if (clean && (clean.length === 10 || clean.length === 12 || clean.length === 13)) {
      this.searchSubject.next(clean);
    } else {
      this.isBlocked = false;
      this.blockReason = null;
      this.warningMessage = null;
      this.lockedByWard = null;
      this.isCompletedThisYear = false;
      this.isAutoFilled = false;
    }
  }

  executeCheck(identifier: string): void {
    this.isChecking = true;
    this.api.get<any>(`/objects/check/${identifier}`).subscribe({
      next: (res) => {
        this.isChecking = false;
        if (res.success && res.exists) {
          this.isBlocked = false; // Warn only, never hard-block!
          this.warningMessage = res.warningMessage || res.blockReason || 'Mã định danh này đã tồn tại trên hệ thống. Hệ thống cảnh báo trùng nhưng vẫn cho phép cập nhật hoặc mở thêm chi nhánh/cơ sở.';
          if (res.objectData) {
            this.isAutoFilled = true;
            this.formData.name = res.objectData.name || this.formData.name;
            this.formData.representative = res.objectData.representative || this.formData.representative;
            this.formData.address = res.objectData.address || this.formData.address;
            this.formData.ward = res.objectData.ward || this.formData.ward;
            this.formData.status = res.objectData.status || this.formData.status;
          }
        } else {
          this.isBlocked = false;
          this.blockReason = null;
          this.warningMessage = null;
          this.isAutoFilled = false;
        }
      },
      error: () => {
        this.isChecking = false;
      }
    });
  }

  isSaveDisabled(): boolean {
    if (!this.identifierInput || !this.formData.name || !this.formData.address || !this.formData.ward) {
      return true;
    }
    if (this.formData.type === 'enterprise' && !this.formData.representative) {
      return true;
    }
    return false;
  }

  onSave(): void {
    if (this.isSaveDisabled()) return;

    if (this.formData.type === 'enterprise') {
      this.formData.taxCode = this.identifierInput;
      this.formData.idNumber = '';
    } else {
      this.formData.idNumber = this.identifierInput;
    }

    // Sync first headquarters location if empty
    if (this.formData.locations.length > 0) {
      if (!this.formData.locations[0].address) {
        this.formData.locations[0].address = this.formData.address;
      }
      if (!this.formData.locations[0].ward) {
        this.formData.locations[0].ward = this.formData.ward;
      }
    }

    this.dialogRef.close(this.formData);
  }
}
