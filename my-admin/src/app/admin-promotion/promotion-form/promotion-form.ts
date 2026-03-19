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

  // Danh sách dữ liệu phụ để hiển thị lựa chọn
  categories: any[] = [];
  products: any[] = [];
  
  // Biến theo dõi danh mục đang được chọn để lọc sản phẩm bên cột phải
  selectedCatNameForProd: string = '';

  // Biến hiển thị thông báo lỗi nhỏ trên giao diện
  errorMessage: string = '';

  formData: any = {
    name: '',
    code: '',
    description: '',
    type: 'order', // 'order' (Tiền hàng) | 'freeship' (Vận chuyển)
    status: 'upcoming',
    discountType: 'percent', // 'percent' | 'fixed'
    discountValue: 0,
    minOrder: 0,
    maxDiscount: 0,
    startDate: '',
    endDate: '',
    totalLimit: 100,
    userLimit: 1,
    firstOrderOnly: false,
    applyScope: 'all', // 'all' | 'category' | 'product'
    appliedCategoryIds: [],
    appliedProductIds: []
  };

  constructor(private promoService: PromotionService) {}

  ngOnInit(): void {
    // Tải dữ liệu danh mục và sản phẩm trước
    this.taiDuLieuPhu();

    if (this.mode === 'edit' && this.promoData) {
      // Đổ toàn bộ dữ liệu từ hàng được chọn vào form
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

  // Lấy dữ liệu danh mục và sản phẩm từ Service
  taiDuLieuPhu(): void {
    // 1. Lấy danh mục và sắp xếp A-Z
    this.promoService.layDanhSachDanhMuc().subscribe({
      next: (res: any) => {
        if (res && Array.isArray(res)) {
          this.categories = res
            .map(cat => ({
              ...cat,
              _id: cat._id?.$oid || cat._id 
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
          
          if (this.categories.length > 0 && !this.selectedCatNameForProd) {
            this.selectedCatNameForProd = this.categories[0].name;
          }
        }
      },
      error: (err) => console.error('Lỗi lấy danh mục:', err)
    });

    // 2. Lấy sản phẩm
    this.promoService.layDanhSachSanPham(1000).subscribe({
      next: (res: any) => {
        const rawProducts = res.products || (Array.isArray(res) ? res : []);
        this.products = rawProducts.map((prod: any) => ({
          ...prod,
          _id: prod._id?.$oid || prod._id
        }));
      },
      error: (err) => console.error('Lỗi lấy sản phẩm:', err)
    });
  }

  // Getter lọc sản phẩm theo danh mục
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
    if (index > -1) {
      this.formData[targetList].splice(index, 1);
    } else {
      this.formData[targetList].push(id);
    }
  }

  isSelected(id: string, type: 'category' | 'product'): boolean {
    const targetList = type === 'category' ? 'appliedCategoryIds' : 'appliedProductIds';
    return this.formData[targetList] ? this.formData[targetList].includes(id) : false;
  }

  /**
   * Xử lý khi đổi loại giảm giá: Nếu là % thì không được vượt quá 100
   */
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

  onSave(): void {
    this.errorMessage = ''; // Reset thông báo lỗi trước khi kiểm tra

    // --- KIỂM TRA CÁC TRƯỜNG BẮT BUỘC CHẶT CHẼ ---
    const f = this.formData;

    // 1. Các trường cơ bản (Đã bao gồm Ngày kết thúc)
    if (!f.code?.trim() || !f.name?.trim() || !f.startDate || !f.endDate || !f.type || !f.status || !f.discountType || !f.applyScope) {
      this.errorMessage = 'Vui lòng điền đầy đủ các thông tin bắt buộc có dấu (*).';
      return;
    }

    // 2. Kiểm tra giới hạn lượt dùng
    if (f.totalLimit <= 0 || f.userLimit <= 0) {
      this.errorMessage = 'Tổng giới hạn và giới hạn mỗi khách phải lớn hơn 0.';
      return;
    }

    // 3. Logic giá trị giảm giá
    if (f.discountValue <= 0) {
      this.errorMessage = 'Giá trị giảm giá phải lớn hơn 0.';
      return;
    }

    if (f.discountType === 'percent' && f.discountValue > 100) {
      this.errorMessage = 'Giảm giá theo phần trăm không được vượt quá 100%.';
      f.discountValue = 100; 
      return;
    }

    // 4. Kiểm tra logic ngày tháng (Ngày kết thúc không được nhỏ hơn ngày bắt đầu)
    if (f.endDate < f.startDate) {
      this.errorMessage = 'Ngày kết thúc không được diễn ra trước ngày bắt đầu.';
      return;
    }

    // Clone dữ liệu và làm sạch mảng ID theo phạm vi (applyScope)
    const submitData = { ...this.formData };
    
    if (submitData.applyScope === 'all') {
      submitData.appliedCategoryIds = [];
      submitData.appliedProductIds = [];
    } else if (submitData.applyScope === 'category') {
      submitData.appliedProductIds = [];
      if (submitData.appliedCategoryIds.length === 0) {
        this.errorMessage = 'Vui lòng chọn ít nhất một danh mục áp dụng.';
        return;
      }
    } else if (submitData.applyScope === 'product') {
      submitData.appliedCategoryIds = [];
      if (submitData.appliedProductIds.length === 0) {
        this.errorMessage = 'Vui lòng chọn ít nhất một sản phẩm áp dụng.';
        return;
      }
    }

    // Thực hiện gọi API
    const request = this.mode === 'add' 
      ? this.promoService.themKhuyenMai(submitData) 
      : this.promoService.suaKhuyenMai(submitData._id, submitData);

    request.subscribe({
      next: () => {
        this.saved.emit();
        this.goBack.emit();
      },
      error: (loi: any) => {
        console.error('Lỗi khi lưu dữ liệu:', loi);
        // Thông báo lỗi cụ thể hơn để bà dễ xử lý
        this.errorMessage = 'Không thể lưu thay đổi. Vui lòng kiểm tra mã khuyến mãi có bị trùng không hoặc kết nối mạng.';
      }
    });
  }

  private datLaiBieuMau(): void {
    this.formData = {
      name: '', 
      code: '', 
      description: '', 
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
      appliedProductIds: []
    };
    this.errorMessage = '';
  }
}