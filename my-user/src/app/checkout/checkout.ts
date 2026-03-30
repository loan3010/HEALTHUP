import {
  Component,
  computed,
  signal,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ApiService, GUEST_CART_STORAGE_KEY } from '../services/api.service';




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
  /** Các field cấu trúc — backend có thể chưa lưu hết; khi có thì ưu tiên dùng khi sửa */
  street?: string;
  provinceCode?: number;
  districtCode?: number;
  wardCode?: number;
  provinceName?: string;
  districtName?: string;
  wardName?: string;
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
  eligible?: boolean;
  ineligibleReason?: string;
  vipOnly?: boolean;
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
  maxDiscount?: number; // ✅ THÊM để tính lại discount khi đổi loại ship
  message: string;
}




@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.css'],
})
export class Checkout implements OnInit, OnDestroy {
  private readonly API_BASE     = 'http://localhost:3000/api';
  private readonly GEO_API      = 'https://provinces.open-api.vn/api';
  private readonly CART_KEY     = 'cart_v1';
  private readonly CHECKOUT_KEY = 'checkout_v1';




  userId = '';
  private token = '';




  items     = signal<CheckoutItem[]>([]);
  errorMsg  = signal('');
  isPlacing = signal(false);




  showSuccess      = signal(false);
  successOrderId   = signal('');
  successOrderCode = signal('');
  /** Mã SMS ngắn HU-… để tra cứu không cần đăng nhập */
  successGuestLookupCode = signal('');


  /** SĐT người nhận — hiển thị trên modal "đã gửi SMS đến số …" */
  successOrderPhone = signal('');


  /** Hotline hiển thị trong mockup SMS (cùng số banner checkout khách) */
  readonly supportHotlineDisplay = '0335 512 275';




  /**
   * Khách không đăng nhập: bấm Đặt hàng → gửi SMS OTP → modal mockup tin nhắn → nhập mã → tạo đơn.
   */
  showGuestOtpModal = signal(false);
  /** Mã 6 số nhập trong modal (không còn nhập OTP trên form địa chỉ). */
  guestOtpModalCode = signal('');
  /** Khi backend bật SMS_DEBUG_RETURN_OTP — hiện mã trong mockup (chỉ dev). */
  guestOtpModalDevCode = signal('');
  guestOtpModalError   = signal('');
  /** Đang gửi OTP lần đầu sau khi bấm Đặt hàng (nút chính). */
  isSendingCheckoutOtp = signal(false);
  /** Gửi lại mã trong modal */
  isSendingOtp         = signal(false);
  otpCooldownSec       = signal(0);
  private otpCooldownTimer: ReturnType<typeof setInterval> | null = null;




  guestAddrForm!: FormGroup;




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




  bestVoucherCode = signal<string>('');




  // ── Hạng thành viên ──
  userRank    = signal<string>('member');
  totalSpent  = signal<number>(0);
  recentSpent = signal<number>(0);
  showRankTooltip = false;




  rankProgressPercent = computed(() =>
    Math.min(100, Math.round((this.recentSpent() / 2_000_000) * 100))
  );




  rankProgressRemain = computed(() =>
    Math.max(0, 2_000_000 - this.recentSpent())
  );




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
  /** Tách riêng khỏi modal sổ địa chỉ (member) — tránh ghi đè danh sách khi cùng trang */
  guestDistricts: District[] = [];
  guestWards:     Ward[]     = [];
  loadingProvinces = false;
  loadingDistricts = false;
  loadingWards     = false;
  loadingGuestDistricts = false;
  loadingGuestWards     = false;
  fullAddressPreview = '';




  addrForm!: FormGroup;
  checkoutForm!: FormGroup;




