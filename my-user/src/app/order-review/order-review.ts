import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, STATIC_BASE } from '../services/api.service';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

// ── Interface cho chế độ list ────────────────────────────────────
interface ReviewableItem {
  productId: string;
  name: string;
  imageUrl: string;
  price: number;
  quantity: number;
  reviewed: boolean;
}
interface ReviewableOrder {
  _id: string;
  orderCode: string;
  createdAt: string;
  total: number;
  items: ReviewableItem[];
}

@Component({
  selector: 'app-order-review',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './order-review.html',
  styleUrls: ['./order-review.css']
})
export class OrderReviewComponent implements OnInit {

  // ── Chế độ hiển thị ──────────────────────────────────────────
  // 'list'   → hiện tất cả đơn đã giao (trang Đánh giá đơn hàng)
  // 'detail' → hiện review của 1 sản phẩm cụ thể
  mode: 'list' | 'detail' = 'list';

  // ── Chế độ LIST ──────────────────────────────────────────────
  isListLoading = false;
  reviewableOrders: ReviewableOrder[] = [];

  // ── Chế độ DETAIL ────────────────────────────────────────────
  productId    = '';
  productName  = '';
  isLoggedIn   = false;
  isLoading    = false;
  isSubmitting = false;

  currentUserName = '';
  currentUserId   = '';

  hasPurchased    = false;
  purchaseChecked = false;
  alreadyReviewed = false;

  averageRating  = 0;
  starsDisplay   = '';
  totalReviews   = 0;
  totalSold      = 0;
  ratingCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  photoReviewCount = 0;
  praiseTags: string[] = [];

  selectedStar    = 0;
  hoverStar       = 0;
  selectedVariant = '';
  reviewText      = '';
  selectedTags:   string[] = [];
  purchasedVariants: string[] = [];
  selectedImages: File[] = [];
  imagePreviewUrls: string[] = [];

  editingReviewId: string | null = null;
  editStar      = 0;
  editHoverStar = 0;
  editText      = '';
  editTags:     string[] = [];
  editVariant   = '';
  editImages:   File[]   = [];
  editPreviewUrls:   string[] = [];
  editExistingImgs:  string[] = [];
  isEditSubmitting = false;

  deletingReviewId: string | null = null;
  isDeleting = false;

  likedReviewIds    = new Set<string>();
  dislikedReviewIds = new Set<string>();

  starLabels: Record<number, string> = {
    1: 'Rất tệ', 2: 'Không hài lòng', 3: 'Bình thường', 4: 'Tốt', 5: 'Tuyệt vời!',
  };

  quickTags = [
    'Thơm ngon', 'Giòn', 'Đúng như mô tả', 'Đóng gói đẹp',
    'Giao hàng nhanh', 'Chất lượng tốt', 'Giá hợp lý', 'Sẽ mua lại',
  ];

  allReviews: any[]      = [];
  filteredReviews: any[] = [];
  activeFilter = 'all';
  reviewSort   = 'newest';
  currentPage  = 1;
  hasMoreReviews = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public api: ApiService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    const user  = localStorage.getItem('user');
    this.isLoggedIn = !!(token && user);

    try {
      const u = JSON.parse(user || '{}');
      this.currentUserName = u?.username || u?.name || '';
      this.currentUserId   = u?._id || u?.id || localStorage.getItem('userId') || '';
    } catch {}

    try {
      const liked    = JSON.parse(localStorage.getItem('liked_reviews')    || '[]');
      const disliked = JSON.parse(localStorage.getItem('disliked_reviews') || '[]');
      this.likedReviewIds    = new Set<string>(liked);
      this.dislikedReviewIds = new Set<string>(disliked);
    } catch {}

