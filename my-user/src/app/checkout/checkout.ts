import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';

type ShippingMethod = 'standard' | 'express';
type PaymentMethod = 'cod' | 'momo' | 'vnpay';

type CheckoutItem = {
  productId: string;
  variantId?: string | null;
  variantLabel?: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
};

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.css'],
})
export class Checkout {
  private readonly API_BASE = 'http://localhost:3000';
  private readonly ORDER_ENDPOINT = `${this.API_BASE}/api/orders`;

  private readonly CART_KEY = 'cart_v1';
  private readonly CHECKOUT_KEY = 'checkout_v1';

  items = signal<CheckoutItem[]>([]);

  errorMsg = signal('');
  isPlacing = signal(false);

  shippingMethod = signal<ShippingMethod>('standard');
  paymentMethod = signal<PaymentMethod>('cod');

  voucherCode = signal('');
  voucherMsg = signal('');

  form!: FormGroup;

  provinces: any[] = [];
  districts: any[] = [];
  wards: any[] = [];

  subTotal = computed(() =>
    this.items().reduce((sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0)
  );

  shippingFee = computed(() => {
    if (this.shippingMethod() === 'express') return 30000;
    return this.subTotal() > 500000 ? 0 : 20000;
  });

  discount = computed(() => {
    if (this.voucherCode() === 'SALE10') return this.subTotal() * 0.1;
    if (this.voucherCode() === 'FREESHIP') return this.shippingFee();
    return 0;
  });

  total = computed(() => Math.max(0, this.subTotal() + this.shippingFee() - this.discount()));

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient
  ) {
    this.form = this.fb.group({
      email: [''],
      fullName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^0\d{9}$/)]],
      address: ['', Validators.required],
      province: ['', Validators.required],
      district: ['', Validators.required],
      ward: ['', Validators.required],
      note: [''],
    });

    this.loadCheckoutItems();
    if (!this.items().length) this.router.navigateByUrl('/cart');

    this.loadProvinces();
  }

  goToCart() {
    this.router.navigateByUrl('/cart');
  }

  private isMongoObjectId(id: string) {
    return /^[a-fA-F0-9]{24}$/.test(String(id || '').trim());
  }

  private loadCheckoutItems() {
    try {
      const raw = localStorage.getItem(this.CHECKOUT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const safe = Array.isArray(parsed)
        ? parsed.filter(x => x && x.productId && x.quantity != null)
        : [];
      this.items.set(safe);
    } catch {
      this.items.set([]);
    }
  }

  private clearAfterSuccess() {
    localStorage.removeItem(this.CHECKOUT_KEY);

    try {
      const boughtIds = new Set(this.items().map(i => i.productId));
      const rawCart = localStorage.getItem(this.CART_KEY);
      const cart = rawCart ? JSON.parse(rawCart) : [];
      const remain = Array.isArray(cart)
        ? cart.filter((x: any) => !boughtIds.has(x.productId))
        : [];
      localStorage.setItem(this.CART_KEY, JSON.stringify(remain));
    } catch {
      // ignore
    }

    this.items.set([]);
  }

  loadProvinces() {
    this.http.get<any[]>('https://provinces.open-api.vn/api/p/').subscribe({
      next: (data) => (this.provinces = data),
      error: () => this.errorMsg.set('Không tải được danh sách tỉnh/thành'),
    });
  }

  onProvinceChange(code: string) {
    this.form.patchValue({ province: code, district: '', ward: '' });
    this.districts = [];
    this.wards = [];
    if (!code) return;

    this.http.get<any>(`https://provinces.open-api.vn/api/p/${code}?depth=2`).subscribe({
      next: (data) => (this.districts = data?.districts ?? []),
      error: () => this.errorMsg.set('Không tải được danh sách quận/huyện'),
    });
  }

  onDistrictChange(code: string) {
    this.form.patchValue({ district: code, ward: '' });
    this.wards = [];
    if (!code) return;

    this.http.get<any>(`https://provinces.open-api.vn/api/d/${code}?depth=2`).subscribe({
      next: (data) => (this.wards = data?.wards ?? []),
      error: () => this.errorMsg.set('Không tải được danh sách phường/xã'),
    });
  }

  onVoucherInput(value: string) {
    this.voucherCode.set((value ?? '').trim());
    this.voucherMsg.set('');
  }

  applyVoucher() {
    const v = this.voucherCode();
    if (v === 'SALE10' || v === 'FREESHIP') this.voucherMsg.set('Áp dụng voucher thành công');
    else this.voucherMsg.set('Voucher không hợp lệ');
  }

  removeVoucher() {
    this.voucherCode.set('');
    this.voucherMsg.set('');
  }

  placeOrder() {
    this.errorMsg.set('');
    if (this.isPlacing()) return;

    if (!this.items().length) {
      this.errorMsg.set('Danh sách checkout trống');
      this.router.navigateByUrl('/cart');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg.set('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    // ✅ Chặn lỗi productId không phải ObjectId (nguyên nhân fail phổ biến)
    const badIds = this.items()
      .map(i => i.productId)
      .filter(id => !this.isMongoObjectId(id));

    if (badIds.length) {
      console.log('bad productIds:', badIds);
      this.errorMsg.set('Có sản phẩm bị sai productId (không phải ObjectId). Vui lòng thêm lại sản phẩm vào giỏ.');
      return;
    }

    const payload = {
      customer: this.form.value,
      items: this.items().map(i => ({
        productId: i.productId,
        variantId: i.variantId || null,
        variantLabel: i.variantLabel || '',
        quantity: i.quantity
      })),
      shippingMethod: this.shippingMethod(),
      paymentMethod: this.paymentMethod(),
      voucherCode: this.voucherCode() || null,
    };

    this.isPlacing.set(true);

    this.http.post<any>(this.ORDER_ENDPOINT, payload).subscribe({
      next: (res) => {
        const orderId = res?.orderId ?? res?.id ?? res?._id;
        if (!orderId) {
          this.errorMsg.set('Đặt hàng thành công nhưng không nhận được mã đơn');
          this.isPlacing.set(false);
          return;
        }

        this.clearAfterSuccess();
        this.router.navigate(['/order-success', orderId]);
      },
      error: (err) => {
        console.error('placeOrder error:', err);

        // ✅ Hiện đúng lỗi backend trả về
        const msg =
          err?.error?.message ||
          err?.error?.error ||
          err?.message ||
          'Đặt hàng thất bại. Vui lòng thử lại!';

        this.errorMsg.set(msg);
        this.isPlacing.set(false);
      }
    });
  }

  setShipping(m: ShippingMethod) {
    this.shippingMethod.set(m);
  }

  setPayment(m: PaymentMethod) {
    this.paymentMethod.set(m);
  }

  hasError(name: string, err: string) {
    const c = this.form.get(name);
    return !!c && c.touched && c.hasError(err);
  }

  vnd(n: number) {
    return n.toLocaleString('vi-VN') + '₫';
  }
}