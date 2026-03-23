import { Component, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PromotionService } from '../promotion.service'; 
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';

interface PromotionGroup {
  groupName: string;
  isOpen: boolean;
  selected: boolean;
  items: any[];
  // --- TRẠNG THÁI ĐỂ CHỈNH SỬA TẠI CHỖ ---
  isEditing: boolean;
  tempName: string; 
}

@Component({
  selector: 'app-promotion-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './promotion-list.html',
  styleUrls: ['./promotion-list.css']
})
export class PromotionList implements OnInit {
  @Output() goEdit = new EventEmitter<any>();
  @Output() goAdd = new EventEmitter<void>();

  // --- QUẢN LÝ TÌM KIẾM ---
  searchText: string = '';         // Nội dung đang gõ trên input
  appliedSearchText: string = '';  // Nội dung thực tế dùng để lọc (chỉ cập nhật khi nhấn Enter)

  // --- CÁC BIẾN BỘ LỌC ĐA NĂNG ---
  filterDiscountType: string = ''; // fixed (cố định) | percent (phần trăm)
  filterCategory: string = '';     // Map vào trường 'type': freeship | order
  filterApplyTo: string = '';      // Map vào trường 'applyScope': all | category | product
  filterStatus: string = '';       // upcoming | ongoing | expired

  promotions: any[] = []; // Nguồn dữ liệu gốc từ Server
  groupedPromotions: PromotionGroup[] = []; // Dữ liệu hiển thị sau khi lọc và gom nhóm
  uniqueGroupNames: string[] = []; // Danh sách các nhóm hiện có (để đổ vào menu chọn)

  // Trạng thái hiển thị Modal/Menu
  isGroupModalOpen: boolean = false;
  showMoveToMenu: boolean = false; // Trạng thái đóng mở menu "Chuyển vào nhóm"
  tempGroupName: string = '';

  // --- HỆ THỐNG THÔNG BÁO TÙY CHỈNH ---
  notify = {
    show: false,
    type: 'success' as 'success' | 'danger' | 'warning',
    icon: 'bi-check-circle',
    title: '',
    message: '',
    btnText: 'ĐỒNG Ý',
    isConfirm: false,
    actionType: '' 
  };

  pendingData: any = null; // Lưu dữ liệu tạm khi chờ xác nhận

  constructor(
    private promoService: PromotionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.taiDuLieu();
  }

  /**
   * Lấy toàn bộ danh sách từ server và phân loại trạng thái tự động
   */
  taiDuLieu(): void {
    this.promoService.layDanhSach().subscribe({
      next: (duLieu: any[]) => {
        const bayGio = new Date(); 
        this.promotions = duLieu.map((p: any) => {
          const ngayBD = new Date(p.startDate);
          const ngayKT = new Date(p.endDate);
          let trangThai = (bayGio < ngayBD) ? 'upcoming' : (bayGio <= ngayKT ? 'ongoing' : 'expired');

          return {
            ...p,
            selected: false,
            status: trangThai, 
            isActive: p.isActive !== undefined ? p.isActive : true, // Trạng thái kích hoạt
            usage: `${p.usedCount || 0}/${p.totalLimit || 0}`,
            start: ngayBD.toLocaleDateString('vi-VN'),
            end: ngayKT.toLocaleDateString('vi-VN'),
            groupName: p.groupName || '', 
            updated: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('vi-VN') : ''
          };
        });
        
        this.organizeGroups();
        this.updateUniqueGroups(); // Cập nhật danh sách nhóm hiện có
      },
      error: (err) => {
        console.error('Lỗi tải dữ liệu:', err);
        this.showNotify('danger', 'Lỗi hệ thống', 'Không thể kết nối đến máy chủ.');
      }
    });
  }

  /**
   * Lấy danh sách tên các nhóm duy nhất (loại bỏ nhóm rỗng)
   */
  updateUniqueGroups(): void {
    const names = this.promotions
      .map(p => p.groupName)
      .filter(name => name && name.trim() !== '');
    this.uniqueGroupNames = Array.from(new Set(names));
  }

  /**
   * Cập nhật trạng thái lọc từ các thẻ thống kê phía trên
   */
  filterByStatus(status: string): void {
    this.filterStatus = status;
    this.organizeGroups();
  }

