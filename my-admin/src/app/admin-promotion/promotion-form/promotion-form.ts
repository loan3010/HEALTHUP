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

  formData: any = {
    name: '',
    code: '',
    description: '',
    type: 'order',
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
    appliedProductIds: [],
    allowedMemberRanks: []   // ← MỚI
  };

  constructor(private promoService: PromotionService) {}

  ngOnInit(): void {
    this.taiDuLieuPhu();

    if (this.mode === 'edit' && this.promoData) {
      this.formData = {
        ...this.promoData,
        applyScope: this.promoData.applyScope || 'all',
        appliedCategoryIds: (this.promoData.appliedCategoryIds || []).map((id: any) => id?.$oid || id),
        appliedProductIds:  (this.promoData.appliedProductIds  || []).map((id: any) => id?.$oid || id),
        allowedMemberRanks: this.promoData.allowedMemberRanks || [],   // ← MỚI
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
      },
      error: (err) => console.error('Lỗi lấy danh mục:', err)
    });

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

  // ── MỚI: Toggle hạng thành viên ──
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

  onSave(): void {
    this.errorMessage = '';
    const f = this.formData;

    if (!f.code?.trim() || !f.name?.trim() || !f.startDate || !f.endDate || !f.type || !f.status || !f.discountType || !f.applyScope) {
      this.errorMessage = 'Vui lòng điền đầy đủ các thông tin bắt buộc có dấu (*).';
      return;
    }

    if (f.totalLimit <= 0 || f.userLimit <= 0) {
      this.errorMessage = 'Tổng giới hạn và giới hạn mỗi khách phải lớn hơn 0.';
      return;
    }

    if (f.discountValue <= 0) {
      this.errorMessage = 'Giá trị giảm giá phải lớn hơn 0.';
      return;
    }

    if (f.discountType === 'percent' && f.discountValue > 100) {
      this.errorMessage = 'Giảm giá theo phần trăm không được vượt quá 100%.';
      f.discountValue = 100;
      return;
    }

    if (f.endDate < f.startDate) {
      this.errorMessage = 'Ngày kết thúc không được diễn ra trước ngày bắt đầu.';
      return;
    }

    const submitData = { ...this.formData };

    if (submitData.applyScope === 'all') {
      submitData.appliedCategoryIds = [];
      submitData.appliedProductIds  = [];
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
      appliedProductIds: [],
      allowedMemberRanks: []   // ← MỚI
    };
    this.errorMessage = '';
  }
}