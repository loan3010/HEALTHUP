import { Component, EventEmitter, HostListener, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminOrderService,
  HotlineOrderPayload,
  HotlineOrderPreview,
} from '../order/order.service';
import { CustomerItem, CustomerService } from '../../admin-customer/customer/customer.service';
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
    variants: [],
    variantId: '',
    quantity: 1,
  };
}

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
    this.fullName = (c.username || '').trim() || 'Khách hàng';
    this.phone = (c.phone || '').trim();
    this.email = (c.email || '').trim();
    this.streetAddress = (c.address || '').trim();
    this.customerPhoneSearch = this.phone;
    this.showCustomerHits = false;
    this.customerHits = [];
  }

  clearLinkedCustomer(): void {
    this.linkedUserId = '';
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
    if (!this.fullName.trim() || !this.phone.trim() || !this.streetAddress.trim()) {
      this.submitError = 'Nhập đủ họ tên, SĐT, địa chỉ (số nhà/đường).';
      return;
    }
    if (!/^0\d{9}$/.test(this.phone.trim())) {
      this.submitError = 'SĐT phải 10 số, bắt đầu bằng 0.';
      return;
    }
    if (!this.provinceCode || !this.districtCode || !this.wardCode) {
      this.submitError = 'Chọn đủ Tỉnh/Thành, Quận/Huyện, Phường/Xã.';
      return;
    }
    for (let i = 0; i < this.lines.length; i++) {
      const l = this.lines[i];
      if (!l.productId) continue;
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

    this.submitting = true;
    this.orderService.createAdminHotlineOrder(payload).subscribe({
      next: (res) => {
        this.submitting = false;
        const id = String(res.orderId || '');
        if (id) this.created.emit(id);
        else this.submitError = 'Tạo đơn thành công nhưng thiếu mã đơn.';
      },
      error: (err) => {
        this.submitting = false;
        this.submitError = err?.error?.message || err?.message || 'Không tạo được đơn';
      },
    });
  }

  back(): void {
    this.cancelled.emit();
  }

  formatMoney(n: number): string {
    return new Intl.NumberFormat('vi-VN').format(n || 0) + 'đ';
  }
}
