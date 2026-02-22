import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

export interface Review {
  id: number;
  name: string;
  initial: string;
  avatarColor: string;
  rating: number;
  date: string;
  variant?: string;
  tags?: string[];
  text: string;
  imgs?: string[];
  adminReply?: string;
  adminReplyDate?: string;
  helpful: number;
  verified: boolean;
}

@Component({
  selector: 'app-order-review',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './order-review.html',
  styleUrls: ['./order-review.css']
})
export class OrderReviewComponent implements OnInit {

  productName    = 'Hạt Macadamia Rang Muối Úc';
  averageRating  = 4.9;
  starsDisplay   = '★★★★★';
  totalReviews   = 128;
  totalSold      = 342;
  isLoggedIn     = true;
  isLoading      = false;
  hasMoreReviews = true;
  isSubmitting   = false;

  activeFilter = 'all';
  reviewSort   = 'newest';

  ratingCounts: Record<number, number> = { 5: 92, 4: 24, 3: 8, 2: 3, 1: 1 };
  photoReviewCount = 38;

  praiseTags = ['Chất lượng tốt', 'Giao hàng nhanh', 'Đóng gói đẹp', 'Đúng như mô tả', 'Thơm ngon'];

  selectedStar    = 0;
  hoverStar       = 0;
  selectedVariant = '';
  reviewText      = '';
  selectedTags:   string[] = [];

  starLabels: Record<number, string> = {
    1: 'Rất tệ',
    2: 'Không hài lòng',
    3: 'Bình thường',
    4: 'Tốt',
    5: 'Tuyệt vời!',
  };

  purchasedVariants = ['250g · Hũ thủy tinh', '500g · Hũ nhựa', '1kg · Túi zip'];

  quickTags = [
    'Thơm ngon', 'Giòn', 'Đúng như mô tả', 'Đóng gói đẹp',
    'Giao hàng nhanh', 'Chất lượng tốt', 'Giá hợp lý', 'Sẽ mua lại',
  ];

  allReviews: Review[] = [
    {
      id: 1, name: 'Ngọc Linh', initial: 'N', avatarColor: '#4A7C2F', rating: 5,
      date: '15/01/2025', variant: '250g · Hũ thủy tinh',
      tags: ['Thơm ngon', 'Đóng gói đẹp', 'Sẽ mua lại'],
      text: 'Macadamia rang muối vừa phải, không bị mặn, hạt chắc và thơm lắm. Đóng gói kỹ, hũ thủy tinh rất đẹp. Đây là lần thứ 3 mình mua rồi, chắc chắn sẽ quay lại!',
      imgs: ['assets/images/reviews/r1-1.jpg', 'assets/images/reviews/r1-2.jpg'],
      adminReply: 'Cảm ơn bạn Ngọc Linh đã tin tưởng HealthUp! Chúng tôi rất vui khi sản phẩm đáp ứng được kỳ vọng.',
      adminReplyDate: '16/01/2025', helpful: 24, verified: true,
    },
    {
      id: 2, name: 'Minh Tuấn', initial: 'M', avatarColor: '#3A6FD4', rating: 4,
      date: '10/01/2025', variant: '500g · Hũ nhựa',
      tags: ['Chất lượng tốt', 'Giá hợp lý'],
      text: 'Sản phẩm ngon, giao hàng nhanh. Trừ 1 sao vì lần này hạt hơi nhỏ hơn lần trước một chút. Nhìn chung vẫn ổn, sẽ mua tiếp.',
      imgs: [], helpful: 8, verified: true,
    },
    {
      id: 3, name: 'Thu Hương', initial: 'T', avatarColor: '#D4854A', rating: 5,
      date: '05/01/2025', variant: '250g · Hũ thủy tinh',
      tags: ['Đóng gói đẹp', 'Đúng như mô tả'],
      text: 'Quà tặng cho mẹ dịp Tết. Đóng gói đẹp lắm, hũ thủy tinh trong sáng. Mẹ thích lắm. Sẽ mua thêm combo quà tặng gia đình.',
      imgs: ['assets/images/reviews/r3-1.jpg'], helpful: 42, verified: true,
    },
    {
      id: 4, name: 'Đức Anh', initial: 'Đ', avatarColor: '#2D5016', rating: 5,
      date: '02/01/2025', variant: '500g · Hũ nhựa',
      tags: ['Thơm ngon', 'Giao hàng nhanh'],
      text: 'Đặt cho vợ bầu ăn thêm dinh dưỡng. Sản phẩm sạch, nguồn gốc rõ ràng. Giao hàng nhanh, đóng gói các lớp bảo vệ rất tốt.',
      imgs: [], helpful: 17, verified: true,
    },
  ];

  filteredReviews: Review[] = [];

  ngOnInit(): void { this.applyFilter(); }

  getBarPercent(star: number): number {
    return Math.round((this.ratingCounts[star] / this.totalReviews) * 100);
  }

  getStarStr(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  setFilter(filter: string): void { this.activeFilter = filter; this.applyFilter(); }

  applyFilter(): void {
    let result = [...this.allReviews];
    if (this.activeFilter !== 'all') {
      if (this.activeFilter === 'photo') {
        result = result.filter(r => r.imgs && r.imgs.length > 0);
      } else {
        const star = parseInt(this.activeFilter, 10);
        result = result.filter(r => r.rating === star);
      }
    }
    switch (this.reviewSort) {
      case 'highest': result.sort((a, b) => b.rating  - a.rating);  break;
      case 'lowest':  result.sort((a, b) => a.rating  - b.rating);  break;
      case 'helpful': result.sort((a, b) => b.helpful - a.helpful); break;
    }
    this.filteredReviews = result;
  }

  onSortChange(): void { this.applyFilter(); }

  isTagSelected(tag: string): boolean { return this.selectedTags.includes(tag); }

  toggleQuickTag(tag: string): void {
    this.selectedTags = this.selectedTags.includes(tag)
      ? this.selectedTags.filter(t => t !== tag)
      : [...this.selectedTags, tag];
  }

  canSubmit(): boolean { return this.selectedStar > 0 && this.reviewText.trim().length >= 10; }

  submitReview(): void {
    if (!this.canSubmit()) return;
    this.isSubmitting = true;
    setTimeout(() => {
      const newReview: Review = {
        id: Date.now(), name: 'Bạn', initial: 'B', avatarColor: '#7FB069',
        rating: this.selectedStar, date: new Date().toLocaleDateString('vi-VN'),
        variant: this.selectedVariant || undefined, tags: [...this.selectedTags],
        text: this.reviewText, imgs: [], helpful: 0, verified: true,
      };
      this.allReviews.unshift(newReview);
      this.totalReviews++;
      this.applyFilter();
      this.resetForm();
      this.isSubmitting = false;
    }, 1000);
  }

  resetForm(): void {
    this.selectedStar = 0; this.hoverStar = 0;
    this.selectedVariant = ''; this.reviewText = ''; this.selectedTags = [];
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    console.log('Files selected:', input.files?.length);
  }

  openImageViewer(img: string): void { console.log('Open image:', img); }

  markHelpful(reviewId: number): void {
    const review = this.allReviews.find(r => r.id === reviewId);
    if (review) review.helpful++;
  }

  markNotHelpful(_reviewId: number): void {}
  reportReview(reviewId: number): void { console.log('Report review:', reviewId); }

  loadMoreReviews(): void {
    this.isLoading = true;
    setTimeout(() => { this.hasMoreReviews = false; this.isLoading = false; }, 800);
  }
}