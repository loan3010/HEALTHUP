import { Component, OnInit, ChangeDetectorRef, AfterViewInit, ElementRef, ViewChildren, QueryList } from '@angular/core';
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
export class ReturnManagement implements OnInit, AfterViewInit {

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
  showConfirmSubmit = false;

  // Ảnh minh chứng
  selectedImages: File[] = [];
  imagePreviews: string[] = [];
  readonly MAX_IMAGES = 5;

  // Lưu orderId từ queryParams để xử lý sau khi load xong
  private pendingOrderId: string | null = null;
  private pendingAction: 'create' | 'highlight' | null = null;
  private highlightOrderId: string | null = null;
  
  // Tham chiếu đến các card đơn hàng để scroll
  @ViewChildren('returnCard') returnCards!: QueryList<ElementRef>;

  /**
   * SVG inline: không phụ thuộc file /assets
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
    // Lấy orderId từ queryParams trước
    this.route.queryParams.subscribe(params => {
      this.pendingOrderId = params['orderId'] || null;
      this.pendingAction = params['action'] || null;
      // Load orders và xử lý sau
      this.loadOrders();
    });
  }

  ngAfterViewInit(): void {
    // Sau khi view được render, nếu có highlightOrderId thì scroll đến
    if (this.highlightOrderId) {
      setTimeout(() => {
        // ✅ FIX: Kiểm tra highlightOrderId không null trước khi gọi
        if (this.highlightOrderId) {
          this.scrollToOrder(this.highlightOrderId);
        }
      }, 300);
    }
  }

  private getUserId(): string {
    const direct = localStorage.getItem('userId');
    if (direct) return direct;
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?._id || user?.id || '';
    } catch { return ''; }
  }

  /**
   * Scroll đến đơn hàng có ID tương ứng và highlight
   */
  private scrollToOrder(orderId: string): void {
    if (!orderId) return; // ✅ FIX: Kiểm tra orderId không null/undefined
    
    const cards = this.returnCards?.toArray();
    if (!cards || cards.length === 0) return;
    
    const index = this.returnOrders.findIndex(o => o._id === orderId);
    if (index !== -1 && cards[index]) {
      cards[index].nativeElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Thêm class highlight
      cards[index].nativeElement.classList.add('highlight-order');
      
      // Xóa highlight sau 3 giây
      setTimeout(() => {
        if (cards[index]) {
          cards[index].nativeElement.classList.remove('highlight-order');
        }
      }, 3000);
    }
  }

