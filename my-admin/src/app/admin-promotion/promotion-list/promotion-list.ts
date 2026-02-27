import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-promotion-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promotion-list.html',
  styleUrls: ['./promotion-list.css']
})
export class PromotionList {
  @Output() goEdit = new EventEmitter<any>();
  @Output() goAdd = new EventEmitter<void>();
  

  searchText: string = '';
  
  // Dữ liệu mẫu y hệt ảnh
  promotions = [
    { name: 'Khuyến mãi chào mừng tháng 12', code: 'KMCHAO12', usage: '0/100', status: 'upcoming', start: '20/11/2025', end: '10/01/2026', updated: '16/11/2025', selected: false },
    { name: 'Giữa tháng 11', code: 'KMMID11', usage: '0/100', status: 'ongoing', start: '11/11/2025', end: '16/12/2025', updated: '16/11/2025', selected: false },
    { name: 'Chào tháng 11 - Mua 1 tặng 1', code: 'TRUNGNGUYEN11', usage: '0/30', status: 'ongoing', start: '09/10/2025', end: '30/11/2026', updated: '10/11/2025', selected: false }
  ];

  get selectedCount() { return this.promotions.filter(p => p.selected).length; }

  toggleAll(event: any) {
    const isChecked = event.target.checked;
    this.promotions.forEach(p => p.selected = isChecked);
  }

  onEditClick() {
  const selected = this.promotions.find(p => p.selected); // Tìm dòng có selected = true
  if (selected) {
    this.goEdit.emit(selected); // Phát lệnh kèm theo dữ liệu dòng đó
  } else {
    alert("Vui lòng chọn một khuyến mãi để chỉnh sửa!");
  }
}
}