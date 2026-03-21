import { Component, Output, EventEmitter, OnInit } from '@angular/core';
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

  // Trạng thái hiển thị Modal gom nhóm (Tạo nhóm mới)
  isGroupModalOpen: boolean = false;
  tempGroupName: string = '';

  // --- HỆ THỐNG THÔNG BÁO TÙY CHỈNH (NOTIFICATION SYSTEM) ---
  notify = {
    show: false,
    type: 'success' as 'success' | 'danger' | 'warning',
    icon: 'bi-check-circle',
    title: '',
    message: '',
    btnText: 'ĐỒNG Ý',
    isConfirm: false,
    actionType: '' // 'deletePromo' | 'dissolveGroup'
  };

  pendingData: any = null; // Lưu dữ liệu tạm khi chờ xác nhận

  constructor(private promoService: PromotionService) {}

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
            usage: `${p.usedCount || 0}/${p.totalLimit || 0}`,
            start: ngayBD.toLocaleDateString('vi-VN'),
            end: ngayKT.toLocaleDateString('vi-VN'),
            groupName: p.groupName || '', 
            updated: p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('vi-VN') : ''
          };
        });
        // Render dữ liệu và giữ nguyên trạng thái đóng mở
        this.organizeGroups();
      },
      error: (err) => {
        console.error('Lỗi tải dữ liệu:', err);
        this.showNotify('danger', 'Lỗi hệ thống', 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền.');
      }
    });
  }

  /**
   * HÀM QUAN TRỌNG: LỌC ĐA ĐIỀU KIỆN & CHIA FOLDER
   * Giữ nguyên trạng thái isOpen của các nhóm trước đó nếu có
   */
  organizeGroups(): void {
    // Lưu lại trạng thái đóng/mở hiện tại của các nhóm dựa trên tên nhóm
    const currentStates = new Map<string, boolean>();
    this.groupedPromotions.forEach(g => {
      currentStates.set(g.groupName, g.isOpen);
    });

    const term = this.appliedSearchText.toLowerCase().trim();
    const isAnyFilterActive = !!(term || this.filterDiscountType || this.filterCategory || this.filterApplyTo || this.filterStatus);

    // 1. Lọc mảng phẳng dựa trên tất cả các tiêu chí
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

    // 2. Gom nhóm mảng đã lọc
    const map = new Map<string, any[]>();
    if (!isAnyFilterActive) {
      map.set('', []);
    }

    filteredList.forEach(p => {
      const gName = p.groupName || '';
      if (!map.has(gName)) map.set(gName, []);
      map.get(gName)?.push(p);
    });

    // 3. Chuyển đổi sang giao diện hiển thị
    this.groupedPromotions = Array.from(map.entries()).map(([name, items]) => {
      const wasOpen = currentStates.get(name);
      
      let finalOpenState = false;
      if (isAnyFilterActive) {
        finalOpenState = true; // Nếu đang lọc thì tự động mở
      } else if (wasOpen !== undefined) {
        finalOpenState = wasOpen; // Nếu đã có trạng thái trước đó thì giữ nguyên
      } else {
        finalOpenState = false; // Mặc định lần đầu vào là đóng
      }

      return {
        groupName: name,
        isOpen: finalOpenState,
        selected: false,
        items: items,
        isEditing: false,
        tempName: name
      };
    });
    
    if (isAnyFilterActive) {
      this.groupedPromotions = this.groupedPromotions.filter(g => g.items.length > 0);
    }
  }

  /**
   * Đóng/Mở nhóm khi click vào thanh tiêu đề (Header)
   */
  toggleGroup(group: PromotionGroup): void {
    if (!group.isEditing) {
      group.isOpen = !group.isOpen;
    }
  }

  /**
   * Xử lý khi nhấn ENTER để tìm kiếm
   */
  onSearchEnter(): void {
    this.appliedSearchText = this.searchText;
    this.organizeGroups();
  }

  /**
   * NÚT ĐẶT LẠI: Reset toàn bộ về mặc định và ĐÓNG folder
   */
  resetFilters(): void {
    this.searchText = '';
    this.appliedSearchText = '';
    this.filterDiscountType = '';
    this.filterCategory = '';
    this.filterApplyTo = '';
    this.filterStatus = '';
    this.organizeGroups(); 
  }

  // --- LOGIC CHỈNH SỬA TÊN NHÓM TẠI CHỖ (INLINE EDIT) ---

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
        this.promotions.forEach(p => {
          if (ids.includes(p._id)) p.groupName = newName;
        });
      },
      error: (err) => {
        console.error('Lỗi đổi tên nhóm:', err);
        group.isEditing = false;
        this.showNotify('danger', 'Lỗi cập nhật', 'Không thể đổi tên nhóm vào lúc này.');
      }
    });
  }

  cancelEditGroup(group: PromotionGroup): void {
    group.isEditing = false;
    group.tempName = group.groupName;
  }

  // --- LOGIC CHỌN (CHECKBOX) ---

  toggleGroupSelection(group: PromotionGroup): void {
    group.items.forEach(p => p.selected = group.selected);
  }

  updateGroupCheckboxState(group: PromotionGroup): void {
    group.selected = group.items.length > 0 && group.items.every(p => p.selected);
  }

  toggleItemSelection(p: any, group: PromotionGroup): void {
    p.selected = !p.selected;
    this.updateGroupCheckboxState(group);
  }

  // --- HỆ THỐNG MODAL THÔNG BÁO TÙY CHỈNH ---

  showNotify(type: 'success' | 'danger' | 'warning', title: string, message: string) {
    this.notify = {
      show: true,
      type,
      title,
      message,
      isConfirm: false,
      actionType: '',
      btnText: 'ĐỒNG Ý',
      icon: type === 'success' ? 'bi-check-circle' : (type === 'danger' ? 'bi-exclamation-octagon' : (type === 'warning' ? 'bi-exclamation-triangle' : 'bi-question-circle'))
    };
  }

  showConfirm(actionType: 'deletePromo' | 'dissolveGroup', title: string, message: string, data?: any) {
    this.pendingData = data;
    this.notify = {
      show: true,
      type: 'warning',
      title,
      message,
      isConfirm: true,
      actionType,
      btnText: 'XÁC NHẬN',
      icon: 'bi-question-circle'
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

  // --- XỬ LÝ XÓA KHUYẾN MÃI ---

  confirmDeletePromotions(): void {
    const count = this.promotions.filter(p => p.selected).length;
    this.showConfirm(
      'deletePromo', 
      'Xác nhận xóa dữ liệu', 
      `Hệ thống sẽ xóa vĩnh viễn <b>${count}</b> chương trình khuyến mãi đã chọn. Bạn có chắc chắn muốn tiếp tục?`
    );
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
            this.showNotify('success', 'Thành công', 'Các chương trình khuyến mãi đã được loại bỏ hoàn toàn khỏi hệ thống.');
          }
        }
      });
    });
  }

  // --- XỬ LÝ XÓA NHÓM (GIẢI TÁN) ---

  confirmDeleteGroup(group: PromotionGroup): void {
    this.showConfirm(
      'dissolveGroup', 
      'Giải tán nhóm khuyến mãi', 
      `Các chương trình trong nhóm <b>"${group.groupName}"</b> sẽ quay về mục "Chưa phân nhóm". Bạn có muốn thực hiện?`,
      group
    );
  }

  private executeDissolveGroup(): void {
    const group = this.pendingData;
    const ids = group.items.map((p: any) => p._id);
    
    this.promoService.nhomKhuyenMai(ids, "").subscribe({
      next: () => {
        this.taiDuLieu();
        this.showNotify('success', 'Đã giải tán nhóm', `Nhóm "${group.groupName}" đã được xóa thành công.`);
      },
      error: (err) => this.showNotify('danger', 'Lỗi cập nhật', 'Không thể giải tán nhóm vào lúc này.')
    });
  }

  // --- LOGIC KÉO THẢ & GOM NHÓM ---

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
        this.showNotify('success', 'Gom nhóm thành công', `Đã chuyển các chương trình đã chọn vào nhóm <b>"${name}"</b>.`);
      },
      error: (err) => this.showNotify('danger', 'Lỗi gom nhóm', 'Có lỗi xảy ra trong quá trình tạo nhóm mới.')
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