    this.route.queryParams.subscribe(params => {
      this.productId = params['productId'] || '';

      if (this.productId) {
        // ── Chế độ DETAIL: có productId ────────────────────────
        this.mode = 'detail';
        this.loadReviews();
        if (this.isLoggedIn && this.currentUserId) {
          this.checkPurchased();
        } else {
          this.purchaseChecked = true;
        }
      } else {
        // ── Chế độ LIST: không có productId ────────────────────
        this.mode = 'list';
        if (this.isLoggedIn) {
          this.loadReviewableOrders();
        }
      }
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  CHẾ ĐỘ LIST
  // ════════════════════════════════════════════════════════════════

  loadReviewableOrders(): void {
    this.isListLoading = true;
    const userId = this.currentUserId;
    if (!userId) { this.isListLoading = false; return; }

    this.api.getOrders(userId).subscribe({
      next: (orders: any[]) => {
        // Lọc: đã giao + không trả hàng
        const eligible = (orders || []).filter(o =>
          o.status === 'delivered' &&
          (!o.returnStatus || o.returnStatus === 'none')
        );

        if (eligible.length === 0) {
          this.reviewableOrders = [];
          this.isListLoading = false;
          this.cdr.detectChanges();
          return;
        }

        // Kiểm tra từng sản phẩm đã được review chưa
        const checks$ = eligible.map(order => {
          const itemChecks$ = (order.items || []).map((item: any) => {
            // ✅ productId có thể là object { _id } hoặc string — extract an toàn
            const pid = typeof item.productId === 'object'
              ? (item.productId?._id || item.productId?.id || '')
              : String(item.productId || '');
            return this.api.getReviews(pid, { limit: 100 }).pipe(
              map((res: any) => {
                const reviews: any[] = res?.reviews || [];
                const myReview = reviews.find((r: any) => r.name === this.currentUserName);
                return {
                  productId: pid,
                  name:      item.name,
                  imageUrl:  item.imageUrl || '',
                  price:     item.price,
                  quantity:  item.quantity,
                  reviewed:  !!myReview,
                } as ReviewableItem;
              }),
              catchError(() => of({
                productId: pid,
                name:      item.name,
                imageUrl:  item.imageUrl || '',
                price:     item.price,
                quantity:  item.quantity,
                reviewed:  false,
              } as ReviewableItem))
            );
          });

          return forkJoin(itemChecks$).pipe(
            map(items => ({
              _id:       order._id,
              orderCode: order.orderCode || order._id?.substring(0, 8)?.toUpperCase(),
              createdAt: order.createdAt,
              total:     order.total,
              items,
            } as ReviewableOrder))
          );
        });

        forkJoin(checks$).subscribe({
          next: result => {
            this.reviewableOrders = result;
            this.isListLoading = false;
            this.cdr.detectChanges();
          },
          error: () => { this.isListLoading = false; this.cdr.detectChanges(); }
        });
      },
      error: () => { this.isListLoading = false; this.cdr.detectChanges(); }
    });
  }

  goToReview(productId: string): void {
    if (!productId) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { productId },
    });
  }

  hasUnreviewed(order: ReviewableOrder): boolean {
    return order.items.some(i => !i.reviewed);
  }

  reviewedCount(order: ReviewableOrder): number {
    return order.items.filter(i => i.reviewed).length;
  }

