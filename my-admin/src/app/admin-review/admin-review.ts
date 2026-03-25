import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { Router } from '@angular/router';

interface Review {
  _id: string;
  productId: {
    _id: string;
    name: string;
    images: string[];
  };
  name: string;
  rating: number;
  text: string;
  variant?: string;
  tags?: string[];
  imgs?: string[];
  adminReply?: string;
  adminReplyDate?: string;
  helpful: number;
  verified: boolean;
  date: string;
  createdAt: string;
}

@Component({
  selector: 'app-admin-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-review.html',
  styleUrls: ['./admin-review.css']
})
export class AdminReviewComponent implements OnInit {
  reviews: Review[] = [];
  isLoading = false;
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  limit = 20;
  
  // Filters - chỉ dùng 1 bộ lọc duy nhất (KPI cards)
  filterHasReply: 'all' | 'replied' | 'unreplied' = 'all';
  
  // Search
  searchKeyword = '';
  
  // Stats - lưu tổng số từ API riêng
  totalReviews = 0;
  repliedCount = 0;
  unrepliedCount = 0;
  
  // Reply modal
  showReplyModal = false;
  selectedReview: Review | null = null;
  replyText = '';
  isSubmitting = false;
  
  // Delete modal
  showDeleteModal = false;
  reviewToDelete: Review | null = null;
  isDeleting = false;

  constructor(
    private api: ApiService, 
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStats(); // Tải thống kê trước
    this.loadReviews();
  }

  // Tải thống kê tổng số từ API (3 API riêng biệt)
  loadStats(): void {
    // Tải số lượng đã phản hồi (có nội dung)
    this.api.getAllReviews({
      page: 1,
      limit: 1,
      search: this.searchKeyword,
      hasReply: 'replied'
    }).subscribe({
      next: (res: any) => {
        console.log('Total replied (có nội dung):', res.total);
        this.repliedCount = res.total || 0;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải thống kê đã phản hồi:', err);
      }
    });

    // Tải số lượng chưa phản hồi (null hoặc rỗng)
    this.api.getAllReviews({
      page: 1,
      limit: 1,
      search: this.searchKeyword,
      hasReply: 'unreplied'
    }).subscribe({
      next: (res: any) => {
        console.log('Total unreplied (null hoặc rỗng):', res.total);
        this.unrepliedCount = res.total || 0;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải thống kê chưa phản hồi:', err);
      }
    });

    // Tải tổng số tất cả
    this.api.getAllReviews({
      page: 1,
      limit: 1,
      search: this.searchKeyword,
      hasReply: 'all'
    }).subscribe({
      next: (res: any) => {
        console.log('Total all:', res.total);
        this.totalReviews = res.total || 0;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải thống kê tổng:', err);
      }
    });
  }

  loadReviews(): void {
    this.isLoading = true;
    this.api.getAllReviews({
      page: this.currentPage,
      limit: this.limit,
      search: this.searchKeyword,
      hasReply: this.filterHasReply
    }).subscribe({
      next: (res: any) => {
        console.log('Reviews loaded:', res.total, 'reviews count:', res.reviews?.length);
        this.reviews = res.reviews;
        this.totalItems = res.total;
        this.totalPages = res.totalPages;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải đánh giá:', err);
        this.isLoading = false;
        this.api.showToast('Không thể tải danh sách đánh giá', 'error');
      }
    });
  }

  // Các method get thống kê trả về tổng số từ API
  getTotalCount(): number {
    return this.totalReviews;
  }

  getRepliedCount(): number {
    return this.repliedCount;
  }

  getUnrepliedCount(): number {
    return this.unrepliedCount;
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadReviews();
    this.loadStats(); // Cập nhật lại thống kê khi tìm kiếm
  }

  // Click vào KPI card để lọc
  setFilter(filter: 'all' | 'replied' | 'unreplied'): void {
    if (this.filterHasReply === filter) return;
    this.filterHasReply = filter;
    this.currentPage = 1;
    this.loadReviews();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadReviews();
  }

