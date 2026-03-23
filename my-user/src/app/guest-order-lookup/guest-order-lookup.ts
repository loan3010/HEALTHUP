import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService, STATIC_BASE } from '../services/api.service';

/** Dòng chọn số lượng trả (giống return-management). */
interface RetLine {
  productId: string;
  name: string;
  imageUrl: string;
  price: number;
  quantity: number;
  returnQty: number;
}

@Component({
  selector: 'app-guest-order-lookup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './guest-order-lookup.html',
  styleUrls: ['./guest-order-lookup.css'],
})
export class GuestOrderLookup implements OnInit {
  phone = '';
  orderCode = '';
  loading = false;
  errorMsg = '';
  order: any = null;

  returnReason = '';
  returnNote = '';
  returnLines: RetLine[] = [];
  selectedImages: File[] = [];
  imagePreviews: string[] = [];
  readonly MAX_IMAGES = 5;
  isSubmitting = false;
  submitOkMsg = '';

  readonly REASONS = [
    'Sản phẩm bị lỗi / hư hỏng',
    'Sản phẩm không đúng mô tả',
    'Giao sai sản phẩm',
    'Sản phẩm hết hạn sử dụng',
    'Không hài lòng với chất lượng',
    'Khác',
  ];

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  /** Đã tự tra cứu một lần từ URL (mở từ modal header: phone + code). */
  private autoLookupFromQueryDone = false;

  ngOnInit(): void {
    this.route.queryParams.subscribe((p) => {
      const c = p['code'];
      const ph = p['phone'];
      if (c && typeof c === 'string') {
        this.orderCode = c.trim();
      }
      if (ph && typeof ph === 'string') {
        this.phone = ph.trim();
      }
      this.cdr.detectChanges();

      const pOk = /^0\d{9}$/.test(String(this.phone || '').trim());
      const cOk = /^ORD\d{11}$/i.test(String(this.orderCode || '').trim());
      if (pOk && cOk && !this.autoLookupFromQueryDone && !this.order) {
        this.autoLookupFromQueryDone = true;
        this.lookup();
      }
    });
  }

  lookup(): void {
    this.errorMsg = '';
    this.order = null;
    this.submitOkMsg = '';
    const p = this.phone.trim();
    const c = this.orderCode.trim().toUpperCase();
    if (!/^0\d{9}$/.test(p)) {
      this.errorMsg = 'Số điện thoại không hợp lệ (10 số, bắt đầu 0).';
      return;
    }
    if (!/^ORD\d{11}$/i.test(c)) {
      this.errorMsg = 'Mã đơn không hợp lệ (VD: ORD00000000001).';
      return;
    }

    this.loading = true;
    this.api.guestLookupOrder(p, c).subscribe({
      next: (res) => {
        this.order = res.order;
        this.buildReturnLines();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Không tìm thấy đơn hàng.';
        this.cdr.detectChanges();
      },
    });
  }

  private lineProductId(item: any): string {
    const x = item?.productId;
    if (x && typeof x === 'object' && x._id != null) return String(x._id);
    return String(x ?? '');
  }

  /** Public: template dùng cho ảnh dòng đơn (populate). */
  orderLineImageRaw(item: any): string {
    const direct = item?.imageUrl;
    if (direct != null && String(direct).trim()) return String(direct).trim();
    const pop = item?.productId;
    if (pop && typeof pop === 'object' && Array.isArray(pop.images) && pop.images[0]) {
      return String(pop.images[0]).trim();
    }
    return '';
  }

  buildReturnLines(): void {
    if (!this.order?.items) {
      this.returnLines = [];
      return;
    }
    this.returnLines = (this.order.items || []).map((item: any) => ({
      productId: this.lineProductId(item),
      name: item.name,
      imageUrl: this.orderLineImageRaw(item),
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 0),
      returnQty: Number(item.quantity || 0),
    }));
  }

  decRet(i: RetLine): void {
    if (i.returnQty > 0) i.returnQty--;
  }
  incRet(i: RetLine): void {
    if (i.returnQty < i.quantity) i.returnQty++;
  }

  getImageUrl(url: string): string {
    if (!url) return '/assets/images/placeholder.png';
    const u = String(url).trim();
    if (u.startsWith('http') || u.startsWith('data:')) return u;
    return `${STATIC_BASE}${u.startsWith('/') ? u : '/' + u}`;
  }

  canShowReturnForm(): boolean {
    return (
      this.order &&
      this.order.status === 'delivered' &&
      (!this.order.returnStatus || this.order.returnStatus === 'none')
    );
  }

  canSubmitReturn(): boolean {
    return (
      !!this.returnReason &&
      this.returnLines.some((x) => x.returnQty > 0) &&
      !this.isSubmitting
    );
  }

  onImagesSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (!input.files?.length) return;
    const left = this.MAX_IMAGES - this.selectedImages.length;
    const add = Array.from(input.files).slice(0, left);
    add.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 5 * 1024 * 1024) return;
      this.selectedImages.push(file);
      const r = new FileReader();
      r.onload = (e) => {
        this.imagePreviews.push(e.target?.result as string);
        this.cdr.detectChanges();
      };
      r.readAsDataURL(file);
    });
    input.value = '';
  }

  removeImg(i: number): void {
    this.selectedImages.splice(i, 1);
    this.imagePreviews.splice(i, 1);
  }

  submitReturn(): void {
    if (!this.canSubmitReturn() || !this.order?._id) return;
    this.isSubmitting = true;
    this.errorMsg = '';
    const items = this.returnLines.filter((x) => x.returnQty > 0);
    this.api
      .guestRequestReturn(String(this.order._id), {
        phone: this.phone.trim(),
        orderCode: this.orderCode.trim().toUpperCase(),
        reason: this.returnReason,
        note: this.returnNote,
        items,
        images: this.selectedImages,
      })
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.submitOkMsg = 'Đã gửi yêu cầu đổi trả. Shop sẽ xử lý và liên hệ bạn.';
          if (this.order) this.order.returnStatus = 'requested';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMsg = err?.error?.message || 'Gửi thất bại. Thử lại.';
          this.cdr.detectChanges();
        },
      });
  }

  formatMoney(n: number): string {
    return new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ';
  }

  statusLabel(s: string): string {
    const m: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Chờ giao',
      shipping: 'Đang giao',
      delivery_failed: 'Giao thất bại',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy',
    };
    return m[s] || s;
  }
}
