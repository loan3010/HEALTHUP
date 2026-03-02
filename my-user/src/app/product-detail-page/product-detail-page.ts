import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

export interface PolicyItem { icon: string; title: string; desc: string; }

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
export class ProductDetailPageComponent implements OnInit {

  product: any = null;
  relatedProducts: any[] = [];
  activeImage = '';
  selectedWeight  = '';
  selectedType    = '';
  activeTab: 'desc' | 'nutrition' | 'policy' = 'desc';
  qty = 1;
  addedToCart = false;
  isWishlisted = false;
  isLoading = true;

  policyItems: PolicyItem[] = [
    { icon: 'bi-arrow-repeat', title: 'Đổi trả trong 7 ngày',  desc: 'Áp dụng khi sản phẩm lỗi, hư hỏng do vận chuyển hoặc không đúng đơn hàng.' },
    { icon: 'bi-truck',        title: 'Giao hàng toàn quốc',   desc: 'Từ 2-5 ngày làm việc. Nội thành TP.HCM & Hà Nội giao trong ngày hoặc hôm sau.' },
    { icon: 'bi-credit-card',  title: 'Thanh toán an toàn',    desc: 'Hỗ trợ COD, VNPay, Momo. Không thu phí giao dịch.' },
    { icon: 'bi-patch-check',  title: 'Chất lượng kiểm định',  desc: 'Sản phẩm đạt chứng nhận VSATTP, nguồn gốc rõ ràng, truy xuất được.' },
  ];

  // ---- TƯ VẤN / Q&A ----
  isLoggedIn = true;   // TODO: thay bằng auth service thực
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
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.product = null;
        this.relatedProducts = [];
        this.isLoading = true;
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

  loadProduct(id: string): void {
    this.api.getProductById(id).subscribe({
      next: (data) => {
        this.product        = data;
        this.activeImage    = data.images?.[0] || '';
        this.selectedWeight = data.weights?.[0]?.label || '';
        this.selectedType   = data.packagingTypes?.[0] || '';
        this.isLoading      = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải sản phẩm:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadRelated(id: string): void {
    this.api.getRelatedProducts(id).subscribe({
      next: (data) => {
        this.relatedProducts = data;
        this.cdr.detectChanges();
      },
      error: (err) => { console.error('Lỗi tải SP liên quan:', err); }
    });
  }

  // ---- TƯ VẤN ----

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
          total:    res.stats?.total    || res.total    || 0,
          pending:  res.stats?.pending  || 0,
          answered: res.stats?.answered || 0,
        };

        this.applyConsultingFilter();
        this.hasMoreQuestions = questions.length === 5;
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
        setTimeout(() => {
          this.askSubmitSuccess = false;
          this.cdr.detectChanges();
        }, 5000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi gửi câu hỏi:', err);
        this.isAskSubmitting = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ---- HELPERS ----

  getStars(rating: number): string {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  selectWeight(label: string): void {
    this.selectedWeight = label;

    // Cập nhật giá theo khối lượng được chọn
    if (this.product?.weightPrices?.length) {
      const wp = this.product.weightPrices.find((w: any) => w.label === label);
      if (wp) {
        this.product.price    = wp.price;
        this.product.oldPrice = wp.oldPrice;
      }
    }
  }

  decreaseQty(): void { if (this.qty > 1) this.qty--; }
  increaseQty(): void { if (this.product && this.qty < this.product.stock) this.qty++; }

  addToCart(): void {
    if (this.addedToCart) return;
    this.addedToCart = true;
    setTimeout(() => (this.addedToCart = false), 2500);
  }

  buyNow(): void { this.addToCart(); this.router.navigate(['/checkout']); }

  toggleWishlist(): void { this.isWishlisted = !this.isWishlisted; }

  share(): void {
    if (navigator.share) {
      navigator.share({ title: this.product?.name, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  }

  addRelated(event: Event, id: string): void {
    event.stopPropagation();
    console.log('Add related to cart:', id);
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