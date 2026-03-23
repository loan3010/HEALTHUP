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

// Cấu hình Interface phù hợp với dữ liệu từ Database
export interface BannerSlide {
  _id?: string;
  imageUrl: string;
  title: string;
  linkUrl: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  order?: number;
}

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPipe],
  templateUrl: './homepage.html',
  styleUrls: ['./homepage.css']
})
export class HomepageComponent implements OnInit, OnDestroy {

  // ── State chung ──────────────────────────────────────────────────────────
  activeCategory = 0;
  featuredProducts: any[] = [];
  isLoading = true;
  isBlogLoading = true;
  blogPosts: BlogPost[] = [];

  wishlist: string[] = [];
  private wishlistSub!: Subscription;

  readonly STATIC_BASE         = STATIC_BASE;
  readonly PLACEHOLDER_PRODUCT = `${STATIC_BASE}/images/products/placeholder.png`;
  readonly PLACEHOLDER_BLOG    = `${STATIC_BASE}/images/blogs/placeholder.png`;

  // ── BANNER SLIDER (Dữ liệu thực tế từ API) ────────────────────────────────
  banners: BannerSlide[] = [];
  currentBanner   = 0;
  isTransitioning = false;
  private bannerTimer: any;
  readonly BANNER_INTERVAL    = 5000;
  readonly TRANSITION_LOCK_MS = 700;