  /**
   * HÀM QUAN TRỌNG: LỌC ĐA ĐIỀU KIỆN & CHIA FOLDER
   */
  organizeGroups(): void {
    const currentStates = new Map<string, boolean>();
    this.groupedPromotions.forEach(g => currentStates.set(g.groupName, g.isOpen));

    const term = this.appliedSearchText.toLowerCase().trim();
    const isAnyFilterActive = !!(term || this.filterDiscountType || this.filterCategory || this.filterApplyTo || this.filterStatus);

    const filteredList = this.promotions.filter(p => {
      const matchesSearch = !term || 
        p.name.toLowerCase().includes(term) || 
        p.code.toLowerCase().includes(term) || 
        (p.groupName && p.groupName.toLowerCase().includes(term));

      const matchesDiscount = !this.filterDiscountType || p.discountType === this.filterDiscountType;
      const matchesCategory = !this.filterCategory || p.type === this.filterCategory;
      const matchesApply = !this.filterApplyTo || p.applyScope === this.filterApplyTo;
      const matchesStatus = !this.filterStatus || p.status === this.filterStatus;

      return matchesSearch && matchesDiscount && matchesCategory && matchesApply && matchesStatus;
    });

    const map = new Map<string, any[]>();
    if (!isAnyFilterActive && !map.has('')) {
      map.set('', []);
    }

    filteredList.forEach(p => {
      const gName = p.groupName || '';
      if (!map.has(gName)) map.set(gName, []);
      map.get(gName)?.push(p);
    });

    this.groupedPromotions = Array.from(map.entries()).map(([name, items]) => {
      const wasOpen = currentStates.get(name);
      return {
        groupName: name,
        isOpen: isAnyFilterActive ? true : (wasOpen !== undefined ? wasOpen : false),
        selected: false,
        items: items,
        isEditing: false,
        tempName: name
      };
    });
    
    if (isAnyFilterActive) {
      this.groupedPromotions = this.groupedPromotions.filter(g => g.items.length > 0);
    }
    this.cdr.detectChanges();
  }

  /**
   * CHỨC NĂNG MỚI: Vô hiệu hóa hoặc Kích hoạt các khuyến mãi đã chọn
   */
  toggleActiveStatus(status: boolean): void {
    const selectedPromos = this.promotions.filter(p => p.selected);
    if (selectedPromos.length === 0) return;

    let processed = 0;
    selectedPromos.forEach(p => {
      this.promoService.capNhatKhuyenMai(p._id, { isActive: status }).subscribe({
        next: () => {
          processed++;
          if (processed === selectedPromos.length) {
            this.showNotify('success', 'Thành công', `Đã ${status ? 'hiện' : 'ẩn'} các chương trình đã chọn.`);
            this.taiDuLieu();
          }
        },
        error: () => this.showNotify('danger', 'Lỗi', 'Không thể cập nhật trạng thái.')
      });
    });
  }

  /**
   * CHỨC NĂNG MỚI: Chuyển các khuyến mãi đã chọn vào một nhóm hiện có
   */
  moveToGroup(targetName: string): void {
    const selectedIds = this.promotions.filter(p => p.selected).map(p => p._id);
    if (selectedIds.length === 0) return;

    this.promoService.nhomKhuyenMai(selectedIds, targetName).subscribe({
      next: () => {
        this.showMoveToMenu = false;
        this.taiDuLieu();
        this.showNotify('success', 'Thành công', `Đã chuyển vào nhóm <b>"${targetName}"</b>.`);
      },
      error: () => this.showNotify('danger', 'Lỗi', 'Không thể di chuyển nhóm.')
    });
  }

  /**
   * Đóng/Mở nhóm khi click vào thanh tiêu đề
   */
  toggleGroup(group: PromotionGroup): void {
    if (!group.isEditing) {
      group.isOpen = !group.isOpen;
    }
  }

  onSearchEnter(): void {
    this.appliedSearchText = this.searchText;
    this.organizeGroups();
  }

  resetFilters(): void {
    this.searchText = '';
    this.appliedSearchText = '';
    this.filterDiscountType = '';
    this.filterCategory = '';
    this.filterApplyTo = '';
    this.filterStatus = '';
    this.organizeGroups(); 
  }

  // --- CHỈNH SỬA TÊN NHÓM TẠI CHỖ ---

  startEditGroupName(group: PromotionGroup, event: Event): void {
    event.stopPropagation(); 
    if (!group.groupName) return; 
    group.isEditing = true;
    group.tempName = group.groupName;
  }

  saveGroupName(group: PromotionGroup): void {
    const newName = group.tempName.trim();
    if (!newName || newName === group.groupName) {
      group.isEditing = false;
      return;
    }

    const ids = group.items.map(p => p._id);
    this.promoService.nhomKhuyenMai(ids, newName).subscribe({
      next: () => {
        group.groupName = newName;
        group.isEditing = false;
        this.taiDuLieu();
      },
      error: (err) => {
        group.isEditing = false;
        this.showNotify('danger', 'Lỗi cập nhật', 'Không thể đổi tên nhóm.');
      }
    });
  }

