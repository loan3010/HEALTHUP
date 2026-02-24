import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // QUAN TRỌNG: Sửa lỗi NG8002
import { AdminSidebar } from '../admin-sidebar/admin-sidebar';
import { AdminHeader } from '../admin-header/admin-header';
import { AdminBlog } from '../adminblog/admin-blog/admin-blog'; // Import component Blog bạn vừa tạo
import { Promotion } from '../admin-promotion/promotion/promotion';
import {Consulting } from '../admin-consulting/consulting/consulting';
import { AdminChatbot } from '../admin_chatbot/admin-chatbot/admin-chatbot';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, AdminSidebar, AdminHeader, AdminBlog, Promotion, Consulting, AdminChatbot ], // Thêm CommonModule và Blog vào đây
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.css']
})
export class AdminLayout {
  isSidebarOpen = true;
  currentTab: string = 'tong-quan'; // Biến lưu trữ tab hiện tại để sửa lỗi TS2339

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen; 
  }

  // Hàm nhận dữ liệu tab từ Sidebar truyền lên
  onTabChange(tabName: string) {
    this.currentTab = tabName;
  }
}