  getListImageUrl(url: string): string {
    if (!url) return '/assets/images/placeholder.png';
    return url.startsWith('http') ? url : `${STATIC_BASE}${url}`;
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  CHẾ ĐỘ DETAIL
  // ════════════════════════════════════════════════════════════════

  // ✅ Extract productId an toàn từ object hoặc string
  private extractId(productId: any): string {
    if (!productId) return '';
    if (typeof productId === 'object') return productId?._id || productId?.id || '';
    return String(productId);
  }

  private checkPurchased(): void {
    this.purchaseChecked = false;
    this.api.getOrders(this.currentUserId).subscribe({
      next: (orders: any[]) => {
        const deliveredOrders = (orders || []).filter(o => o.status === 'delivered');
        this.hasPurchased = deliveredOrders.some(order =>
          (order.items || []).some((item: any) =>
            this.extractId(item.productId) === String(this.productId)
          )
        );
        this.purchaseChecked = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.hasPurchased    = false;
        this.purchaseChecked = true;
        this.cdr.detectChanges();
      }
    });
  }

  private checkAlreadyReviewed(): void {
    if (!this.currentUserName) return;
    this.alreadyReviewed = this.allReviews.some(r => r.name === this.currentUserName);
  }

  get canWriteReview(): boolean {
    return this.isLoggedIn
      && this.purchaseChecked
      && this.hasPurchased
      && !this.alreadyReviewed
      && !this.editingReviewId;
  }

  fixImgUrl(url: string): string {
    if (!url) return '';
    return url.startsWith('http') ? url : `${STATIC_BASE}${url}`;
  }

  loadReviews(append = false): void {
    if (!this.productId) return;
    this.isLoading = true;
    this.cdr.detectChanges();

    this.api.getReviews(this.productId, {
      filter: this.activeFilter,
      sort:   this.reviewSort,
      page:   this.currentPage,
      limit:  10,
    }).subscribe({
      next: (res) => {
        const reviews = res.reviews || [];
        if (!append) {
          this.allReviews      = reviews;
          this.filteredReviews = reviews;
        } else {
          this.allReviews      = [...this.allReviews, ...reviews];
          this.filteredReviews = this.allReviews;
        }

        this.totalReviews     = res.stats?.total      || res.total || 0;
        this.averageRating    = res.stats?.average    || 0;
        this.starsDisplay     = this.getStarStr(Math.round(this.averageRating));
        this.ratingCounts     = res.stats?.counts     || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        this.praiseTags       = res.stats?.praiseTags || [];
        this.photoReviewCount = res.stats?.photoCount || 0;

        if (res.product) {
          this.productName = res.product.name || '';
          this.totalSold   = res.product.sold || 0;
          const weights = res.product.weights || [];
          const types   = res.product.packagingTypes || [];
          this.purchasedVariants = weights.length && types.length
            ? weights.flatMap((w: string) => types.map((t: string) => `${w} · ${t}`))
            : weights;
        }

        this.hasMoreReviews = reviews.length === 10;
        this.isLoading = false;
        this.checkAlreadyReviewed();
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });
  }

  goToProduct(): void {
    this.productId
      ? this.router.navigate(['/product-detail-page', this.productId])
      : this.router.navigate(['/product-listing-page']);
  }

  getBarPercent(star: number): number {
    if (!this.totalReviews) return 0;
    return Math.round((this.ratingCounts[star] / this.totalReviews) * 100);
  }

  getStarStr(rating: number): string {
    const n = Math.min(5, Math.max(0, rating));
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  setFilter(filter: string): void {
    this.activeFilter = filter;
    this.currentPage  = 1;
    this.allReviews   = [];
    this.loadReviews();
  }

  onSortChange(): void {
    this.currentPage = 1;
    this.allReviews  = [];
    this.loadReviews();
  }

  isTagSelected(tag: string): boolean { return this.selectedTags.includes(tag); }

  toggleQuickTag(tag: string): void {
    this.selectedTags = this.selectedTags.includes(tag)
      ? this.selectedTags.filter(t => t !== tag)
      : [...this.selectedTags, tag];
  }

  canSubmit(): boolean { return this.selectedStar > 0 && this.reviewText.trim().length >= 10; }

  submitReview(): void {
    if (!this.canSubmit() || !this.productId) return;
    if (!this.hasPurchased) {
      this.api.showToast('Bạn chỉ có thể đánh giá sản phẩm đã mua.', 'error');
      return;
    }

    this.isSubmitting = true;
    this.cdr.detectChanges();

    let userName = 'Khách hàng';
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      userName = u?.username || u?.name || 'Khách hàng';
    } catch {}

    const doSubmit = (imgUrls: string[]) => {
      this.api.submitReview({
        productId: this.productId,
        userId:    this.currentUserId,
        name:      userName,
        rating:    this.selectedStar,
        variant:   this.selectedVariant || undefined,
        tags:      this.selectedTags,
        text:      this.reviewText,
        imgs:      imgUrls,
      }).subscribe({
        next: () => {
          this.resetForm();
          this.currentPage = 1;
          this.allReviews  = [];
          this.loadReviews();
          this.isSubmitting = false;
          this.api.showToast('Đánh giá của bạn đã được gửi thành công!', 'success');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isSubmitting = false;
          const msg = err?.error?.error || 'Không thể gửi đánh giá. Vui lòng thử lại.';
          this.api.showToast(msg, 'error');
          this.cdr.detectChanges();
        }
      });
    };

    if (this.selectedImages.length > 0) {
      this.api.uploadReviewImages(this.selectedImages).subscribe({
        next: (res) => { doSubmit((res.urls || []).map((u: string) => this.fixImgUrl(u))); },
        error: () => {
          this.isSubmitting = false;
          this.api.showToast('Không thể upload ảnh. Vui lòng thử lại.', 'error');
          this.cdr.detectChanges();
        }
      });
    } else {
      doSubmit([]);
    }
  }

  resetForm(): void {
    this.selectedStar     = 0;
    this.hoverStar        = 0;
    this.selectedVariant  = '';
    this.reviewText       = '';
    this.selectedTags     = [];
    this.selectedImages   = [];
    this.imagePreviewUrls = [];
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const toAdd = Array.from(input.files).slice(0, 5 - this.selectedImages.length);
    toAdd.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) {
        this.api.showToast(`Ảnh "${file.name}" vượt quá 5MB, bỏ qua.`, 'error');
        return;
      }
      this.selectedImages.push(file);
      const reader = new FileReader();
      reader.onload = (e) => { this.imagePreviewUrls.push(e.target?.result as string); this.cdr.detectChanges(); };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  removeImage(index: number): void {
    this.selectedImages.splice(index, 1);
    this.imagePreviewUrls.splice(index, 1);
    this.cdr.detectChanges();
  }

  isMyReview(review: any): boolean {
    return !!this.currentUserName && review.name === this.currentUserName;
  }

  openEditForm(review: any): void {
    this.editingReviewId  = String(review._id);
    this.editStar         = review.rating;
    this.editHoverStar    = 0;
    this.editText         = review.text;
    this.editTags         = [...(review.tags || [])];
    this.editVariant      = review.variant || '';
    this.editImages       = [];
    this.editExistingImgs = [...(review.imgs || [])];
    this.editPreviewUrls  = (review.imgs || []).map((u: string) => this.fixImgUrl(u));
    this.cdr.detectChanges();
  }

  cancelEdit(): void {
    this.editingReviewId  = null;
    this.editImages       = [];
    this.editPreviewUrls  = [];
    this.editExistingImgs = [];
    this.cdr.detectChanges();
  }

  toggleEditTag(tag: string): void {
    this.editTags = this.editTags.includes(tag)
      ? this.editTags.filter(t => t !== tag)
      : [...this.editTags, tag];
  }

  isEditTagSelected(tag: string): boolean { return this.editTags.includes(tag); }
  canEditSubmit(): boolean { return this.editStar > 0 && this.editText.trim().length >= 10; }

  removeEditExistingImg(index: number): void {
    this.editExistingImgs.splice(index, 1);
    this.editPreviewUrls.splice(index, 1);
    this.cdr.detectChanges();
  }

  removeEditNewImg(index: number): void {
    this.editImages.splice(index, 1);
    this.editPreviewUrls.splice(this.editExistingImgs.length + index, 1);
    this.cdr.detectChanges();
  }

  onEditFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const totalExisting = this.editExistingImgs.length + this.editImages.length;
    const toAdd = Array.from(input.files).slice(0, 5 - totalExisting);
    toAdd.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) { this.api.showToast(`Ảnh "${file.name}" vượt quá 5MB, bỏ qua.`, 'error'); return; }
      this.editImages.push(file);
      const reader = new FileReader();
      reader.onload = (e) => { this.editPreviewUrls.push(e.target?.result as string); this.cdr.detectChanges(); };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  submitEdit(): void {
    if (!this.canEditSubmit() || !this.editingReviewId) return;
    this.isEditSubmitting = true;
    this.cdr.detectChanges();

    const doUpdate = (newImgUrls: string[]) => {
      const allImgs = [...this.editExistingImgs, ...newImgUrls];
      this.api.updateReview(this.editingReviewId!, {
        rating: this.editStar, text: this.editText,
        tags: this.editTags, variant: this.editVariant || undefined, imgs: allImgs,
      }).subscribe({
        next: () => {
          this.cancelEdit();
          this.isEditSubmitting = false;
          this.currentPage = 1;
          this.allReviews  = [];
          this.loadReviews();
          this.api.showToast('Đã cập nhật đánh giá!', 'success');
          this.cdr.detectChanges();
        },
        error: () => {
          this.isEditSubmitting = false;
          this.api.showToast('Không thể cập nhật đánh giá. Thử lại!', 'error');
          this.cdr.detectChanges();
        }
      });
    };

    if (this.editImages.length > 0) {
      this.api.uploadReviewImages(this.editImages).subscribe({
        next: (res) => doUpdate((res.urls || []).map((u: string) => this.fixImgUrl(u))),
        error: () => { this.isEditSubmitting = false; this.api.showToast('Không thể upload ảnh mới. Thử lại!', 'error'); this.cdr.detectChanges(); }
      });
    } else { doUpdate([]); }
  }

  confirmDelete(reviewId: any): void {
    this.ngZone.run(() => { this.deletingReviewId = String(reviewId); this.cdr.detectChanges(); });
  }

  cancelDelete(): void {
    this.ngZone.run(() => { this.deletingReviewId = null; this.cdr.detectChanges(); });
  }

  submitDelete(): void {
    if (!this.deletingReviewId) return;
    this.isDeleting = true;
    this.cdr.detectChanges();
    const idToDelete = String(this.deletingReviewId);
    this.api.deleteReview(idToDelete).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.deletingReviewId = null;
          this.isDeleting      = false;
          this.currentPage     = 1;
          this.allReviews      = [];
          this.loadReviews();
          this.api.showToast('Đã xóa đánh giá!', 'info');
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.isDeleting = false;
          this.api.showToast('Không thể xóa đánh giá. Thử lại!', 'error');
          this.cdr.detectChanges();
        });
      }
    });
  }

  markHelpful(reviewId: string): void {
    if (this.likedReviewIds.has(reviewId)) {
      this.likedReviewIds.delete(reviewId);
      const r = this.allReviews.find(x => x._id === reviewId);
      if (r) r.helpful = Math.max(0, (r.helpful || 0) - 1);
      this.saveLikeState(); this.cdr.detectChanges(); return;
    }
    if (this.dislikedReviewIds.has(reviewId)) this.dislikedReviewIds.delete(reviewId);
    this.likedReviewIds.add(reviewId);
    this.saveLikeState();
    this.api.markHelpful(reviewId).subscribe({
      next: (updated: any) => {
        const r = this.allReviews.find(x => x._id === reviewId);
        if (r) r.helpful = updated?.helpful ?? (r.helpful || 0) + 1;
        this.cdr.detectChanges();
      },
      error: () => { this.likedReviewIds.delete(reviewId); this.saveLikeState(); this.cdr.detectChanges(); }
    });
  }

  markNotHelpful(reviewId: string): void {
    if (this.dislikedReviewIds.has(reviewId)) {
      this.dislikedReviewIds.delete(reviewId); this.saveLikeState(); this.cdr.detectChanges(); return;
    }
    if (this.likedReviewIds.has(reviewId)) {
      this.likedReviewIds.delete(reviewId);
      const r = this.allReviews.find(x => x._id === reviewId);
      if (r) r.helpful = Math.max(0, (r.helpful || 0) - 1);
    }
    this.dislikedReviewIds.add(reviewId);
    this.saveLikeState(); this.cdr.detectChanges();
  }

  isLiked(reviewId: string):    boolean { return this.likedReviewIds.has(reviewId); }
  isDisliked(reviewId: string): boolean { return this.dislikedReviewIds.has(reviewId); }

  private saveLikeState(): void {
    try {
      localStorage.setItem('liked_reviews',    JSON.stringify([...this.likedReviewIds]));
      localStorage.setItem('disliked_reviews', JSON.stringify([...this.dislikedReviewIds]));
    } catch {}
  }

  openImageViewer(img: string): void { window.open(img, '_blank'); }
  reportReview(id: string): void { console.log('Report review:', id); }
  loadMoreReviews(): void { this.currentPage++; this.loadReviews(true); }
  getAvatarInitial(name: string): string { return name?.charAt(0)?.toUpperCase() || 'K'; }
  getAvatarColor(index: number): string {
    const colors = ['#4A7C2F', '#3A6FD4', '#D4854A', '#2D5016', '#8B5CF6'];
    return colors[index % colors.length];
  }

  formatCurrency(price: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }
}