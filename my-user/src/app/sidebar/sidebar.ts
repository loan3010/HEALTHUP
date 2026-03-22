import {
  Component, Input, Output, EventEmitter,
  OnChanges, OnInit, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

export interface CategoryFilter { key: string; name: string; count: number; }
export interface PricePreset    { key: string; label: string; min: number; max: number; }

export interface SidebarFilters {
  categories: string[];
  priceMin: number;
  priceMax: number;
  rating: number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent implements OnInit, OnChanges {

  @Input() selectedFilters: string[] = [];
  @Input() priceRange: [number, number] = [0, 1000000];
  @Input() categoryCounts: Record<string, number> = {};

  @Output() allFiltersChanged = new EventEmitter<SidebarFilters>();
  @Output() reset = new EventEmitter<void>();

  openSections: Record<string, boolean> = {
    category: true,
    price: true,
  };

  private _categoryKeys: { key: string; name: string }[] = [];
  isLoadingCategories = false;

  get categories(): CategoryFilter[] {
    return this._categoryKeys.map(c => ({
      ...c,
      count: this.categoryCounts?.[c.key] ?? 0,
    }));
  }

  pricePresets: PricePreset[] = [
    { key: 'all',     label: 'Tất cả',    min: 0,      max: 1000000 },
    { key: 'u100',    label: 'Dưới 100K', min: 0,      max: 100000  },
    { key: '100-200', label: '100K–200K', min: 100000, max: 200000  },
    { key: 'o200',    label: 'Trên 200K', min: 200000, max: 1000000 },
  ];

  activePricePreset = 'all';
  priceMin = 0;
  priceMax = 1000000;

  get sliderLeft():  number { return (this.priceMin  / 1000000) * 100; }
  get sliderRight(): number { return 100 - (this.priceMax / 1000000) * 100; }

  get activeFilterCount(): number {
    return this.selectedFilters.length
      + (this.activePricePreset !== 'all' ? 1 : 0);
  }

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['priceRange'] && this.priceRange) {
      this.priceMin = this.priceRange[0];
      this.priceMax = this.priceRange[1];
      if (this.priceRange[0] === 0 && this.priceRange[1] === 1000000) {
        this.activePricePreset = 'all';
      }
    }
  }

  loadCategories(): void {
    this.isLoadingCategories = true;
    this.http.get<any[]>('http://localhost:3000/api/categories').subscribe({
      next: (cats) => {
        this._categoryKeys = (cats || [])
          .filter(c => c.isActive !== false)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map(c => ({ key: c.name, name: c.name }));
        this.isLoadingCategories = false;
      },
      error: () => {
        this._categoryKeys = [
          { key: 'Hạt dinh dưỡng', name: 'Hạt dinh dưỡng' },
          { key: 'Granola',        name: 'Granola'          },
          { key: 'Trái cây sấy',  name: 'Trái cây sấy'    },
          { key: 'Đồ ăn vặt',     name: 'Đồ ăn vặt'       },
          { key: 'Trà thảo mộc',  name: 'Trà thảo mộc'    },
          { key: 'Combo',          name: 'Combo'            },
        ];
        this.isLoadingCategories = false;
      }
    });
  }

  toggleSection(key: string): void { this.openSections[key] = !this.openSections[key]; }

  isCategorySelected(key: string): boolean { return this.selectedFilters.includes(key); }

  toggleCategoryFilter(key: string): void {
    this.selectedFilters = this.isCategorySelected(key)
      ? this.selectedFilters.filter(f => f !== key)
      : [...this.selectedFilters, key];
    this.emitAll();
  }

  selectPricePreset(preset: PricePreset): void {
    this.activePricePreset = preset.key;
    this.priceMin = preset.min;
    this.priceMax = preset.max;
    this.emitAll();
  }

  onPriceInputChange(): void {
    this.activePricePreset = 'custom';
    if (this.priceMin < 0) this.priceMin = 0;
    if (this.priceMax < this.priceMin) this.priceMax = this.priceMin;
    this.emitAll();
  }

  private emitAll(): void {
    this.allFiltersChanged.emit({
      categories: this.selectedFilters,
      priceMin:   this.priceMin,
      priceMax:   this.priceMax,
      rating:     0,
    });
  }

  onReset(): void {
    this.selectedFilters   = [];
    this.activePricePreset = 'all';
    this.priceMin = 0;
    this.priceMax = 1000000;
    this.reset.emit();
  }
}