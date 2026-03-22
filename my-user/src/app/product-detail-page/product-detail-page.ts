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
  helpful?: number;
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
  selectedAttr3 = '';
  selectedAttr4 = '';

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
    { icon: 'bi-arrow-repeat', title: 'Đổi trả trong 7 ngày',  desc: 'Áp dụng khi sản phẩm lỗi hoặc không đúng đơn hàng.' },
    { icon: 'bi-truck',        title: 'Giao hàng toàn quốc',   desc: 'Từ 2-5 ngày làm việc.' },
    { icon: 'bi-credit-card',  title: 'Thanh toán an toàn',    desc: 'Hỗ trợ COD, VNPay, Momo.' },
    { icon: 'bi-patch-check',  title: 'Chất lượng kiểm định',  desc: 'Sản phẩm đạt chứng nhận VSATTP.' }
  ];

  isLoggedIn = true;
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

        // Chỉ variant đang bán (isActive !== false); ẩn combo admin không hiện trên shop.
        const vis = (data.variants || []).filter((v: any) => v?.isActive !== false);
        const firstInStock = vis.find((v: any) => Number(v.stock || 0) > 0);
        const v0 = firstInStock || vis[0];
        if (v0) {
          this.selectVariant(v0);
        } else {
          this.selectedVariantId = '';
          this.selectedAttr1 = '';
          this.selectedAttr2 = '';
          this.selectedAttr3 = '';
          this.selectedAttr4 = '';
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
        const questions: ConsultingQuestion[] = res.questions || [];
        if (!append) {
          this.consultingQuestions = questions;
        } else {
          this.consultingQuestions = [...this.consultingQuestions, ...questions];
        }
        this.consultingStats = {
          total:    res.stats?.total    || res.total || 0,
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

    this.api.submitConsultingQuestion({
      productId: this.product._id,
      content:   this.askText.trim(),
    }).subscribe({
      next: () => {
        this.askText          = '';
        this.isAskSubmitting  = false;
        this.askSubmitSuccess = true;
        this.consultingPage      = 1;
        this.consultingQuestions = [];
        this.loadConsultingQuestions();
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

  /** Biến thể còn bán (bỏ dòng admin đánh dấu ẩn / combo không tồn tại). */
  visibleVariants(): any[] {
    return (this.product?.variants || []).filter((v: any) => v?.isActive !== false);
  }

  hasSellableVariants(): boolean {
    return this.visibleVariants().length > 0;
  }

  /**
   * Chọn variant theo object (từ TN).
   * Đồng bộ selectedVariantId, selectedAttr1, selectedAttr2 và ảnh biến thể nếu có.
   */
  selectVariant(v: any): void {
    this.selectedVariantId = v?._id || '';
    const p = this.parseVariantParts(v);
    this.selectedAttr1 = p.a1;
    this.selectedAttr2 = p.a2;
    this.selectedAttr3 = p.a3;
    this.selectedAttr4 = p.a4;
    // Hỗ trợ ảnh theo phân loại nếu backend trả về field image/imageUrl.
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
    const vis = this.visibleVariants();
    if (!vis.length) return null;
    return (
      vis.find((v: any) => String(v._id) === String(this.selectedVariantId)) || null
    );
  }

  /**
   * Đọc attr1–4 từ API; fallback tách label "A | B | C | D".
   */
  parseVariantParts(v: any): { a1: string; a2: string; a3: string; a4: string } {
    const a1 = String(v?.attr1Value ?? '').trim();
    const a2 = String(v?.attr2Value ?? '').trim();
    const a3 = String(v?.attr3Value ?? '').trim();
    const a4 = String(v?.attr4Value ?? '').trim();
    if (a1 || a2 || a3 || a4) {
      return { a1, a2, a3, a4 };
    }
    const label = String(v?.label || '').trim();
    const parts = label.split('|').map((x: string) => x.trim()).filter(Boolean);
    return {
      a1: parts[0] || '',
      a2: parts[1] || '',
      a3: parts[2] || '',
      a4: parts[3] || ''
    };
  }

  /** Có chiều thứ 4 (preset admin mới). */
  hasFourthAttrDimension(): boolean {
    return this.visibleVariants().some((v: any) => !!this.parseVariantParts(v).a4);
  }

  /** Có chiều thứ 3. */
  hasThirdAttrDimension(): boolean {
    return this.visibleVariants().some((v: any) => !!this.parseVariantParts(v).a3);
  }

  /** Có đủ 2 chiều. */
  hasSecondAttrDimension(): boolean {
    return this.visibleVariants().some((v: any) => !!this.parseVariantParts(v).a2);
  }

  variantLabel1(): string {
    return String(this.product?.variantAttr1Name || 'Phân loại 1').trim() || 'Phân loại 1';
  }

  variantLabel2(): string {
    return String(this.product?.variantAttr2Name || 'Trọng lượng').trim() || 'Trọng lượng';
  }

  variantLabel3(): string {
    return String(this.product?.variantAttr3Name || 'Phân loại 3').trim() || 'Phân loại 3';
  }

  variantLabel4(): string {
    return String(this.product?.variantAttr4Name || 'Phân loại 4').trim() || 'Phân loại 4';
  }

  /**
   * Dòng gợi ý nhỏ cho khách — theo admin (variantQuantityKind).
   * SP cũ không có field → chuỗi rỗng, không hiển thị.
   */
  variantQuantityKindHint(): string {
    const k = String(this.product?.variantQuantityKind || '').toLowerCase();
    if (k === 'mass') return 'Phân loại theo khối lượng (g, kg).';
    if (k === 'volume') return 'Phân loại theo thể tích (ml, l).';
    return '';
  }

  variantAttr1Options(): string[] {
    const set = new Set<string>();
    this.visibleVariants().forEach((v: any) => {
      const p = this.parseVariantParts(v);
      if (p.a1) set.add(p.a1);
    });
    return Array.from(set);
  }

  /** Giá trị chiều 2 khả dụng sau khi đã chọn chiều 1. */
  variantAttr2OptionsForSelection(): string[] {
    const set = new Set<string>();
    const a1 = String(this.selectedAttr1 || '').trim();
    this.visibleVariants().forEach((v: any) => {
      const p = this.parseVariantParts(v);
      if (p.a1 === a1 && p.a2) set.add(p.a2);
    });
    return Array.from(set);
  }

  /** Chiều 3 sau khi đã chọn chiều 1 + 2. */
  variantAttr3OptionsForSelection(): string[] {
    const set = new Set<string>();
    const a1 = String(this.selectedAttr1 || '').trim();
    const a2 = String(this.selectedAttr2 || '').trim();
    this.visibleVariants().forEach((v: any) => {
      const p = this.parseVariantParts(v);
      if (p.a1 === a1 && p.a2 === a2 && p.a3) set.add(p.a3);
    });
    return Array.from(set);
  }

  /** Chiều 4 sau khi đã chọn 1+2+3. */
  variantAttr4OptionsForSelection(): string[] {
    const set = new Set<string>();
    const a1 = String(this.selectedAttr1 || '').trim();
    const a2 = String(this.selectedAttr2 || '').trim();
    const a3 = String(this.selectedAttr3 || '').trim();
    this.visibleVariants().forEach((v: any) => {
      const p = this.parseVariantParts(v);
      if (p.a1 === a1 && p.a2 === a2 && p.a3 === a3 && p.a4) set.add(p.a4);
    });
    return Array.from(set);
  }

  onSelectVariantAttr1(value: string): void {
    this.selectedAttr1 = value;
    const opts2 = this.variantAttr2OptionsForSelection();
    if (!opts2.includes(this.selectedAttr2)) {
      this.selectedAttr2 = opts2[0] || '';
    }
    const opts3 = this.variantAttr3OptionsForSelection();
    if (!opts3.includes(this.selectedAttr3)) {
      this.selectedAttr3 = opts3[0] || '';
    }
    const opts4 = this.variantAttr4OptionsForSelection();
    if (!opts4.includes(this.selectedAttr4)) {
      this.selectedAttr4 = opts4[0] || '';
    }
    this.syncVariantFromAttrs();
  }

  onSelectVariantAttr2(value: string): void {
    this.selectedAttr2 = value;
    const opts3 = this.variantAttr3OptionsForSelection();
    if (!opts3.includes(this.selectedAttr3)) {
      this.selectedAttr3 = opts3[0] || '';
    }
    const opts4 = this.variantAttr4OptionsForSelection();
    if (!opts4.includes(this.selectedAttr4)) {
      this.selectedAttr4 = opts4[0] || '';
    }
    this.syncVariantFromAttrs();
  }

  onSelectVariantAttr3(value: string): void {
    this.selectedAttr3 = value;
    const opts4 = this.variantAttr4OptionsForSelection();
    if (!opts4.includes(this.selectedAttr4)) {
      this.selectedAttr4 = opts4[0] || '';
    }
    this.syncVariantFromAttrs();
  }

  onSelectVariantAttr4(value: string): void {
    this.selectedAttr4 = value;
    this.syncVariantFromAttrs();
  }

  /**
   * Max tồn theo các chiều đã cố định; tham số sau để trống = không lọc chiều đó.
   */
  variantStockForAttrs(a1: string, a2?: string, a3?: string, a4?: string): number {
    const list = this.visibleVariants();
    let best = 0;
    for (const v of list) {
      const p = this.parseVariantParts(v);
      if (p.a1 !== a1) continue;
      if (a2 !== undefined && a2 !== '' && p.a2 !== a2) continue;
      if (a3 !== undefined && a3 !== '' && p.a3 !== a3) continue;
      if (a4 !== undefined && a4 !== '' && p.a4 !== a4) continue;
      best = Math.max(best, Number(v?.stock || 0));
    }
    return best;
  }

  /** Ghép variant theo attr đã chọn (1–4 chiều). */
  syncVariantFromAttrs(): void {
    const list = this.visibleVariants();
    if (!list.length) return;
    const four = this.hasFourthAttrDimension();
    const three = this.hasThirdAttrDimension();
    const two = this.hasSecondAttrDimension();
    const match = list.find((v: any) => {
      const p = this.parseVariantParts(v);
      if (four) {
        return (
          p.a1 === this.selectedAttr1 &&
          p.a2 === this.selectedAttr2 &&
          p.a3 === this.selectedAttr3 &&
          p.a4 === this.selectedAttr4
        );
      }
      if (three) {
        return (
          p.a1 === this.selectedAttr1 &&
          p.a2 === this.selectedAttr2 &&
          p.a3 === this.selectedAttr3
        );
      }
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
    if (this.hasSellableVariants()) {
      return Number(v?.stock ?? 0);
    }
    return Number(this.product?.stock ?? 0);
  }

  isCurrentVariantOutOfStock(): boolean {
    if (!this.product) return true;
    if (this.product.isOutOfStock) return true;
    return this.currentStock() <= 0;
  }

  /** Chữ overlay ảnh: cờ admin vs hết hàng toàn SP. */
  galleryOverlayHeadline(): string {
    if (!this.product) return 'HẾT HÀNG';
    if (this.product.isOutOfStock) return 'TẠM NGỪNG BÁN';
    return 'HẾT HÀNG';
  }

  /** Dòng đỏ dưới số lượng khi không mua được. */
  stockStatusShortLabel(): string {
    if (!this.product) return 'Hết hàng';
    if (this.product.isOutOfStock) return 'Hiện không mở bán';
    return 'Hết hàng';
  }

  /** Nhãn nút Thêm giỏ / Mua ngay khi disabled. */
  ctaUnavailableLabel(): string {
    if (!this.product) return 'Hết hàng';
    if (this.product.isOutOfStock) return 'Tạm ngừng bán';
    return 'Hết hàng';
  }

  /** Gợi ý đổi phân loại (chỉ khi còn phân loại khác, không phải cờ admin). */
  showVariantPickAnotherHint(): boolean {
    return (
      !!this.product &&
      !this.product.isOutOfStock &&
      this.isCurrentVariantOutOfStock() &&
      !this.isProductCompletelyOutOfStock()
    );
  }

  /** Nhắc cờ admin trong khối biến thể 1 chiều (overlay vẫn hiện chung). */
  showAdminPauseInVariantBlock(): boolean {
    return !!this.product?.isOutOfStock && this.hasSellableVariants() && !this.hasSecondAttrDimension();
  }

  /**
   * `packagingTypes` là field riêng (một vài chuỗi). Biến thể có thể đã có chiều "Loại đóng gói".
   * Trước đây chỉ loại khi chuỗi packaging === cả `label` biến thể → "Hộp" vẫn hiện dù đã có "500g | Hộp".
   * Nay: ẩn mỗi giá trị packaging nếu đã xuất hiện (khớp đúng, không phân biệt hoa thường) trong attr1/2/3 của bất kỳ biến thể nào.
   */
  visiblePackagingTypes(productLike?: any): string[] {
    const p = productLike || this.product;
    const pack = (Array.isArray(p?.packagingTypes) ? p.packagingTypes : [])
      .map((x: string) => String(x || '').trim())
      .filter(Boolean);
    if (!pack.length) return [];

    const variantList = Array.isArray(p?.variants) ? p.variants : [];
    if (!variantList.length) return pack;

    const attrValueSet = new Set<string>();
    variantList.forEach((v: any) => {
      const pr = this.parseVariantParts(v);
      [pr.a1, pr.a2, pr.a3, pr.a4].forEach((val) => {
        const key = String(val || '').trim().toLowerCase();
        if (key) attrValueSet.add(key);
      });
    });

    return pack.filter((x: string) => {
      const key = String(x || '').trim().toLowerCase();
      return !attrValueSet.has(key);
    });
  }

  isProductCompletelyOutOfStock(): boolean {
    if (!this.product) return true;
    const vis = this.visibleVariants();
    if (vis.length > 0) {
      const total = vis.reduce((sum: number, v: any) => sum + Number(v?.stock || 0), 0);
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
        this.api.showToast(`Đã thêm ${this.qty} sản phẩm vào giỏ hàng!`, 'success');
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
      const msg = this.product.isOutOfStock
        ? 'Sản phẩm tạm không mở bán.'
        : 'Sản phẩm này đã hết hàng, vui lòng chọn phân loại khác.';
      this.api.showToast(msg, 'error');
      return;
    }

    const v = this.currentVariant();
    const checkoutItem = [{
      productId:    this.product._id,
      variantId:    v?._id || null,
      variantLabel: v?.label || '',
      name:         this.product.name,
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
      this.api.showToast(
        product.isOutOfStock ? 'Sản phẩm tạm không mở bán.' : 'Sản phẩm này đã hết hàng.',
        'error'
      );
      return;
    }
    this.api.addToCart(product._id, 1, product.name).subscribe({
      next: () => {
        this.api.showToast(`Đã thêm "${product.name}" vào giỏ hàng!`, 'success');
      },
      error: (err) => {
        console.error('Lỗi thêm SP liên quan:', err);
        this.api.showToast('Không thể thêm vào giỏ hàng.', 'error');
      }
    });
  }

  // Cuộn về đầu trang trước khi navigate sang sản phẩm khác
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