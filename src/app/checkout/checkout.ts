import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { CartService, CartItem } from '../../cart/services/cart.service';
import { OrderService } from '../service/service';
import { PaymentMethod, ShippingMethod } from '../service/model';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './checkout.html',
  styleUrls: ['./checkout.css'],
})
export class Checkout {
  items: CartItem[] = [];

  // UI state
  errorMsg = signal('');
  successMsg = signal('');
  isPlacing = signal(false);

  shippingMethod = signal<ShippingMethod>('standard');
  paymentMethod = signal<PaymentMethod>('cod');

  voucherCode = signal('');
  voucherMsg = signal('');

  form!: FormGroup;


  // Province/District/Ward
provinces: string[] = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Hải Phòng',
  'Đà Nẵng',
  'Cần Thơ',
  'Thừa Thiên Huế',
  'An Giang',
  'Bà Rịa - Vũng Tàu',
  'Bắc Giang',
  'Bắc Kạn',
  'Bạc Liêu',
  'Bắc Ninh',
  'Bến Tre',
  'Bình Định',
  'Bình Dương',
  'Bình Phước',
  'Bình Thuận',
  'Cà Mau',
  'Cao Bằng',
  'Đắk Lắk',
  'Đắk Nông',
  'Điện Biên',
  'Đồng Nai',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Giang',
  'Hà Nam',
  'Hà Tĩnh',
  'Hải Dương',
  'Hậu Giang',
  'Hòa Bình',
  'Hưng Yên',
  'Khánh Hòa',
  'Kiên Giang',
];

// locationTree: Tỉnh -> Huyện -> Xã
private locationTree: Record<string, Record<string, string[]>> = this.buildMockLocationTree(
  this.provinces,
  10, // mỗi tỉnh 10 huyện
  10  // mỗi huyện 10 xã/phường
);

/**
 * Tạo data mock theo cấu trúc phụ thuộc:
 * - Mỗi tỉnh: Huyện 01..10
 * - Mỗi huyện: Phường/Xã 01..10
 */
