import { Component, computed, signal, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';

type ShippingMethod = 'standard' | 'express';
type PaymentMethod  = 'cod' | 'momo' | 'vnpay';

type CheckoutItem = {
  productId: string;
  variantId?: string | null;
  variantLabel?: string;
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

export interface VoucherInfo {
  code: string;
  name: string;
  description?: string;
  type?: 'order' | 'shipping';
  discountType: 'percent' | 'fixed' | 'freeship';
  discountValue: number;
  minOrder?: number;
  maxDiscount?: number;
}

interface ApplyVoucherResult {
  valid: boolean;
  code?: string;
  name?: string;
  description?: string;
  type?: 'order' | 'shipping';
  discountType?: string;
  discountValue?: number;
  discountOnType?: 'items' | 'shipping';
  discountAmount?: number;
  message: string;
}

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

  userId = '';
  private token = '';

  items     = signal<CheckoutItem[]>([]);
  errorMsg  = signal('');
  isPlacing = signal(false);

  showSuccess    = signal(false);
  successOrderId = signal('');

  shippingMethod = signal<ShippingMethod>('standard');
  paymentMethod  = signal<PaymentMethod>('cod');

  // ── Voucher tiền hàng ──
  orderVoucherCode       = signal('');
  orderVoucherMsg        = signal('');
  orderVoucherResult     = signal<ApplyVoucherResult | null>(null);
  isApplyingOrderVoucher = false;

  // ── Voucher phí vận chuyển ──
  shipVoucherCode       = signal('');
  shipVoucherMsg        = signal('');
  shipVoucherResult     = signal<ApplyVoucherResult | null>(null);
  isApplyingShipVoucher = false;

  // ── Modal voucher ──
  showVoucherModal     = false;
  voucherModalFor: 'order' | 'shipping' = 'order';
  availableVouchers    = signal<VoucherInfo[]>([]);
  isLoadingVouchers    = false;

  // ✅ MỚI: Lưu code voucher tốt nhất (giảm nhiều tiền nhất)
  bestVoucherCode = signal<string>('');

  // ── Address ──
  savedAddresses = signal<SavedAddress[]>([]);
  selectedAddrId = signal<string>('');
  isLoadingAddr  = signal(false);

  showAddrModal    = false;
  addrDropdownOpen = false; 
  isAddrEditMode   = false;
  editingAddrIdx   = -1;
  isAddrSaving     = false;
  addrModalError   = '';
  addrModalSuccess = '';

  provinces: Province[] = [];
  districts: District[] = [];
  wards:     Ward[]     = [];
  loadingProvinces = false;
  loadingDistricts = false;
  loadingWards     = false;
  fullAddressPreview = '';

  addrForm!: FormGroup;
  checkoutForm!: FormGroup;

  // ── Computed ──
  subTotal = computed(() =>
    this.items().reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0)
  );

  shippingFee = computed(() =>
    this.shippingMethod() === 'express' ? 30000 : (this.subTotal() > 500000 ? 0 : 20000)
  );

  discountOnItems = computed(() => {
    const r = this.orderVoucherResult();
    if (!r?.valid || r.discountOnType !== 'items') return 0;
    return r.discountAmount ?? 0;
  });

  discountOnShipping = computed(() => {
    const r = this.shipVoucherResult();
    if (!r?.valid || r.discountOnType !== 'shipping') return 0;
    return r.discountAmount ?? 0;
  });

  discount = computed(() => this.discountOnItems() + this.discountOnShipping());

  total = computed(() =>
    Math.max(0, this.subTotal() - this.discountOnItems() + this.shippingFee() - this.discountOnShipping())
  );

  get selectedAddr(): SavedAddress | undefined {
    return this.savedAddresses().find(a => this.getId(a) === this.selectedAddrId());
  }

  get isOrderVoucherApplied(): boolean {
    return this.orderVoucherResult()?.valid === true;
  }

  get isShipVoucherApplied(): boolean {
    return this.shipVoucherResult()?.valid === true;
  }

  get appliedOrderVoucherInfo(): VoucherInfo | undefined {
    const r = this.orderVoucherResult();
    if (!r?.valid || !r.code) return undefined;
    return {
      code:         r.code,
      name:         r.name ?? '',
      description:  r.description,
      type:         r.type,
      discountType: r.discountType as any,
      discountValue: r.discountValue ?? 0,
    };
  }

  get appliedShipVoucherInfo(): VoucherInfo | undefined {
    const r = this.shipVoucherResult();
    if (!r?.valid || !r.code) return undefined;
    return {
      code:         r.code,
      name:         r.name ?? '',
      description:  r.description,
      type:         r.type,
      discountType: r.discountType as any,
      discountValue: r.discountValue ?? 0,
    };
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
    if (this.userId && this.token) this.loadSavedAddresses();
  }

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }

  getId(a: SavedAddress): string { return (a._id || a.id || '') as string; }
  getInitial(name: string): string { return (name || 'U').charAt(0).toUpperCase(); }

  // ── Address ──
  loadSavedAddresses(): void {
    this.isLoadingAddr.set(true);
    this.http.get<{ addresses: SavedAddress[] }>(
      `${this.API_BASE}/users/${this.userId}/addresses`,
      { headers: this.headers }
    ).subscribe({
      next: (res) => {
        const addrs  = res.addresses || [];
        const sorted = [...addrs.filter(a => a.isDefault), ...addrs.filter(a => !a.isDefault)];
        this.savedAddresses.set(sorted);
        this.isLoadingAddr.set(false);
        if (sorted.length > 0) {
          this.selectedAddrId.set(this.getId(sorted.find(a => a.isDefault) || sorted[0]));
        }
        this.cdr.detectChanges();
      },
      error: () => { this.isLoadingAddr.set(false); this.cdr.detectChanges(); }
    });
  }

  selectAddress(id: string): void { this.selectedAddrId.set(id); this.cdr.detectChanges(); }

  setDefaultAddr(idx: number): void {
    const id = this.getId(this.savedAddresses()[idx]);
    this.http.put(`${this.API_BASE}/users/${this.userId}/addresses/${id}/set-default`, {}, { headers: this.headers })
      .subscribe({
        next: () => {
          const updated = this.savedAddresses().map((a, i) => ({ ...a, isDefault: i === idx }));
          this.savedAddresses.set([...updated.filter(a => a.isDefault), ...updated.filter(a => !a.isDefault)]);
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
          if (this.selectedAddrId() === id) {
            this.selectedAddrId.set(updated.length > 0 ? this.getId(updated[0]) : '');
          }
          this.cdr.detectChanges();
        }
      });
  }

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
    this.isAddrEditMode = false; this.editingAddrIdx = -1;
    this.addrModalError = ''; this.addrModalSuccess = '';
    this.districts = []; this.wards = []; this.fullAddressPreview = '';
    this.addrForm.reset({ isDefault: false });
    this.showAddrModal = true; this.cdr.detectChanges();
  }

  openEditAddrModal(idx: number): void {
    this.isAddrEditMode = true; this.editingAddrIdx = idx;
    this.addrModalError = ''; this.addrModalSuccess = '';
    this.districts = []; this.wards = [];
    const a = this.savedAddresses()[idx];
    this.fullAddressPreview = a.address;
    this.addrForm.reset({ name: a.name, phone: a.phone, province: '', district: '', ward: '', street: a.address, isDefault: a.isDefault });
    // Giữ preview địa chỉ cũ hiển thị ngay khi mở modal
    setTimeout(() => { this.cdr.detectChanges(); }, 0);
    this.showAddrModal = true; this.cdr.detectChanges();
  }

  closeAddrModal(): void {
    this.showAddrModal = false; this.addrForm.reset();
    this.fullAddressPreview = ''; this.addrModalError = ''; this.addrModalSuccess = '';
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
      this.cdr.detectChanges(); return;
    }
    this.isAddrEditMode ? this.updateAddr() : this.addAddr();
  }

  private getFullAddr(): string { return this.fullAddressPreview || this.addrForm.value.street; }

  private addAddr(): void {
    this.isAddrSaving = true; this.addrModalError = '';
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
          this.savedAddresses.set([...addrs.filter(a => a.isDefault), ...addrs.filter(a => !a.isDefault)]);
          this.selectedAddrId.set(this.getId(newAddr));
          this.closeAddrModal(); this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.isAddrSaving = false;
          this.addrModalError = err?.error?.message || 'Thêm địa chỉ thất bại!';
          this.cdr.detectChanges();
        }
      });
  }

  private updateAddr(): void {
    this.isAddrSaving = true; this.addrModalError = '';
    const v  = this.addrForm.value;
    const id = this.getId(this.savedAddresses()[this.editingAddrIdx]);
    const body = { name: v.name, phone: v.phone, address: this.getFullAddr() || v.street, isDefault: v.isDefault, userId: this.userId };
    this.http.put<any>(`${this.API_BASE}/users/${this.userId}/addresses/${id}`, body, { headers: this.headers })
      .subscribe({
        next: (res) => {
          this.isAddrSaving = false;
          const updated: SavedAddress = res.address;
          let addrs = [...this.savedAddresses()];
          if (updated.isDefault) addrs = addrs.map(a => ({ ...a, isDefault: false }));
          addrs[this.editingAddrIdx] = updated;
          this.savedAddresses.set([...addrs.filter(a => a.isDefault), ...addrs.filter(a => !a.isDefault)]);
          this.closeAddrModal(); this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.isAddrSaving = false;
          this.addrModalError = err?.error?.message || 'Cập nhật thất bại!';
          this.cdr.detectChanges();
        }
      });
  }

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
      error: () => { this.loadingWards; }
    });
  }

  onWardChange(): void { this.updatePreview(); }

  updatePreview(): void {
    const v     = this.addrForm.value;
    const pName = this.provinces.find(p => p.code == v.province)?.name || '';
    const dName = this.districts.find(d => d.code == v.district)?.name || '';
    const wName = this.wards.find(w => w.code == v.ward)?.name || '';
    this.fullAddressPreview = [v.street, wName, dName, pName].filter(Boolean).join(', ');
  }

  // ══════════════════════════════════════
  // VOUCHER
  // ══════════════════════════════════════

  isVoucherEligible(v: VoucherInfo): boolean {
    const min = v.minOrder ?? 0;
    return this.subTotal() >= min;
  }

  voucherDisabledReason(v: VoucherInfo): string {
    const min = v.minOrder ?? 0;
    if (this.subTotal() < min) {
      return `Cần thêm ${this.vnd(min - this.subTotal())} để dùng mã này`;
    }
    return '';
  }

  // ✅ MỚI: Tính số tiền tiết kiệm thực tế của 1 voucher
  calcVoucherSaving(v: VoucherInfo): number {
    if (!this.isVoucherEligible(v)) return 0;

    if (v.discountType === 'freeship') {
      return this.shippingFee();
    }

    const base = v.type === 'shipping' ? this.shippingFee() : this.subTotal();

    if (v.discountType === 'percent') {
      const saving = Math.round(base * v.discountValue / 100);
      return v.maxDiscount ? Math.min(saving, v.maxDiscount) : saving;
    }

    if (v.discountType === 'fixed') {
      return Math.min(v.discountValue, base);
    }

    return 0;
  }

  onVoucherInput(v: string, forType: 'order' | 'shipping'): void {
    const upper = v.trim().toUpperCase();
    if (forType === 'order') {
      this.orderVoucherCode.set(upper);
      this.orderVoucherMsg.set('');
      if (!v.trim()) { this.orderVoucherResult.set(null); }
    } else {
      this.shipVoucherCode.set(upper);
      this.shipVoucherMsg.set('');
      if (!v.trim()) { this.shipVoucherResult.set(null); }
    }
    this.cdr.detectChanges();
  }

  applyVoucher(forType: 'order' | 'shipping'): void {
    const code = forType === 'order' ? this.orderVoucherCode() : this.shipVoucherCode();

    if (!code) {
      forType === 'order'
        ? this.orderVoucherMsg.set('Vui lòng nhập mã voucher')
        : this.shipVoucherMsg.set('Vui lòng nhập mã voucher');
      return;
    }
    if (forType === 'order'    && this.isApplyingOrderVoucher) return;
    if (forType === 'shipping' && this.isApplyingShipVoucher)  return;

    if (forType === 'order') {
      this.isApplyingOrderVoucher = true;
      this.orderVoucherMsg.set('');
    } else {
      this.isApplyingShipVoucher = true;
      this.shipVoucherMsg.set('');
    }
    this.cdr.detectChanges();

    this.http.post<ApplyVoucherResult>(`${this.API_BASE}/promotions/apply`, {
      code,
      subTotal:    this.subTotal(),
      shippingFee: this.shippingFee(),
    }).subscribe({
      next: (res) => {
        if (forType === 'order' && res.discountOnType !== 'items') {
          this.isApplyingOrderVoucher = false;
          this.orderVoucherResult.set({ valid: false, message: '' });
          this.orderVoucherMsg.set('Mã này chỉ dùng cho phí vận chuyển, hãy nhập vào ô bên dưới');
          this.cdr.detectChanges(); return;
        }
        if (forType === 'shipping' && res.discountOnType !== 'shipping') {
          this.isApplyingShipVoucher = false;
          this.shipVoucherResult.set({ valid: false, message: '' });
          this.shipVoucherMsg.set('Mã này chỉ dùng cho tiền hàng, hãy nhập vào ô bên trên');
          this.cdr.detectChanges(); return;
        }

        if (forType === 'order') {
          this.isApplyingOrderVoucher = false;
          this.orderVoucherResult.set(res);
          this.orderVoucherMsg.set(res.message);
        } else {
          this.isApplyingShipVoucher = false;
          this.shipVoucherResult.set(res);
          this.shipVoucherMsg.set(res.message);
        }
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        const msg = err?.error?.message || 'Voucher không hợp lệ hoặc đã hết hạn';
        if (forType === 'order') {
          this.isApplyingOrderVoucher = false;
          this.orderVoucherResult.set({ valid: false, message: msg });
          this.orderVoucherMsg.set(msg);
        } else {
          this.isApplyingShipVoucher = false;
          this.shipVoucherResult.set({ valid: false, message: msg });
          this.shipVoucherMsg.set(msg);
        }
        this.cdr.detectChanges();
      }
    });
  }

  removeVoucher(forType: 'order' | 'shipping'): void {
    if (forType === 'order') {
      this.orderVoucherCode.set('');
      this.orderVoucherMsg.set('');
      this.orderVoucherResult.set(null);
    } else {
      this.shipVoucherCode.set('');
      this.shipVoucherMsg.set('');
      this.shipVoucherResult.set(null);
    }
    this.cdr.detectChanges();
  }

  // ✅ CẬP NHẬT: Mở modal — sort voucher theo saving giảm dần, đánh dấu tốt nhất
  openVoucherModal(forType: 'order' | 'shipping'): void {
    this.voucherModalFor   = forType;
    this.showVoucherModal  = true;
    this.isLoadingVouchers = true;
    this.bestVoucherCode.set('');
    this.cdr.detectChanges();

    this.http.get<VoucherInfo[]>(`${this.API_BASE}/promotions/available`).subscribe({
      next: (list) => {
        // Lọc đúng loại
        const filtered = (list || []).filter(v =>
          forType === 'shipping' ? v.type === 'shipping' : v.type === 'order'
        );

        // Tính saving thực tế rồi sort
        const withSaving = filtered.map(v => ({
          ...v,
          _saving:   this.calcVoucherSaving(v),
          _eligible: this.isVoucherEligible(v),
        }));

        // Eligible: sort theo tiết kiệm nhiều nhất lên đầu
        const eligible = withSaving
          .filter(v => v._eligible)
          .sort((a, b) => b._saving - a._saving);

        // Ineligible: sort theo minOrder tăng dần (gần đủ điều kiện lên đầu)
        const ineligible = withSaving
          .filter(v => !v._eligible)
          .sort((a, b) => (a.minOrder ?? 0) - (b.minOrder ?? 0));

        // Đánh dấu voucher tốt nhất
        if (eligible.length > 0) {
          this.bestVoucherCode.set(eligible[0].code);
        }

        this.availableVouchers.set([...eligible, ...ineligible]);
        this.isLoadingVouchers = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.availableVouchers.set([]);
        this.isLoadingVouchers = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeVoucherModal(): void {
    this.showVoucherModal = false;
    this.cdr.detectChanges();
  }

  selectVoucher(code: string, eligible: boolean): void {
    if (!eligible) return;
    this.voucherModalFor === 'order'
      ? this.orderVoucherCode.set(code)
      : this.shipVoucherCode.set(code);
    this.closeVoucherModal();
    this.applyVoucher(this.voucherModalFor);
  }

  voucherTypeLabel(v: VoucherInfo): string {
    if (v.discountType === 'freeship') return 'Miễn phí vận chuyển';
    if (v.discountType === 'percent')  return `Giảm ${v.discountValue}%`;
    if (v.discountType === 'fixed')    return `Giảm ${v.discountValue.toLocaleString('vi-VN')}₫`;
    return v.name;
  }

  voucherTypeIcon(v: VoucherInfo): string {
    if (v.discountType === 'freeship' || v.type === 'shipping') return 'bi-truck';
    if (v.discountType === 'percent')  return 'bi-percent';
    return 'bi-tag';
  }

  get voucherModalTitle(): string {
    return this.voucherModalFor === 'shipping'
      ? 'Mã giảm phí vận chuyển'
      : 'Mã giảm tiền hàng';
  }

  // ══════════════════════════════════════
  // PLACE ORDER
  // ══════════════════════════════════════
  placeOrder(): void {
    this.errorMsg.set('');
    if (this.isPlacing()) return;
    if (!this.items().length) { this.router.navigateByUrl('/cart'); return; }

    if (!this.selectedAddr) {
      this.errorMsg.set('Vui lòng chọn hoặc thêm địa chỉ nhận hàng');
      this.cdr.detectChanges(); return;
    }

    const badIds = this.items().filter(i => !/^[a-fA-F0-9]{24}$/.test(String(i.productId || '').trim()));
    if (badIds.length) {
      this.errorMsg.set('Có sản phẩm bị lỗi ID. Vui lòng thêm lại vào giỏ.');
      this.cdr.detectChanges(); return;
    }

    const addr = this.selectedAddr!;
    const note = this.checkoutForm.value.note || '';

    const customer: any = {
      fullName: addr.name, phone: addr.phone, email: '',
      address: addr.address, province: 'N/A', district: 'N/A', ward: 'N/A', note,
    };

    const payload: any = {
      customer,
      items: this.items().map(i => ({
        productId:    i.productId,
        variantId:    i.variantId || null,
        variantLabel: i.variantLabel || '',
        quantity:     i.quantity,
      })),
      shippingMethod: this.shippingMethod(),
      paymentMethod:  this.paymentMethod(),
      voucherCode:     this.isOrderVoucherApplied ? this.orderVoucherCode() : null,
      shipVoucherCode: this.isShipVoucherApplied  ? this.shipVoucherCode()  : null,
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

  goToOrderDetail(): void { this.showSuccess.set(false); this.router.navigate(['/profile/order-detail', this.successOrderId()]); }
  goToHome():        void { this.showSuccess.set(false); this.router.navigateByUrl('/'); }

  setShipping(m: ShippingMethod) { this.shippingMethod.set(m); }
  setPayment(m: PaymentMethod)   { this.paymentMethod.set(m); }
  goToCart() { this.router.navigateByUrl('/cart'); }
  vnd(n: number) { return n.toLocaleString('vi-VN') + '₫'; }

  private loadCheckoutItems(): void {
    try {
      const raw    = localStorage.getItem(this.CHECKOUT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      this.items.set(Array.isArray(parsed) ? parsed.filter((x: any) => x?.productId && x.quantity != null) : []);
    } catch { this.items.set([]); }
  }

  private clearAfterSuccess(): void {
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

    const userId = this.userId;
    if (userId) {
      const headers = new HttpHeaders({ 'x-user-id': userId });
      boughtIds.forEach(productId => {
        this.http.delete(`${this.API_BASE}/carts/remove/${productId}`, { headers })
          .subscribe({ error: () => {} });
      });
    }
    this.items.set([]);
  }
}