  cancelEditGroup(group: PromotionGroup): void {
    group.isEditing = false;
    group.tempName = group.groupName;
  }

  // --- QUẢN LÝ CHỌN (CHECKBOX) ---

  toggleGroupSelection(group: PromotionGroup): void {
    group.items.forEach(p => p.selected = group.selected);
  }

  updateGroupCheckboxState(group: PromotionGroup): void {
    group.selected = group.items.length > 0 && group.items.every(p => p.selected);
  }

  // --- HỆ THỐNG THÔNG BÁO ---

  showNotify(type: 'success' | 'danger' | 'warning', title: string, message: string) {
    this.notify = {
      show: true, type, title, message, isConfirm: false, actionType: '', btnText: 'ĐỒNG Ý',
      icon: type === 'success' ? 'bi-check-circle' : 'bi-exclamation-octagon'
    };
  }

  showConfirm(actionType: 'deletePromo' | 'dissolveGroup', title: string, message: string, data?: any) {
    this.pendingData = data;
    this.notify = {
      show: true, type: 'warning', title, message, isConfirm: true, actionType, btnText: 'XÁC NHẬN', icon: 'bi-question-circle'
    };
  }

  handleNotifyAction() {
    if (!this.notify.isConfirm) {
      this.notify.show = false;
      return;
    }
    if (this.notify.actionType === 'deletePromo') this.executeDeletePromotions();
    if (this.notify.actionType === 'dissolveGroup') this.executeDissolveGroup();
    this.notify.show = false;
  }

  confirmDeletePromotions(): void {
    const count = this.selectedCount;
    this.showConfirm('deletePromo', 'Xác nhận xóa', `Xóa vĩnh viễn <b>${count}</b> chương trình đã chọn?`);
  }

  private executeDeletePromotions(): void {
    const selectedIds = this.promotions.filter(p => p.selected).map(p => p._id);
    let count = 0;
    selectedIds.forEach(id => {
      this.promoService.xoaKhuyenMai(id).subscribe({
        next: () => {
          count++;
          if (count === selectedIds.length) {
            this.taiDuLieu();
            this.showNotify('success', 'Thành công', 'Đã xóa dữ liệu.');
          }
        }
      });
    });
  }

  confirmDeleteGroup(group: PromotionGroup): void {
    this.showConfirm('dissolveGroup', 'Giải tán nhóm', `Các mã trong <b>"${group.groupName}"</b> sẽ về mục "Chưa phân nhóm".`, group);
  }

  private executeDissolveGroup(): void {
    const group = this.pendingData;
    const ids = group.items.map((p: any) => p._id);
    this.promoService.nhomKhuyenMai(ids, "").subscribe({
      next: () => {
        this.taiDuLieu();
        this.showNotify('success', 'Đã giải tán nhóm', `Nhóm "${group.groupName}" đã được xóa.`);
      },
      error: () => this.showNotify('danger', 'Lỗi', 'Không thể giải tán nhóm.')
    });
  }

  onDrop(event: CdkDragDrop<any[]>, targetGroupName: string): void {
    const promo = event.item.data;
    if (promo.groupName === targetGroupName) return;
    this.promoService.nhomKhuyenMai([promo._id], targetGroupName).subscribe({
      next: () => this.taiDuLieu()
    });
  }

  openGroupModal(): void {
    this.tempGroupName = '';
    this.isGroupModalOpen = true;
  }

  confirmGrouping(): void {
    const selectedIds = this.promotions.filter(p => p.selected).map(p => p._id);
    const name = this.tempGroupName.trim();
    this.promoService.nhomKhuyenMai(selectedIds, name).subscribe({
      next: () => {
        this.isGroupModalOpen = false;
        this.taiDuLieu();
        this.showNotify('success', 'Thành công', `Đã tạo nhóm <b>"${name}"</b>.`);
      },
      error: () => this.showNotify('danger', 'Lỗi', 'Không thể tạo nhóm mới.')
    });
  }

  // --- GETTER THỐNG KÊ ---
  get totalCount() { return this.promotions.length; }
  get ongoingCount() { return this.promotions.filter(p => p.status === 'ongoing').length; }
  get upcomingCount() { return this.promotions.filter(p => p.status === 'upcoming').length; }
  get expiredCount() { return this.promotions.filter(p => p.status === 'expired').length; }
  get selectedCount() { return this.promotions.filter(p => p.selected).length; }

  toggleAll(event: any): void {
    const isChecked = event.target.checked;
    this.promotions.forEach(p => p.selected = isChecked);
    this.groupedPromotions.forEach(g => g.selected = isChecked);
  }

  onEditClick() {
    const selected = this.promotions.find(p => p.selected);
    if (selected) this.goEdit.emit(selected);
  }
}