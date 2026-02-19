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

  productName    = 'Hat Macadamia Rang Muoi Uc';
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

  praiseTags = ['Chat luong tot', 'Giao hang nhanh', 'Dong goi dep', 'Dung nhu mo ta', 'Thom ngon'];

  selectedStar    = 0;
  hoverStar       = 0;
  selectedVariant = '';
  reviewText      = '';
  selectedTags:   string[] = [];

  starLabels: Record<number, string> = {
    1: 'Rat te',
    2: 'Khong hai long',
    3: 'Binh thuong',
    4: 'Tot',
    5: 'Tuyet voi!',
  };

  purchasedVariants = ['250g · Hu thuy tinh', '500g · Hu nhua', '1kg · Tui zip'];

  quickTags = [
    'Thom ngon', 'Gion', 'Dung nhu mo ta', 'Dong goi dep',
    'Giao hang nhanh', 'Chat luong tot', 'Gia hop ly', 'Se mua lai',
  ];

  allReviews: Review[] = [
    {
      id: 1, name: 'Ngoc Linh', initial: 'N', avatarColor: '#4A7C2F', rating: 5,
      date: '15/01/2025', variant: '250g · Hu thuy tinh',
      tags: ['Thom ngon', 'Dong goi dep', 'Se mua lai'],
      text: 'Macadamia rang muoi vua phai, khong bi man, hat chac va thom lam. Dong goi ky, hu thuy tinh rat dep. Day la lan thu 3 minh mua roi, chac chan se quay lai!',
      imgs: ['assets/images/reviews/r1-1.jpg', 'assets/images/reviews/r1-2.jpg'],
      adminReply: 'Cam on ban Ngoc Linh da tin tuong HealthUp! Chung toi rat vui khi san pham dap ung duoc ky vong.',
      adminReplyDate: '16/01/2025', helpful: 24, verified: true,
    },
    {
      id: 2, name: 'Minh Tuan', initial: 'M', avatarColor: '#3A6FD4', rating: 4,
      date: '10/01/2025', variant: '500g · Hu nhua',
      tags: ['Chat luong tot', 'Gia hop ly'],
      text: 'San pham ngon, giao hang nhanh. Tru 1 sao vi lan nay hat hoi nho hon lan truoc mot chut. Nhin chung van on, se mua tiep.',
      imgs: [], helpful: 8, verified: true,
    },
    {
      id: 3, name: 'Thu Huong', initial: 'T', avatarColor: '#D4854A', rating: 5,
      date: '05/01/2025', variant: '250g · Hu thuy tinh',
      tags: ['Dong goi dep', 'Dung nhu mo ta'],
      text: 'Qua tang cho me dip Tet. Dong goi dep lam, hu thuy tinh trong sang. Me thich lam. Se mua them combo qua tang gia dinh.',
      imgs: ['assets/images/reviews/r3-1.jpg'], helpful: 42, verified: true,
    },
    {
      id: 4, name: 'Duc Anh', initial: 'D', avatarColor: '#2D5016', rating: 5,
      date: '02/01/2025', variant: '500g · Hu nhua',
      tags: ['Thom ngon', 'Giao hang nhanh'],
      text: 'Dat cho vo bau an them dinh duong. San pham sach, nguon goc ro rang. Giao hang nhanh, dong goi cac lop bao ve rat tot.',
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
        id: Date.now(), name: 'Ban', initial: 'B', avatarColor: '#7FB069',
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