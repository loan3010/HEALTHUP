import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromotionService } from '../promotion.service';

@Component({
  selector: 'app-promotion-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promotion-form.html',
  styleUrls: ['./promotion-form.css']
})
export class PromotionForm implements OnInit {
  @Input() mode: 'add' | 'edit' = 'add';
  @Input() promoData: any = null;
  @Output() goBack = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  categories: any[] = [];
  products: any[] = [];
  selectedCatNameForProd: string = '';
  errorMessage: string = '';

  // BIẾN QUAN TRỌNG: Điều khiển chế độ Freeship trên giao diện
  isFreeshipMode: boolean = false;

  formData: any = {
    name: '',
    code: '',
    description: '',
    groupName: '',
    isActive: true,
    type: 'order',      // Khớp Schema: 'order' | 'freeship'
    status: 'upcoming', // 'upcoming' | 'ongoing' | 'expired'
    discountType: 'percent', 
    discountValue: 0,
    minOrder: 0,
    maxDiscount: 0,
    startDate: '',
    endDate: '',
    totalLimit: 100,
    userLimit: 1,
    firstOrderOnly: false,
    applyScope: 'all',  // 'all' | 'category' | 'product'
    appliedCategoryIds: [],
    appliedProductIds: [],
    allowedMemberRanks: [] // Trường mới bà vừa thêm
  };

  constructor(private promoService: PromotionService) {}

  ngOnInit(): void {
    this.taiDuLieuPhu();

    if (this.mode === 'edit' && this.promoData) {
      // Nhận diện nếu đây là mã Freeship 100% để bật công tắc giao diện
      if (this.promoData.type === 'freeship' && this.promoData.discountValue === 100) {
        this.isFreeshipMode = true;
      }

      this.formData = {
        ...this.promoData,
        applyScope: this.promoData.applyScope || 'all',
        appliedCategoryIds: (this.promoData.appliedCategoryIds || []).map((id: any) => id?.$oid || id),
        appliedProductIds:  (this.promoData.appliedProductIds  || []).map((id: any) => id?.$oid || id),
        allowedMemberRanks: this.promoData.allowedMemberRanks || [],
        startDate: this.dinhDangNgay(this.promoData.startDate),
        endDate:   this.dinhDangNgay(this.promoData.endDate)
      };
    } else {
      this.datLaiBieuMau();
    }
  }

  taiDuLieuPhu(): void {
    this.promoService.layDanhSachDanhMuc().subscribe({
      next: (res: any) => {
        if (res && Array.isArray(res)) {
          this.categories = res
            .map(cat => ({ ...cat, _id: cat._id?.$oid || cat._id }))
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
          if (this.categories.length > 0 && !this.selectedCatNameForProd) {
            this.selectedCatNameForProd = this.categories[0].name;
          }
        }
      }
    });

    this.promoService.layDanhSachSanPham(1000).subscribe({
      next: (res: any) => {
        const rawProducts = res.products || (Array.isArray(res) ? res : []);
        this.products = rawProducts.map((prod: any) => ({
          ...prod,
          _id: prod._id?.$oid || prod._id
        }));
      }
    });
  }

  get filteredProductsByCat() {
    if (!this.selectedCatNameForProd) return [];
    return this.products.filter(p =>
      p.cat?.toString().trim().toLowerCase() === this.selectedCatNameForProd.trim().toLowerCase()
    );
  }

  chonDanhMucDeLoc(catName: string): void {
    this.selectedCatNameForProd = catName;
  }

  toggleSelection(id: string, type: 'category' | 'product'): void {
    const targetList = type === 'category' ? 'appliedCategoryIds' : 'appliedProductIds';
    if (!this.formData[targetList]) this.formData[targetList] = [];
    const index = this.formData[targetList].indexOf(id);
    if (index > -1) this.formData[targetList].splice(index, 1);
    else this.formData[targetList].push(id);
  }

  isSelected(id: string, type: 'category' | 'product'): boolean {
    const targetList = type === 'category' ? 'appliedCategoryIds' : 'appliedProductIds';
    return this.formData[targetList] ? this.formData[targetList].includes(id) : false;
  }

  /**
   * Xử lý chọn/bỏ chọn hạng thành viên
   */
  toggleRank(rank: string): void {
    if (!this.formData.allowedMemberRanks) this.formData.allowedMemberRanks = [];
    const idx = this.formData.allowedMemberRanks.indexOf(rank);
    if (idx > -1) {
      this.formData.allowedMemberRanks.splice(idx, 1);
    } else {
      this.formData.allowedMemberRanks.push(rank);
    }
  }

