import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService, STATIC_BASE } from '../services/api.service';

/** Dòng chọn số lượng trả */
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
  /** Mã tra cứu SMS — HU-XXXXXX */
  lookupCode = '';
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
  showConfirmSubmit = false;
  submitOkMsg = '';

  showCancelConfirm = false;
  isCancelling = false;

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

  private autoLookupFromQueryDone = false;

  /**
   * Khi tra cứu bằng SĐT + ORD (link cũ): lưu SĐT để gửi đổi trả đúng nhánh API.
   * Đơn có guestLookupCode thì luôn null.
   */
  private verifiedLegacyPhone: string | null = null;

  ngOnInit(): void {
    this.route.queryParams.subscribe((p) => {
      const c = p['code'];
      const ph = p['phone'];
      if (c && typeof c === 'string') {
        this.lookupCode = c.trim();
      }
      this.cdr.detectChanges();

      if (this.autoLookupFromQueryDone || this.order) return;

      const normHu = this.normalizeLookupInput(this.lookupCode);
      const rawC = String(this.lookupCode || '').replace(/\s/g, '').toUpperCase();
      const phOk = typeof ph === 'string' && /^0\d{9}$/.test(ph.trim());
      const ordOk = /^ORD\d{11}$/.test(rawC);

      if (normHu) {
        this.autoLookupFromQueryDone = true;
        this.lookup();
      } else if (ordOk && phOk) {
        // Link cũ từ header (?phone=&code=ORD...) — vẫn tra được một lần
        this.autoLookupFromQueryDone = true;
        this.lookupLegacyPhoneOrd(ph.trim(), rawC);
      }
    });
  }

  /** Đồng bộ quy tắc với backend normalizeGuestLookupCode */
  private normalizeLookupInput(raw: string): string {
    const s = String(raw || '').replace(/\s/g, '').toUpperCase();
    if (!s) return '';
    if (/^HU-[A-Z0-9]{6}$/.test(s)) return s;
    if (/^HU[A-Z0-9]{6}$/.test(s)) return `HU-${s.slice(2)}`;
    return '';
  }

  lookup(): void {
    this.errorMsg = '';
    this.order = null;
    this.submitOkMsg = '';

    const normHu = this.normalizeLookupInput(this.lookupCode);
    if (normHu) {
      this.runGuestLookup({ guestLookupCode: normHu });
      return;
    }

    const raw = String(this.lookupCode || '').replace(/\s/g, '').toUpperCase();
    if (/^ORD\d{11}$/.test(raw)) {
      this.errorMsg =
        'Mã ORD dài chỉ dùng kèm link có sẵn SĐT. Vui lòng tra cứu bằng mã HU-… trong SMS, hoặc đăng nhập để xem đơn.';
      return;
    }

    this.errorMsg = 'Vui lòng nhập mã tra cứu (VD: HU-7K9M2P trong tin nhắn SMS).';
  }

  /** Đơn cũ: API yêu c chỉ kèm SĐT (từ query, không hiện form ORD trên UI). */
  private lookupLegacyPhoneOrd(phone: string, orderCode: string): void {
    this.errorMsg = '';
    this.order = null;
    this.submitOkMsg = '';
    this.runGuestLookup({ phone, orderCode });
  }

  private runGuestLookup(payload: {
    guestLookupCode?: string;
    phone?: string;
    orderCode?: string;
  }): void {
    this.loading = true;
    this.api.guestLookupOrder(payload).subscribe({
      next: (res) => {
        this.order = res.order;
        if (payload.phone && payload.orderCode) {
          this.verifiedLegacyPhone = String(payload.phone).trim();
        } else {
          this.verifiedLegacyPhone = null;
        }
        this.buildReturnLines();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg =
          err?.error?.message ||
          'Mã tra cứu không chính xác hoặc đơn hàng không tồn tại.';
        this.cdr.detectChanges();
      },
    });
  }

  openCancelModal(): void {
    this.showCancelConfirm = true;
  }

  closeCancelModal(): void {
    this.showCancelConfirm = false;
  }

  confirmCancelOrder(): void {
    if (!this.order?._id || this.isCancelling) return;
    const glc = this.normalizeLookupInput(this.lookupCode);
    const huOnOrder = String(this.order.guestLookupCode || '').trim();
    if (huOnOrder) {
      if (!glc || glc !== huOnOrder.toUpperCase()) {
        this.errorMsg = 'Mã tra cứu trong ô nhập phải trùng mã SMS để hủy đơn.';
        return;
      }
    }

    this.isCancelling = true;
    this.errorMsg = '';

    const cancelOpts = huOnOrder && glc ? { guestLookupCode: glc } : undefined;
    this.api.cancelOrder(this.order._id, cancelOpts).subscribe({
      next: () => {
        this.isCancelling = false;
        this.showCancelConfirm = false;
        this.order.status = 'cancelled';
        this.api.showToast('Đã hủy đơn hàng thành công!', 'info');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isCancelling = false;
        this.errorMsg =
          err?.error?.message ||
          'Không thể hủy đơn hàng lúc này. Vui lòng liên hệ hotline để được hỗ trợ.';
        this.cdr.detectChanges();
      },
    });
  }

  private lineProductId(item: any): string {
    const x = item?.productId;
    if (x && typeof x === 'object' && x._id != null) return String(x._id);
    return String(x ?? '');
  }

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
    if (this.showConfirmSubmit) return;
    this.showConfirmSubmit = true;
  }

  cancelSubmitReturnConfirm(): void {
    this.showConfirmSubmit = false;
  }

  confirmSubmitReturn(): void {
    if (this.isSubmitting) return;
    if (!this.order?._id) return;

    const glc = this.normalizeLookupInput(this.lookupCode);
    const huOnOrder = String(this.order.guestLookupCode || '').trim();
    const phone =
      this.verifiedLegacyPhone ||
      String(this.order?.customer?.phone || '').trim();
    const ord = String(this.order?.orderCode || '').trim().toUpperCase();

    if (huOnOrder) {
      if (!glc || glc !== huOnOrder.toUpperCase()) {
        this.errorMsg = 'Mã tra cứu không khớp — không thể gửi yêu cầu.';
        this.showConfirmSubmit = false;
        return;
      }
    } else {
      if (!/^0\d{9}$/.test(phone) || !/^ORD\d{11}$/.test(ord)) {
        this.errorMsg = 'Thiếu thông tin xác minh đơn cũ. Vui lòng mở lại link tra cứu có đủ SĐT + mã ORD.';
        this.showConfirmSubmit = false;
        return;
      }
    }

    this.showConfirmSubmit = false;
    this.isSubmitting = true;
    this.errorMsg = '';

    const items = this.returnLines.filter((x) => x.returnQty > 0);

    const returnBody: Parameters<ApiService['guestRequestReturn']>[1] = {
      phone,
      orderCode: ord,
      reason: this.returnReason,
      note: this.returnNote,
      items,
      images: this.selectedImages,
    };
    if (huOnOrder && glc) returnBody.guestLookupCode = glc;

    this.api
      .guestRequestReturn(String(this.order._id), returnBody)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.submitOkMsg =
            'Yêu cầu đổi trả của bạn đã được gửi thành công. HealthUp sẽ liên hệ với bạn sớm nhất có thể.';
          if (this.order) this.order.returnStatus = 'requested';
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMsg =
            err?.error?.message || 'Gửi yêu cầu thất bại. Vui lòng kiểm tra lại kết nối.';
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
      confirmed: 'Chờ giao hàng',
      shipping: 'Đang vận chuyển',
      delivery_failed: 'Giao hàng không thành công',
      delivered: 'Đã giao hàng thành công',
      cancelled: 'Đã hủy đơn',
    };
    return m[s] || s;
  }

  returnStatusLabel(rs: string): string {
    const m: Record<string, string> = {
      none: 'Không',
      requested: 'Đã gửi yêu cầu',
      approved: 'Đã chấp nhận hoàn',
      rejected: 'Từ chối hoàn',
      completed: 'Hoàn tất',
    };
    return m[rs] || rs;
  }

  cancelLookupActor(): string {
    const o = this.order;
    if (!o || o.status !== 'cancelled') return '';
    const by = String(o.cancelledByType || '').toLowerCase();
    if (by === 'customer') return 'Khách hàng';
    if (by === 'admin') return 'Cửa hàng / Admin';
    if (by === 'system') return 'Hệ thống';
    return 'Chưa ghi nhận (đơn cũ)';
  }

  cancelLookupTime(): string {
    const o = this.order;
    if (!o || o.status !== 'cancelled') return '';
    const raw = o.cancelledAt || o.updatedAt;
    if (!raw) return '';
    return new Date(raw).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  cancelLookupTimeIsEstimate(): boolean {
    const o = this.order;
    return !!(o && o.status === 'cancelled' && !o.cancelledAt && o.updatedAt);
  }
}
