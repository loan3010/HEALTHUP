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
}
