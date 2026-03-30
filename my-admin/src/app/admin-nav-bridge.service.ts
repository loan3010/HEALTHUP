import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Điều hướng giữa các tab trong AdminLayout (không dùng router con).
 * Header thông báo gọi goToOrder / goToProduct; Order/Product subscribe.
 */
@Injectable({ providedIn: 'root' })
export class AdminNavBridgeService {
  /** Đổi tab sidebar + nội dung (chuỗi khớp admin-layout ngSwitch). */
  readonly switchTab$ = new Subject<string>();
  /** Mở chi tiết đơn — delay nhỏ để Order component kịp mount sau khi đổi tab. */
  readonly openOrderDetail$ = new Subject<string>();
  /** Mở form sản phẩm theo id. */
  readonly openProductEditor$ = new Subject<string>();
  /** Mở tab Tư vấn → chi tiết câu hỏi theo productId. */
  readonly openConsultingProduct$ = new Subject<string>();
  /** Mở tab Đánh giá → lọc/highlight theo reviewId hoặc sản phẩm. */
  readonly openReviewFocus$ = new Subject<{
    productId: string;
    reviewId: string | null;
  }>();

  goToOrder(orderId: string): void {
    const id = String(orderId || '').trim();
    if (!id) return;
    this.switchTab$.next('don-hang');
    setTimeout(() => this.openOrderDetail$.next(id), 120);
  }

  goToProduct(productId: string): void {
    const id = String(productId || '').trim();
    if (!id) return;
    this.switchTab$.next('san-pham');
    setTimeout(() => this.openProductEditor$.next(id), 120);
  }

  goToConsulting(productId: string): void {
    const id = String(productId || '').trim();
    if (!id) return;
    this.switchTab$.next('tu-van');
    setTimeout(() => this.openConsultingProduct$.next(id), 120);
  }

  /** Chuông thông báo: đánh giá mới — vào màn Quản lý đánh giá (có thể mở modal phản hồi). */
  goToReview(productId: string, reviewId: string | null | undefined): void {
    const pid = String(productId || '').trim();
    const rid = reviewId ? String(reviewId).trim() : '';
    if (!pid && !rid) return;
    this.switchTab$.next('danh-gia');
    setTimeout(
      () => this.openReviewFocus$.next({ productId: pid, reviewId: rid || null }),
      120
    );
  }
}
