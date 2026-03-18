import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
export class Cart implements OnInit {
  items: CartItem[] = [];
  total = 0;
  isLoading = true;

  overQtyMsg: Record<string, string> = {};

  // ===== MODAL STATE =====
  showConfirm = false;
  confirmMessage = '';
  itemToDelete: CartItem | null = null;

  constructor(
    private router: Router,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.loadCartFromApi();
  }

  // ================= LOAD TỪ API =================
  private loadCartFromApi(): void {
    this.isLoading = true;
    this.api.getCart().subscribe({
      next: (cart) => {
        this.items = (cart.items || []).map((item: any) => {
          const p = item.productId; // đã populate
          const imageRaw = p?.images?.[0] || p?.image || '';
          const imageUrl = imageRaw.startsWith('http')
            ? imageRaw
            : `${STATIC_BASE}${imageRaw}`;
          return {
            productId: String(p?._id || item.productId),
            name:      p?.name || 'Sản phẩm',
            price:     p?.price || 0,
            imageUrl,
            quantity:  item.quantity,
            selected:  false,
          };
        });
        this.isLoading = false;
        this.calcTotal();
      },
      error: (err) => {
        console.error('Lỗi tải giỏ hàng:', err);
        this.isLoading = false;
      }
    });
  }

  // ================= TOTAL =================
  private calcTotal(): void {
    this.total = this.items
      .filter(it => it.selected)
      .reduce((sum, it) => sum + it.price * it.quantity, 0);
  }

  updateTotal(): void {
    this.calcTotal();
  }

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
    this.itemToDelete = item;
    this.confirmMessage = `Bạn có chắc muốn xóa "${item.name}" khỏi giỏ hàng?`;
    this.showConfirm = true;
  }

  confirmDecrease(item: CartItem): void {
    if (item.quantity <= 1) {
      this.itemToDelete = item;
      this.confirmMessage =
        `Sản phẩm "${item.name}" đang có số lượng là 1.\nBạn có muốn xóa khỏi giỏ hàng không?`;
      this.showConfirm = true;
    } else {
      this.dec(item);
    }
  }

  acceptConfirm(): void {
    if (this.itemToDelete) {
      this.items = this.items.filter(x => x.productId !== this.itemToDelete!.productId);
      delete this.overQtyMsg[this.itemToDelete.productId];
      this.calcTotal();
    }
    this.closeModal();
  }

  cancelConfirm(): void {
    this.closeModal();
  }

  private closeModal(): void {
    this.showConfirm = false;
    this.itemToDelete = null;
  }

  // ================= CART OPERATIONS =================
  remove(it: CartItem): void {
    this.confirmRemove(it);
  }

  dec(it: CartItem): void {
    delete this.overQtyMsg[it.productId];
    it.quantity--;
    this.calcTotal();
  }

  inc(it: CartItem): void {
    it.quantity++;
    this.calcTotal();
  }

  onQtyInput(it: CartItem, value: string): void {
    const next = Number(value);
    if (!Number.isFinite(next)) return;

    if (next <= 0) {
      this.confirmDecrease(it);
      return;
    }

    it.quantity = next;
    this.calcTotal();
  }

  trackById(_: number, item: CartItem) {
    return item.productId;
  }
}