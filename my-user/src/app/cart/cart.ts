import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  selected?: boolean;
}

const CART_KEY = 'cart_v1';
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

  overQtyMsg: Record<string, string> = {};

  // ===== MODAL STATE =====
  showConfirm = false;
  confirmMessage = '';
  itemToDelete: CartItem | null = null;

  private stockMap: Record<string, number> = {
    'p001': 5,
    'p002': 20,
    'p003': 1,
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.items = this.readStorage();
    // nếu muốn giữ trạng thái tick khi reload thì bỏ dòng này
    this.items.forEach(it => it.selected = it.selected ?? false);
    this.calcTotal();
  }

  // ================= STORAGE =================
  private writeStorage(): void {
    localStorage.setItem(CART_KEY, JSON.stringify(this.items));
    this.calcTotal();
  }

  private readStorage(): CartItem[] {
    try {
      const raw = localStorage.getItem(CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // ================= TOTAL =================
  private calcTotal(): void {
    this.total = this.items
      .filter(it => it.selected)
      .reduce((sum, it) => sum + it.price * it.quantity, 0);
  }

  updateTotal(): void {
    this.calcTotal();
    this.writeStorage(); // ✅ lưu lại selected khi tick/untick
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
    this.writeStorage(); // ✅ lưu selected
  }

  // ================= NAVIGATION =================
  buyNow(): void {
    this.router.navigate(['/products']);
  }

  // ✅ CHỈNH Ở ĐÂY
  checkout(): void {
    if (!this.selectedCount) return;

    const selectedItems = this.items
      .filter(it => it.selected)
      .map(it => ({
        productId: it.productId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        imageUrl: it.imageUrl ?? null,
      }));

    // lưu riêng danh sách mua để checkout đọc
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
      this.writeStorage();
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
    this.writeStorage();
  }

  inc(it: CartItem): void {
    this.trySetQty(it, it.quantity + 1);
  }

  onQtyInput(it: CartItem, value: string): void {
    const next = Number(value);
    if (!Number.isFinite(next)) return;

    if (next <= 0) {
      this.confirmDecrease(it);
      return;
    }

    this.trySetQty(it, next);
  }

  private trySetQty(it: CartItem, nextQty: number): void {
    const stock = this.stockMap[it.productId] ?? 0;

    if (nextQty <= stock) {
      delete this.overQtyMsg[it.productId];
      it.quantity = nextQty;
      this.writeStorage();
    } else {
      this.overQtyMsg[it.productId] = `Vượt quá số lượng (tồn kho: ${stock})`;
    }
  }

  trackById(_: number, item: CartItem) {
    return item.productId;
  }
}