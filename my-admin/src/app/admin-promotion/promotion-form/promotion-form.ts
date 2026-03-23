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
    groupName: '',    // Đã thêm để đồng bộ nhóm
    isActive: true,    // Đã thêm để đồng bộ ẩn/hiện
    type: 'order',     // 'order' (Hàng hóa) | 'shipping' (Vận chuyển)
    status: 'upcoming',
    discountType: 'percent', 
    discountValue: 0,
    minOrder: 0,
    maxDiscount: 0,
    startDate: '',
    endDate: '',
    totalLimit: 100,
    userLimit: 1,
    firstOrderOnly: false,
    applyScope: 'all',
    appliedCategoryIds: [],
    appliedProductIds: []
  };

  constructor(private promoService: PromotionService) {}

  ngOnInit(): void {
    this.taiDuLieuPhu();

    if (this.mode === 'edit' && this.promoData) {
      // Nhận diện nếu đây là mã Freeship 100% để bật công tắc giao diện
      if (this.promoData.type === 'shipping' && this.promoData.discountValue === 100) {
        this.isFreeshipMode = true;
      }

      this.formData = { 
        ...this.promoData,
        applyScope: this.promoData.applyScope || 'all',
        appliedCategoryIds: (this.promoData.appliedCategoryIds || []).map((id: any) => id?.$oid || id),
        appliedProductIds: (this.promoData.appliedProductIds || []).map((id: any) => id?.$oid || id),
        startDate: this.dinhDangNgay(this.promoData.startDate),
        endDate: this.dinhDangNgay(this.promoData.endDate)
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
   * HÀM LƯU DỮ LIỆU: Đã xử lý logic Freeship và ép kiểu Backend
   */
  onSave(): void {
    this.errorMessage = ''; 
    const f = this.formData;

    // 1. Kiểm tra thông tin bắt buộc
    if (!f.code?.trim() || !f.name?.trim() || !f.startDate || !f.endDate) {
      this.errorMessage = 'Vui lòng điền đầy đủ Tên, Mã và Thời hạn chương trình.';
      return;
    }

    // 2. Kiểm tra logic ngày tháng
    if (f.endDate < f.startDate) {
      this.errorMessage = 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu.';
      return;
    }

    // Clone dữ liệu để xử lý trung gian
    let submitData = { ...this.formData };

    // 3. XỬ LÝ LOGIC "PHIÊN DỊCH" CHO BACKEND (Né lỗi 400)
    if (this.isFreeshipMode) {
      submitData.type = 'shipping';      // Loại: Vận chuyển
      submitData.discountType = 'percent'; // Cách giảm: Phần trăm
      submitData.discountValue = 100;     // 100% = Freeship
    }

    // 4. ÉP KIỂU DỮ LIỆU SỐ CHẶT CHẼ
    submitData.discountValue = Number(submitData.discountValue);
    submitData.minOrder = Number(submitData.minOrder);
    submitData.maxDiscount = Number(submitData.maxDiscount);
    submitData.totalLimit = Number(submitData.totalLimit);
    submitData.userLimit = Number(submitData.userLimit);
    submitData.code = submitData.code.trim().toUpperCase(); // Viết hoa mã voucher

    // 5. Làm sạch mảng ID theo phạm vi áp dụng
    if (submitData.applyScope === 'all') {
      submitData.appliedCategoryIds = [];
      submitData.appliedProductIds = [];
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

    // Gọi API
    const request = this.mode === 'add' 
      ? this.promoService.themKhuyenMai(submitData) 
      : this.promoService.suaKhuyenMai(submitData._id, submitData);

    request.subscribe({
      next: () => {
        this.saved.emit();
        this.goBack.emit();
      },
      error: (loi: any) => {
        console.error('Lỗi chi tiết từ Backend:', loi);
        if (loi.status === 400) {
          this.errorMessage = 'Dữ liệu không hợp lệ. Hãy kiểm tra lại các trường hoặc mã voucher bị trùng.';
        } else {
          this.errorMessage = 'Hệ thống đang bận, vui lòng thử lại sau.';
        }
      }
    });
  }

  private datLaiBieuMau(): void {
    this.isFreeshipMode = false;
    this.formData = {
      name: '', code: '', description: '', groupName: '',
      isActive: true, type: 'order', status: 'upcoming',
      discountType: 'percent', discountValue: 0, minOrder: 0, maxDiscount: 0,
      startDate: new Date().toISOString().split('T')[0],
      endDate: '', totalLimit: 100, userLimit: 1, firstOrderOnly: false,
      applyScope: 'all', appliedCategoryIds: [], appliedProductIds: []
    };
    this.errorMessage = '';
  }
}