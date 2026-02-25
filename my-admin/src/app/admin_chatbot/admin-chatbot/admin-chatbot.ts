import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

// Import đầy đủ các component con để tránh lỗi NG8001
import { ChatbotKnowledgeBase } from '../chatbot-knowledge-base/chatbot-knowledge-base';
import { ChatbotLogicEngine } from '../chatbot-logic-engine/chatbot-logic-engine';
import { ChatbotLivePreview } from '../chatbot-live-preview/chatbot-live-preview';
import { ChatbotFormEditor } from '../chatbot-form-editor/chatbot-form-editor';

@Component({
  selector: 'app-admin-chatbot',
  standalone: true,
  imports: [
    CommonModule, 
    ChatbotKnowledgeBase, 
    ChatbotLogicEngine, 
    ChatbotLivePreview, 
    ChatbotFormEditor
  ],
  templateUrl: './admin-chatbot.html',
  styleUrls: ['./admin-chatbot.css'],
  encapsulation: ViewEncapsulation.None
})
export class AdminChatbot {
  // --- KHAI BÁO BIẾN (Để không bị lỗi Undefined) ---
  viewMode: 'knowledge' | 'logic' = 'knowledge';
  isModalOpen: boolean = false;
  isChatOpen: boolean = false;
  editingData: any = null;

  // --- CÁC HÀM XỬ LÝ (Phải nằm TRONG dấu ngoặc nhọn của class) ---

  toggleView(view: 'knowledge' | 'logic') {
    this.viewMode = view;
  }

  toggleChat() {
    this.isChatOpen = !this.isChatOpen;
  }

  // Mở form trống để Thêm mới
  openAddModal() {
    this.editingData = null; 
    this.isModalOpen = true;
  }

  // Mở form có dữ liệu để Sửa
  openEditModal(data: any) {
    this.editingData = { ...data }; 
    this.isModalOpen = true;
  }

  // Đóng Modal và reset dữ liệu
  closeModal() {
    this.isModalOpen = false;
    this.editingData = null;
  }
} // <--- Dấu ngoặc nhọn này phải ở cuối cùng để đóng class