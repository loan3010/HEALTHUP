import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminOrder, AdminOrderService } from '../order/order.service';

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

  setReturnStatus(nextReturnStatus: 'requested' | 'completed'): void {
    if (!this.order || this.actionLoading) return;
    this.actionLoading = true;
    this.orderService.updateReturnStatus(this.order._id, nextReturnStatus).subscribe({
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

  get itemCount(): number {
    return (this.order?.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  }

  canConfirm(): boolean { return this.order?.status === 'pending'; }
  canStartShipping(): boolean { return this.order?.status === 'confirmed'; }
  canDeliver(): boolean { return this.order?.status === 'shipping'; }
  canCancel(): boolean { return this.order?.status === 'pending'; }
  canRequestReturn(): boolean {
    return this.order?.status === 'delivered' && this.order?.returnStatus === 'none';
  }
  canCompleteReturn(): boolean {
    return this.order?.status === 'delivered' && this.order?.returnStatus === 'requested';
  }

}
