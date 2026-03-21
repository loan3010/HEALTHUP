import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService, STATIC_BASE } from '../services/api.service';

export interface PolicyItem {
  icon: string;
  title: string;
  desc: string;
}

export interface ConsultingQuestion {
  _id?: string;
  user: string;
  content: string;
  status: 'pending' | 'answered';
  answer?: string;
  answerTime?: string;
  time: string;
  helpfulCount?: number;
  unhelpfulCount?: number;
  voted?: boolean;
}

export interface ConsultingStats {
  total: number;
  pending: number;
  answered: number;
}

@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CurrencyPipe],
  templateUrl: './product-detail-page.html',
  styleUrls: ['./product-detail-page.css']
})
export class ProductDetailPageComponent implements OnInit, OnDestroy {

  product: any = null;
  relatedProducts: any[] = [];

  activeImage = '';
  selectedWeight = '';
  selectedType = '';
  selectedVariantId = '';
  /** Hai chiều phân loại (đồng bộ với admin: attr1 + attr2). */
  selectedAttr1 = '';
  selectedAttr2 = '';

  activeTab: 'desc' | 'nutrition' | 'policy' = 'desc';

  qty = 1;

  addedToCart = false;
  addToCartError = '';
  isLoading = true;

  private wishlistSub!: Subscription;
  get isWishlisted(): boolean {
    return this.product?._id ? this.api.isWishlisted(this.product._id) : false;
  }

  policyItems: PolicyItem[] = [
    { icon: 'bi-arrow-repeat', title: 'Đổi trả trong 7 ngày',   desc: 'Áp dụng khi sản phẩm lỗi hoặc không đúng đơn hàng.' },
    { icon: 'bi-truck',        title: 'Giao hàng toàn quốc',    desc: 'Từ 2-5 ngày làm việc.' },
    { icon: 'bi-credit-card',  title: 'Thanh toán an toàn',     desc: 'Hỗ trợ COD, VNPay, Momo.' },
    { icon: 'bi-patch-check',  title: 'Chất lượng kiểm định',   desc: 'Sản phẩm đạt chứng nhận VSATTP.' }
  ];

  // --- LOGIC TƯ VẤN (CONSULTING) ---
  get isLoggedIn(): boolean {
    return !!localStorage.getItem('token'); // Kiểm tra trạng thái đăng nhập thật
  }
  askText = '';
  isAskSubmitting = false;
  askSubmitSuccess = false;

  consultingQuestions: ConsultingQuestion[] = [];
  filteredConsultingQuestions: ConsultingQuestion[] = [];
  consultingFilter: 'all' | 'answered' | 'pending' = 'all';
  isConsultingLoading = false;
  hasMoreQuestions = false;
  consultingPage = 1;

  consultingStats: ConsultingStats = { total: 0, pending: 0, answered: 0 };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    public api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.wishlistSub = this.api.wishlist$.subscribe(() => {
      this.cdr.detectChanges();
    });

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        // Cuộn về đầu trang mỗi khi load sản phẩm mới
        window.scrollTo({ top: 0, behavior: 'instant' });

        this.product = null;
        this.relatedProducts = [];
        this.isLoading = true;
        this.qty = 1;
        this.askSubmitSuccess = false;
        this.consultingQuestions = [];
        this.consultingPage = 1;
        this.cdr.detectChanges();
        
        this.loadProduct(id);
        this.loadRelated(id);
        this.loadConsultingQuestions(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.wishlistSub?.unsubscribe();
  }

  loadProduct(id: string): void {
    this.api.getProductById(id).subscribe({
      next: (data: any) => {
        this.product     = data;
        this.activeImage = data.images?.[0] || '';
        this.selectedWeight = data.weights?.[0]?.label || '';
        this.selectedType   = this.visiblePackagingTypes(data)?.[0] || '';

        // Ưu tiên chọn variant còn hàng (main)
        const firstInStock = (data.variants || []).find((v: any) => Number(v.stock || 0) > 0);
        const v0 = firstInStock || data.variants?.[0];
        if (v0) {
          this.selectVariant(v0);
        } else {
          this.selectedVariantId = '';
          this.selectedAttr1 = '';
          this.selectedAttr2 = '';
        }

        this.isLoading = false;
        this.qty = 1;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Lỗi tải sản phẩm:', err);
        this.isLoading = false;
        if (err.status === 404) {
          this.router.navigate(['/product-listing-page']);
        }
        this.cdr.detectChanges();
      }
    });
  }

  loadRelated(id: string): void {
    this.api.getRelatedProducts(id).subscribe({
      next: (data: any[]) => {
        this.relatedProducts = data;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Lỗi tải SP liên quan:', err);
      }
    });
  }

