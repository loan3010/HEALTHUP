import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, filter } from 'rxjs';
import { ApiService, STATIC_BASE } from '../services/api.service';

export interface ColorOption {
  value: string;
  label: string;
  hex: string;
}

export interface CartItemVariants {
  sizes?: string[];
  colors?: ColorOption[];
}

export interface CartItem {
  productId: string;
  variantId?: string | null;
  variantLabel?: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  selected?: boolean;
  variants?: CartItemVariants;
  selectedSize?: string;
  selectedColor?: string;
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
  private clearSelectedMode = false;

  private routerSub!: Subscription;

  constructor(
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCartFromApi();

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

          // Build variants từ product data nếu backend trả về
          const variants: CartItemVariants = {};
          if (p?.sizes?.length)  variants.sizes  = p.sizes;
          if (p?.colors?.length) variants.colors = p.colors;

          return {
            productId:     String(p?._id || item.productId || ''),
            variantId:     item.variantId || null,
            variantLabel:  item.variantLabel || '',
            name:          p?.name  || item.name  || 'Sản phẩm',
            price:         p?.price || item.price || 0,
            imageUrl,
            quantity:      item.quantity || 1,
            selected:      false,
            variants:      Object.keys(variants).length ? variants : undefined,
            selectedSize:  item.selectedSize  || p?.sizes?.[0]  || undefined,
            selectedColor: item.selectedColor || p?.colors?.[0]?.value || undefined,
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

  // ================= VARIANT =================
  selectSize(item: CartItem, size: string): void {
    item.selectedSize = size;
  }

  selectColor(item: CartItem, colorValue: string): void {
    item.selectedColor = colorValue;
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
        productId:     it.productId,
        variantId:     it.variantId || null,
        variantLabel:  it.variantLabel || '',
        name:          it.name,
        price:         it.price,
        quantity:      it.quantity,
        imageUrl:      it.imageUrl ?? null,
        selectedSize:  it.selectedSize  ?? null,
        selectedColor: it.selectedColor ?? null,
      }));

    localStorage.setItem(CHECKOUT_KEY, JSON.stringify(selectedItems));
    this.router.navigate(['/checkout']);
  }

  // ================= XÓA TẤT CẢ ĐÃ CHỌN =================
  confirmClearSelected(): void {
    if (!this.selectedCount) return;
    this.clearSelectedMode = true;
    this.itemToDelete      = null;
    this.confirmMessage    = `Bạn có chắc muốn xóa ${this.selectedCount} sản phẩm đã chọn khỏi giỏ hàng?`;
    this.showConfirm       = true;
  }

  private execClearSelected(): void {
    const targets = this.items.filter(it => it.selected);
    if (!targets.length) return;

    let pending = targets.length;
    const done = () => {
      pending--;
      if (pending === 0) {
        this.items = this.items.filter(it => !it.selected);
        this.calcTotal();
        this.cdr.detectChanges();
      }
    };

    targets.forEach(it => {
      this.api.removeCartItem(it.productId).subscribe({
        next:  () => done(),
        error: () => {
          done();
          this.api.showToast('Một số sản phẩm không thể xóa. Vui lòng thử lại.', 'error');
        }
      });
    });
  }

  // ================= CONFIRM MODAL =================
  confirmRemove(item: CartItem): void {
    this.clearSelectedMode = false;
    this.itemToDelete      = item;
    this.confirmMessage    = `Bạn có chắc muốn xóa "${item.name}" khỏi giỏ hàng?`;
    this.showConfirm       = true;
  }

  confirmDecrease(item: CartItem): void {
    if (item.quantity <= 1) {
      this.clearSelectedMode = false;
      this.itemToDelete      = item;
      this.confirmMessage    = `Sản phẩm "${item.name}" đang có số lượng là 1.\nBạn có muốn xóa khỏi giỏ hàng không?`;
      this.showConfirm       = true;
    } else {
      this.dec(item);
    }
  }

  acceptConfirm(): void {
    // ✅ Capture trước khi closeModal() null chúng
    const isClear = this.clearSelectedMode;
    const target  = this.itemToDelete;

    this.closeModal();

    if (isClear) {
      this.execClearSelected();
      return;
    }

    if (!target) return;

    this.api.removeCartItem(target.productId).subscribe({
      next: () => {
        this.items = this.items.filter(x => this.itemKey(x) !== this.itemKey(target));
        delete this.overQtyMsg[this.itemKey(target)];
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
    it.quantity  = newQty;
    delete this.overQtyMsg[this.itemKey(it)];
    this.calcTotal();
    this.cdr.detectChanges();

    this.api.updateCartItem(it.productId, newQty).subscribe({
      error: () => {
        it.quantity = newQty + 1;
        this.calcTotal();
        this.cdr.detectChanges();
        this.api.showToast('Không thể cập nhật số lượng.', 'error');
      }
    });
  }

  inc(it: CartItem): void {
    const newQty = it.quantity + 1;
    it.quantity  = newQty;
    this.calcTotal();
    this.cdr.detectChanges();

    this.api.updateCartItem(it.productId, newQty).subscribe({
      error: () => {
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

    const prev  = it.quantity;
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
    return this.itemKey(item);
  }

  private itemKey(item: CartItem): string {
    return `${item.productId}__${item.variantId || ''}`;
  }
}