  constructor(
    private router: Router,
    public  api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadBanners();
    this.loadFeaturedProducts();
    this.loadBlogs();

    this.wishlistSub = this.api.wishlist$.subscribe(list => {
      this.wishlist = list;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.wishlistSub?.unsubscribe();
    this.stopTimer();
  }

  /**
   * Truy xuất danh sách banner và lọc theo thời hạn hiển thị
   */
  private loadBanners(): void {
    this.api.getBanners().subscribe({
      next: (res) => {
        const hiện_tại = new Date();
        
        // Lọc banner dựa trên thời gian bắt đầu và kết thúc
        this.banners = res.filter(b => {
          const ngày_bắt_đầu = b.startDate ? new Date(b.startDate) : null;
          const ngày_kết_thúc = b.endDate ? new Date(b.endDate) : null;

          if (ngày_bắt_đầu && hiện_tại < ngày_bắt_đầu) return false;
          if (ngày_kết_thúc && hiện_tại > ngày_kết_thúc) return false;
          return true;
        });

        // Chỉ bắt đầu bộ đếm thời gian nếu có từ 2 banner trở lên
        if (this.banners.length > 1) {
          this.startTimer();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi khi tải dữ liệu banner từ hệ thống:', err);
      }
    });
  }

  /**
   * Xử lý URL hình ảnh banner
   */
  getBannerImageUrl(url: string): string {
    if (!url) return this.PLACEHOLDER_PRODUCT;
    return url.startsWith('http') ? url : `${STATIC_BASE}${url}`;
  }

  /**
   * Xử lý sự kiện khi nhấn vào banner để điều hướng
   */
  onBannerClick(url: string | undefined): void {
    if (!url || url.trim() === '') {
      // Mặc định điều hướng về trang danh mục nếu không có URL cụ thể
      this.router.navigate(['/product-listing-page']);
      return;
    }

    if (url.startsWith('http')) {
      // Mở liên kết bên ngoài trong tab mới
      window.open(url, '_blank');
    } else {
      // Điều hướng nội bộ trong ứng dụng Angular
      this.router.navigateByUrl(url);
    }
  }

  private goToSlide(index: number): void {
    if (this.isTransitioning || this.banners.length === 0) return;
    this.isTransitioning = true;
    this.currentBanner   = (index + this.banners.length) % this.banners.length;
    this.cdr.detectChanges();
    setTimeout(() => { this.isTransitioning = false; }, this.TRANSITION_LOCK_MS);
  }

  prevBanner(): void { this.goToSlide(this.currentBanner - 1); this.resetTimer(); }
  nextBanner(): void { this.goToSlide(this.currentBanner + 1); this.resetTimer(); }
  goToBanner(i: number): void { this.goToSlide(i); this.resetTimer(); }

  startTimer(): void {
    this.stopTimer();
    this.bannerTimer = setInterval(() => {
      this.goToSlide(this.currentBanner + 1);
    }, this.BANNER_INTERVAL);
  }

  stopTimer(): void {
    if (this.bannerTimer) {
      clearInterval(this.bannerTimer);
    }
  }

  resetTimer(): void {
    this.stopTimer();
    if (this.banners.length > 1) {
      this.startTimer();
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  trustItems: TrustItem[] = [
    { icon: 'bi-patch-check',  title: 'Nguồn gốc rõ ràng', sub: 'Truy xuất tận nơi sản xuất' },
    { icon: 'bi-star-fill',    title: '4.9/5 đánh giá',     sub: 'Từ 10.000+ khách hàng'      },
    { icon: 'bi-arrow-repeat', title: 'Đổi trả 7 ngày',     sub: 'Không cần lý do'            },
    { icon: 'bi-shield-check', title: 'Thanh toán bảo mật', sub: 'VNPay · Momo · COD'        },
  ];

  categories: Category[] = [
    { name: 'Hạt dinh dưỡng', count: 'Xem tất cả', color: '#EAF2E3', image: `${STATIC_BASE}/images/products/black-bag-chia-500g.png`          },
    { name: 'Granola',         count: 'Xem tất cả', color: '#FFF8EE', image: `${STATIC_BASE}/images/products/granola-500g-mix-flavors.png`    },
    { name: 'Trái cây sấy',   count: 'Xem tất cả', color: '#F5EEFF', image: `${STATIC_BASE}/images/products/chuoi-say-lanh.jpg`               },
    { name: 'Đồ ăn vặt',      count: 'Xem tất cả', color: '#FFF0E8', image: `${STATIC_BASE}/images/products/cheese-biscuit-baked-218g.png`   },
    { name: 'Trà thảo mộc',   count: 'Xem tất cả', color: '#E8F5FF', image: `${STATIC_BASE}/images/products/seaweed-flakes-dried-korea.png`  },
    { name: 'Combo',           count: 'Xem tất cả', color: '#FFF5E8', image: `${STATIC_BASE}/images/products/granola-matcha-combo-2x500g.png` },
  ];

  private loadFeaturedProducts(): void {
    this.api.getProducts({ sort: 'popular', limit: 8 }).subscribe({
      next:  (res) => { this.featuredProducts = res.products || []; this.isLoading = false; this.cdr.detectChanges(); },
      error: ()    => { this.isLoading = false; this.cdr.detectChanges(); },
    });
  }

  private loadBlogs(): void {
    this.api.getBlogs(3).subscribe({
      next:  (data) => { this.blogPosts = data; this.isBlogLoading = false; this.cdr.detectChanges(); },
      error: ()     => { this.isBlogLoading = false; this.cdr.detectChanges(); },
    });
  }

  getBlogImageUrl(coverImage: string): string {
    if (!coverImage) return this.PLACEHOLDER_BLOG;
    return coverImage.startsWith('http') ? coverImage : `${STATIC_BASE}${coverImage}`;
  }

  getStars(rating: number): string {
    const n = Math.min(5, Math.max(0, Math.round(rating)));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  isWishlisted(id: string): boolean { return this.wishlist.includes(id); }

  onCategoryClick(index: number, catName: string): void {
    this.activeCategory = index;
    this.router.navigate(['/product-listing-page'], { queryParams: { cat: catName } });
  }

  toggleWishlist(event: Event, id: string, productName?: string): void {
    event.stopPropagation();
    this.api.toggleWishlist(id, productName);
  }

  isOutOfStock(product: any): boolean {
    if (!product) return true;
    if (product.isOutOfStock) return true;

    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const totalStock = product.variants.reduce(
        (sum: number, v: any) => sum + Number(v?.stock || 0), 0
      );
      return totalStock <= 0;
    }
    return Number(product.stock || 0) <= 0;
  }

  addToCart(event: Event, product: any): void {
    event.stopPropagation();
    if (!product?._id) return;

    if (this.isOutOfStock(product)) {
      this.api.showToast('Sản phẩm hiện đã hết hàng.', 'error');
      return;
    }

    this.api.addToCart(product._id, 1, product.name).subscribe({
      error: () => this.api.showToast('Không thể thêm sản phẩm vào giỏ hàng.', 'error'),
    });
  }

  goToDetail(id: string):     void { if (id) this.router.navigate(['/product-detail-page', id]); }
  goToBlogDetail(id: string): void { if (id) this.router.navigate(['/blog', id]); }
  goToAllBlogs():             void { this.router.navigate(['/blog']); }
}