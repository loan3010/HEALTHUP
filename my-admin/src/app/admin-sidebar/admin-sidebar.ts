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

  activeTab: string = 'khuyen-mai';

  setActiveTab(tabName: string) {
    this.activeTab = tabName;
    this.tabChange.emit(tabName);
  }
}