import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ApiService } from '../services/api.service';

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

  // ---- TƯ VẤN / Q&A ----
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
        this.product        = data;
        this.activeImage    = data.images?.[0] || '';
        this.selectedWeight = data.weights?.[0]?.label || '';
        this.selectedType   = data.packagingTypes?.[0] || '';
        this.isLoading      = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Lỗi tải sản phẩm:', err);
        this.isLoading = false;
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

  decreaseQty(): void {
    if (this.qty > 1) this.qty--;
  }

  increaseQty(): void {
    if (this.product && this.qty < this.product.stock) this.qty++;
  }

  addToCart(): void {
    if (this.addedToCart || !this.product?._id) return;
    this.addToCartError = '';

    this.api.addToCart(this.product._id, this.qty, this.product.name).subscribe({
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
        this.addToCartError = 'Không thể thêm vào giỏ hàng. Vui lòng thử lại.';
        this.api.showToast(this.addToCartError, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  buyNow(): void {
    if (!this.product?._id) return;

    const checkoutItem = [{
      productId: this.product._id,
      name:      this.product.name,
      price:     this.product.price,
      quantity:  this.qty,
      imageUrl:  this.product.images?.[0] || this.product.image || null,
      weight:    this.selectedWeight,
      type:      this.selectedType,
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

  goToProduct(id: string): void {
    if (!id) return;
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