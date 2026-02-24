import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-profile.html',
  styleUrls: ['./user-profile.css'],
})
export class UserProfile {

  activeMenu = 'Tài khoản cá nhân';

  menuItems = [
    { icon: 'bi-person', label: 'Tài khoản cá nhân' },
    { icon: 'bi-geo-alt', label: 'Sổ địa chỉ' },
    { icon: 'bi-box-seam', label: 'Quản lý đơn hàng' },
    { icon: 'bi-arrow-repeat', label: 'Quản lý đổi trả' },
    { icon: 'bi-star', label: 'Đánh giá đơn hàng' },
    { icon: 'bi-heart', label: 'Sản phẩm yêu thích' },
    { icon: 'bi-bell', label: 'Thông báo' }
  ];

  setActive(label: string) {
    this.activeMenu = label;
  }

}