  onDiscountTypeChange(): void {
    if (this.formData.discountType === 'percent' && this.formData.discountValue > 100) {
      this.formData.discountValue = 100;
    }
  }

  private dinhDangNgay(ngay: any): string {
    if (!ngay) return '';
    const d = new Date(ngay);
    return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
  }

  /**
   * HÀM LƯU DỮ LIỆU: Đã đồng bộ với Schema mới (freeship)
   */
  onSave(): void {
    this.errorMessage = ''; 
    const f = this.formData;

    // 1. Kiểm tra thông tin bắt buộc
    if (!f.code?.trim() || !f.name?.trim() || !f.startDate || !f.endDate || !f.type || !f.status || !f.discountType || !f.applyScope) {
      this.errorMessage = 'Vui lòng điền đầy đủ các thông tin bắt buộc có dấu (*).';
      return;
    }

    // 2. Kiểm tra logic dữ liệu
    if (f.totalLimit <= 0 || f.userLimit <= 0) {
      this.errorMessage = 'Tổng giới hạn và giới hạn mỗi khách phải lớn hơn 0.';
      return;
    }

    if (f.discountValue <= 0) {
      this.errorMessage = 'Giá trị giảm giá phải lớn hơn 0.';
      return;
    }

    if (f.endDate < f.startDate) {
      this.errorMessage = 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu.';
      return;
    }

    // 3. Clone dữ liệu để xử lý trung gian
    let submitData = { ...this.formData };

    // 4. XỬ LÝ LOGIC FREESHIP (Ép kiểu chuẩn theo Schema Backend)
    if (this.isFreeshipMode) {
      submitData.type = 'freeship'; // <--- Chỉnh từ 'shipping' sang 'freeship'
      submitData.discountType = 'percent';
      submitData.discountValue = 100;
    }

    // 5. ÉP KIỂU VÀ LÀM SẠCH DỮ LIỆU
    submitData.discountValue = Number(submitData.discountValue);
    submitData.minOrder = Number(submitData.minOrder);
    submitData.maxDiscount = Number(submitData.maxDiscount);
    submitData.totalLimit = Number(submitData.totalLimit);
    submitData.userLimit = Number(submitData.userLimit);
    submitData.code = submitData.code.trim().toUpperCase();

    // 6. Xử lý mảng ID theo phạm vi áp dụng
    if (submitData.applyScope === 'all') {
      submitData.appliedCategoryIds = [];
      submitData.appliedProductIds  = [];
    } else if (submitData.applyScope === 'category') {
      submitData.appliedProductIds = [];
      if (submitData.appliedCategoryIds.length === 0) {
        this.errorMessage = 'Hãy chọn ít nhất một danh mục áp dụng.';
        return;
      }
    } else if (submitData.applyScope === 'product') {
      submitData.appliedCategoryIds = [];
      if (submitData.appliedProductIds.length === 0) {
        this.errorMessage = 'Hãy chọn ít nhất một sản phẩm áp dụng.';
        return;
      }
    }

    // 7. Gọi API
    const request = this.mode === 'add'
      ? this.promoService.themKhuyenMai(submitData)
      : this.promoService.suaKhuyenMai(submitData._id, submitData);

    request.subscribe({
      next: () => {
        this.saved.emit();
        this.goBack.emit();
      },
      error: (loi: any) => {
        console.error('Lỗi Backend:', loi);
        if (loi.status === 400) {
          this.errorMessage = 'Dữ liệu không hợp lệ. Hãy kiểm tra lại mã voucher hoặc các hạng mục bắt buộc.';
        } else {
          this.errorMessage = 'Hệ thống đang bận, vui lòng thử lại sau.';
        }
      }
    });
  }

  private datLaiBieuMau(): void {
    this.isFreeshipMode = false;
    this.formData = {
      name: '',
      code: '',
      description: '',
      groupName: '',
      isActive: true,
      type: 'order',
      status: 'upcoming',
      discountType: 'percent',
      discountValue: 0,
      minOrder: 0,
      maxDiscount: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      totalLimit: 100,
      userLimit: 1,
      firstOrderOnly: false,
      applyScope: 'all',
      appliedCategoryIds: [],
      appliedProductIds: [],
      allowedMemberRanks: []
    };
    this.errorMessage = '';
  }
}