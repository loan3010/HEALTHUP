import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, filter, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService, STATIC_BASE, API_BASE } from '../services/api.service';
import { HttpClient } from '@angular/common/http';

export interface ColorOption {
  value: string;
  label: string;
  hex: string;
}

export interface CartItemVariants {
  sizes?: string[];
  colors?: ColorOption[];
}

// Dùng chung cho cả variant lẫn weight option
export interface VariantOption {
  _id: string;    // variant: _id thật | weight: label (dùng làm key)
  label: string;
  price: number;
  stock: number;
  oldPrice?: number;
  isWeight?: boolean; // true = đây là weight option, không phải variant
}

export interface CartItem {
  productId: string;
  variantId?: string | null;
  variantLabel?: string;
  // Danh sách lựa chọn phân loại (variants HOẶC weights)
  allVariants?: VariantOption[];
  // Loại lựa chọn đang hiển thị
  optionType?: 'variant' | 'weight' | 'none';
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
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCartFromApi();
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd && e.urlAfterRedirects === '/cart')
    ).subscribe(() => this.loadCartFromApi());
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  // ================= LOAD TỪ API =================
  loadCartFromApi(): void {
    this.isLoading = true;

    this.api.getCart().subscribe({
      next: (res) => {
        const rawItems: any[] =
          res?.items ||
          res?.cart?.items ||
          res?.data?.items ||
          (Array.isArray(res) ? res : []);

        // Bước 1: Map sơ bộ
        const partialItems = rawItems.map((item: any) => this.mapRawItem(item));

        // Bước 2: Những item chưa có allVariants → fetch product riêng
        const needFetch = partialItems.filter(
          it => (!it.allVariants || it.allVariants.length === 0) && it.productId
        );

        if (needFetch.length === 0) {
          this.items = partialItems;
          this.finishLoad();
          return;
        }

        const uniqueIds = [...new Set(needFetch.map(it => it.productId))];
        const requests = uniqueIds.map(pid =>
          this.http.get<any>(`${API_BASE}/products/${pid}`).pipe(catchError(() => of(null)))
        );

        forkJoin(requests).subscribe({
          next: (products) => {
            const productMap: Record<string, any> = {};
            products.forEach((p, i) => { if (p) productMap[uniqueIds[i]] = p; });

            this.items = partialItems.map(item => {
              if (item.allVariants && item.allVariants.length > 0) return item;
              const p = productMap[item.productId];
              if (!p) return item;
              return this.enrichWithProductData(item, p);
            });

            this.finishLoad();
          },
          error: () => {
            this.items = partialItems;
            this.finishLoad();
          }
        });
      },
      error: (err) => {
        console.error('Lỗi tải giỏ hàng:', err);
        this.isLoading = false;
        setTimeout(() => this.cdr.detectChanges());
      }
    });
  }

  private finishLoad(): void {
    this.isLoading = false;
    this.calcTotal();
    setTimeout(() => this.cdr.detectChanges());
  }

  // Map 1 raw cart item → CartItem
  private mapRawItem(item: any): CartItem {
    const p = (item.productId && typeof item.productId === 'object') ? item.productId : null;

    const imageRaw = p?.images?.[0] || p?.image || item.imageUrl || item.image || '';
    const imageUrl = imageRaw
      ? (imageRaw.startsWith('http') ? imageRaw : `${STATIC_BASE}${imageRaw}`)
      : '';

    const { allVariants, optionType } = this.buildOptions(p, item);

    // Giá: ưu tiên theo variant/weight đang chọn
    const currentOption = this.findCurrentOption(allVariants, item.variantId, item.variantLabel);
    const price = currentOption?.price ?? p?.price ?? item.price ?? 0;

    return {
      productId:     String(p?._id || item.productId || ''),
      variantId:     item.variantId ? String(item.variantId) : null,
      variantLabel:  item.variantLabel || currentOption?.label || '',
      allVariants,
      optionType,
      name:          p?.name  ?? item.name  ?? 'Sản phẩm',
      price:         Number(price),
      imageUrl,
      quantity:      item.quantity || 1,
      selected:      false,
    } as CartItem;
  }

  // Enrich item khi cần fetch product riêng
  private enrichWithProductData(item: CartItem, p: any): CartItem {
    const { allVariants, optionType } = this.buildOptions(p, item);
    const currentOption = this.findCurrentOption(allVariants, item.variantId, item.variantLabel);
    const price = currentOption?.price ?? p?.price ?? item.price;

    let imageUrl = item.imageUrl;
    if (!imageUrl && p.images?.length) {
      const raw = p.images[0];
      imageUrl = raw.startsWith('http') ? raw : `${STATIC_BASE}${raw}`;
    }

    return {
      ...item,
      allVariants,
      optionType,
      price:        Number(price),
      imageUrl:     imageUrl || '',
      variantLabel: item.variantLabel || currentOption?.label || '',
      name:         item.name || p.name || 'Sản phẩm',
    };
  }

  /**
   * Xây dựng danh sách lựa chọn phân loại từ product data.
   * Ưu tiên: variants[] (có giá/stock riêng) → weights[] + weightPrices[] → none
   */
  private buildOptions(p: any, item?: any): { allVariants: VariantOption[]; optionType: 'variant' | 'weight' | 'none' } {
    if (!p) return { allVariants: [], optionType: 'none' };

    // --- Trường hợp 1: Sản phẩm có variants ---
    if (Array.isArray(p.variants) && p.variants.length > 0) {
      const allVariants: VariantOption[] = p.variants.map((v: any) => ({
        _id:      String(v._id),
        label:    String(v.label || ''),
        price:    Number(v.price  || 0),
        stock:    Number(v.stock  || 0),
        oldPrice: Number(v.oldPrice || 0),
        isWeight: false,
      }));
      return { allVariants, optionType: 'variant' };
    }

    // --- Trường hợp 2: Sản phẩm có weights ---
    if (Array.isArray(p.weights) && p.weights.length > 0) {
      // weightPrices map để lấy giá theo label
      const wpMap: Record<string, { price: number; oldPrice: number }> = {};
      (p.weightPrices || []).forEach((wp: any) => {
        wpMap[wp.label] = { price: Number(wp.price || 0), oldPrice: Number(wp.oldPrice || 0) };
      });

      const basePrice = Number(p.price || 0);

      const allVariants: VariantOption[] = p.weights.map((w: any) => {
        const wp = wpMap[w.label];
        return {
          _id:      w.label,           // dùng label làm key vì weight không có _id riêng
          label:    String(w.label || ''),
          price:    wp?.price ?? basePrice,
          stock:    w.outOfStock ? 0 : 999, // weights không track stock → dùng 999 nếu còn hàng
          oldPrice: wp?.oldPrice ?? Number(p.oldPrice || 0),
          isWeight: true,
        };
      });
      return { allVariants, optionType: 'weight' };
    }

    return { allVariants: [], optionType: 'none' };
  }

  /**
   * Tìm option đang được chọn.
   * - Variant: so sánh _id với variantId
   * - Weight:  so sánh label với variantLabel
   */
  private findCurrentOption(
    allVariants: VariantOption[],
    variantId: string | null | undefined,
    variantLabel: string | undefined
  ): VariantOption | undefined {
    if (!allVariants.length) return undefined;

    // Thử match theo _id (variant)
    if (variantId) {
      const byId = allVariants.find(v => String(v._id) === String(variantId));
      if (byId) return byId;
    }

    // Thử match theo label (weight)
    if (variantLabel) {
      const byLabel = allVariants.find(v => v.label === variantLabel);
      if (byLabel) return byLabel;
    }

    // Fallback: option đầu tiên
    return allVariants[0];
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

  // ================= ĐỔI PHÂN LOẠI =================
  /**
   * Đổi variant hoặc weight cho item trong giỏ.
   * optionId = variant._id hoặc weight.label
   */
  changeOption(item: CartItem, optionId: string): void {
    const currentId = item.optionType === 'weight' ? item.variantLabel : item.variantId;
    if (currentId === optionId) return;

    const newOption = item.allVariants?.find(v => v._id === optionId);
    if (!newOption) return;

    if (newOption.stock <= 0) {
      this.api.showToast(`"${newOption.label}" đã hết hàng.`, 'error');
      return;
    }

    const oldVariantId    = item.variantId;
    const oldVariantLabel = item.variantLabel;
    const oldPrice        = item.price;

    // Cập nhật UI ngay (optimistic)
    if (item.optionType === 'weight') {
      // Weight: lưu label vào variantLabel, variantId giữ null
      item.variantId    = null;
      item.variantLabel = newOption.label;
    } else {
      // Variant: lưu _id vào variantId
      item.variantId    = newOption._id;
      item.variantLabel = newOption.label;
    }
    item.price = newOption.price;
    if (item.quantity > newOption.stock && newOption.stock < 999) {
      item.quantity = newOption.stock;
    }
    this.calcTotal();
    this.cdr.detectChanges();

    if (item.optionType === 'weight') {
      // Weight: chỉ cập nhật giá cục bộ, không cần gọi API xóa/thêm
      // vì backend không track weight trong cart item
      this.api.showToast(`Đã chọn "${newOption.label}"`, 'success');
      return;
    }

    // Variant: xóa item cũ → thêm item mới với variant mới
    this.api.removeCartItem(item.productId, oldVariantId).subscribe({
      next: () => {
        this.api.addToCart(
          item.productId, item.quantity, item.name,
          newOption._id, newOption.label
        ).subscribe({
          next: () => {
            this.api.showToast(`Đã đổi sang "${newOption.label}"`, 'success');
          },
          error: () => this.rollback(item, oldVariantId, oldVariantLabel, oldPrice)
        });
      },
      error: () => this.rollback(item, oldVariantId, oldVariantLabel, oldPrice)
    });
  }

  private rollback(
    item: CartItem,
    oldVariantId: string | null | undefined,
    oldVariantLabel: string | undefined,
    oldPrice: number
  ): void {
    item.variantId    = oldVariantId;
    item.variantLabel = oldVariantLabel;
    item.price        = oldPrice;
    this.calcTotal();
    this.cdr.detectChanges();
    this.api.showToast('Không thể đổi phân loại. Vui lòng thử lại.', 'error');
  }

  // Xem lại trang chi tiết sản phẩm
  viewProduct(item: CartItem): void {
    if (!item.productId) return;
    this.router.navigate(['/product-detail-page', item.productId]);
  }

  // Lấy optionId hiện tại (để highlight button đang active)
  currentOptionId(item: CartItem): string {
    if (item.optionType === 'weight') return item.variantLabel || '';
    return item.variantId || '';
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
        productId:    it.productId,
        variantId:    it.variantId    || null,
        variantLabel: it.variantLabel || '',
        name:         it.name,
        price:        it.price,
        quantity:     it.quantity,
        imageUrl:     it.imageUrl     ?? null,
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
      if (--pending === 0) {
        this.items = this.items.filter(it => !it.selected);
        this.calcTotal();
        this.cdr.detectChanges();
      }
    };
    targets.forEach(it => {
      this.api.removeCartItem(it.productId, it.variantId).subscribe({
        next: () => done(),
        error: () => {
          done();
          this.api.showToast('Một số sản phẩm không thể xóa.', 'error');
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
    const isClear = this.clearSelectedMode;
    const target  = this.itemToDelete;
    this.closeModal();
    if (isClear) { this.execClearSelected(); return; }
    if (!target) return;
    this.api.removeCartItem(target.productId, target.variantId).subscribe({
      next: () => {
        this.items = this.items.filter(x => this.itemKey(x) !== this.itemKey(target));
        delete this.overQtyMsg[this.itemKey(target)];
        this.calcTotal();
        this.cdr.detectChanges();
      },
      error: () => this.api.showToast('Không thể xóa sản phẩm.', 'error')
    });
  }

  cancelConfirm(): void { this.closeModal(); }
  private closeModal(): void { this.showConfirm = false; this.itemToDelete = null; }

  // ================= CART OPERATIONS =================
  remove(it: CartItem): void { this.confirmRemove(it); }

  dec(it: CartItem): void {
    const newQty = it.quantity - 1;
    it.quantity  = newQty;
    delete this.overQtyMsg[this.itemKey(it)];
    this.calcTotal();
    this.cdr.detectChanges();
    this.api.updateCartItem(it.productId, newQty, it.variantId).subscribe({
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
    this.api.updateCartItem(it.productId, newQty, it.variantId).subscribe({
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
    if (next <= 0) { this.confirmDecrease(it); return; }
    const prev  = it.quantity;
    it.quantity = next;
    this.calcTotal();
    this.cdr.detectChanges();
    this.api.updateCartItem(it.productId, next, it.variantId).subscribe({
      error: () => {
        it.quantity = prev;
        this.calcTotal();
        this.cdr.detectChanges();
        this.api.showToast('Không thể cập nhật số lượng.', 'error');
      }
    });
  }

  trackById = (_: number, item: CartItem): string => this.itemKey(item);

  private itemKey(item: CartItem): string {
    return `${item.productId}__${item.variantId || ''}`;
  }
}