  // --- HÀM XỬ LÝ TƯ VẤN (CONSULTING) DỮ LIỆU THẬT ---

  loadConsultingQuestions(productId?: string, append = false): void {
    const id = productId || this.product?._id;
    if (!id) return;

    this.isConsultingLoading = true;
    this.cdr.detectChanges();

    this.api.getConsultingQuestions(id, {
      filter: this.consultingFilter,
      page:   this.consultingPage,
      limit:  5,
    }).subscribe({
      next: (res) => {
        // Map lại dữ liệu từ Backend để hiển thị thời gian thân thiện nếu cần
        const questions: ConsultingQuestion[] = (res.questions || []).map((q: any) => ({
          ...q,
          time: q.createdAt ? new Date(q.createdAt).toLocaleDateString('vi-VN') : 'Vừa xong',
          answerTime: q.answerAt ? new Date(q.answerAt).toLocaleDateString('vi-VN') : '',
          helpfulCount: q.helpfulCount || 0,
          unhelpfulCount: q.unhelpfulCount || 0,
          voted: false
        }));

        if (!append) {
          this.consultingQuestions = questions;
        } else {
          this.consultingQuestions = [...this.consultingQuestions, ...questions];
        }

        this.consultingStats = {
          total:    res.stats?.total    || 0,
          pending:  res.stats?.pending  || 0,
          answered: res.stats?.answered || 0,
        };

        this.applyConsultingFilter();
        this.hasMoreQuestions    = questions.length === 5;
        this.isConsultingLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải câu hỏi tư vấn:', err);
        this.isConsultingLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyConsultingFilter(): void {
    if (this.consultingFilter === 'all') {
      this.filteredConsultingQuestions = this.consultingQuestions;
    } else {
      this.filteredConsultingQuestions = this.consultingQuestions.filter(
        q => q.status === this.consultingFilter
      );
    }
  }

  setConsultingFilter(filter: 'all' | 'answered' | 'pending'): void {
    this.consultingFilter    = filter;
    this.consultingPage      = 1;
    this.consultingQuestions = [];
    this.loadConsultingQuestions();
  }

  loadMoreQuestions(): void {
    this.consultingPage++;
    this.loadConsultingQuestions(undefined, true);
  }

  submitQuestion(): void {
    if (this.askText.trim().length < 10 || !this.product?._id) return;
    this.isAskSubmitting = true;

    // Lấy tên người dùng từ localStorage
    let userName = 'Khách hàng';
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      userName = user.name || user.username || 'Khách hàng';
    } catch (e) {}

    this.api.submitConsultingQuestion({
      productId: this.product._id,
      content:   this.askText.trim(),
      user: userName
    }).subscribe({
      next: () => {
        this.askText          = '';
        this.isAskSubmitting  = false;
        this.askSubmitSuccess = true;
        this.consultingPage      = 1;
        this.consultingQuestions = [];
        this.loadConsultingQuestions(); // Tải lại để hiện câu hỏi mới gửi
        this.api.showToast('Câu hỏi của bạn đã được gửi! Chúng tôi sẽ phản hồi sớm nhất.', 'success');
        
        setTimeout(() => {
          this.askSubmitSuccess = false;
          this.cdr.detectChanges();
        }, 5000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi gửi câu hỏi:', err);
        this.isAskSubmitting = false;
        this.api.showToast('Không thể gửi câu hỏi. Vui lòng thử lại.', 'error');
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Khách hàng đánh giá câu trả lời (Like / Dislike) - Bản fix cứng lỗi không nhảy số
   */
  voteQuestion(q: any, type: 'up' | 'down'): void {
    if (q.voted || !q._id) return; 

    this.api.voteConsultingQuestion(q._id, type).subscribe({
      next: (res: any) => {
        // 1. Cập nhật dữ liệu vào mảng filtered (mảng đang hiển thị trên HTML)
        this.filteredConsultingQuestions = this.filteredConsultingQuestions.map(item => {
          if (item._id === q._id) {
            return {
              ...item,
              helpfulCount: res.helpfulCount,
              unhelpfulCount: res.unhelpfulCount,
              voted: true // Đánh dấu đã vote để disable nút
            };
          }
          return item;
        });

        // 2. Đồng bộ luôn qua mảng gốc để khi lọc không bị mất số
        this.consultingQuestions = this.consultingQuestions.map(item => {
          if (item._id === q._id) {
            return {
              ...item,
              helpfulCount: res.helpfulCount,
              unhelpfulCount: res.unhelpfulCount,
              voted: true
            };
          }
          return item;
        });

        this.api.showToast('Cảm ơn bạn đã gửi đánh giá!', 'success');
        
        // 3. Ép Angular render lại ngay lập tức
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Lỗi khi đánh giá:', err);
        this.api.showToast('Không thể gửi đánh giá lúc này.', 'error');
      }
    });
  }

  // --- CÁC HÀM TIỆN ÍCH KHÁC ---

  getStars(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  selectWeight(label: string): void {
    this.selectedWeight = label;
    if (this.product?.weightPrices?.length) {
      const wp = this.product.weightPrices.find((w: any) => w.label === label);
      if (wp) {
        this.product.price    = wp.price;
        this.product.oldPrice = wp.oldPrice;
      }
    }
  }

  selectVariant(v: any): void {
    this.selectedVariantId = v?._id || '';
    const p = this.parseVariantParts(v);
    this.selectedAttr1 = p.a1;
    this.selectedAttr2 = p.a2;
    
    const variantImage = v?.image || v?.imageUrl || '';
    if (variantImage) {
      this.activeImage = String(variantImage).startsWith('http')
        ? variantImage
        : `${STATIC_BASE}${variantImage}`;
    }
    if (this.qty > this.currentStock()) this.qty = Math.max(1, this.currentStock());
  }

  decreaseQty(): void {
    if (this.qty > 1) this.qty--;
  }

  increaseQty(): void {
    const stock = this.currentStock();
    if (stock > 0 && this.qty < stock) this.qty++;
  }

  currentVariant(): any | null {
    if (!this.product?.variants?.length) return null;
    return this.product.variants.find(
      (v: any) => String(v._id) === String(this.selectedVariantId)
    ) || null;
  }

  parseVariantParts(v: any): { a1: string; a2: string } {
    const a1 = String(v?.attr1Value ?? '').trim();
    const a2 = String(v?.attr2Value ?? '').trim();
    if (a1 && a2) return { a1, a2 };
    const label = String(v?.label || '').trim();
    const parts = label.split('|').map((x: string) => x.trim()).filter(Boolean);
    if (parts.length >= 2) return { a1: parts[0], a2: parts[1] };
    return { a1: parts[0] || label, a2: '' };
  }

  hasSecondAttrDimension(): boolean {
    return (this.product?.variants || []).some((v: any) => !!this.parseVariantParts(v).a2);
  }

  variantLabel1(): string {
    return String(this.product?.variantAttr1Name || 'Phân loại 1').trim() || 'Phân loại 1';
  }

  variantLabel2(): string {
    return String(this.product?.variantAttr2Name || 'Phân loại 2').trim() || 'Phân loại 2';
  }

  variantAttr1Options(): string[] {
    const set = new Set<string>();
    (this.product?.variants || []).forEach((v: any) => {
      const p = this.parseVariantParts(v);
      if (p.a1) set.add(p.a1);
    });
    return Array.from(set);
  }

  variantAttr2OptionsForSelection(): string[] {
    const set = new Set<string>();
    const a1 = String(this.selectedAttr1 || '').trim();
    (this.product?.variants || []).forEach((v: any) => {
      const p = this.parseVariantParts(v);
      if (p.a1 === a1 && p.a2) set.add(p.a2);
    });
    return Array.from(set);
  }

  onSelectVariantAttr1(value: string): void {
    this.selectedAttr1 = value;
    const opts = this.variantAttr2OptionsForSelection();
    if (!opts.includes(this.selectedAttr2)) {
      this.selectedAttr2 = opts[0] || '';
    }
    this.syncVariantFromAttrs();
  }

  onSelectVariantAttr2(value: string): void {
    this.selectedAttr2 = value;
    this.syncVariantFromAttrs();
  }

  variantStockForAttrs(a1: string, a2: string): number {
    const match = (this.product?.variants || []).find((v: any) => {
      const p = this.parseVariantParts(v);
      return p.a1 === a1 && p.a2 === a2;
    });
    return Number(match?.stock ?? 0);
  }

  syncVariantFromAttrs(): void {
    const list = this.product?.variants || [];
    if (!list.length) return;
    const two = this.hasSecondAttrDimension();
    const match = list.find((v: any) => {
      const p = this.parseVariantParts(v);
      if (two) {
        return p.a1 === this.selectedAttr1 && p.a2 === this.selectedAttr2;
      }
      return p.a1 === this.selectedAttr1;
    });
    if (match) {
      this.selectVariant(match);
    }
  }

  currentPrice(): number {
    const v = this.currentVariant();
    return Number(v?.price ?? this.product?.price ?? 0);
  }

  currentOldPrice(): number {
    const v = this.currentVariant();
    return Number(v?.oldPrice ?? this.product?.oldPrice ?? 0);
  }

  currentStock(): number {
    const v = this.currentVariant();
    if (this.product?.variants?.length) {
      return Number(v?.stock ?? 0);
    }
    return Number(this.product?.stock ?? 0);
  }

  isCurrentVariantOutOfStock(): boolean {
    if (!this.product) return true;
    if (this.product.isOutOfStock) return true;
    return this.currentStock() <= 0;
  }

  visiblePackagingTypes(productLike?: any): string[] {
    const p = productLike || this.product;
    const pack = Array.isArray(p?.packagingTypes) ? p.packagingTypes : [];
    const variantLabels = Array.isArray(p?.variants)
      ? p.variants.map((v: any) => String(v.label || '').trim())
      : [];
    if (!pack.length) return [];
    if (!variantLabels.length) return pack;
    const variantsSet = new Set(variantLabels.map((x: string) => x.toLowerCase()));
    return pack.filter((x: string) => !variantsSet.has(String(x || '').trim().toLowerCase()));
  }

  isProductCompletelyOutOfStock(): boolean {
    if (!this.product) return true;
    if (Array.isArray(this.product.variants) && this.product.variants.length > 0) {
      const total = this.product.variants.reduce(
        (sum: number, v: any) => sum + Number(v?.stock || 0), 0
      );
      return total <= 0;
    }
    return Number(this.product.stock || 0) <= 0;
  }

  addToCart(): void {
    if (this.addedToCart || !this.product?._id) return;
    if (this.isCurrentVariantOutOfStock()) {
      this.api.showToast('Sản phẩm này đã hết hàng, vui lòng chọn phân loại khác.', 'error');
      return;
    }
    this.addToCartError = '';

    const v = this.currentVariant();
    this.api.addToCart(
      this.product._id,
      this.qty,
      this.product.name,
      v?._id || null,
      v?.label || ''
    ).subscribe({
      next: () => {
        this.addedToCart = true;
        setTimeout(() => {
          this.addedToCart = false;
          this.cdr.detectChanges();
        }, 2500);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Lỗi thêm vào giỏ hàng:', err);
        this.addToCartError = err?.error?.message || 'Không thể thêm vào giỏ hàng. Vui lòng thử lại.';
        this.api.showToast(this.addToCartError, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  buyNow(): void {
    if (!this.product?._id) return;
    if (this.isCurrentVariantOutOfStock()) {
      this.api.showToast('Sản phẩm này đã hết hàng, vui lòng chọn phân loại khác.', 'error');
      return;
    }

    const v = this.currentVariant();
    const checkoutItem = [{
      productId:    this.product._id,
      variantId:    v?._id || null,
      variantLabel: v?.label || '',
      name:          this.product.name,
      price:        this.currentPrice(),
      quantity:     this.qty,
      imageUrl:     this.product.images?.[0] || this.product.image || null,
      weight:       this.selectedWeight,
      type:         this.selectedType,
    }];

    try {
      localStorage.setItem('checkout_v1', JSON.stringify(checkoutItem));
    } catch (e) {
      console.error('Lỗi lưu checkout:', e);
      return;
    }
    this.router.navigate(['/checkout']);
  }

  toggleWishlist(): void {
    if (this.product?._id) {
      this.api.toggleWishlist(this.product._id, this.product.name);
    }
  }

  share(): void {
    if (navigator.share) {
      navigator.share({ title: this.product?.name, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      this.api.showToast('Đã sao chép link sản phẩm!', 'info');
    }
  }

  addRelated(event: Event, product: any): void {
    event.stopPropagation();
    if (!product?._id) return;
    if ((product.stock === 0 || product.isOutOfStock) && !product.variants?.length) {
      this.api.showToast('Sản phẩm này đã hết hàng.', 'error');
      return;
    }
    this.api.addToCart(product._id, 1, product.name).subscribe({
      next: () => {
        // Success toast đã được handle trong Service
      },
      error: (err) => {
        console.error('Lỗi thêm SP liên quan:', err);
        this.api.showToast('Không thể thêm vào giỏ hàng.', 'error');
      }
    });
  }

  goToProduct(id: string): void {
    if (!id) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    this.router.navigate(['/product-detail-page', id]);
  }

  getAvatarInitial(name: string): string {
    return name?.charAt(0)?.toUpperCase() || 'K';
  }

  getAvatarColor(index: number): string {
    const colors = ['#36873A', '#3A6FD4', '#D4A017', '#2A6B2E', '#8B5CF6'];
    return colors[index % colors.length];
  }
}