  /**
   * Load orders và xử lý pendingOrderId nếu có
   */
  loadOrders(): void {
    this.isLoading = true;
    const userId = this.getUserId();
    if (!userId) { 
      this.isLoading = false; 
      this.cdr.detectChanges();
      return; 
    }

    this.api.getOrders(userId).subscribe({
      next: (res: any) => {
        const all: any[] = Array.isArray(res) ? res : [];

        // Lọc đơn đã giao và có yêu cầu đổi trả
        this.returnOrders = all.filter(
          o => o.status === 'delivered' && o.returnStatus && o.returnStatus !== 'none'
        );
        
        // Sắp xếp theo thời gian tạo yêu cầu (mới nhất lên đầu)
        this.returnOrders.sort((a, b) => {
          const dateA = a.returnRequestedAt ? new Date(a.returnRequestedAt).getTime() : 0;
          const dateB = b.returnRequestedAt ? new Date(b.returnRequestedAt).getTime() : 0;
          return dateB - dateA;
        });

        // Lọc đơn đã giao chưa có yêu cầu (có thể tạo yêu cầu mới)
        this.deliveredOrders = all.filter(
          o => o.status === 'delivered' && (!o.returnStatus || o.returnStatus === 'none')
        );

        this.isLoading = false;
        this.cdr.detectChanges();

        // ✅ Xử lý orderId từ queryParams sau khi đã load xong
        if (this.pendingOrderId) {
          const existingRequest = this.returnOrders.find(o => o._id === this.pendingOrderId);
          const availableOrder = this.deliveredOrders.find(o => o._id === this.pendingOrderId);
          
          if (availableOrder && this.pendingAction !== 'highlight') {
            // Đơn chưa có yêu cầu → mở form tạo mới
            this.openCreateForm(availableOrder);
          } else if (existingRequest) {
            // Đơn đã có yêu cầu → chuyển về list view và highlight đơn đó
            this.view = 'list';
            this.highlightOrderId = this.pendingOrderId;
            this.cdr.detectChanges();
            
            // Sau khi render, scroll đến và highlight
            setTimeout(() => {
              // ✅ FIX: Kiểm tra highlightOrderId không null trước khi gọi
              if (this.highlightOrderId) {
                this.scrollToOrder(this.highlightOrderId);
              }
            }, 200);
            
            this.api.showToast('Đơn hàng đã có yêu cầu đổi trả!', 'info');
          } else {
            // Không tìm thấy đơn hàng
            this.api.showToast('Không tìm thấy đơn hàng để đổi trả!', 'error');
          }
          this.pendingOrderId = null;
          this.pendingAction = null;
        }
      },
      error: () => { 
        this.isLoading = false; 
        this.deliveredOrders = [];
        this.returnOrders = [];
        this.cdr.detectChanges();
      }
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

  decreaseReturnQty(item: ReturnItem): void { 
    if (item.returnQty > 0) item.returnQty--; 
  }
  
  increaseReturnQty(item: ReturnItem): void { 
    if (item.returnQty < item.quantity) item.returnQty++; 
  }

  get returnTotal(): number {
    return this.returnItems.reduce((sum, i) => sum + i.price * i.returnQty, 0);
  }

  get canSubmit(): boolean {
    return !!this.selectedOrder
      && !!this.returnReason
      && this.returnItems.some(i => i.returnQty > 0);
  }

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
      if (!file.type.startsWith('image/')) return;
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

    input.value = '';
    this.cdr.detectChanges();
  }

  removeImage(index: number): void {
    this.selectedImages.splice(index, 1);
    this.imagePreviews.splice(index, 1);
    this.cdr.detectChanges();
  }

  submitReturn(): void {
    if (!this.canSubmit || this.isSubmitting) return;
    // Hiện modal xác nhận trước khi gửi request.
    // Mục tiêu: tránh khách bấm nhầm và muốn "hủy yêu cầu" sau đó.
    if (this.showConfirmSubmit) return;
    this.showConfirmSubmit = true;
  }

  cancelSubmitReturnConfirm(): void {
    this.showConfirmSubmit = false;
  }

  confirmSubmitReturn(): void {
    if (this.isSubmitting) return;
    if (!this.selectedOrder?._id) return;

    this.showConfirmSubmit = false;
    this.isSubmitting = true;

    this.api.requestReturn(this.selectedOrder._id, {
      reason: this.returnReason,
      note:   this.returnNote,
      items:  this.returnItems.filter(i => i.returnQty > 0),
      images: this.selectedImages,
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.api.showToast('Yêu cầu đổi trả đã được gửi! Admin sẽ xử lý sớm nhất.', 'success');
        this.loadOrders(); // Reload lại danh sách
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
      none:      'Chưa yêu cầu hoàn',
      requested: 'Chờ xử lý',
      approved:  'Đã chấp nhận hoàn',
      rejected:  'Từ chối hoàn',
      // Dữ liệu cũ: coi `completed` như `approved` vì luồng mới không còn bước `completed`.
      completed: 'Đã chấp nhận hoàn',
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

  getImageUrl(url: string | null | undefined): string {
    if (url == null || !String(url).trim()) return this.imgFallback;
    const u = String(url).trim();
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('data:')) return u;
    const path = u.startsWith('/') ? u : `/${u}`;
    return `${STATIC_BASE}${path}`;
  }

  lineProductId(item: any): string {
    const p = item?.productId;
    if (p && typeof p === 'object' && p._id != null) return String(p._id);
    return String(p ?? '');
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

  returnItemImageUrl(order: any, retItem: any): string {
    const fromRet = retItem?.imageUrl;
    if (fromRet != null && String(fromRet).trim()) return String(fromRet).trim();
    const pid = String(retItem?.productId ?? '');
    const lines = order?.items || [];
    const line = lines.find((i: any) => this.lineProductId(i) === pid);
    return line ? this.orderLineImageRaw(line) : '';
  }

  visibleReturnImages(order: any): string[] {
    return (order?.returnImages || []).filter((u: any) => u != null && String(u).trim());
  }

  onImgError(ev: Event): void {
    const el = ev.target as HTMLImageElement;
    if (el && el.src !== this.imgFallback) {
      el.src = this.imgFallback;
      el.onerror = null;
    }
  }

  goToOrders(): void { 
    this.router.navigate(['/profile/order-management']); 
  }
}