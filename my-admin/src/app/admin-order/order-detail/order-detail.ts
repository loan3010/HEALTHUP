import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { STATIC_BASE } from '../../services/api.service';
import {
  AdminOrder,
  AdminOrderService,
  AdminReturnLine,
  AdminReturnStatus,
} from '../order/order.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.css',
})
export class OrderDetail implements OnChanges {
  @Input() orderId = '';
  @Output() back = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  order: AdminOrder | null = null;
  isLoading = false;
  errorMsg = '';
  actionLoading = false;

  constructor(private orderService: AdminOrderService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderId'] && this.orderId) {
      this.loadDetail();
    }
  }

  loadDetail(): void {
    this.isLoading = true;
    this.errorMsg = '';
    this.orderService.getById(this.orderId).subscribe({
      next: (res) => {
        this.order = res;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || 'Không thể tải chi tiết đơn hàng';
        this.isLoading = false;
      }
    });
  }

  setStatus(nextStatus: 'confirmed' | 'shipping' | 'delivered' | 'cancelled'): void {
    if (!this.order || this.actionLoading) return;
    this.actionLoading = true;
    this.orderService.updateStatus(this.order._id, nextStatus).subscribe({
      next: (res) => {
        this.order = res;
        this.actionLoading = false;
        this.updated.emit();
        alert(nextStatus === 'confirmed' ? 'Đơn hàng đã được xác nhận!' : 'Cập nhật trạng thái thành công!');
      },
      error: (err) => {
        this.actionLoading = false;
        alert(err?.error?.message || 'Không thể cập nhật trạng thái');
      }
    });
  }

  /**
   * Admin chỉ chuyển: requested→approved|rejected, approved→completed.
   * Bước requested chỉ do khách gửi qua API request-return.
   */
  setReturnStatus(nextReturnStatus: AdminReturnStatus): void {
    if (!this.order || this.actionLoading) return;
    let returnReason = '';
    let returnRejectionReason = '';
    if (nextReturnStatus === 'rejected') {
      const r = window.prompt('Lý do từ chối yêu cầu hoàn:', '');
      if (r === null) return;
      returnRejectionReason = r;
    }
    this.actionLoading = true;
    this.orderService
      .updateReturnStatus(this.order._id, nextReturnStatus, '', returnReason, returnRejectionReason)
      .subscribe({
        next: (res) => {
          this.order = res;
          this.actionLoading = false;
          this.updated.emit();
          alert('Cập nhật trả hàng/hoàn tiền thành công!');
        },
        error: (err) => {
          this.actionLoading = false;
          alert(err?.error?.message || 'Không thể cập nhật trạng thái trả hàng/hoàn tiền');
        }
      });
  }

  get statusLabel(): string {
    const map: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Chờ giao hàng',
      shipping: 'Đang giao',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy'
    };
    return map[this.order?.status || ''] || (this.order?.status || '');
  }

  paymentLabel(m: string): string {
    const map: Record<string, string> = { cod: 'COD', momo: 'MoMo', vnpay: 'VNPay' };
    return map[m] || m;
  }

  getTierClass(tier: string): string {
    const map: Record<string, string> = {
      'Đồng': 'tier-dong',
      'Bạc': 'tier-bac',
      'Vàng': 'tier-vang',
      'Kim Cương': 'tier-kim'
    };
    return map[tier] || 'tier-dong';
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value || 0) + 'đ';
  }

  /**
   * Ghép địa chỉ giao: bỏ phần rỗng và chữ "N/A" (đơn cũ / placeholder).
   */
  formatShipmentAddress(c: AdminOrder['customer'] | null | undefined): string {
    if (!c) return '—';
    const parts = [c.address, c.ward, c.district, c.province].map((p) =>
      p == null ? '' : String(p).trim()
    );
    const kept = parts.filter((p) => p.length > 0 && !/^n\/a$/i.test(p));
    return kept.length ? kept.join(', ') : '—';
  }

  get itemCount(): number {
    return (this.order?.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  }

  canConfirm(): boolean { return this.order?.status === 'pending'; }
  canStartShipping(): boolean { return this.order?.status === 'confirmed'; }
  canDeliver(): boolean { return this.order?.status === 'shipping'; }
  canCancel(): boolean { return this.order?.status === 'pending'; }
  /** Shop chấp nhận xử lý hoàn (sau khi khách đã yêu cầu). */
  canApproveReturn(): boolean {
    return this.order?.status === 'delivered' && this.order?.returnStatus === 'requested';
  }
  canRejectReturn(): boolean {
    return this.order?.status === 'delivered' && this.order?.returnStatus === 'requested';
  }
  /** Đã nhận hàng trả & hoàn tiền — chỉ sau khi đã chấp nhận (approved). */
  canCompleteReturn(): boolean {
    return this.order?.status === 'delivered' && this.order?.returnStatus === 'approved';
  }

  /** Nhãn hiển thị cột trả/hoàn + khối chi tiết. */
  returnFlowLabel(rs: string | undefined): string {
    const map: Record<string, string> = {
      none: 'Không',
      requested: 'Yêu cầu hoàn/trả',
      approved: 'Đã chấp nhận hoàn',
      rejected: 'Từ chối hoàn',
      completed: 'Đã hoàn tiền / trả xong',
    };
    return map[rs || 'none'] || (rs || '');
  }

  /** Lọc URL ảnh hoàn hàng hợp lệ (tránh null/empty). */
  returnProofImages(o: AdminOrder | null): string[] {
    const arr = o?.returnImages;
    if (!Array.isArray(arr)) return [];
    return arr.map((u) => String(u || '').trim()).filter(Boolean);
  }

  /**
   * URL đầy đủ để <img> tải được file tĩnh trên backend.
   * Phải giống logic getImageUrl (return-management): nếu thiếu "/" đầu path
   * mà nối trực tiếp origin sẽ thành http://localhost:3000images/... → ảnh vỡ.
   */
  returnProofUrl(raw: string): string {
    if (raw == null || !String(raw).trim()) return 'assets/no-image.png';
    let u = String(raw).trim().replace(/\\/g, '/');
    if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u;
    const path = u.startsWith('/') ? u : `/${u}`;
    return `${STATIC_BASE}${path}`;
  }

  /** Ảnh 404 hoặc sai đường dẫn — đổi sang placeholder, tránh vòng lặp onerror. */
  onReturnProofImgError(ev: Event): void {
    const el = ev.target as HTMLImageElement;
    const fallback = 'assets/no-image.png';
    if (el && !el.src.endsWith(fallback)) {
      el.src = fallback;
      el.onerror = null;
    }
  }

  /**
   * Dòng yêu cầu trả có số lượng > 0 (API lưu từ form khách — có thể chỉ 2/3 SP).
   */
  returnLinesWithQty(o: AdminOrder | null): AdminReturnLine[] {
    const rows = o?.returnItems;
    if (!Array.isArray(rows)) return [];
    return rows.filter((r) => Number(r?.returnQty ?? 0) > 0);
  }

  /** Tiền hàng tương ứng phần trả (đơn giá × SL trả), chưa gồm ship. */
  returnRequestGoodsTotal(o: AdminOrder | null): number {
    return this.returnLinesWithQty(o).reduce(
      (s, r) => s + Number(r.price || 0) * Number(r.returnQty || 0),
      0
    );
  }

}
