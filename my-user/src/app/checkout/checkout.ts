import { CommonModule } from '@angular/common';
import { Component, computed, signal, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule, HttpHeaders, HttpErrorResponse } from '@angular/common/http';

type ShippingMethod = 'standard' | 'express';
type PaymentMethod  = 'cod' | 'momo' | 'vnpay';

type CheckoutItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
};

interface SavedAddress {
  _id?: string;
  id?: string;
  name: string;
  phone: string;
  address: string;
  isDefault: boolean;
}

interface Province { code: number; name: string; }
interface District { code: number; name: string; }
interface Ward     { code: number; name: string; }

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.css'],
})
export class Checkout implements OnInit {
  private readonly API_BASE     = 'http://localhost:3000/api';
  private readonly GEO_API      = 'https://provinces.open-api.vn/api';
  private readonly CART_KEY     = 'cart_v1';
  private readonly CHECKOUT_KEY = 'checkout_v1';

  // ── Auth ──
  userId = '';             // public — dùng trong template
  private token = '';

  // ── Items ──
  items     = signal<CheckoutItem[]>([]);
  errorMsg  = signal('');
  isPlacing = signal(false);

  // ── Success modal ──
  showSuccess    = signal(false);
  successOrderId = signal('');

  // ── Shipping / Payment ──
  shippingMethod = signal<ShippingMethod>('standard');
  paymentMethod  = signal<PaymentMethod>('cod');

  // ── Voucher ──
  voucherCode = signal('');
  voucherMsg  = signal('');

  // ══════════════════════════════════════
  // SỔ ĐỊA CHỈ STATE
  // ══════════════════════════════════════
  savedAddresses = signal<SavedAddress[]>([]);
  selectedAddrId = signal<string>('');   // '' = chưa chọn
  isLoadingAddr  = signal(false);

  // Modal thêm/sửa địa chỉ (từ address-book)
  showAddrModal   = false;
  isAddrEditMode  = false;
  editingAddrIdx  = -1;
  isAddrSaving    = false;
  addrModalError  = '';
  addrModalSuccess = '';

  // Province/district/ward cho modal địa chỉ
  provinces: Province[] = [];
  districts: District[] = [];
  wards:     Ward[]     = [];
  loadingProvinces = false;
  loadingDistricts = false;
  loadingWards     = false;
  fullAddressPreview = '';

  addrForm!: FormGroup;

  // ── Checkout form (chỉ note) ──
  checkoutForm!: FormGroup;

