import { Component, EventEmitter, HostListener, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminOrderService,
  HotlineOrderPayload,
  HotlineOrderPreview,
} from '../order/order.service';
import {
  CustomerItem,
  CustomerSavedAddress,
  CustomerService,
} from '../../admin-customer/customer/customer.service';
import { VnAddressService, VnDivisionRow } from '../vn-address.service';

/** Một dòng sản phẩm trên form tạo đơn. */
export interface OrderFormLine {
  search: string;
  suggestions: any[];
  showSuggest: boolean;
  productId: string;
  productName: string;
  sku: string;
  basePrice: number;
  baseStock: number;
  /** SP bị admin đánh dấu tạm ngừng bán — không cho tạo đơn. */
  productPaused: boolean;
  variants: Array<{ _id: string; label: string; price: number; stock: number }>;
  variantId: string;
  quantity: number;
}

function emptyLine(): OrderFormLine {
  return {
    search: '',
    suggestions: [],
    showSuggest: false,
    productId: '',
    productName: '',
    sku: '',
    basePrice: 0,
    baseStock: 0,
    productPaused: false,
    variants: [],
    variantId: '',
    quantity: 1,
  };
}

/** Gốc website khách (SMS + mockup). Đổi nếu chạy my-user cổng khác. */
const USER_SHOP_ORIGIN = 'http://localhost:4200';

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-form.html',
  styleUrl: './order-form.css',
})
export class OrderFormComponent implements OnInit, OnDestroy {
  @Output() cancelled = new EventEmitter<void>();
  /** ID đơn vừa tạo — parent mở chi tiết. */
  @Output() created = new EventEmitter<string>();

  provinces: VnDivisionRow[] = [];
  districts: VnDivisionRow[] = [];
  wards: VnDivisionRow[] = [];
  provinceCode = '';
  districtCode = '';
  wardCode = '';

  customerPhoneSearch = '';
  customerHits: CustomerItem[] = [];
  showCustomerHits = false;
  linkedUserId = '';

  /** Người gọi đặt — SMS gửi về SĐT này. */
  ordererFullName = '';
  ordererPhone = '';
  ordererEmail = '';

  /** Địa chỉ đã lưu trên tài khoản (chỉ khi đã liên kết user). */
  linkedAddresses: CustomerSavedAddress[] = [];
  linkedAddressesLoading = false;
  /** Lỗi tải sổ địa chỉ (hiển thị thay vì im lặng như "chưa lưu"). */
  linkedAddressesError = '';
  /**
   * true: đang dùng chuỗi địa chỉ một dòng từ sổ (backend chấp nhận province/district/ward rỗng).
   * false: nhập tay với bộ chọn tỉnh/huyện/xã.
   */
  useFullLineFromSavedBook = false;
  /** Highlight dòng đang chọn trong sổ (so sánh _id). */
  selectedSavedAddressId = '';

  fullName = '';
  phone = '';
  email = '';
  streetAddress = '';
  note = '';

  shippingMethod: 'standard' | 'express' = 'standard';
  paymentMethod: 'cod' | 'momo' | 'vnpay' = 'cod';
  voucherCode = '';
  shipVoucherCode = '';

  lines: OrderFormLine[] = [emptyLine()];

  preview: HotlineOrderPreview | null = null;
  previewLoading = false;
  previewError = '';
  submitError = '';
  submitting = false;