  openReplyModal(review: Review): void {
    this.selectedReview = review;
    this.replyText = review.adminReply || '';
    this.showReplyModal = true;
  }

  closeReplyModal(): void {
    this.showReplyModal = false;
    this.selectedReview = null;
    this.replyText = '';
    this.isSubmitting = false;
  }

  submitReply(): void {
    if (!this.selectedReview || !this.replyText.trim()) {
      this.api.showToast('Vui lòng nhập nội dung phản hồi', 'error');
      return;
    }

    this.isSubmitting = true;
    this.api.replyReview(this.selectedReview._id, this.replyText.trim()).subscribe({
      next: (res: any) => {
        const index = this.reviews.findIndex(r => r._id === this.selectedReview?._id);
        if (index !== -1 && res.review) {
          this.reviews[index] = { ...this.reviews[index], ...res.review };
        }
        this.api.showToast('Đã phản hồi đánh giá thành công', 'success');
        
        // Cập nhật lại thống kê sau khi phản hồi
        this.loadStats();
        
        // Nếu đang ở tab lọc "chưa phản hồi" và vừa phản hồi xong, cần reload lại danh sách
        if (this.filterHasReply === 'unreplied') {
          this.loadReviews();
        }
        
        this.closeReplyModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi phản hồi:', err);
        this.api.showToast(err.error?.error || 'Không thể gửi phản hồi', 'error');
        this.isSubmitting = false;
      }
    });
  }

  // Xóa phản hồi của admin
  deleteReply(review: Review, event?: Event): void {
    event?.stopPropagation();
    if (!review._id) return;
    
    if (confirm('Bạn có chắc chắn muốn xóa phản hồi này?')) {
      this.api.deleteReply(review._id).subscribe({
        next: (res: any) => {
          const index = this.reviews.findIndex(r => r._id === review._id);
          if (index !== -1 && res.review) {
            this.reviews[index] = { ...this.reviews[index], ...res.review };
          }
          this.api.showToast('Đã xóa phản hồi thành công', 'success');
          
          // Cập nhật lại thống kê sau khi xóa phản hồi
          this.loadStats();
          
          // Nếu đang ở tab lọc "đã phản hồi" và vừa xóa phản hồi xong, cần reload lại danh sách
          if (this.filterHasReply === 'replied') {
            this.loadReviews();
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Lỗi xóa phản hồi:', err);
          this.api.showToast(err.error?.error || 'Không thể xóa phản hồi', 'error');
        }
      });
    }
  }

  openDeleteModal(review: Review): void {
    this.reviewToDelete = review;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.reviewToDelete = null;
    this.isDeleting = false;
  }

  confirmDelete(): void {
    if (!this.reviewToDelete) return;

    this.isDeleting = true;
    this.api.deleteReview(this.reviewToDelete._id).subscribe({
      next: () => {
        this.reviews = this.reviews.filter(r => r._id !== this.reviewToDelete?._id);
        this.totalItems--;
        this.api.showToast('Đã xóa đánh giá thành công', 'success');
        
        // Cập nhật lại thống kê sau khi xóa đánh giá
        this.loadStats();
        
        this.closeDeleteModal();
        
        if (this.reviews.length === 0 && this.currentPage > 1) {
          this.currentPage--;
          this.loadReviews();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi xóa:', err);
        this.api.showToast(err.error?.error || 'Không thể xóa đánh giá', 'error');
        this.isDeleting = false;
      }
    });
  }

  getStarRating(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN');
    } catch {
      return dateStr;
    }
  }

  getProductImage(product: any): string {
    if (product?.images && product.images.length > 0) {
      const img = product.images[0];
      return img.startsWith('http') ? img : `http://localhost:3000${img}`;
    }
    return '/assets/images/placeholder.png';
  }

  getProductName(product: any): string {
    return product?.name || 'Sản phẩm không xác định';
  }

  getProductId(product: any): string {
    return product?._id || '';
  }

  goToProduct(productId: string): void {
    if (productId) {
      this.router.navigate(['/admin/san-pham'], { queryParams: { id: productId } });
    }
  }
}