  // ── Computed ──
  subTotal = computed(() =>
    this.items().reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0)
  );
  shippingFee = computed(() =>
    this.shippingMethod() === 'express' ? 30000 : (this.subTotal() > 500000 ? 0 : 20000)
  );
  discount = computed(() => {
    if (this.voucherCode() === 'SALE10')   return this.subTotal() * 0.1;
    if (this.voucherCode() === 'FREESHIP') return this.shippingFee();
    return 0;
  });
  total = computed(() => Math.max(0, this.subTotal() + this.shippingFee() - this.discount()));

  // Địa chỉ đang được chọn
  get selectedAddr(): SavedAddress | undefined {
    return this.savedAddresses().find(a => this.getId(a) === this.selectedAddrId());
  }

  constructor(
    private fb:     FormBuilder,
    private router: Router,
    private http:   HttpClient,
    private cdr:    ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.checkoutForm = this.fb.group({ note: [''] });
    this.buildAddrForm();
    this.loadCheckoutItems();
    if (!this.items().length) { this.router.navigateByUrl('/cart'); return; }

    try {
      const u    = JSON.parse(localStorage.getItem('user') || '{}');
      this.token  = localStorage.getItem('token') || '';
      this.userId = u.id || u._id || '';
    } catch {}

    this.loadProvinces();

    if (this.userId && this.token) {
      this.loadSavedAddresses();
    }
  }

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }

  getId(a: SavedAddress): string { return (a._id || a.id || '') as string; }
  getInitial(name: string): string { return (name || 'U').charAt(0).toUpperCase(); }

  // ══════════════════════════════════════
  // LOAD SỔ ĐỊA CHỈ
  // ══════════════════════════════════════
  loadSavedAddresses(): void {
    this.isLoadingAddr.set(true);
    this.http.get<{ addresses: SavedAddress[] }>(
      `${this.API_BASE}/users/${this.userId}/addresses`,
      { headers: this.headers }
    ).subscribe({
      next: (res) => {
        const addrs = res.addresses || [];
        this.savedAddresses.set(addrs);
        this.isLoadingAddr.set(false);
        // Tự chọn địa chỉ mặc định
        if (addrs.length > 0) {
          const def = addrs.find(a => a.isDefault) || addrs[0];
          this.selectedAddrId.set(this.getId(def));
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingAddr.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  selectAddress(id: string): void {
    this.selectedAddrId.set(id);
    this.cdr.detectChanges();
  }

  setDefaultAddr(idx: number): void {
    const id = this.getId(this.savedAddresses()[idx]);
    this.http.put(`${this.API_BASE}/users/${this.userId}/addresses/${id}/set-default`, {}, { headers: this.headers })
      .subscribe({
        next: () => {
          const updated = this.savedAddresses().map((a, i) => ({ ...a, isDefault: i === idx }));
          this.savedAddresses.set(updated);
          this.cdr.detectChanges();
        }
      });
  }

  deleteAddr(idx: number): void {
    if (!confirm('Xóa địa chỉ này?')) return;
    const id = this.getId(this.savedAddresses()[idx]);
    this.http.delete(`${this.API_BASE}/users/${this.userId}/addresses/${id}`, { headers: this.headers })
      .subscribe({
        next: () => {
          const updated = this.savedAddresses().filter((_, i) => i !== idx);
          this.savedAddresses.set(updated);
          // Nếu đang chọn cái vừa xóa → chọn cái đầu tiên còn lại
          if (this.selectedAddrId() === id) {
            this.selectedAddrId.set(updated.length > 0 ? this.getId(updated[0]) : '');
          }
          this.cdr.detectChanges();
        }
      });
  }

  // ══════════════════════════════════════
  // MODAL THÊM / SỬA ĐỊA CHỈ (address-book)
  // ══════════════════════════════════════
  private buildAddrForm(): void {
    this.addrForm = this.fb.group({
      name:      ['', [Validators.required, Validators.minLength(2)]],
      phone:     ['', [Validators.required, Validators.pattern(/^[0-9]{9,11}$/)]],
      province:  ['', Validators.required],
      district:  ['', Validators.required],
      ward:      ['', Validators.required],
      street:    ['', Validators.required],
      isDefault: [false],
    });
    this.addrForm.valueChanges.subscribe(() => this.updatePreview());
  }

  openAddAddrModal(): void {
    this.isAddrEditMode   = false;
    this.editingAddrIdx   = -1;
    this.addrModalError   = '';
    this.addrModalSuccess = '';
    this.districts        = [];
    this.wards            = [];
    this.fullAddressPreview = '';
    this.addrForm.reset({ isDefault: false });
    this.showAddrModal = true;
    this.cdr.detectChanges();
  }

  openEditAddrModal(idx: number): void {
    this.isAddrEditMode   = true;
    this.editingAddrIdx   = idx;
    this.addrModalError   = '';
    this.addrModalSuccess = '';
    this.districts        = [];
    this.wards            = [];
    const a = this.savedAddresses()[idx];
    this.fullAddressPreview = a.address;
    this.addrForm.reset({
      name:      a.name,
      phone:     a.phone,
      province:  '',
      district:  '',
      ward:      '',
      street:    a.address,
      isDefault: a.isDefault,
    });
    this.showAddrModal = true;
    this.cdr.detectChanges();
  }

  closeAddrModal(): void {
    this.showAddrModal = false;
    this.addrForm.reset();
    this.fullAddressPreview = '';
    this.addrModalError     = '';
    this.addrModalSuccess   = '';
    this.cdr.detectChanges();
  }

  showAddrFieldError(field: string): boolean {
    const f = this.addrForm.get(field);
    return !!(f && f.invalid && (f.dirty || f.touched));
  }

  submitAddrForm(): void {
    if (this.addrForm.invalid) {
      this.addrForm.markAllAsTouched();
      this.addrModalError = 'Vui lòng điền đầy đủ thông tin!';
      this.cdr.detectChanges();
      return;
    }
    this.isAddrEditMode ? this.updateAddr() : this.addAddr();
  }

  private getFullAddr(): string {
    return this.fullAddressPreview || this.addrForm.value.street;
  }

  private addAddr(): void {
    this.isAddrSaving   = true;
    this.addrModalError = '';
    const v    = this.addrForm.value;
    const body = { name: v.name, phone: v.phone, address: this.getFullAddr(), isDefault: v.isDefault, userId: this.userId };

    this.http.post<any>(`${this.API_BASE}/users/${this.userId}/addresses`, body, { headers: this.headers })
      .subscribe({
        next: (res) => {
          this.isAddrSaving = false;
          const newAddr: SavedAddress = res.address;
          let addrs = [...this.savedAddresses()];
          if (newAddr.isDefault) addrs = addrs.map(a => ({ ...a, isDefault: false }));
          addrs.push(newAddr);
          this.savedAddresses.set(addrs);
          this.selectedAddrId.set(this.getId(newAddr));
          this.closeAddrModal();
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.isAddrSaving   = false;
          this.addrModalError = err?.error?.message || 'Thêm địa chỉ thất bại!';
          this.cdr.detectChanges();
        }
      });
  }

  private updateAddr(): void {
    this.isAddrSaving   = true;
    this.addrModalError = '';
    const v    = this.addrForm.value;
    const id   = this.getId(this.savedAddresses()[this.editingAddrIdx]);
    const body = { name: v.name, phone: v.phone, address: this.getFullAddr() || v.street, isDefault: v.isDefault, userId: this.userId };

    this.http.put<any>(`${this.API_BASE}/users/${this.userId}/addresses/${id}`, body, { headers: this.headers })
      .subscribe({
        next: (res) => {
          this.isAddrSaving = false;
          const updated: SavedAddress = res.address;
          let addrs = [...this.savedAddresses()];
          if (updated.isDefault) addrs = addrs.map(a => ({ ...a, isDefault: false }));
          addrs[this.editingAddrIdx] = updated;
          this.savedAddresses.set(addrs);
          this.closeAddrModal();
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.isAddrSaving   = false;
          this.addrModalError = err?.error?.message || 'Cập nhật thất bại!';
          this.cdr.detectChanges();
        }
      });
  }

  // ── Province API ──
  loadProvinces(): void {
    if (this.provinces.length) return;
    this.loadingProvinces = true;
    this.http.get<Province[]>(`${this.GEO_API}/?depth=1`).subscribe({
      next: (d) => { this.provinces = d; this.loadingProvinces = false; this.cdr.detectChanges(); },
      error: () => { this.loadingProvinces = false; }
    });
  }

  onProvinceChange(): void {
    const code = this.addrForm.get('province')?.value;
    this.districts = []; this.wards = [];
    this.addrForm.patchValue({ district: '', ward: '' }, { emitEvent: false });
    if (!code) return;
    this.loadingDistricts = true;
    this.http.get<any>(`${this.GEO_API}/p/${code}?depth=2`).subscribe({
      next: (d) => { this.districts = d.districts || []; this.loadingDistricts = false; this.cdr.detectChanges(); },
      error: () => { this.loadingDistricts = false; }
    });
  }

  onDistrictChange(): void {
    const code = this.addrForm.get('district')?.value;
    this.wards = [];
    this.addrForm.patchValue({ ward: '' }, { emitEvent: false });
    if (!code) return;
    this.loadingWards = true;
    this.http.get<any>(`${this.GEO_API}/d/${code}?depth=2`).subscribe({
      next: (d) => { this.wards = d.wards || []; this.loadingWards = false; this.cdr.detectChanges(); },
      error: () => { this.loadingWards = false; }
    });
  }

  onWardChange(): void { this.updatePreview(); }

  updatePreview(): void {
    const v = this.addrForm.value;
    const pName = this.provinces.find(p => p.code == v.province)?.name || '';
    const dName = this.districts.find(d => d.code == v.district)?.name || '';
    const wName = this.wards.find(w => w.code == v.ward)?.name     || '';
    this.fullAddressPreview = [v.street, wName, dName, pName].filter(Boolean).join(', ');
  }

  // ══════════════════════════════════════
  // VOUCHER
  // ══════════════════════════════════════
  onVoucherInput(v: string) { this.voucherCode.set(v.trim()); this.voucherMsg.set(''); }
  applyVoucher() {
    const v = this.voucherCode();
    this.voucherMsg.set(['SALE10','FREESHIP'].includes(v) ? '✓ Áp dụng thành công!' : 'Voucher không hợp lệ');
    this.cdr.detectChanges();
  }
  removeVoucher() { this.voucherCode.set(''); this.voucherMsg.set(''); }

  // ══════════════════════════════════════
  // PLACE ORDER
  // ══════════════════════════════════════
  placeOrder(): void {
    this.errorMsg.set('');
    if (this.isPlacing()) return;
    if (!this.items().length) { this.router.navigateByUrl('/cart'); return; }

    if (!this.selectedAddr) {
      this.errorMsg.set('Vui lòng chọn hoặc thêm địa chỉ nhận hàng');
      this.cdr.detectChanges();
      return;
    }

    const badIds = this.items().filter(i => !/^[a-fA-F0-9]{24}$/.test(String(i.productId || '').trim()));
    if (badIds.length) {
      this.errorMsg.set('Có sản phẩm bị lỗi ID. Vui lòng thêm lại vào giỏ.');
      this.cdr.detectChanges();
      return;
    }

    const addr = this.selectedAddr!;
    const note = this.checkoutForm.value.note || '';

    const customer: any = {
      fullName: addr.name,
      phone:    addr.phone,
      email:    '',
      address:  addr.address,
      province: 'N/A',
      district: 'N/A',
      ward:     'N/A',
      note,
    };

    const payload: any = {
      customer,
      items:          this.items().map(i => ({ productId: i.productId, quantity: i.quantity })),
      shippingMethod: this.shippingMethod(),
      paymentMethod:  this.paymentMethod(),
      voucherCode:    this.voucherCode() || null,
    };
    if (this.userId) payload.userId = this.userId;

    this.isPlacing.set(true);
    this.cdr.detectChanges();

    this.http.post<any>(`${this.API_BASE}/orders`, payload).subscribe({
      next: (res) => {
        const orderId = res?.orderId ?? res?.id ?? res?._id ?? '';
        this.clearAfterSuccess();
        this.isPlacing.set(false);
        this.successOrderId.set(String(orderId));
        this.showSuccess.set(true);
        this.cdr.detectChanges();
      },
      error: (err) => {
        const msg = err?.error?.message || err?.error?.error || err?.message || 'Đặt hàng thất bại. Thử lại nhé!';
        this.errorMsg.set(msg);
        this.isPlacing.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  // ── Success modal ──
  goToOrderDetail(): void { this.showSuccess.set(false); this.router.navigate(['/profile/order-detail', this.successOrderId()]); }
  goToHome():        void { this.showSuccess.set(false); this.router.navigateByUrl('/'); }

  // ── Helpers ──
  setShipping(m: ShippingMethod) { this.shippingMethod.set(m); }
  setPayment(m: PaymentMethod)   { this.paymentMethod.set(m); }
  goToCart() { this.router.navigateByUrl('/cart'); }
  vnd(n: number) { return n.toLocaleString('vi-VN') + '₫'; }

  private loadCheckoutItems(): void {
    try {
      const raw = localStorage.getItem(this.CHECKOUT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      this.items.set(Array.isArray(parsed) ? parsed.filter((x: any) => x?.productId && x.quantity != null) : []);
    } catch { this.items.set([]); }
  }

  private clearAfterSuccess(): void {
    // 1. Xóa localStorage
    const boughtIds = this.items().map(i => i.productId);
    localStorage.removeItem(this.CHECKOUT_KEY);
    try {
      const raw  = localStorage.getItem(this.CART_KEY);
      const cart = raw ? JSON.parse(raw) : [];
      const bought = new Set(boughtIds);
      localStorage.setItem(this.CART_KEY, JSON.stringify(
        Array.isArray(cart) ? cart.filter((x: any) => !bought.has(x.productId)) : []
      ));
    } catch {}

    // 2. ✅ Xóa từng sản phẩm đã mua trên server cart
    const userId = this.userId;
    if (userId) {
      const headers = new HttpHeaders({ 'x-user-id': userId });
      boughtIds.forEach(productId => {
        this.http.delete(
          `${this.API_BASE}/carts/remove/${productId}`,
          { headers }
        ).subscribe({ error: () => {} }); // silent fail
      });
    }

    this.items.set([]);
  }
}