  /** Modal xác nhận trước khi POST tạo đơn. */
  showConfirmCreate = false;
  /** Sau tạo thành công: mockup tin nhắn cho admin (SMS tùy có/không TK). */
  showSuccessMockup = false;
  successOrderCode = '';
  successGuestLookupCode = '';
  /** true = đã gắn userId — mockup hướng dẫn vào Đơn hàng của tôi, không nhấn mã HU. */
  successLinkedMember = false;
  /** ID Mongo đơn vừa tạo — emit khi đóng mockup. */
  private successLastOrderId = '';

  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private productSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private customerSearchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private orderService: AdminOrderService,
    private customerService: CustomerService,
    private vnAddress: VnAddressService
  ) {}

  ngOnInit(): void {
    this.vnAddress.getProvinces().subscribe({
      next: (rows) => (this.provinces = rows),
      error: () => (this.provinces = []),
    });
  }

  ngOnDestroy(): void {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    if (this.productSearchTimer) clearTimeout(this.productSearchTimer);
    if (this.customerSearchTimer) clearTimeout(this.customerSearchTimer);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent): void {
    const t = ev.target as HTMLElement;
    if (!t.closest('.of-suggest-wrap') && !t.closest('.of-cust-suggest')) {
      this.lines.forEach((l) => (l.showSuggest = false));
      this.showCustomerHits = false;
    }
  }

  onProvinceChange(): void {
    this.districtCode = '';
    this.wardCode = '';
    this.districts = [];
    this.wards = [];
    if (!this.provinceCode) return;
    this.vnAddress.getDistrictsByProvince(this.provinceCode).subscribe({
      next: (rows) => (this.districts = rows),
      error: () => (this.districts = []),
    });
    this.schedulePreview();
  }

  onDistrictChange(): void {
    this.wardCode = '';
    this.wards = [];
    if (!this.districtCode) return;
    this.vnAddress.getWardsByDistrict(this.districtCode).subscribe({
      next: (rows) => (this.wards = rows),
      error: () => (this.wards = []),
    });
    this.schedulePreview();
  }

  onWardChange(): void {
    this.schedulePreview();
  }

  /** Tên hiển thị từ mã đã chọn (lưu vào đơn). */
  private divisionName(rows: VnDivisionRow[], code: string): string {
    const r = rows.find((x) => x.code === code);
    return r?.name || '';
  }

  onCustomerPhoneInput(): void {
    if (this.customerSearchTimer) clearTimeout(this.customerSearchTimer);
    this.customerSearchTimer = setTimeout(() => this.runCustomerSearch(), 350);
  }

  private runCustomerSearch(): void {
    const q = this.customerPhoneSearch.trim();
    if (q.length < 3) {
      this.customerHits = [];
      this.showCustomerHits = false;
      return;
    }
    this.customerService.getAll({ search: q, page: 1, limit: 12 }).subscribe({
      next: (res) => {
        this.customerHits = res.data || [];
        this.showCustomerHits = this.customerHits.length > 0;
      },
      error: () => {
        this.customerHits = [];
        this.showCustomerHits = false;
      },
    });
  }

  pickCustomer(c: CustomerItem): void {
    this.linkedUserId = c.id;
    this.ordererFullName = ((c.username || '') as string).trim() || 'Khách hàng';
    this.ordererPhone = (c.phone || '').trim();
    this.ordererEmail = (c.email || '').trim();
    this.customerPhoneSearch = this.ordererPhone;
    this.showCustomerHits = false;
    this.customerHits = [];
    this.linkedAddresses = [];
    this.useFullLineFromSavedBook = false;
    this.linkedAddressesError = '';
    this.fullName = '';
    this.phone = '';
    this.email = '';
    this.streetAddress = '';
    this.provinceCode = '';
    this.districtCode = '';
    this.wardCode = '';
    this.districts = [];
    this.wards = [];

    const uid = String(c.id || '').trim();
    if (!uid) {
      this.linkedAddressesError = 'Thiếu ID khách — chọn lại từ danh sách gợi ý.';
      return;
    }

    // Tải sổ địa chỉ; nếu có mặc định hoặc chỉ 1 dòng → áp dụng luôn cho người nhận + địa chỉ giao.
    this.linkedAddressesLoading = true;
    this.customerService.getAddresses(uid).subscribe({
      next: (res) => {
        this.linkedAddressesLoading = false;
        this.linkedAddressesError = '';
        this.linkedAddresses = res.addresses || [];
        const def = this.linkedAddresses.find((a) => a.isDefault);
        if (def) {
          this.pickSavedAddress(def);
        } else if (this.linkedAddresses.length === 1) {
          this.pickSavedAddress(this.linkedAddresses[0]);
        } else {
          this.selectedSavedAddressId = '';
        }
        this.schedulePreview();
      },
      error: (err) => {
        this.linkedAddressesLoading = false;
        this.linkedAddresses = [];
        this.selectedSavedAddressId = '';
        this.linkedAddressesError =
          err?.error?.message || err?.message || 'Không tải được sổ địa chỉ — kiểm tra backend / mạng.';
        this.schedulePreview();
      },
    });
  }

  clearLinkedCustomer(): void {
    this.linkedUserId = '';
    this.ordererFullName = '';
    this.ordererPhone = '';
    this.ordererEmail = '';
    this.linkedAddresses = [];
    this.useFullLineFromSavedBook = false;
    this.linkedAddressesLoading = false;
    this.selectedSavedAddressId = '';
    this.linkedAddressesError = '';
  }

  /** Chọn một dòng trong sổ địa chỉ — một chuỗi đầy đủ, không bắt buộc tách tỉnh/huyện/xã. */
  pickSavedAddress(a: CustomerSavedAddress): void {
    this.useFullLineFromSavedBook = true;
    this.fullName = (a.name || '').trim() || 'Khách hàng';
    this.phone = (a.phone || '').trim() || this.phone;
    this.provinceCode = '';
    this.districtCode = '';
    this.wardCode = '';
    this.districts = [];
    this.wards = [];
    this.streetAddress = (a.address || '').trim();
    this.schedulePreview();
  }

  /** Địa chỉ giao không nằm trong sổ — nhập tay + chọn tỉnh/huyện/xã. */
  chooseManualShippingAddress(): void {
    this.selectedSavedAddressId = '';
    this.useFullLineFromSavedBook = false;
    this.streetAddress = '';
    this.provinceCode = '';
    this.districtCode = '';
    this.wardCode = '';
    this.districts = [];
    this.wards = [];
    this.schedulePreview();
  }

  onLineSearchInput(idx: number): void {
    const line = this.lines[idx];
    line.productId = '';
    line.productName = '';
    line.variantId = '';
    line.variants = [];
    if (this.productSearchTimer) clearTimeout(this.productSearchTimer);
    this.productSearchTimer = setTimeout(() => this.fetchProductSuggestions(idx), 320);
  }

  private fetchProductSuggestions(idx: number): void {
    const line = this.lines[idx];
    if (!line) return;
    const q = line.search.trim();
    if (q.length < 2) {
      line.suggestions = [];
      line.showSuggest = false;
      return;
    }
    this.orderService.searchProductsForOrder(q, 15).subscribe({
      next: (rows) => {
        line.suggestions = rows;
        line.showSuggest = rows.length > 0;
      },
      error: () => {
        line.suggestions = [];
        line.showSuggest = false;
      },
    });
  }

  pickProduct(idx: number, p: any): void {
    const line = this.lines[idx];
    line.productId = String(p._id);
    line.productName = String(p.name || '');
    line.sku = String(p.sku || '');
    line.basePrice = Number(p.price || 0);
    line.baseStock = Number(p.stock ?? 0);
    line.productPaused = !!p.isOutOfStock;
    line.variants = (Array.isArray(p.variants) ? p.variants : []).map((v: any) => ({
      _id: String(v._id),
      label: String(v.label || ''),
      price: Number(v.price || 0),
      stock: Number(v.stock ?? 0),
    }));
    line.variantId = line.variants.length ? line.variants[0]._id : '';
    line.search = line.productName;
    line.showSuggest = false;
    line.suggestions = [];
    this.schedulePreview();
  }

  lineUnitPrice(line: OrderFormLine): number {
    if (!line.productId) return 0;
    if (line.variants.length && line.variantId) {
      const v = line.variants.find((x) => x._id === line.variantId);
      if (v) return v.price;
    }
    return line.basePrice;
  }

  lineStock(line: OrderFormLine): number {
    if (!line.productId) return 0;
    if (line.variants.length && line.variantId) {
      const v = line.variants.find((x) => x._id === line.variantId);
      if (v) return v.stock;
    }
    return line.baseStock;
  }

  onVariantOrQtyChange(): void {
    this.schedulePreview();
  }

  addLine(): void {
    this.lines.push(emptyLine());
  }

  removeLine(idx: number): void {
    if (this.lines.length <= 1) return;
    this.lines.splice(idx, 1);
    this.schedulePreview();
  }

  schedulePreview(): void {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => this.runPreview(), 450);
  }

  private buildPayload(): HotlineOrderPayload | null {
    const pName = this.divisionName(this.provinces, this.provinceCode);
    const dName = this.divisionName(this.districts, this.districtCode);
    const wName = this.divisionName(this.wards, this.wardCode);

    const items = this.lines
      .filter((l) => l.productId && l.quantity > 0)
      .map((l) => {
        let variantLabel = '';
        if (l.variants.length && l.variantId) {
          const v = l.variants.find((x) => x._id === l.variantId);
          variantLabel = v?.label || '';
        }
        return {
          productId: l.productId,
          quantity: l.quantity,
          variantId: l.variantId || undefined,
          variantLabel,
        };
      });

    if (!items.length) return null;

    return {
      orderer: {
        fullName: this.ordererFullName.trim(),
        phone: this.ordererPhone.trim(),
        email: this.ordererEmail.trim(),
      },
      customer: {
        fullName: this.fullName.trim(),
        phone: this.phone.trim(),
        email: this.email.trim(),
        address: this.streetAddress.trim(),
        province: pName || '',
        district: dName || '',
        ward: wName || '',
        note: this.note.trim(),
      },
      items,
      shippingMethod: this.shippingMethod,
      paymentMethod: this.paymentMethod,
      voucherCode: this.voucherCode.trim() || null,
      shipVoucherCode: this.shipVoucherCode.trim() || null,
      userId: this.linkedUserId || undefined,
    };
  }

  private runPreview(): void {
    const payload = this.buildPayload();
    if (!payload) {
      this.preview = null;
      this.previewError = '';
      return;
    }
    this.previewLoading = true;
    this.previewError = '';
    this.orderService.previewHotlineOrder(payload).subscribe({
      next: (p) => {
        this.preview = p;
        this.previewLoading = false;
      },
      error: (err) => {
        this.preview = null;
        this.previewLoading = false;
        this.previewError = err?.error?.message || err?.message || 'Không xem trước được';
      },
    });
  }

  submit(): void {
    this.submitError = '';
    if (!this.ordererFullName.trim() || !this.ordererPhone.trim()) {
      this.submitError = 'Nhập họ tên và SĐT người đặt hàng.';
      return;
    }
    if (!/^0\d{9}$/.test(this.ordererPhone.trim())) {
      this.submitError = 'SĐT người đặt phải 10 số, bắt đầu bằng 0.';
      return;
    }
    if (!this.fullName.trim() || !this.phone.trim() || !this.streetAddress.trim()) {
      this.submitError = 'Nhập đủ họ tên người nhận, SĐT nhận, và địa chỉ giao.';
      return;
    }
    if (!/^0\d{9}$/.test(this.phone.trim())) {
      this.submitError = 'SĐT người nhận phải 10 số, bắt đầu bằng 0.';
      return;
    }
    // Địa chỉ từ sổ: một dòng đầy đủ — backend cho phép ward/province/district rỗng (giống checkout).
    if (!this.useFullLineFromSavedBook) {
      if (!this.provinceCode || !this.districtCode || !this.wardCode) {
        this.submitError = 'Chọn đủ Tỉnh/Thành, Quận/Huyện, Phường/Xã — hoặc chọn địa chỉ đã lưu.';
        return;
      }
    }
    for (let i = 0; i < this.lines.length; i++) {
      const l = this.lines[i];
      if (!l.productId) continue;
      if (l.productPaused) {
        this.submitError = `Dòng ${i + 1}: sản phẩm tạm ngừng bán — chọn SP khác.`;
        return;
      }
      if (l.variants.length > 0 && !l.variantId) {
        this.submitError = `Dòng ${i + 1}: chọn phân loại (biến thể).`;
        return;
      }
    }

    const payload = this.buildPayload();
    if (!payload) {
      this.submitError = 'Thêm ít nhất một sản phẩm hợp lệ.';
      return;
    }

    this.showConfirmCreate = true;
  }

  /** Đóng modal xác nhận không gọi API. */
  closeConfirmCreate(): void {
    this.showConfirmCreate = false;
  }

  /** User xác nhận trong modal — POST tạo đơn. */
  confirmCreateSubmit(): void {
    const payload = this.buildPayload();
    if (!payload) {
      this.submitError = 'Thiếu dữ liệu — kiểm tra lại form.';
      this.showConfirmCreate = false;
      return;
    }
    this.showConfirmCreate = false;
    this.submitting = true;
    this.submitError = '';
    this.orderService.createAdminHotlineOrder(payload).subscribe({
      next: (res) => {
        this.submitting = false;
        this.successLastOrderId = String(res.orderId || '');
        this.successOrderCode = String(res.orderCode || '').trim();
        this.successGuestLookupCode = String(res.guestLookupCode || '').trim();
        this.successLinkedMember = !!this.linkedUserId?.trim();
        this.showSuccessMockup = true;
        if (!this.successLastOrderId) {
          this.submitError = 'Tạo đơn thành công nhưng thiếu ID đơn.';
        }
      },
      error: (err) => {
        this.submitting = false;
        this.submitError = err?.error?.message || err?.message || 'Không tạo được đơn';
      },
    });
  }

  /** Sau khi admin đọc mockup — đóng và mở chi tiết đơn. */
  closeSuccessMockupAndContinue(): void {
    this.showSuccessMockup = false;
    const id = this.successLastOrderId;
    if (id) this.created.emit(id);
  }

  userTrackOrdersAbsUrl(): string {
    const o = String(USER_SHOP_ORIGIN || 'http://localhost:4200').replace(/\/$/, '');
    return `${o}/order-management`;
  }

  userGuestLookupAbsUrl(): string {
    const o = String(USER_SHOP_ORIGIN || 'http://localhost:4200').replace(/\/$/, '');
    return `${o}/tra-cuu-don`;
  }

  back(): void {
    this.cancelled.emit();
  }

  formatMoney(n: number): string {
    return new Intl.NumberFormat('vi-VN').format(n || 0) + 'đ';
  }

  /** So sánh _id subdocument (string hoặc object từ API). */
  addrKey(a: CustomerSavedAddress): string {
    const id = (a as { _id?: unknown })._id;
    return id != null ? String(id) : '';
  }
}
