import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chatbot-live-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chatbot-live-preview.html',
  styleUrl: './chatbot-live-preview.css'
})
export class ChatbotLivePreview {
  // KHAI BÁO CÁI NÀY ĐỂ NÚT DẤU X HOẠT ĐỘNG
  @Output() closeChat = new EventEmitter<void>();
}