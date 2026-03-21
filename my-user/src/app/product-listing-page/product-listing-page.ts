import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SidebarComponent, SidebarFilters } from '../sidebar/sidebar';
import { ApiService } from '../services/api.service';

export interface FilterTag { key: string; label: string; }

@Component({
  selector: 'app-product-listing-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CurrencyPipe, SidebarComponent],
  templateUrl: './product-listing-page.html',
  styleUrls: ['./product-listing-page.css'],
})
export class ProductListingPageComponent implements OnInit, OnDestroy {

  viewMode: 'grid' | 'list' = 'grid';
  sortBy = 'popular';
  isLoading = false;
  currentPage = 1;
  pageSize = 9;

  wishlist: string[] = [];
  private wishlistSub!: Subscription;

  selectedFilters: string[] = [];
  priceRange: [number, number] = [0, 1000000];
  activeFilterTags: FilterTag[] = [];
  skeletons = Array(6).fill(0);
  categoryCounts: Record<string, number> = {};

  private currentFilters: SidebarFilters = {
    categories: [],
    priceMin: 0,
    priceMax: 1000000,
    rating: 0,
  };

  displayedProducts: any[] = [];
  totalProducts = 0;
  totalPages = 1;
  pageNumbers: (number | string)[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    public api: ApiService,
  ) {}

  ngOnInit(): void {
    this.loadCategoryCounts();

    this.route.queryParams.subscribe(params => {
      if (params['cat']) {
        this.selectedFilters = [params['cat']];
        this.currentFilters.categories = [params['cat']];
        this.rebuildFilterTags();
      } else {
        this.selectedFilters = [];
        this.currentFilters.categories = [];
      }
      this.currentPage = 1;
      this.loadProducts();
    });

    this.wishlistSub = this.api.wishlist$.subscribe(list => {
      this.wishlist = list;
      // không cần detectChanges — Default CD tự pick up
    });
  }

  ngOnDestroy(): void {
    this.wishlistSub?.unsubscribe();
  }

  loadCategoryCounts(): void {
    this.api.getCategoryCounts().subscribe({
      next: (counts) => {
        this.categoryCounts = { ...counts };
      },
      error: (err) => console.error('Lỗi tải category counts:', err),
    });
  }

  loadProducts(): void {
    this.isLoading = true;
    // Giữ data cũ trong lúc fetch để tránh nhấp nháy trắng

    const filters: any = {
      sort:  this.sortBy,
      page:  this.currentPage,
      limit: this.pageSize,
    };

    if (this.currentFilters.categories.length > 0) {
      filters.cat = this.currentFilters.categories.join(',');
    }
    if (this.currentFilters.priceMin > 0) {
      filters.minPrice = this.currentFilters.priceMin;
    }
    if (this.currentFilters.priceMax < 1000000) {
      filters.maxPrice = this.currentFilters.priceMax;
    }
    if (this.currentFilters.rating > 0) {
      filters.minRating = this.currentFilters.rating;
    }

    this.api.getProducts(filters).subscribe({
      next: (res) => {
        this.displayedProducts = res.products || [];
        this.totalProducts     = res.total    || 0;
        this.totalPages        = res.totalPages || 1;
        this.buildPageNumbers();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Lỗi tải sản phẩm:', err);
        this.displayedProducts = [];
        this.isLoading = false;
      }
    });
  }

  buildPageNumbers(): void {
    const pages: (number | string)[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      if (i === 1 || i === this.totalPages || Math.abs(i - this.currentPage) <= 1) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    this.pageNumbers = pages;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSortChange(): void { this.currentPage = 1; this.loadProducts(); }

  onAllFiltersChanged(filters: SidebarFilters): void {
    this.currentFilters  = { ...filters };
    this.selectedFilters = [...filters.categories];
    this.currentPage     = 1;
    this.rebuildFilterTags();
    this.loadProducts();
  }

  onResetFilters(): void {
    this.currentFilters   = { categories: [], priceMin: 0, priceMax: 1000000, rating: 0 };
    this.selectedFilters  = [];
    this.priceRange       = [0, 1000000];
    this.activeFilterTags = [];
    this.currentPage      = 1;
    this.loadProducts();
  }

  clearAllFilters(): void { this.onResetFilters(); }

  removeFilter(key: string): void {
    this.selectedFilters = this.selectedFilters.filter(f => f !== key);
    this.currentFilters.categories = [...this.selectedFilters];
    this.rebuildFilterTags();
    this.loadProducts();
  }

  rebuildFilterTags(): void {
    this.activeFilterTags = this.selectedFilters.map(f => ({ key: f, label: f }));
  }

  getStars(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  isWishlisted(id: string): boolean {
    return this.wishlist.includes(id);
  }

  toggleWishlist(event: Event, product: any): void {
    event.stopPropagation();
    this.api.toggleWishlist(product._id, product.name);
  }

  addToCart(event: Event, product: any): void {
    event.stopPropagation();
    if (!product?._id) return;

    this.api.addToCart(product._id, 1, product.name).subscribe({
      error: (err) => {
        console.error('Lỗi thêm giỏ hàng:', err);
        this.api.showToast('Không thể thêm vào giỏ hàng. Vui lòng thử lại.', 'error');
      }
    });
  }

  // FIX #6: trackBy giúp *ngFor không re-render toàn bộ list khi data thay đổi
  trackByProductId(_: number, product: any): string {
    return product._id;
  }

  goToDetail(id: any): void {
    if (!id) return;
    const idStr = typeof id === 'object' ? id.toString() : String(id);
    this.router.navigate(['/product-detail-page', idStr]);
  }
}