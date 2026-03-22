import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ApiService } from '../services/api.service';

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
          productId: item.productId,
          name:      item.name,
          imageUrl:  item.imageUrl || '',
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
      productId: item.productId,
      name:      item.name,
      imageUrl:  item.imageUrl || '',
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
  getReturnStatusLabel(status: string): string {
    const map: Record<string, string> = {
      requested: 'Chờ xử lý',
      completed: 'Hoàn thành',
    };
    return map[status] || status;
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

  getImageUrl(url: string): string {
    if (!url) return '/assets/images/placeholder.png';
    return url.startsWith('http') ? url : `http://localhost:3000${url}`;
  }

  goToOrders(): void { this.router.navigate(['/profile/order-management']); }
}