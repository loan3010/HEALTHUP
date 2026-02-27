import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-chatbot-form-editor',
  standalone: true,
  templateUrl: './chatbot-form-editor.html',
  styleUrls: ['./chatbot-form-editor.css']
})
export class ChatbotFormEditor {
  @Input() data: any = null; // Nhận dữ liệu để edit
  @Output() close = new EventEmitter<void>();

  // Mock categories
  categories = ['Granola', 'Trà thảo mộc', 'Trái cây sấy', 'Chính sách chung'];
}