private buildMockLocationTree(
  provinces: string[],
  districtCount: number,
  wardCount: number
): Record<string, Record<string, string[]>> {
  const tree: Record<string, Record<string, string[]>> = {};

  for (const p of provinces) {
    const districtMap: Record<string, string[]> = {};

    for (let i = 1; i <= districtCount; i++) {
      const d = `Quận/Huyện ${String(i).padStart(2, '0')}`;

      const wards: string[] = [];
      for (let j = 1; j <= wardCount; j++) {
        wards.push(`Phường/Xã ${String(j).padStart(2, '0')}`);
      }

      districtMap[d] = wards;
    }

    tree[p] = districtMap;
  }

  // (Tuỳ chọn)
  tree['TP. Hồ Chí Minh'] = {
    'Quận 1': ['Bến Nghé', 'Bến Thành', 'Cầu Kho', 'Nguyễn Thái Bình', 'Tân Định', 'Đa Kao', 'Cô Giang', 'Cô Bắc', 'Phạm Ngũ Lão', 'Nguyễn Cư Trinh'],
    'Quận 3': ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10'],
    'Thủ Đức': ['Linh Chiểu', 'Linh Trung', 'Linh Tây', 'Hiệp Bình Chánh', 'Hiệp Bình Phước', 'Tam Phú', 'Tam Bình', 'Bình Thọ', 'Trường Thọ', 'Phước Long A'],
    'Quận 5': ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10'],
    'Quận 7': ['Tân Phú', 'Tân Phong', 'Tân Quy', 'Tân Hưng', 'Phú Mỹ', 'Bình Thuận', 'Phú Thuận', 'Tân Kiểng', 'Tân Thuận Đông', 'Tân Thuận Tây'],
    // 10 huyện/quận demo
    'Quận 10': ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10'],
    'Quận 11': ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10'],
    'Quận 6': ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10'],
    'Bình Tân': ['Bình Hưng Hòa', 'Bình Hưng Hòa A', 'Bình Hưng Hòa B', 'Tân Tạo', 'Tân Tạo A', 'An Lạc', 'An Lạc A', 'Bình Trị Đông', 'Bình Trị Đông A', 'Bình Trị Đông B'],
    'Gò Vấp': ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10'],
  };

  tree['Hà Nội'] = {
    'Ba Đình': ['Phúc Xá', 'Trúc Bạch', 'Vĩnh Phúc', 'Cống Vị', 'Liễu Giai', 'Ngọc Hà', 'Kim Mã', 'Giảng Võ', 'Ngọc Khánh', 'Đội Cấn'],
    'Cầu Giấy': ['Dịch Vọng', 'Dịch Vọng Hậu', 'Mai Dịch', 'Nghĩa Đô', 'Nghĩa Tân', 'Quan Hoa', 'Trung Hòa', 'Yên Hòa', 'Phường 9', 'Phường 10'],
    'Đống Đa': ['Cát Linh', 'Văn Miếu', 'Quốc Tử Giám', 'Láng Thượng', 'Ô Chợ Dừa', 'Văn Chương', 'Hàng Bột', 'Khâm Thiên', 'Nam Đồng', 'Thịnh Quang'],
    // thêm đủ 10 huyện/quận
    'Quận/Huyện 04': Array.from({ length: 10 }, (_, i) => `Phường/Xã ${String(i + 1).padStart(2, '0')}`),
    'Quận/Huyện 05': Array.from({ length: 10 }, (_, i) => `Phường/Xã ${String(i + 1).padStart(2, '0')}`),
    'Quận/Huyện 06': Array.from({ length: 10 }, (_, i) => `Phường/Xã ${String(i + 1).padStart(2, '0')}`),
    'Quận/Huyện 07': Array.from({ length: 10 }, (_, i) => `Phường/Xã ${String(i + 1).padStart(2, '0')}`),
    'Quận/Huyện 08': Array.from({ length: 10 }, (_, i) => `Phường/Xã ${String(i + 1).padStart(2, '0')}`),
    'Quận/Huyện 09': Array.from({ length: 10 }, (_, i) => `Phường/Xã ${String(i + 1).padStart(2, '0')}`),
    'Quận/Huyện 10': Array.from({ length: 10 }, (_, i) => `Phường/Xã ${String(i + 1).padStart(2, '0')}`),
  };

  return tree;
}
  districts: string[] = [];
  wards: string[] = [];

  // totals
  subTotal = computed(() => this.orderService.calcSubTotal(this.items));
  shippingFee = computed(() =>
    this.orderService.calcShippingFee(this.shippingMethod(), this.subTotal())
  );
  discount = computed(() =>
    this.orderService.calcDiscount(this.voucherCode(), this.subTotal())
  );
  total = computed(() =>
    Math.max(0, this.subTotal() + this.shippingFee() - this.discount())
  );

  constructor(
    private fb: FormBuilder,
    private cartService: CartService,
    public orderService: OrderService,
    private router: Router
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

    this.cartService.cart$.subscribe((cart: CartItem[]) => {
      this.items = cart;
      if (!cart.length) this.router.navigateByUrl('/cart');
    });
  }


  onProvinceChange(p: string): void {
    // reset district/ward khi đổi tỉnh
    this.form.patchValue({ province: p, district: '', ward: '' });

    const districtMap = this.locationTree[p] || {};
    this.districts = Object.keys(districtMap);
    this.wards = [];
  }

  onDistrictChange(d: string): void {
    const p = this.form.get('province')?.value as string;

    // reset ward khi đổi huyện
    this.form.patchValue({ district: d, ward: '' });

    this.wards = this.locationTree[p]?.[d] || [];
  }

  //  Ship và thanh toán
  setShipping(m: ShippingMethod) {
    this.shippingMethod.set(m);
  }

  setPayment(m: PaymentMethod) {
    this.paymentMethod.set(m);
  }

  //  Voucher 
  onVoucherInput(value: string) {
    this.voucherCode.set(value);
  }

  applyVoucher() {
    const code = this.voucherCode().trim();
    this.voucherCode.set(code);

    const res = this.orderService.validateVoucher(code, this.subTotal());
    this.voucherMsg.set(res.ok ? 'Áp dụng mã thành công' : (res.msg || ''));
  }

  removeVoucher() {
    this.voucherCode.set('');
    this.voucherMsg.set('');
  }

  // ===== Place order =====
  placeOrder() {
    this.errorMsg.set('');
    this.successMsg.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg.set('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    const check = this.orderService.validateVoucher(this.voucherCode(), this.subTotal());
    if (!check.ok) {
      this.errorMsg.set(check.msg || 'Mã giảm giá không hợp lệ');
      return;
    }

    const pm = this.paymentMethod();

    // demo: momo/vnpay -> qua trang mô phỏng
    if (pm === 'momo') {
      this.router.navigate(['/payment', 'momo']);
      return;
    }
    if (pm === 'vnpay') {
      this.router.navigate(['/payment', 'vnpay']);
      return;
    }

    // COD: tạo đơn ngay
    this.isPlacing.set(true);

    const order = this.orderService.createOrder(this.items as any, {
      customer: this.form.value,
      shippingMethod: this.shippingMethod(),
      paymentMethod: pm,
      voucherCode: this.voucherCode() || undefined,
    });

    this.cartService.clearCart();
    this.isPlacing.set(false);

    this.router.navigate(['/order-success', order.id]);
  }

  // utils
  vnd(n: number) {
    return this.orderService.vnd(n);
  }

  hasError(name: string, err: string) {
    const c = this.form.get(name);
    return !!c && c.touched && c.hasError(err);
  }
}
