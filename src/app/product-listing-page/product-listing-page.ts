import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar';

export interface ProductItem {
  id: number;
  image: string;
  name: string;
  cat: string;
  weight: string;
  price: number;
  oldPrice?: number;
  stars: string;
  reviews: number;
  sold?: number;
  badge?: 'new' | 'hot';
  sale?: string;
}

export interface FilterTag {
  key: string;
  label: string;
}

@Component({
  selector: 'app-product-listing-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CurrencyPipe, SidebarComponent],
  templateUrl: './product-listing-page.html',
  styleUrls: ['./product-listing-page.css']
})
export class ProductListingPageComponent implements OnInit {

  viewMode: 'grid' | 'list' = 'grid';
  sortBy = 'popular';
  isLoading = false;
  currentPage = 1;
  pageSize = 9;

  wishlist: number[] = [];
  selectedFilters: string[] = [];
  priceRange: [number, number] = [0, 1000000];
  activeFilterTags: FilterTag[] = [];
  skeletons = Array(6).fill(0);

  allProducts: ProductItem[] = [
    { id: 1, image: 'assets/images/products/macadamia.png',  name: 'Hat Macadamia Rang Muoi Uc',        cat: 'Hat dinh duong', weight: '250g / Hu thuy tinh', price: 185000, oldPrice: 220000, stars: '★★★★★', reviews: 128, badge: 'hot', sale: '-16%' },
    { id: 2, image: 'assets/images/products/granola.png',    name: 'Granola Hanh Nhan Mat Ong',          cat: 'Granola',        weight: '400g / Tui zip',      price: 145000,                  stars: '★★★★☆', reviews: 89,  badge: 'new'              },
    { id: 3, image: 'assets/images/products/nho-kho.png',   name: 'Nho Kho Khong Hat Nhap Khau',        cat: 'Trai cay say',   weight: '300g / Hop giay',     price: 98000,  oldPrice: 120000, stars: '★★★★★', reviews: 204, sale: '-18%'              },
    { id: 4, image: 'assets/images/products/tra.png',       name: 'Tra Hoa Cuc Tam Sen',                cat: 'Tra thao moc',   weight: '100g / Hop thiec',    price: 125000,                  stars: '★★★★☆', reviews: 56                               },
    { id: 5, image: 'assets/images/products/hat-dieu.png',  name: 'Hat Dieu Rang Muoi',                 cat: 'Hat dinh duong', weight: '300g / Hu nhua',      price: 155000,                  stars: '★★★★★', reviews: 97                               },
    { id: 6, image: 'assets/images/products/combo1.png',    name: 'Combo Eat Clean Cho Nguoi Tap Gym',  cat: 'Combo',          weight: '3 san pham',          price: 390000, oldPrice: 450000, stars: '★★★★★', reviews: 312, sale: '-13%'              },
    { id: 7, image: 'assets/images/products/xoai-say.png',  name: 'Xoai Say Deo Khong Duong',           cat: 'Trai cay say',   weight: '200g / Tui zip',      price: 75000,                   stars: '★★★★☆', reviews: 144, badge: 'new'              },
    { id: 8, image: 'assets/images/products/granola2.png',  name: 'Granola Socola Den Dua',             cat: 'Granola',        weight: '300g / Hu thuy tinh', price: 138000,                  stars: '★★★★☆', reviews: 61                               },
    { id: 9, image: 'assets/images/products/hanh-nhan.png', name: 'Hanh Nhan Nguyen Vo California',     cat: 'Hat dinh duong', weight: '500g / Tui zip',      price: 210000, oldPrice: 250000, stars: '★★★★★', reviews: 178, sale: '-16%'              },
  ];

  displayedProducts: ProductItem[] = [];
  totalProducts = 0;
  totalPages = 1;
  pageNumbers: (number | string)[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void { this.applyFiltersAndSort(); }

  get filteredProducts(): ProductItem[] {
    let result = [...this.allProducts];
    if (this.selectedFilters.length > 0) {
      result = result.filter(p =>
        this.selectedFilters.some(f => p.cat.toLowerCase().includes(f.toLowerCase()))
      );
    }
    result = result.filter(p => p.price >= this.priceRange[0] && p.price <= this.priceRange[1]);
    switch (this.sortBy) {
      case 'price-asc':  result.sort((a, b) => a.price - b.price); break;
      case 'price-desc': result.sort((a, b) => b.price - a.price); break;
      case 'newest':     result.sort((a, b) => b.id - a.id);       break;
      case 'rating':     result.sort((a, b) => b.reviews - a.reviews); break;
    }
    return result;
  }

  applyFiltersAndSort(): void {
    const filtered = this.filteredProducts;
    this.totalProducts = filtered.length;
    this.totalPages = Math.ceil(this.totalProducts / this.pageSize);
    const start = (this.currentPage - 1) * this.pageSize;
    this.displayedProducts = filtered.slice(start, start + this.pageSize);
    this.buildPageNumbers();
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
    this.applyFiltersAndSort();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSortChange(): void { this.currentPage = 1; this.applyFiltersAndSort(); }

  onFiltersChanged(filters: string[]): void {
    this.selectedFilters = filters;
    this.currentPage = 1;
    this.rebuildFilterTags();
    this.applyFiltersAndSort();
  }

  onPriceChanged(range: [number, number]): void {
    this.priceRange = range;
    this.currentPage = 1;
    this.applyFiltersAndSort();
  }

  onResetFilters(): void {
    this.selectedFilters = [];
    this.priceRange = [0, 1000000];
    this.activeFilterTags = [];
    this.currentPage = 1;
    this.applyFiltersAndSort();
  }

  clearAllFilters(): void { this.onResetFilters(); }

  removeFilter(key: string): void {
    this.selectedFilters = this.selectedFilters.filter(f => f !== key);
    this.rebuildFilterTags();
    this.applyFiltersAndSort();
  }

  rebuildFilterTags(): void {
    this.activeFilterTags = this.selectedFilters.map(f => ({ key: f, label: f }));
  }

  isWishlisted(id: number): boolean { return this.wishlist.includes(id); }

  toggleWishlist(event: Event, id: number): void {
    event.stopPropagation();
    this.wishlist = this.wishlist.includes(id)
      ? this.wishlist.filter(x => x !== id)
      : [...this.wishlist, id];
  }

  addToCart(event: Event, id: number): void {
    event.stopPropagation();
    console.log('Add to cart:', id);
  }

  goToDetail(id: number): void { this.router.navigate(['/product-detail-page', id]); }
}