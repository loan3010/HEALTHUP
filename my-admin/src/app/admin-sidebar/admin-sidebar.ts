import { Component, Input, Output, EventEmitter } from '@angular/core';
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
  @Output() tabChange = new EventEmitter<string>();


  activeTab: string = 'tong-quan';


  setActiveTab(tabName: string) {
    this.activeTab = tabName;
    this.tabChange.emit(tabName);
  }


  /**
   * Đồng bộ highlight sidebar khi đổi tab từ code (vd. thông báo mở đơn hàng).
   * Không emit tabChange — tránh vòng lặp với parent.
   */
  setActiveTabSilent(tabName: string): void {
    this.activeTab = tabName;
  }
}