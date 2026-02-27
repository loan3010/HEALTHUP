import { Component, Input, Output, EventEmitter } from '@angular/core'; // Thêm Output và EventEmitter
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [CommonModule], 
  templateUrl: './admin-sidebar.html',
  styleUrls: ['./admin-sidebar.css']
})
export class AdminSidebar {
  @Input() isOpen: boolean = true; 
  @Output() tabChange = new EventEmitter<string>(); // Phát tín hiệu khi đổi tab

  activeTab: string = 'tong-quan'; 

  setActiveTab(tabName: string) {
    this.activeTab = tabName;
    this.tabChange.emit(tabName); // Gửi tên tab ra ngoài cho Layout
  }
}