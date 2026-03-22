import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ApiService, STATIC_BASE } from '../services/api.service';

export interface ReturnItem {
  productId: string;
  name: string;
  imageUrl: string;
  price: number;
  quantity: number;
  returnQty: number;
}

@Component({
  selector: 'app-return-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './return-management.html',
  styleUrls: ['./return-management.css']
})
export class ReturnManagement implements OnInit {

  // ── View ──────────────────────────────────────────────────────────────────
  view: 'list' | 'create' = 'list';

  // ── List ──────────────────────────────────────────────────────────────────
  returnOrders: any[] = [];
  isLoading = true;

  // ── Create form ───────────────────────────────────────────────────────────
  deliveredOrders: any[] = [];
  selectedOrder: any = null;
  returnItems: ReturnItem[] = [];
  returnReason = '';
  returnNote = '';
  isSubmitting = false;

  // ✅ MỚI: Ảnh minh chứng
  selectedImages: File[] = [];
  imagePreviews: string[] = [];
  readonly MAX_IMAGES = 5;

  /**
   * SVG inline: không phụ thuộc file /assets (trước đây dùng placeholder.png không tồn tại → ô trắng).
   */
  readonly imgFallback =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">' +
        '<rect fill="#EAF4DF" width="80" height="80" rx="12"/>' +
        '<path fill="#9AB882" d="M22 54l9-11 7 9 13-16 9 18H22z"/>' +
        '<circle fill="#9AB882" cx="29" cy="28" r="4.5"/>' +
      '</svg>'
    );

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
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.loadOrders(() => {
        if (params['orderId']) {
          const found = this.deliveredOrders.find(o => o._id === params['orderId']);
          if (found) this.openCreateForm(found);
        }
      });
    });
  }

  private getUserId(): string {
    const direct = localStorage.getItem('userId');
    if (direct) return direct;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?._id || user?.id || '';
    } catch { return ''; }
  }

  loadOrders(cb?: () => void): void {
    this.isLoading = true;
    const userId = this.getUserId();
    if (!userId) { this.isLoading = false; return; }

    this.api.getOrders(userId).subscribe({
      next: (res: any) => {
        const all: any[] = Array.isArray(res) ? res : [];

        this.returnOrders = all.filter(
          o => o.status === 'delivered' && o.returnStatus && o.returnStatus !== 'none'
        );

        this.deliveredOrders = all.filter(
          o => o.status === 'delivered' && (!o.returnStatus || o.returnStatus === 'none')
        );

        this.isLoading = false;
        this.cdr.detectChanges();
        if (cb) cb();
      },
      error: () => { this.isLoading = false; this.cdr.detectChanges(); }
    });
  }

  openCreateForm(order?: any): void {
    this.selectedOrder = order || null;
    this.returnReason  = '';
    this.returnNote    = '';
    this.selectedImages = [];
    this.imagePreviews  = [];
    this.returnItems = order
      ? (order.items || []).map((item: any) => ({
          productId: this.lineProductId(item),
          name:      item.name,
          imageUrl:  this.orderLineImageRaw(item),
          price:     item.price,
          quantity:  item.quantity,
          returnQty: item.quantity,
        }))
      : [];
    this.view = 'create';
    this.cdr.detectChanges();
  }

  onOrderSelect(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const order = this.deliveredOrders.find(o => o._id === id);
    if (!order) return;
    this.selectedOrder = order;
    this.returnItems = (order.items || []).map((item: any) => ({
      productId: this.lineProductId(item),
      name:      item.name,
      imageUrl:  this.orderLineImageRaw(item),
      price:     item.price,
      quantity:  item.quantity,
      returnQty: item.quantity,
    }));
    this.cdr.detectChanges();
  }

  decreaseReturnQty(item: ReturnItem): void { if (item.returnQty > 0) item.returnQty--; }
  increaseReturnQty(item: ReturnItem): void { if (item.returnQty < item.quantity) item.returnQty++; }

  get returnTotal(): number {
    return this.returnItems.reduce((sum, i) => sum + i.price * i.returnQty, 0);
  }

  get canSubmit(): boolean {
    return !!this.selectedOrder
      && !!this.returnReason
      && this.returnItems.some(i => i.returnQty > 0);
  }

  // ✅ MỚI: Xử lý chọn ảnh
  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    const files = Array.from(input.files);
    const remaining = this.MAX_IMAGES - this.selectedImages.length;

    if (files.length > remaining) {
      this.api.showToast(`Chỉ được upload tối đa ${this.MAX_IMAGES} ảnh`, 'error');
    }

    const toAdd = files.slice(0, remaining);
    toAdd.forEach(file => {
      // Chỉ nhận ảnh
      if (!file.type.startsWith('image/')) return;
      // Giới hạn 5MB mỗi ảnh
      if (file.size > 5 * 1024 * 1024) {
        this.api.showToast(`Ảnh "${file.name}" vượt quá 5MB`, 'error');
        return;
      }
      this.selectedImages.push(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreviews.push(e.target?.result as string);
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    });

    // Reset input để có thể chọn lại cùng file
    input.value = '';
    this.cdr.detectChanges();
  }

  // ✅ MỚI: Xóa ảnh đã chọn
  removeImage(index: number): void {
    this.selectedImages.splice(index, 1);
    this.imagePreviews.splice(index, 1);
    this.cdr.detectChanges();
  }

  submitReturn(): void {
    if (!this.canSubmit || this.isSubmitting) return;
    this.isSubmitting = true;

    this.api.requestReturn(this.selectedOrder._id, {
      reason: this.returnReason,
      note:   this.returnNote,
      items:  this.returnItems.filter(i => i.returnQty > 0),
      images: this.selectedImages,   // ✅ truyền ảnh
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.api.showToast('Yêu cầu đổi trả đã được gửi! Admin sẽ xử lý sớm nhất.', 'success');
        this.loadOrders();
        this.view = 'list';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        const msg = err?.error?.message || 'Không thể gửi yêu cầu. Vui lòng thử lại.';
        this.api.showToast(msg, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  cancelCreate(): void {
    this.view = 'list';
    this.selectedOrder  = null;
    this.returnItems    = [];
    this.selectedImages = [];
    this.imagePreviews  = [];
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  /**
   * Đồng bộ tiếng Việt cho mọi returnStatus (tránh hiện raw: approved, rejected…).
   * none = đơn chưa có yêu cầu trả/hoàn (thường không lọt vào danh sách thẻ đổi trả).
   */
  getReturnStatusLabel(status: string): string {
    const map: Record<string, string> = {
      none:      'Chưa yêu cầu hoàn',
      requested: 'Chờ xử lý',
      approved:  'Đã chấp nhận hoàn',
      rejected:  'Từ chối hoàn',
      completed: 'Hoàn thành',
    };
    const key = String(status || '').trim();
    return map[key] || key || '—';
  }

  formatCurrency(price: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  /**
   * Chuỗi URL ảnh đầy đủ: hỗ trợ path tương đối từ API, tránh double-slash.
   */
  getImageUrl(url: string | null | undefined): string {
    if (url == null || !String(url).trim()) return this.imgFallback;
    const u = String(url).trim();
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
    const path = u.startsWith('/') ? u : `/${u}`;
    return `${STATIC_BASE}${path}`;
  }

  /** id sản phẩm trên dòng đơn (populate hoặc ObjectId). */
  lineProductId(item: any): string {
    const p = item?.productId;
    if (p && typeof p === 'object' && p._id != null) return String(p._id);
    return String(p ?? '');
  }

  /** Ảnh gốc trên dòng đơn: imageUrl lưu trong đơn hoặc ảnh đầu từ Product populate. */
  orderLineImageRaw(item: any): string {
    const direct = item?.imageUrl;
    if (direct != null && String(direct).trim()) return String(direct).trim();
    const pop = item?.productId;
    if (pop && typeof pop === 'object' && Array.isArray(pop.images) && pop.images[0]) {
      return String(pop.images[0]).trim();
    }
    return '';
  }

  /**
   * Ảnh dòng trong thẻ yêu cầu trả: returnItems có thể thiếu imageUrl — lấy từ đơn gốc.
   */
  returnItemImageUrl(order: any, retItem: any): string {
    const fromRet = retItem?.imageUrl;
    if (fromRet != null && String(fromRet).trim()) return String(fromRet).trim();
    const pid = String(retItem?.productId ?? '');
    const lines = order?.items || [];
    const line = lines.find((i: any) => this.lineProductId(i) === pid);
    return line ? this.orderLineImageRaw(line) : '';
  }

  /** Lọc URL rỗng để không render <img src="">. */
  visibleReturnImages(order: any): string[] {
    return (order?.returnImages || []).filter((u: any) => u != null && String(u).trim());
  }

  /** Khi ảnh remote lỗi — tránh lặp onerror. */
  onImgError(ev: Event): void {
    const el = ev.target as HTMLImageElement;
    if (el && el.src !== this.imgFallback) {
      el.src = this.imgFallback;
      el.onerror = null;
    }
  }

  goToOrders(): void { this.router.navigate(['/profile/order-management']); }
}