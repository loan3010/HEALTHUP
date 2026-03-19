import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminSidebar } from '../admin-sidebar/admin-sidebar';
import { AdminHeader } from '../admin-header/admin-header';
import { AdminBlog } from '../adminblog/admin-blog/admin-blog';
import { Promotion } from '../admin-promotion/promotion/promotion';
import { Consulting } from '../admin-consulting/consulting/consulting';
import { AdminChatbot } from '../admin_chatbot/admin-chatbot/admin-chatbot';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, AdminSidebar, AdminHeader, AdminBlog, Promotion, Consulting, AdminChatbot],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.css']
})
export class AdminLayout {
  isSidebarOpen = true;
  currentTab: string = 'khuyen-mai'; // Mặc định mở tab khuyến mãi vì chưa có dashboard

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  onTabChange(tabName: string) {
    this.currentTab = tabName;
  }
}