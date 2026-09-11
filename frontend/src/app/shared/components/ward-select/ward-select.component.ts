import { Component, Input, Output, EventEmitter, OnInit, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../core/services/api.service';

export interface WardOption {
  id: number;
  code: string;
  name: string;
}

const DEFAULT_DEMO_WARDS: WardOption[] = [
  { id: 1, code: 'HOAN_KIEM', name: 'Phường Hoàn Kiếm' },
  { id: 2, code: 'BA_DINH', name: 'Phường Ba Đình' },
  { id: 3, code: 'DONG_DA', name: 'Phường Đống Đa' },
  { id: 4, code: 'HAI_BA_TRUNG', name: 'Phường Hai Bà Trưng' },
  { id: 5, code: 'CAU_GIAY', name: 'Phường Cầu Giấy' }
];

@Component({
  selector: 'app-ward-select',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => WardSelectComponent),
      multi: true
    }
  ],
  template: `
    <div class="ward-select-container" [ngClass]="containerClass">
      <div class="select-wrapper">
        <mat-icon *ngIf="showIcon" class="ward-icon">location_on</mat-icon>
        <select
          class="ward-select-control"
          [class.has-icon]="showIcon"
          [class.compact]="compact"
          [disabled]="disabled"
          [ngModel]="value"
          (ngModelChange)="onSelectChange($event)"
        >
          <option *ngIf="includeAllOption" [value]="allOptionValue">
            {{ allOptionLabel }}
          </option>
          <option *ngFor="let w of wards" [value]="useCodeAsValue ? w.code : w.name">
            {{ w.name }}
          </option>
        </select>
        <mat-icon class="arrow-icon">expand_more</mat-icon>
      </div>
    </div>
  `,
  styles: [`
    .ward-select-container {
      display: inline-block;
      width: 100%;
      max-width: 280px;
    }

    .select-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }

    .ward-icon {
      position: absolute;
      left: 10px;
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #64748b;
      pointer-events: none;
      z-index: 1;
    }

    .arrow-icon {
      position: absolute;
      right: 8px;
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #94a3b8;
      pointer-events: none;
    }

    .ward-select-control {
      width: 100%;
      height: 38px;
      padding: 0 28px 0 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13.5px;
      font-weight: 500;
      color: #1e293b;
      background-color: #ffffff;
      outline: none;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      transition: all 0.2s ease;

      &.has-icon {
        padding-left: 32px;
      }

      &.compact {
        height: 34px;
        font-size: 13px;
      }

      &:hover:not(:disabled) {
        border-color: #94a3b8;
      }

      &:focus {
        border-color: #1a56db;
        box-shadow: 0 0 0 2px rgba(26, 86, 219, 0.15);
      }

      &:disabled {
        background-color: #f1f5f9;
        color: #94a3b8;
        cursor: not-allowed;
      }
    }
  `]
})
export class WardSelectComponent implements OnInit, ControlValueAccessor {
  @Input() placeholder: string = '-- Tất cả các Phường --';
  @Input() allOptionLabel: string = '-- Tất cả các Phường --';
  @Input() allOptionValue: string = '';
  @Input() includeAllOption: boolean = true;
  @Input() showIcon: boolean = true;
  @Input() compact: boolean = false;
  @Input() containerClass: string = '';
  @Input() useCodeAsValue: boolean = false;
  @Input() disabled: boolean = false;

  @Output() wardChange = new EventEmitter<string>();

  wards: WardOption[] = DEFAULT_DEMO_WARDS;
  value: string = '';

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    if (this.placeholder && this.allOptionLabel === '-- Tất cả các Phường --') {
      this.allOptionLabel = this.placeholder;
    }
    this.fetchWards();
  }

  fetchWards(): void {
    this.api.get<any>('/wards').subscribe({
      next: (res) => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          this.wards = res.data.map((w: any) => ({
            id: w.id,
            code: w.code,
            name: w.name
          }));
        }
      },
      error: () => {
        // Fallback to DEFAULT_DEMO_WARDS already loaded
      }
    });
  }

  onSelectChange(val: string): void {
    this.value = val;
    this.onChange(val);
    this.onTouched();
    this.wardChange.emit(val);
  }

  // ControlValueAccessor methods
  writeValue(val: string): void {
    this.value = val !== undefined && val !== null ? val : '';
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
