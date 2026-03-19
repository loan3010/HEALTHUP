import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService, STATIC_BASE } from '../services/api.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './order-details.html',
  styleUrls: ['./order-details.css']
})
export class OrderDetail implements OnInit {

  order: any = null;
  orders: any[] = [];        // danh sách đơn hàng cho sidebar
  loading = true;
  currentId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.currentId = params.get('id') || '';
      if (this.currentId) {
        this.loading = true;
        this.loadOrder(this.currentId);
      }
    });
    this.loadOrders();
  }

  loadOrder(id: string) {
    this.api.getOrderById(id).subscribe({
      next: (res: any) => {
        this.order = res;
        this.loading = false;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi load order:', err);
        this.loading = false;
        this.cd.detectChanges();
      }
    });
  }

  loadOrders() {
    // ✅ Chỉ lấy đơn hàng của user đang đăng nhập
    const userId = localStorage.getItem('userId') || '';
    this.api.getOrders(userId).subscribe({
      next: (res: any) => {
        this.orders = res || [];
        this.cd.detectChanges();
      },
      error: () => {}
    });
  }

  goToOrder(id: string) {
    this.router.navigate(['/order-detail', id]);
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  getTotal(): number {
    return this.order?.total || this.order?.items?.reduce(
      (s: number, i: any) => s + i.price * i.quantity, 0
    ) || 0;
  }

  getFullAddress(): string {
    const c = this.order?.customer;
    if (!c) return '';
    return [c.address, c.ward, c.district, c.province]
      .filter(Boolean).join(', ');
  }

  fixImage(url: string): string {
    if (!url) return '';
    return url.startsWith('http') ? url : `${STATIC_BASE}${url}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending:         'Chờ xác nhận',
      confirmed:       'Chờ giao hàng',
      delivered:       'Đã giao',
      cancelled:       'Đã hủy',
      pending_payment: 'Chờ thanh toán',
      paid:            'Đã thanh toán',
    };
    return map[status] || status;
  }

  getPaymentLabel(method: string): string {
    const map: Record<string, string> = {
      cod:    'Thanh toán khi nhận hàng (COD)',
      vnpay:  'VNPay',
      momo:   'MoMo',
      bank:   'Chuyển khoản',
    };
    return map[method] || method;
  }

  getShippingLabel(method: string): string {
    const map: Record<string, string> = {
      standard: 'Giao hàng tiêu chuẩn',
      express:  'Giao hàng nhanh',
    };
    return map[method] || method;
  }
}