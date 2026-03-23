// import { Component } from '@angular/core';
// import { CommonModule } from '@angular/common'; // QUAN TRỌNG: Sửa lỗi NG8002
// import { AdminSidebar } from '../admin-sidebar/admin-sidebar';
// import { AdminHeader } from '../admin-header/admin-header';
// import { AdminBlog } from '../adminblog/admin-blog/admin-blog'; // Import component Blog bạn vừa tạo
// import { Promotion } from '../admin-promotion/promotion/promotion';
// import {Consulting } from '../admin-consulting/consulting/consulting';
// import { AdminChatbot } from '../admin_chatbot/admin-chatbot/admin-chatbot';

// @Component({
//   selector: 'app-admin-layout',
//   standalone: true,
//   imports: [CommonModule, AdminSidebar, AdminHeader, AdminBlog, Promotion, Consulting, AdminChatbot ], // Thêm CommonModule và Blog vào đây
//   templateUrl: './admin-layout.html',
//   styleUrls: ['./admin-layout.css']
// })
// export class AdminLayout {
//   isSidebarOpen = true;
//   currentTab: string = 'tong-quan'; // Biến lưu trữ tab hiện tại để sửa lỗi TS2339

//   toggleSidebar() {
//     this.isSidebarOpen = !this.isSidebarOpen; 
//   }

//   // Hàm nhận dữ liệu tab từ Sidebar truyền lên
//   onTabChange(tabName: string) {
//     this.currentTab = tabName;
//   }
// }
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminSidebar } from '../admin-sidebar/admin-sidebar';
import { AdminHeader } from '../admin-header/admin-header';
import { AdminBlog } from '../adminblog/admin-blog/admin-blog';
import { Promotion } from '../admin-promotion/promotion/promotion';
import { Consulting } from '../admin-consulting/consulting/consulting';
import { AdminChatbot } from '../admin_chatbot/admin-chatbot/admin-chatbot';

// --- IMPORT CÁC COMPONENT QUẢN LÝ ---
import { AdminDashboard } from '../admin-dashboard/admin-dashboard';
import { ProductComponent } from '../admin-product/product/product';
import { Customer } from '../admin-customer/customer/customer';
import { CustomerDetail } from '../admin-customer/customer-detail/customer-detail';
import { Order } from '../admin-order/order/order';
import { OrderDetail } from '../admin-order/order-detail/order-detail';

// --- IMPORT COMPONENT BANNER MỚI ---
import { AdminBanner } from '../admin-banner/admin-banner';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule, 
    AdminSidebar, 
    AdminHeader, 
    AdminBlog, 
    Promotion, 
    Consulting, 
    AdminChatbot,
    AdminDashboard,
    ProductComponent,  
    CustomerDetail,
    Customer,
    Order,
    OrderDetail,
    AdminBanner // <--- Đã thêm bạn này vào hệ thống
  ],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.css']
})
export class AdminLayout {
  isSidebarOpen = true;
  currentTab: string = 'tong-quan'; // Mặc định hiển thị Dashboard (Tổng quan)

  /**
   * Đóng/Mở thanh menu bên trái
   */
  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  /**
   * Xử lý khi người dùng chuyển tab trên Sidebar
   * @param tabName Tên tab nhận từ component Sidebar
   */
  onTabChange(tabName: string) {
    this.currentTab = tabName;
  }
}