  // ── Computed ──
  subTotal = computed(() =>
    this.items().reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0)
  );


  /**
   * Giao nhanh — một mức cố định (khớp backend calcShipping / orders.js).
   */
  readonly expressShippingFee = 30000;


  /**
   * Phí hiển thị trên thẻ «Giao tiêu chuẩn» — chỉ phụ thuộc tạm tính, không phụ thuộc radio đang chọn.
   */
  standardOptionDisplayFee = computed(() =>
    this.subTotal() > 500000 ? 0 : 20000
  );


  shippingFee = computed(() =>
    this.shippingMethod() === 'express'
      ? this.expressShippingFee
      : this.standardOptionDisplayFee()
  );




  discountOnItems = computed(() => {
    const r = this.orderVoucherResult();
    if (!r?.valid || r.discountOnType !== 'items') return 0;
    return r.discountAmount ?? 0;
  });




  // ✅ FIX: Tính lại động theo shippingFee() hiện tại thay vì dùng discountAmount đã cache
  discountOnShipping = computed(() => {
    const r = this.shipVoucherResult();
    if (!r?.valid || r.discountOnType !== 'shipping') return 0;

    const fee  = this.shippingFee();
    const maxD = r.maxDiscount ?? 0;

    if (r.discountType === 'freeship') {
      // freeship: giảm toàn bộ phí ship, nhưng không vượt maxDiscount nếu có
      return maxD > 0 ? Math.min(fee, maxD) : fee;
    }
    if (r.discountType === 'percent') {
      const raw = Math.round(fee * (r.discountValue ?? 0) / 100);
      return maxD > 0 ? Math.min(raw, maxD) : raw;
    }
    if (r.discountType === 'fixed') {
      return Math.min(r.discountValue ?? 0, fee);
    }
    return 0;
  });




  discount = computed(() => this.discountOnItems() + this.discountOnShipping());




  total = computed(() =>
    Math.max(0, this.subTotal() - this.discountOnItems() + this.shippingFee() - this.discountOnShipping())
  );




  get selectedAddr(): SavedAddress | undefined {
    return this.savedAddresses().find(a => this.getId(a) === this.selectedAddrId());
  }




  get canUseVouchers(): boolean {
    return !!(this.token && this.userId);
  }




  get shippingAddr(): SavedAddress | null {
    if (this.userId) {
      const a = this.selectedAddr;
      return a || null;
    }
    const v = this.guestAddrForm?.value;
    if (!v) return null;
    const name  = String(v.name || '').trim();
    const phone = String(v.phone || '').trim();
    const street = String(v.street || '').trim();
    if (!name || !phone || !street) return null;
    if (v.province === '' || v.province == null || v.district === '' || v.district == null) {
      return null;
    }
    if (v.ward === '' || v.ward == null) return null;
    const address = this.buildGuestAddressLine();
    if (!address || address.length < 8) return null;
    return { name, phone, address, isDefault: false };
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
      code:          r.code,
      name:          r.name ?? '',
      description:   r.description,
      type:          r.type,
      discountType:  r.discountType as any,
      discountValue: r.discountValue ?? 0,
    };
  }




  get appliedShipVoucherInfo(): VoucherInfo | undefined {
    const r = this.shipVoucherResult();
    if (!r?.valid || !r.code) return undefined;
    return {
      code:          r.code,
      name:          r.name ?? '',
      description:   r.description,
      type:          r.type,
      discountType:  r.discountType as any,
      discountValue: r.discountValue ?? 0,
    };
  }




  get memberRankLabel(): string {
    return this.userRank() === 'vip' ? '⭐ VIP' : 'Thành viên';
  }




  constructor(
    private fb:     FormBuilder,
    private router: Router,
    private http:   HttpClient,
    private cdr:    ChangeDetectorRef,
    private api:    ApiService
  ) {}




  ngOnInit(): void {
    this.checkoutForm  = this.fb.group({ note: [''] });
    this.guestAddrForm = this.fb.group({
      name:     ['', [Validators.required, Validators.minLength(2)]],
      phone:    ['', [Validators.required, Validators.pattern(/^0\d{9}$/)]],
      province: ['', Validators.required],
      district: ['', Validators.required],
      ward:     ['', Validators.required],
      street:   ['', [Validators.required, Validators.minLength(2)]],
    });
    this.buildAddrForm();
    this.loadCheckoutItems();
    if (!this.items().length) { this.router.navigateByUrl('/cart'); return; }




    try {
      const u     = JSON.parse(localStorage.getItem('user') || '{}');
      this.token  = localStorage.getItem('token') || '';
      this.userId = u.id || u._id || '';
    } catch {}




    if (!this.canUseVouchers) {
      this.removeVoucher('order');
      this.removeVoucher('shipping');
    }




    this.loadProvinces();
    if (this.userId && this.token) {
      this.loadSavedAddresses();
      this.loadUserRank();
    }
  }




  ngOnDestroy(): void {
    this.clearOtpCooldownTimer();
  }




  /** Hiển thị SĐT dạng 076***564 trong modal mockup SMS */
  maskPhoneDisplay(phone: string): string {
    const s = String(phone || '').trim();
    if (s.length < 7) {
      return s || '—';
    }
    return `${s.slice(0, 3)}***${s.slice(-3)}`;
  }




  /** Nhập OTP trong modal — chỉ số, tối đa 6 */
  onGuestOtpModalInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const v  = el.value.replace(/\D/g, '').slice(0, 6);
    el.value = v;
    this.guestOtpModalCode.set(v);
    this.guestOtpModalError.set('');
    this.cdr.detectChanges();
  }




  closeGuestOtpModal(): void {
    this.showGuestOtpModal.set(false);
    this.clearGuestOtpModalUi();
  }




  private clearGuestOtpModalUi(): void {
    this.guestOtpModalCode.set('');
    this.guestOtpModalDevCode.set('');
    this.guestOtpModalError.set('');
    this.clearOtpCooldownTimer();
    this.otpCooldownSec.set(0);
  }




  /**
   * Gửi lại OTP từ trong modal (cùng API, có cooldown).
   */
  resendGuestOtpFromModal(): void {
    const addr = this.shippingAddr;
    if (!addr || this.userId) {
      return;
    }
    const phone = String(addr.phone || '').trim();
    if (!/^0\d{9}$/.test(phone)) {
      return;
    }
    if (this.isSendingOtp() || this.otpCooldownSec() > 0) {
      return;
    }




    this.isSendingOtp.set(true);
    this.guestOtpModalError.set('');
    this.cdr.detectChanges();




    this.http
      .post<{ message?: string; devPlainOtp?: string }>(
        `${this.API_BASE}/orders/guest-checkout-otp/send`,
        { phone }
      )
      .subscribe({
        next: (res) => {
          this.isSendingOtp.set(false);
          this.guestOtpModalDevCode.set(String(res?.devPlainOtp || '').trim());
          this.startOtpCooldown(55);
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.isSendingOtp.set(false);
          this.guestOtpModalError.set(
            err?.error?.message || 'Không gửi lại được mã. Thử sau.'
          );
          this.cdr.detectChanges();
        },
      });
  }




  /**
   * Sau khi bấm Đặt hàng (khách): gọi API gửi OTP rồi mở modal mockup tin nhắn.
   */
  private beginGuestCheckoutOtpFlow(phone: string): void {
    this.isSendingCheckoutOtp.set(true);
    this.errorMsg.set('');
    this.cdr.detectChanges();




    this.http
      .post<{ message?: string; devPlainOtp?: string }>(
        `${this.API_BASE}/orders/guest-checkout-otp/send`,
        { phone }
      )
      .subscribe({
        next: (res) => {
          this.isSendingCheckoutOtp.set(false);
          this.guestOtpModalDevCode.set(String(res?.devPlainOtp || '').trim());
          this.guestOtpModalCode.set('');
          this.guestOtpModalError.set('');
          this.showGuestOtpModal.set(true);
          this.startOtpCooldown(55);
          this.cdr.detectChanges();
        },
        error: (err: HttpErrorResponse) => {
          this.isSendingCheckoutOtp.set(false);
          this.errorMsg.set(
            err?.error?.message || 'Không gửi được mã xác nhận. Thử lại.'
          );
          this.cdr.detectChanges();
        },
      });
  }




  private startOtpCooldown(sec: number): void {
    this.clearOtpCooldownTimer();
    this.otpCooldownSec.set(sec);
    this.otpCooldownTimer = setInterval(() => {
      const next = this.otpCooldownSec() - 1;
      this.otpCooldownSec.set(Math.max(0, next));
      if (next <= 0) {
        this.clearOtpCooldownTimer();
      }
      this.cdr.detectChanges();
    }, 1000);
  }




  private clearOtpCooldownTimer(): void {
    if (this.otpCooldownTimer) {
      clearInterval(this.otpCooldownTimer);
      this.otpCooldownTimer = null;
    }
  }




  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }




  private loadUserRank(): void {
    this.http.get<any>(`${this.API_BASE}/users/${this.userId}`, { headers: this.headers })
      .subscribe({
        next: (u) => {
          this.userRank.set(u.memberRank || 'member');
          this.totalSpent.set(u.totalSpent || 0);
          this.recentSpent.set(u.recentSpent || 0);
          this.cdr.detectChanges();
        },
        error: () => {}
      });
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

  /** Chuẩn hóa nhãn địa giới để so khớp với dữ liệu open-api (ví dụ "Tỉnh X" ↔ "X"). */
  private normalizeAdminLabel(s: string): string {
    return (s || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/^(tỉnh|thành phố|tp\.|huyện|quận|thị xã|tx\.|xã|phường|thị trấn|tt\.)\s+/i, '')
      .trim();
  }

  private adminNameMatches(apiName: string, fromAddress: string): boolean {
    const A = this.normalizeAdminLabel(apiName);
    const B = this.normalizeAdminLabel(fromAddress);
    if (!A || !B) return false;
    return A.includes(B) || B.includes(A);
  }

  openEditAddrModal(idx: number): void {
    this.isAddrEditMode = true;
    this.editingAddrIdx = idx;
    this.addrModalError = '';
    this.addrModalSuccess = '';
    this.districts = [];
    this.wards = [];

    const a = this.savedAddresses()[idx];
    const allParts = a.address.split(',').map((p: string) => p.trim()).filter(Boolean);
    const geoKeywords = ['tỉnh', 'thành phố', 'tp.', 'huyện', 'quận', 'thị xã', 'tx.', 'xã', 'phường', 'thị trấn', 'tt.'];
    const isGeoPart = (p: string) => geoKeywords.some((k) => p.toLowerCase().startsWith(k));
    const streetOnly = a.street || allParts.filter((p) => !isGeoPart(p)).join(', ') || a.address;

    this.addrForm.reset({
      name: a.name,
      phone: a.phone,
      province: '',
      district: '',
      ward: '',
      street: streetOnly,
      isDefault: a.isDefault,
    });
    // reset kích hoạt valueChanges → updatePreview chỉ còn street; khôi phục bản đầy đủ cho đến khi cascade xong
    this.fullAddressPreview = a.address;

    this.showAddrModal = true;
    this.cdr.detectChanges();

    const parts = allParts;
    const provinceKeywords = ['tỉnh', 'thành phố', 'tp.'];
    const districtKeywords = ['huyện', 'quận', 'thị xã', 'tx.'];
    const wardKeywords = ['xã', 'phường', 'thị trấn', 'tt.'];

    const findFirstPart = (keywords: string[]) =>
      parts.find((p) => keywords.some((k) => p.toLowerCase().startsWith(k))) || '';
    const findLastPart = (keywords: string[]) => {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        if (keywords.some((k) => p.toLowerCase().startsWith(k))) return p;
      }
      return '';
    };

    const hasStoredCodes =
      [a.provinceCode, a.districtCode, a.wardCode].some(
        (c) => c !== undefined && c !== null && String(c) !== ''
      );
    const hasGeoInText = parts.some((p) => {
      const low = p.toLowerCase();
      return (
        provinceKeywords.some((k) => low.startsWith(k)) ||
        districtKeywords.some((k) => low.startsWith(k)) ||
        wardKeywords.some((k) => low.startsWith(k))
      );
    });
    const hasGeoHint = hasStoredCodes || hasGeoInText;

    const resolveProvince = (): Province | undefined => {
      if (a.provinceCode != null && String(a.provinceCode) !== '') {
        const byCode = this.provinces.find((p) => p.code == a.provinceCode);
        if (byCode) return byCode;
      }
      const meta = (a.provinceName || '').trim();
      const fromAddr = findLastPart(provinceKeywords) || findFirstPart(provinceKeywords);
      for (const name of [meta, fromAddr]) {
        if (name.length < 2) continue;
        const hit = this.provinces.find((p) => this.adminNameMatches(p.name, name));
        if (hit) return hit;
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const seg = parts[i];
        if (!provinceKeywords.some((k) => seg.toLowerCase().startsWith(k))) continue;
        const hit = this.provinces.find((p) => this.adminNameMatches(p.name, seg));
        if (hit) return hit;
      }
      return undefined;
    };

    const doMatch = () => {
      if (!hasGeoHint) {
        this.updatePreview();
        this.cdr.detectChanges();
        return;
      }

      const province = resolveProvince();
      if (!province) {
        this.updatePreview();
        this.cdr.detectChanges();
        return;
      }

      this.loadingDistricts = true;
      this.cdr.detectChanges();

      this.http.get<any>(`${this.GEO_API}/p/${province.code}?depth=2`).subscribe({
        next: (d) => {
          this.districts = d.districts || [];
          this.loadingDistricts = false;
          this.addrForm.patchValue({ province: province.code }, { emitEvent: false });

          const districtLabel =
            (a.districtName || '').trim() ||
            findLastPart(districtKeywords) ||
            findFirstPart(districtKeywords);

          let district: District | undefined;
          if (a.districtCode != null && String(a.districtCode) !== '') {
            district = this.districts.find((di) => di.code == a.districtCode);
          }
          if (!district && districtLabel.length > 1) {
            district = this.districts.find((di) => this.adminNameMatches(di.name, districtLabel));
          }

          if (!district) {
            this.updatePreview();
            this.cdr.detectChanges();
            return;
          }

          this.loadingWards = true;
          this.cdr.detectChanges();

          this.http.get<any>(`${this.GEO_API}/d/${district.code}?depth=2`).subscribe({
            next: (dw) => {
              this.wards = dw.wards || [];
              this.loadingWards = false;

              const wardLabel =
                (a.wardName || '').trim() ||
                findFirstPart(wardKeywords) ||
                findLastPart(wardKeywords);

              let ward: Ward | undefined;
              if (a.wardCode != null && String(a.wardCode) !== '') {
                ward = this.wards.find((w) => w.code == a.wardCode);
              }
              if (!ward && wardLabel.length > 1) {
                ward = this.wards.find((w) => this.adminNameMatches(w.name, wardLabel));
              }

              this.addrForm.patchValue(
                { district: district.code, ward: ward ? ward.code : '' },
                { emitEvent: false }
              );
              this.updatePreview();
              this.cdr.detectChanges();
            },
            error: () => {
              this.loadingWards = false;
              this.cdr.detectChanges();
            },
          });
        },
        error: () => {
          this.loadingDistricts = false;
          this.cdr.detectChanges();
        },
      });
    };

    if (!this.provinces.length) {
      this.loadingProvinces = true;
      this.cdr.detectChanges();
      this.http.get<Province[]>(`${this.GEO_API}/?depth=1`).subscribe({
        next: (d) => {
          this.provinces = d;
          this.loadingProvinces = false;
          this.cdr.detectChanges();
          doMatch();
        },
        error: () => {
          this.loadingProvinces = false;
          this.cdr.detectChanges();
        },
      });
    } else {
      doMatch();
    }
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


  /** Lỗi từng ô form địa chỉ khách — chỉ hiện sau touched / submit. */
  showGuestAddrError(field: string): boolean {
    const f = this.guestAddrForm.get(field);
    return !!(f && f.invalid && (f.dirty || f.touched));
  }


  /** Ghép một dòng địa chỉ đầy đủ gửi lên API (giống logic sổ địa chỉ). */
  private buildGuestAddressLine(): string {
    const v = this.guestAddrForm?.value;
    if (!v) return '';
    const pName = this.provinces.find((p) => p.code == v.province)?.name || '';
    const dName = this.guestDistricts.find((d) => d.code == v.district)?.name || '';
    const wName = this.guestWards.find((w) => w.code == v.ward)?.name || '';
    const street = String(v.street || '').trim();
    return [street, wName, dName, pName].filter(Boolean).join(', ');
  }


  onGuestProvinceChange(): void {
    const code = this.guestAddrForm.get('province')?.value;
    this.guestDistricts = [];
    this.guestWards = [];
    this.guestAddrForm.patchValue({ district: '', ward: '' }, { emitEvent: false });
    if (!code) {
      this.cdr.detectChanges();
      return;
    }
    this.loadingGuestDistricts = true;
    this.http.get<any>(`${this.GEO_API}/p/${code}?depth=2`).subscribe({
      next: (d) => {
        this.guestDistricts = d.districts || [];
        this.loadingGuestDistricts = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingGuestDistricts = false;
        this.cdr.detectChanges();
      },
    });
  }


  onGuestDistrictChange(): void {
    const code = this.guestAddrForm.get('district')?.value;
    this.guestWards = [];
    this.guestAddrForm.patchValue({ ward: '' }, { emitEvent: false });
    if (!code) {
      this.cdr.detectChanges();
      return;
    }
    this.loadingGuestWards = true;
    this.http.get<any>(`${this.GEO_API}/d/${code}?depth=2`).subscribe({
      next: (d) => {
        this.guestWards = d.wards || [];
        this.loadingGuestWards = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loadingGuestWards = false;
        this.cdr.detectChanges();
      },
    });
  }


  onGuestWardChange(): void {
    this.cdr.detectChanges();
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
    if (v.eligible === false) return false;
    return this.subTotal() >= (v.minOrder ?? 0);
  }




  voucherDisabledReason(v: VoucherInfo): string {
    if (v.ineligibleReason) return v.ineligibleReason;
    const min = v.minOrder ?? 0;
    if (this.subTotal() < min) {
      return `Cần thêm ${this.vnd(min - this.subTotal())} để dùng mã này`;
    }
    return '';
  }




  calcVoucherSaving(v: VoucherInfo): number {
    if (!this.isVoucherEligible(v)) return 0;
    if (v.discountType === 'freeship') return this.shippingFee();
    const base = v.type === 'shipping' ? this.shippingFee() : this.subTotal();
    if (v.discountType === 'percent') {
      const saving = Math.round(base * v.discountValue / 100);
      return v.maxDiscount ? Math.min(saving, v.maxDiscount) : saving;
    }
    if (v.discountType === 'fixed') return Math.min(v.discountValue, base);
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
    if (!this.canUseVouchers) return;




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




    const cartProductIds = this.items().map(i => i.productId);




    this.http.post<ApplyVoucherResult>(
      `${this.API_BASE}/promotions/apply`,
      { code, subTotal: this.subTotal(), shippingFee: this.shippingFee(), cartProductIds },
      { headers: this.headers }
    ).subscribe({
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
          // ✅ Lưu thêm maxDiscount từ backend để computed discountOnShipping dùng lại
          this.shipVoucherResult.set({
            ...res,
            maxDiscount: (res as any).maxDiscount ?? 0,
          });
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




  openVoucherModal(forType: 'order' | 'shipping'): void {
    if (!this.canUseVouchers) return;
    this.voucherModalFor   = forType;
    this.showVoucherModal  = true;
    this.isLoadingVouchers = true;
    this.bestVoucherCode.set('');
    this.cdr.detectChanges();




    const cartProductIds = this.items().map(i => i.productId).join(',');




    this.http.get<VoucherInfo[]>(
      `${this.API_BASE}/promotions/available`,
      {
        headers: this.headers,
        params: {
          subTotal:    String(this.subTotal()),
          shippingFee: String(this.shippingFee()),
          cartProductIds,
        }
      }
    ).subscribe({
      next: (list) => {
        const filtered = (list || []).filter(v =>
          forType === 'shipping' ? v.type === 'shipping' : v.type === 'order'
        );




        const eligible   = filtered.filter(v => v.eligible !== false);
        const ineligible = filtered.filter(v => v.eligible === false);




        let bestCode = '';
        if (eligible.length > 0) {
          const best = eligible.reduce((prev, curr) =>
            this.calcVoucherSaving(curr) > this.calcVoucherSaving(prev) ? curr : prev
          );
          bestCode = best.code;
          this.bestVoucherCode.set(bestCode);
        }




        const sortedEligible = eligible.sort((a, b) => {
          if (a.code === bestCode) return -1;
          if (b.code === bestCode) return  1;
          return this.calcVoucherSaving(b) - this.calcVoucherSaving(a);
        });




        const sortedIneligible = ineligible.sort((a, b) =>
          (a.minOrder ?? 0) - (b.minOrder ?? 0)
        );




        this.availableVouchers.set([...sortedEligible, ...sortedIneligible]);
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
  // THỜI GIAN NHẬN HÀNG DỰ KIẾN
  // ══════════════════════════════════════
  getEstimatedDeliveryDate(): string {
    const now = new Date();
    let daysToAdd = 0;

    if (this.shippingMethod() === 'express') {
      daysToAdd = 2;
    } else {
      daysToAdd = 4;
    }

    const estimatedDate = new Date(now);
    estimatedDate.setDate(now.getDate() + daysToAdd);

    return estimatedDate.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }




  // ══════════════════════════════════════
  // PLACE ORDER
  // ══════════════════════════════════════




  private parseAddressParts(fullAddress: string): { province: string; district: string; ward: string } {
    const parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 4) {
      return {
        province: parts[parts.length - 1],
        district: parts[parts.length - 2],
        ward:     parts[parts.length - 3],
      };
    }
    if (parts.length === 3) return { province: parts[2], district: parts[1], ward: parts[0] };
    if (parts.length === 2) return { province: parts[1], district: parts[0], ward: parts[0] };
    return { province: fullAddress, district: fullAddress, ward: fullAddress };
  }




  private buildOrderPayloadForSubmit():
    | { payload: Record<string, unknown>; headers: HttpHeaders }
    | null {
    const addr = this.shippingAddr;
    if (!addr) {
      return null;
    }




    const note = this.checkoutForm.value.note || '';
    let province = '';
    let district = '';
    let ward = '';
    if (this.userId) {
      const parsed = this.parseAddressParts(addr.address);
      province = parsed.province;
      district = parsed.district;
      ward = parsed.ward;
    } else {
      const v = this.guestAddrForm.value;
      province = this.provinces.find((p) => p.code == v.province)?.name || '';
      district = this.guestDistricts.find((d) => d.code == v.district)?.name || '';
      ward = this.guestWards.find((w) => w.code == v.ward)?.name || '';
    }


    const customer: Record<string, string> = {
      fullName: addr.name,
      phone:    addr.phone,
      email:    '',
      address:  addr.address,
      province,
      district,
      ward,
      note,
    };




    const useVoucher = this.canUseVouchers;
    const payload: Record<string, unknown> = {
      customer,
      items: this.items().map((i) => ({
        productId:    i.productId,
        variantId:    i.variantId    || null,
        variantLabel: i.variantLabel || '',
        quantity:     i.quantity,
      })),
      shippingMethod:  this.shippingMethod(),
      paymentMethod:   this.paymentMethod(),
      voucherCode:     useVoucher && this.isOrderVoucherApplied ? this.orderVoucherCode() : null,
      shipVoucherCode: useVoucher && this.isShipVoucherApplied  ? this.shipVoucherCode()  : null,
    };
    if (this.userId) {
      payload['userId'] = this.userId;
    }




    if (!this.token) {
      try {
        const gid = localStorage.getItem(GUEST_CART_STORAGE_KEY);
        if (gid && /^[0-9a-f-]{36}$/i.test(gid)) {
          payload['guestCartSessionId'] = gid;
        }
      } catch { /* ignore */ }
    }




    let headers = new HttpHeaders();
    if (this.token) {
      headers = headers.set('Authorization', `Bearer ${this.token}`);
    }




    return { payload, headers };
  }




  private executeOrderSubmit(
    payload: Record<string, unknown>,
    headers: HttpHeaders,
    addr: { phone: string },
    opts: { closeOtpModalOnSuccess: boolean; otpErrorInModal: boolean }
  ): void {
    this.isPlacing.set(true);
    this.errorMsg.set('');
    if (opts.otpErrorInModal) {
      this.guestOtpModalError.set('');
    }
    this.cdr.detectChanges();




    this.http.post<any>(`${this.API_BASE}/orders`, payload, { headers }).subscribe({
      next: (res) => {
        const orderId = res?.orderId ?? res?.id ?? res?._id ?? '';
        this.clearAfterSuccess();
        this.isPlacing.set(false);
        if (opts.closeOtpModalOnSuccess) {
          this.showGuestOtpModal.set(false);
          this.clearGuestOtpModalUi();
        }
        this.successOrderId.set(String(orderId));
        this.successOrderCode.set(String(res?.orderCode || ''));
        this.successGuestLookupCode.set(String(res?.guestLookupCode || '').trim());
        this.successOrderPhone.set(String(addr.phone || '').trim());
        this.showSuccess.set(true);




        if (this.userId && this.token) {
          this.loadUserRank();
        }




        this.api.refreshUnreadCount();
        this.api.refreshCartCount();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        const msg =
          err?.error?.message ||
          err?.error?.error ||
          err?.message ||
          'Đặt hàng thất bại. Thử lại nhé!';
        this.isPlacing.set(false);
        if (opts.otpErrorInModal) {
          this.guestOtpModalError.set(msg);
        } else {
          this.errorMsg.set(msg);
        }
        this.cdr.detectChanges();
      },
    });
  }




  /** Khách: đã có modal OTP — bấm xác nhận để tạo đơn */
  confirmGuestOrderFromModal(): void {
    if (this.isPlacing()) {
      return;
    }
    const otp = this.guestOtpModalCode().replace(/\D/g, '');
    if (!/^\d{6}$/.test(otp)) {
      this.guestOtpModalError.set('Nhập đủ 6 số mã trong tin nhắn HEALTHUP.');
      this.cdr.detectChanges();
      return;
    }




    const built = this.buildOrderPayloadForSubmit();
    if (!built) {
      this.closeGuestOtpModal();
      this.errorMsg.set('Thiếu thông tin giao hàng. Kiểm tra lại form.');
      this.cdr.detectChanges();
      return;
    }




    const addr = this.shippingAddr;
    if (!addr) {
      this.closeGuestOtpModal();
      return;
    }




    const payload = { ...built.payload, guestCheckoutOtp: otp };
    this.executeOrderSubmit(payload, built.headers, addr, {
      closeOtpModalOnSuccess: true,
      otpErrorInModal:        true,
    });
  }




  placeOrder(): void {
    this.errorMsg.set('');
    if (this.isPlacing() || this.isSendingCheckoutOtp()) {
      return;
    }
    if (!this.items().length) {
      this.router.navigateByUrl('/cart');
      return;
    }




    const addr = this.shippingAddr;
    if (!addr) {
      this.errorMsg.set(
        this.userId
          ? 'Vui lòng chọn hoặc thêm địa chỉ nhận hàng'
          : 'Vui lòng nhập họ tên, SĐT (10 số bắt đầu 0), chọn tỉnh/thành → quận/huyện → phường/xã và địa chỉ chi tiết'
      );
      this.cdr.detectChanges();
      return;
    }




    const badIds = this.items().filter((i) =>
      !/^[a-fA-F0-9]{24}$/.test(String(i.productId || '').trim())
    );
    if (badIds.length) {
      this.errorMsg.set('Có sản phẩm bị lỗi ID. Vui lòng thêm lại vào giỏ.');
      this.cdr.detectChanges();
      return;
    }




    if (!this.userId) {
      if (this.guestAddrForm.invalid) {
        this.guestAddrForm.markAllAsTouched();
        this.errorMsg.set(
          'Vui lòng kiểm tra họ tên, SĐT và địa chỉ (tỉnh / quận / phường + số nhà, đường).'
        );
        this.cdr.detectChanges();
        return;
      }
      const phone = String(addr.phone || '').trim();
      if (!/^0\d{9}$/.test(phone)) {
        this.errorMsg.set('Số điện thoại không hợp lệ.');
        this.cdr.detectChanges();
        return;
      }
      this.beginGuestCheckoutOtpFlow(phone);
      return;
    }




    const built = this.buildOrderPayloadForSubmit();
    if (!built) {
      return;
    }
    this.executeOrderSubmit(built.payload, built.headers, addr, {
      closeOtpModalOnSuccess: false,
      otpErrorInModal:        false,
    });
  }




  goToOrderDetail(): void {
    this.showSuccess.set(false);
    const id = this.successOrderId();
    if (this.token && this.userId) {
      this.router.navigate(['/profile/order-detail', id]);
    } else {
      this.router.navigate(['/tra-cuu-don'], {
        queryParams: {
          code: this.successGuestLookupCode() || this.successOrderCode() || undefined,
        },
      });
    }
  }




  goToHome():        void { this.showSuccess.set(false); this.router.navigateByUrl('/'); }
  setShipping(m: ShippingMethod) { this.shippingMethod.set(m); }
  setPayment(m: PaymentMethod)   { this.paymentMethod.set(m); }
  goToCart() { this.router.navigateByUrl('/cart'); }




  guestOrderLookupAbsUrl(): string {
    if (typeof window === 'undefined') {
      return '/tra-cuu-don';
    }
    return `${window.location.origin}/tra-cuu-don`;
  }




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
    let cartHeaders: HttpHeaders | null = null;
    if (userId && /^[a-f0-9]{24}$/i.test(String(userId).trim())) {
      cartHeaders = new HttpHeaders({ 'x-user-id': String(userId).trim() });
    } else {
      try {
        const gid = localStorage.getItem(GUEST_CART_STORAGE_KEY);
        if (gid && /^[0-9a-f-]{36}$/i.test(gid)) {
          cartHeaders = new HttpHeaders({ 'x-guest-cart-id': gid });
        }
      } catch { /* ignore */ }
    }
    if (cartHeaders) {
      this.items().forEach((i) => {
        const q = i.variantId
          ? `?variantId=${encodeURIComponent(String(i.variantId))}`
          : '';
        this.http
          .delete(`${this.API_BASE}/carts/remove/${i.productId}${q}`, { headers: cartHeaders! })
          .subscribe({ error: () => {} });
      });
    }
    this.items.set([]);
  }
}