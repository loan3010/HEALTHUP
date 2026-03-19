import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, filter } from 'rxjs';
import { ApiService, STATIC_BASE } from '../services/api.service';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  selected?: boolean;
}

const CHECKOUT_KEY = 'checkout_v1';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './cart.html',
  styleUrls: ['./cart.css'],
})
export class Cart implements OnInit, OnDestroy {
  items: CartItem[] = [];
  total = 0;
  isLoading = true;

  overQtyMsg: Record<string, string> = {};

  showConfirm = false;
  confirmMessage = '';
  itemToDelete: CartItem | null = null;

  private routerSub!: Subscription;

  constructor(
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCartFromApi();

    // ✅ Mỗi lần navigate đến /cart đều reload — tránh dùng cache cũ
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd && e.urlAfterRedirects === '/cart')
    ).subscribe(() => {
      this.loadCartFromApi();
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  // ================= LOAD TỪ API =================
  loadCartFromApi(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.api.getCart().subscribe({
      next: (res) => {
        const rawItems = res?.items || res?.cart?.items || [];

        this.items = rawItems.map((item: any) => {
          const p = (item.productId && typeof item.productId === 'object')
            ? item.productId
            : null;

          const imageRaw = p?.images?.[0] || p?.image || item.imageUrl || '';
          const imageUrl = imageRaw
            ? (imageRaw.startsWith('http') ? imageRaw : `${STATIC_BASE}${imageRaw}`)
            : '';

          return {
            productId: String(p?._id || item.productId || ''),
            name:      p?.name  || item.name  || 'Sản phẩm',
            price:     p?.price || item.price || 0,
            imageUrl,
            quantity:  item.quantity || 1,
            selected:  false,
          };
        });

        this.isLoading = false;
        this.calcTotal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải giỏ hàng:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ================= TOTAL =================
  private calcTotal(): void {
    this.total = this.items
      .filter(it => it.selected)
      .reduce((sum, it) => sum + it.price * it.quantity, 0);
  }

  updateTotal(): void { this.calcTotal(); }

  // ================= SELECT =================
  get selectedCount(): number {
    return this.items.filter(it => it.selected).length;
  }

  isAllSelected(): boolean {
    return this.items.length > 0 && this.items.every(it => it.selected);
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.items.forEach(it => it.selected = checked);
    this.calcTotal();
  }

  // ================= NAVIGATION =================
  buyNow(): void {
    this.router.navigate(['/product-listing-page']);
  }

  checkout(): void {
    if (!this.selectedCount) return;

    const selectedItems = this.items
      .filter(it => it.selected)
      .map(it => ({
        productId: it.productId,
        name:      it.name,
        price:     it.price,
        quantity:  it.quantity,
        imageUrl:  it.imageUrl ?? null,
      }));

    localStorage.setItem(CHECKOUT_KEY, JSON.stringify(selectedItems));
    this.router.navigate(['/checkout']);
  }

  // ================= CONFIRM MODAL =================
  confirmRemove(item: CartItem): void {
    this.itemToDelete   = item;
    this.confirmMessage = `Bạn có chắc muốn xóa "${item.name}" khỏi giỏ hàng?`;
    this.showConfirm    = true;
  }

  confirmDecrease(item: CartItem): void {
    if (item.quantity <= 1) {
      this.itemToDelete   = item;
      this.confirmMessage = `Sản phẩm "${item.name}" đang có số lượng là 1.\nBạn có muốn xóa khỏi giỏ hàng không?`;
      this.showConfirm    = true;
    } else {
      this.dec(item);
    }
  }

  acceptConfirm(): void {
    if (!this.itemToDelete) return;

    const target = this.itemToDelete; // ✅ giữ ref trước khi closeModal() null nó
    this.closeModal();                // đóng modal ngay cho UX đẹp

    this.api.removeCartItem(target.productId).subscribe({
      next: () => {
        this.items = this.items.filter(x => x.productId !== target.productId);
        delete this.overQtyMsg[target.productId];
        this.calcTotal();
        this.cdr.detectChanges();
      },
      error: () => {
        this.api.showToast('Không thể xóa sản phẩm. Vui lòng thử lại.', 'error');
      }
    });
  }

  cancelConfirm(): void { this.closeModal(); }

  private closeModal(): void {
    this.showConfirm  = false;
    this.itemToDelete = null;
  }

  // ================= CART OPERATIONS =================
  remove(it: CartItem): void { this.confirmRemove(it); }

  dec(it: CartItem): void {
    const newQty = it.quantity - 1;
    // ✅ Optimistic update: cập nhật UI ngay, không chờ API
    it.quantity = newQty;
    this.calcTotal();
    this.cdr.detectChanges();

    this.api.updateCartItem(it.productId, newQty).subscribe({
      error: () => {
        // Rollback nếu API lỗi
        it.quantity = newQty + 1;
        this.calcTotal();
        this.cdr.detectChanges();
        this.api.showToast('Không thể cập nhật số lượng.', 'error');
      }
    });
  }

  inc(it: CartItem): void {
    const newQty = it.quantity + 1;
    // ✅ Optimistic update: cập nhật UI ngay, không chờ API
    it.quantity = newQty;
    this.calcTotal();
    this.cdr.detectChanges();

    this.api.updateCartItem(it.productId, newQty).subscribe({
      error: () => {
        // Rollback nếu API lỗi
        it.quantity = newQty - 1;
        this.calcTotal();
        this.cdr.detectChanges();
        this.api.showToast('Không thể cập nhật số lượng.', 'error');
      }
    });
  }

  onQtyInput(it: CartItem, value: string): void {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) return;

    if (next <= 0) {
      this.confirmDecrease(it);
      return;
    }

    const prev = it.quantity;
    // ✅ Optimistic update
    it.quantity = next;
    this.calcTotal();
    this.cdr.detectChanges();

    this.api.updateCartItem(it.productId, next).subscribe({
      error: () => {
        it.quantity = prev;
        this.calcTotal();
        this.cdr.detectChanges();
        this.api.showToast('Không thể cập nhật số lượng.', 'error');
      }
    });
  }

  trackById(_: number, item: CartItem) {
    return item.productId;
  }
}