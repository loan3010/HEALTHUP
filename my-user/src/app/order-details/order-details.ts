import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';  // ✅ thêm Location
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

  order: any    = null;
  orders: any[] = [];
  loading       = true;
  currentId     = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private location: Location  // ✅ thêm
  ) {}

  ngOnInit(): void {
    this.loadOrders();
    this.route.paramMap.subscribe(params => {
      const id = params.get('id') || '';
      if (id && id !== this.currentId) {
        this.currentId = id;
        this.loading   = true;
        this.order     = null;
        this.cdr.detectChanges();
        this.loadOrder(id);
      }
    });
  }

  // ✅ Quay lại trang trước
  goBack(): void {
    this.location.back();
  }

  private getUserId(): string {
    const direct = localStorage.getItem('userId');
    if (direct) return direct;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?.id || user?._id || '';
    } catch { return ''; }
  }

  loadOrder(id: string): void {
    this.api.getOrderById(id).subscribe({
      next: (res: any) => {
        this.order   = res;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadOrders(): void {
    const userId = this.getUserId();
    this.api.getOrders(userId).subscribe({
      next: (res: any) => {
        this.orders = Array.isArray(res) ? res : [];
        this.cdr.detectChanges();
      },
      error: () => { this.orders = []; }
    });
  }

  goToOrder(id: string): void {
    this.router.navigate(['/profile/order-detail', id]);
  }

  getTotal(): number {
    return this.order?.total
      || this.order?.items?.reduce((s: number, i: any) => s + i.price * i.quantity, 0)
      || 0;
  }

  getFullAddress(): string {
    const c = this.order?.customer;
    if (!c) return '';
    const parts = [c.address, c.ward, c.district, c.province]
      .map((p) => (p == null ? '' : String(p).trim()))
      .filter((p) => p.length > 0 && !/^n\/a$/i.test(p));
    return parts.join(', ');
  }

  fixImage(url: string): string {
    if (!url) return 'assets/placeholder.png';
    return url.startsWith('http') ? url : `${STATIC_BASE}${url}`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending:         'Chờ xác nhận',
      confirmed:       'Chờ giao hàng',
      shipping:        'Đang giao',
      delivered:       'Đã giao',
      cancelled:       'Đã hủy',
      pending_payment: 'Chờ thanh toán',
      paid:            'Đã thanh toán',
    };
    return map[status] || status;
  }

  getPaymentLabel(method: string): string {
    const map: Record<string, string> = {
      cod:   'Thanh toán khi nhận hàng (COD)',
      vnpay: 'VNPay', momo: 'MoMo', bank: 'Chuyển khoản',
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

  getReturnImages(order: any): string[] {
    const arr = order?.returnImages;
    if (!Array.isArray(arr)) return [];
    return arr.map((u: any) => String(u || '').trim()).filter(Boolean);
  }

  getReturnLines(order: any): any[] {
    const rows = order?.returnItems;
    if (!Array.isArray(rows)) return [];
    return rows.filter((r: any) => Number(r?.returnQty ?? 0) > 0);
  }

  returnRequestGoodsTotal(order: any): number {
    return this.getReturnLines(order).reduce(
      (s: number, r: any) => s + Number(r.price || 0) * Number(r.returnQty || 0),
      0
    );
  }

  getReturnStatusLabel(rs: string): string {
    const map: Record<string, string> = {
      requested: 'Đang chờ shop xử lý',
      approved:  'Shop đã chấp nhận hoàn',
      rejected:  'Yêu cầu bị từ chối',
      completed: 'Đã hoàn tiền / trả xong',
    };
    return map[rs] || rs;
  }
}