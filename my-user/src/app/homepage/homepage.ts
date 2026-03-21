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

export interface BannerSlide {
  image: string;
  title: string;
  subtitle: string;
  btnLabel: string;
  btnLink: string;
  btnQueryParams?: Record<string, string>;
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

  // ── BANNER SLIDER ─────────────────────────────────────────────────────────
  currentBanner   = 0;
  isTransitioning = false;
  private bannerTimer: any;
  readonly BANNER_INTERVAL    = 5000;
  readonly TRANSITION_LOCK_MS = 700;

  banners: BannerSlide[] = [
    {
      image:    `${STATIC_BASE}/images/banners/banner01.jpg`,
      title:    'Thực phẩm tươi sạch',
      subtitle: 'Nguyên liệu tự nhiên, không chất bảo quản — đồng hành cùng sức khoẻ mỗi ngày.',
      btnLabel: 'Khám phá ngay',
      btnLink:  '/product-listing-page',
    },
    {
      image:    `${STATIC_BASE}/images/banners/banner02.jpg`,
      title:    'Dinh dưỡng cân bằng',
      subtitle: 'Granola & Hạt dinh dưỡng cao cấp cho lối sống năng động.',
      btnLabel: 'Xem Granola',
      btnLink:  '/product-listing-page',
      btnQueryParams: { cat: 'Granola' },
    },
    {
      image:    `${STATIC_BASE}/images/banners/banner03.jpg`,
      title:    'Sống khoẻ mỗi ngày',
      subtitle: 'Hơn 100 sản phẩm healthy được kiểm định chất lượng, giao nhanh toàn quốc.',
      btnLabel: 'Mua ngay',
      btnLink:  '/product-listing-page',
    },
    {
      image:    `${STATIC_BASE}/images/banners/banner04.jpg`,
      title:    'Combo tiết kiệm',
      subtitle: 'Bộ đôi Granola + Hạt dinh dưỡng — giảm đến 25%.',
      btnLabel: 'Xem combo',
      btnLink:  '/product-listing-page',
      btnQueryParams: { cat: 'Combo' },
    },
  ];

  private goToSlide(index: number): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.currentBanner   = (index + this.banners.length) % this.banners.length;
    this.cdr.detectChanges();
    setTimeout(() => { this.isTransitioning = false; }, this.TRANSITION_LOCK_MS);
  }

  prevBanner(): void { this.goToSlide(this.currentBanner - 1); this.resetTimer(); }
  nextBanner(): void { this.goToSlide(this.currentBanner + 1); this.resetTimer(); }
  goToBanner(i: number): void { this.goToSlide(i); this.resetTimer(); }

  startTimer(): void {
    this.bannerTimer = setInterval(() => {
      this.goToSlide(this.currentBanner + 1);
    }, this.BANNER_INTERVAL);
  }
  resetTimer(): void {
    clearInterval(this.bannerTimer);
    this.startTimer();
  }
  // ──────────────────────────────────────────────────────────────────────────

  trustItems: TrustItem[] = [
    { icon: 'bi-patch-check',  title: 'Nguồn gốc rõ ràng', sub: 'Truy xuất tận nơi sản xuất' },
    { icon: 'bi-star-fill',    title: '4.9/5 đánh giá',     sub: 'Từ 10.000+ khách hàng'      },
    { icon: 'bi-arrow-repeat', title: 'Đổi trả 7 ngày',     sub: 'Không cần lý do'            },
    { icon: 'bi-shield-check', title: 'Thanh toán bảo mật', sub: 'VNPay · Momo · COD'        },
  ];

  categories: Category[] = [
    { name: 'Hạt dinh dưỡng', count: 'Xem tất cả', color: '#EAF2E3', image: `${STATIC_BASE}/images/products/black-bag-chia-500g.png`         },
    { name: 'Granola',         count: 'Xem tất cả', color: '#FFF8EE', image: `${STATIC_BASE}/images/products/granola-500g-mix-flavors.png`    },
    { name: 'Trái cây sấy',   count: 'Xem tất cả', color: '#F5EEFF', image: `${STATIC_BASE}/images/products/chuoi-say-lanh.jpg`               },
    { name: 'Đồ ăn vặt',      count: 'Xem tất cả', color: '#FFF0E8', image: `${STATIC_BASE}/images/products/cheese-biscuit-baked-218g.png`   },
    { name: 'Trà thảo mộc',   count: 'Xem tất cả', color: '#E8F5FF', image: `${STATIC_BASE}/images/products/seaweed-flakes-dried-korea.png`  },
    { name: 'Combo',           count: 'Xem tất cả', color: '#FFF5E8', image: `${STATIC_BASE}/images/products/granola-matcha-combo-2x500g.png` },
  ];

  constructor(
    private router: Router,
    public  api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFeaturedProducts();
    this.loadBlogs();
    this.startTimer();

    this.wishlistSub = this.api.wishlist$.subscribe(list => {
      this.wishlist = list;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.wishlistSub?.unsubscribe();
    clearInterval(this.bannerTimer);
  }

  private loadFeaturedProducts(): void {
    this.api.getFeaturedProducts().subscribe({
      next:  (data) => { this.featuredProducts = data; this.isLoading = false; this.cdr.detectChanges(); },
      error: ()     => { this.isLoading = false; this.cdr.detectChanges(); },
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

  // FIX: Kiểm tra hết hàng trước khi thêm vào giỏ
  isOutOfStock(product: any): boolean {
    if (!product) return true;
    if (product.isOutOfStock) return true;

    // Có variants → kiểm tra tổng stock của tất cả variants
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const totalStock = product.variants.reduce(
        (sum: number, v: any) => sum + Number(v?.stock || 0), 0
      );
      return totalStock <= 0;
    }

    // Không có variants → kiểm tra stock tổng
    return Number(product.stock || 0) <= 0;
  }

  addToCart(event: Event, product: any): void {
    event.stopPropagation();
    if (!product?._id) return;

    // FIX: Chặn thêm vào giỏ nếu hết hàng
    if (this.isOutOfStock(product)) {
      this.api.showToast('Sản phẩm này đã hết hàng.', 'error');
      return;
    }

    this.api.addToCart(product._id, 1, product.name).subscribe({
      error: () => this.api.showToast('Không thể thêm vào giỏ hàng.', 'error'),
    });
  }

  goToDetail(id: string):     void { if (id) this.router.navigate(['/product-detail-page', id]); }
  goToBlogDetail(id: string): void { if (id) this.router.navigate(['/blog', id]); }
  goToAllBlogs():             void { this.router.navigate(['/blog']); }
}