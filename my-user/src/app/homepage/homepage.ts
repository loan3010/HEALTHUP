import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, STATIC_BASE } from '../services/api.service';

export interface Category {
  name: string;
  count: string;
  color: string;
  image: string;
}

export interface BlogPost {
  _id?: string;
  tag: string;
  title: string;
  excerpt: string;
  coverImage: string;
  author: string;
  date: string;
}

export interface TrustItem {
  icon: string;
  title: string;
  sub: string;
}

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPipe],
  templateUrl: './homepage.html',
  styleUrls: ['./homepage.css']
})
export class HomepageComponent implements OnInit, OnDestroy {

  activeCategory = 0;
  featuredProducts: any[] = [];
  isLoading = true;
  isBlogLoading = true;

  // ── Wishlist từ service stream ──────────────────────────────────────────────
  wishlist: string[] = [];
  private wishlistSub!: Subscription;

  readonly STATIC_BASE = STATIC_BASE;
  readonly PLACEHOLDER_PRODUCT = `${STATIC_BASE}/images/products/placeholder.png`;
  readonly PLACEHOLDER_BLOG    = `${STATIC_BASE}/images/blogs/placeholder.png`;

  trustItems: TrustItem[] = [
    { icon: 'bi-patch-check',  title: 'Nguồn gốc rõ ràng',  sub: 'Truy xuất tận nơi sản xuất' },
    { icon: 'bi-star-fill',    title: '4.9/5 đánh giá',      sub: 'Từ 10.000+ khách hàng'      },
    { icon: 'bi-arrow-repeat', title: 'Đổi trả 7 ngày',      sub: 'Không cần lý do'             },
    { icon: 'bi-shield-check', title: 'Thanh toán bảo mật',  sub: 'VNPay · Momo · COD'         },
  ];

  categories: Category[] = [
    { name: 'Hạt dinh dưỡng', count: 'Xem tất cả', color: '#EAF2E3', image: `${STATIC_BASE}/images/products/black-bag-chia-500g.png` },
    { name: 'Granola',         count: 'Xem tất cả', color: '#FFF8EE', image: `${STATIC_BASE}/images/products/granola-500g-mix-flavors.png` },
    { name: 'Trái cây sấy',   count: 'Xem tất cả', color: '#F5EEFF', image: `${STATIC_BASE}/images/products/chuoi-say-lanh.jpg` },
    { name: 'Đồ ăn vặt',      count: 'Xem tất cả', color: '#FFF0E8', image: `${STATIC_BASE}/images/products/cheese-biscuit-baked-218g.png` },
    { name: 'Trà thảo mộc',   count: 'Xem tất cả', color: '#E8F5FF', image: `${STATIC_BASE}/images/products/seaweed-flakes-dried-korea.png` },
    { name: 'Combo',           count: 'Xem tất cả', color: '#FFF5E8', image: `${STATIC_BASE}/images/products/granola-matcha-combo-2x500g.png` },
  ];

  blogPosts: BlogPost[] = [];

  constructor(
    private router: Router,
    public api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFeaturedProducts();
    this.loadBlogs();

    // Sync wishlist với service
    this.wishlistSub = this.api.wishlist$.subscribe(list => {
      this.wishlist = list;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.wishlistSub?.unsubscribe();
  }

  loadFeaturedProducts(): void {
    this.api.getFeaturedProducts().subscribe({
      next: (data) => {
        this.featuredProducts = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải sản phẩm nổi bật:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadBlogs(): void {
    this.api.getBlogs(3).subscribe({
      next: (data) => {
        this.blogPosts = data;
        this.isBlogLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải blog:', err);
        this.isBlogLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getBlogImageUrl(coverImage: string): string {
    if (!coverImage) return this.PLACEHOLDER_BLOG;
    return coverImage.startsWith('http') ? coverImage : `${STATIC_BASE}${coverImage}`;
  }

  getStars(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  onCategoryClick(index: number, catName: string): void {
    this.activeCategory = index;
    this.router.navigate(['/product-listing-page'], { queryParams: { cat: catName } });
  }

  isWishlisted(id: string): boolean {
    return this.wishlist.includes(id);
  }

  // ── Wishlist tập trung qua service ──────────────────────────────────────────
  toggleWishlist(event: Event, id: string, productName?: string): void {
    event.stopPropagation();
    this.api.toggleWishlist(id, productName);
  }

  // ── addToCart gọi API thực sự, hiện toast qua service ──────────────────────
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

  goToDetail(id: string): void {
    if (id) this.router.navigate(['/product-detail-page', id]);
  }

  goToBlogDetail(id: string): void {
    if (id) this.router.navigate(['/blog', id]);
  }

  goToAllBlogs(): void {
    this.router.navigate(['/blog']);
  }
}