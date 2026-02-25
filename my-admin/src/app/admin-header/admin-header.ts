import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-admin-header',
  standalone: true,
  templateUrl: './admin-header.html',
  styleUrls: ['./admin-header.css']
})
export class AdminHeader {
  @Output() toggleSidebarEvent = new EventEmitter<void>();

  onToggleClick() {
    this.toggleSidebarEvent.emit(); // Phát tín hiệu đi
  }
}