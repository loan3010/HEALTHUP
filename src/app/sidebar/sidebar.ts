import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface CategoryFilter { key: string; name: string; count: number; }
export interface StatusOption   { key: string; label: string; color: string; }
export interface PricePreset    { key: string; label: string; min: number; max: number; }

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent implements OnInit {

  @Input()  selectedFilters: string[] = [];
  @Input()  priceRange: [number, number] = [0, 1000000];
  @Output() filtersChanged = new EventEmitter<string[]>();
  @Output() priceChanged   = new EventEmitter<[number, number]>();
  @Output() reset          = new EventEmitter<void>();

  openSections: Record<string, boolean> = {
    category: true,
    price:    true,
    rating:   true,
    status:   false,
    weight:   false,
  };

  categories: CategoryFilter[] = [
    { key: 'Hạt dinh dưỡng', name: 'Hạt dinh dưỡng', count: 24 },
    { key: 'Granola',        name: 'Granola',         count: 18 },
    { key: 'Trái cây sấy',   name: 'Trái cây sấy',    count: 32 },
    { key: 'Đồ ăn vặt',      name: 'Đồ ăn vặt',       count: 15 },
    { key: 'Trà thảo mộc',   name: 'Trà thảo mộc',    count: 20 },
    { key: 'Combo',          name: 'Combo',           count: 10 },
  ];

  pricePresets: PricePreset[] = [
    { key: 'all',     label: 'Tất cả',     min: 0,      max: 1000000 },
    { key: 'u100',    label: 'Dưới 100K',  min: 0,      max: 100000  },
    { key: '100-200', label: '100K - 200K', min: 100000, max: 200000  },
    { key: 'o200',    label: 'Trên 200K',  min: 200000, max: 1000000 },
  ];

  statusOptions: StatusOption[] = [
    { key: 'in-stock', label: 'Còn hàng',       color: '#7FB069' },
    { key: 'new',      label: 'Hàng mới về',    color: '#3A6FD4' },
    { key: 'on-sale',  label: 'Đang giảm giá',  color: '#E8384F' },
  ];

  weightOptions = ['100g', '200g', '250g', '300g', '400g', '500g', '1kg'];

  ratingCounts: Record<number, number> = { 5: 124, 4: 89, 3: 32, 2: 8, 1: 3 };

  activePricePreset = 'all';
  selectedRating    = 0;
  selectedStatuses: string[] = [];
  selectedWeights:  string[] = [];
  priceMin = 0;
  priceMax = 1000000;

  get sliderLeft():  number { return (this.priceMin  / 1000000) * 100; }
  get sliderRight(): number { return 100 - (this.priceMax / 1000000) * 100; }

  get activeFilterCount(): number {
    return this.selectedFilters.length
      + this.selectedStatuses.length
      + this.selectedWeights.length
      + (this.selectedRating > 0 ? 1 : 0)
      + (this.activePricePreset !== 'all' ? 1 : 0);
  }

  ngOnInit(): void {}

  toggleSection(key: string): void { this.openSections[key] = !this.openSections[key]; }

  isCategorySelected(key: string): boolean { return this.selectedFilters.includes(key); }
  toggleCategoryFilter(key: string): void {
    this.selectedFilters = this.selectedFilters.includes(key)
      ? this.selectedFilters.filter(f => f !== key)
      : [...this.selectedFilters, key];
  }

  selectPricePreset(preset: PricePreset): void {
    this.activePricePreset = preset.key;
    this.priceMin = preset.min;
    this.priceMax = preset.max;
  }

  onPriceInputChange(): void {
    this.activePricePreset = 'custom';
    if (this.priceMin > this.priceMax) this.priceMin = this.priceMax;
  }

  selectRating(s: number): void { this.selectedRating = this.selectedRating === s ? 0 : s; }

  getStars(count: number): string { return '★'.repeat(count) + '☆'.repeat(5 - count); }

  isStatusSelected(key: string): boolean { return this.selectedStatuses.includes(key); }
  toggleStatusFilter(key: string): void {
    this.selectedStatuses = this.selectedStatuses.includes(key)
      ? this.selectedStatuses.filter(s => s !== key)
      : [...this.selectedStatuses, key];
  }

  isWeightSelected(w: string): boolean { return this.selectedWeights.includes(w); }
  toggleWeight(w: string): void {
    this.selectedWeights = this.selectedWeights.includes(w)
      ? this.selectedWeights.filter(x => x !== w)
      : [...this.selectedWeights, w];
  }

  applyFilters(): void {
    this.filtersChanged.emit(this.selectedFilters);
    this.priceChanged.emit([this.priceMin, this.priceMax]);
  }

  onReset(): void {
    this.selectedFilters  = [];
    this.selectedStatuses = [];
    this.selectedWeights  = [];
    this.selectedRating   = 0;
    this.activePricePreset = 'all';
    this.priceMin = 0;
    this.priceMax = 1000000;
    this.reset.emit();
  }
}