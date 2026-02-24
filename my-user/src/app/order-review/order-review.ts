import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-order-review',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './order-review.html',
  styleUrls: ['./order-review.css']
})
export class OrderReviewComponent implements OnInit {

  productId    = '';
  productName  = '';
  isLoggedIn   = true;
  isLoading    = false;
  isSubmitting = false;

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

  starLabels: Record<number, string> = {
    1: 'Rất tệ', 2: 'Không hài lòng', 3: 'Bình thường', 4: 'Tốt', 5: 'Tuyệt vời!',
  };

  quickTags = [
    'Thơm ngon', 'Giòn', 'Đúng như mô tả', 'Đóng gói đẹp',
    'Giao hàng nhanh', 'Chất lượng tốt', 'Giá hợp lý', 'Sẽ mua lại',
  ];

  allReviews: any[] = [];
  filteredReviews: any[] = [];
  activeFilter = 'all';
  reviewSort   = 'newest';
  currentPage  = 1;
  hasMoreReviews = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.productId = params['productId'] || '';
      if (this.productId) {
        this.loadReviews();
      }
    });
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
        if (!append) {
          this.allReviews      = res.reviews || [];
          this.filteredReviews = this.allReviews;
        } else {
          this.allReviews      = [...this.allReviews, ...(res.reviews || [])];
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

        this.hasMoreReviews = (res.reviews?.length || 0) === 10;
        this.isLoading = false;
        this.cdr.detectChanges(); // ✅ force re-render sau khi data về
      },
      error: (err) => {
        console.error('Lỗi tải đánh giá:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  goToProduct(): void {
    if (this.productId) {
      this.router.navigate(['/product-detail-page', this.productId]);
    } else {
      this.router.navigate(['/product-listing-page']);
    }
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
    this.isSubmitting = true;

    this.api.submitReview({
      productId: this.productId,
      name:      'Khách hàng',
      rating:    this.selectedStar,
      variant:   this.selectedVariant || undefined,
      tags:      this.selectedTags,
      text:      this.reviewText,
    }).subscribe({
      next: () => {
        this.resetForm();
        this.currentPage = 1;
        this.allReviews  = [];
        this.loadReviews();
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Lỗi gửi đánh giá:', err);
        this.isSubmitting = false;
      }
    });
  }

  resetForm(): void {
    this.selectedStar    = 0;
    this.hoverStar       = 0;
    this.selectedVariant = '';
    this.reviewText      = '';
    this.selectedTags    = [];
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    console.log('Files selected:', input.files?.length);
  }

  openImageViewer(img: string): void { console.log('Open image:', img); }

  markHelpful(reviewId: string): void {
    this.api.markHelpful(reviewId).subscribe({
      next: () => {
        const r = this.allReviews.find(x => x._id === reviewId);
        if (r) {
          r.helpful = (r.helpful || 0) + 1;
          this.cdr.detectChanges();
        }
      },
      error: (err) => console.error(err)
    });
  }

  markNotHelpful(_id: string): void {}
  reportReview(id: string): void { console.log('Report review:', id); }

  loadMoreReviews(): void { this.currentPage++; this.loadReviews(true); }

  getAvatarInitial(name: string): string { return name?.charAt(0)?.toUpperCase() || 'K'; }

  getAvatarColor(index: number): string {
    const colors = ['#4A7C2F', '#3A6FD4', '#D4854A', '#2D5016', '#8B5CF6'];
    return colors[index % colors.length];
  }
}