import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ChatbotToggleService {
  // Trạng thái đóng/mở khung chat
  isOpen = signal(false); 
  
  // Trạng thái hiển thị màn hình chào mừng (Màn hình có icon 🌿 và nút Bắt đầu)
  showWelcome = signal(true);

  // Biến đánh dấu kích hoạt kịch bản (Để false để giữ đúng quy trình hiện Welcome trước)
  needsActivation = signal(false); 

  /**
   * Hàm mở Chatbot từ các trang ngoài (như trang FAQs)
   * Giúp mở khung chat và giữ nguyên giao diện chào mừng chuẩn của HealthUp.
   */
  openChat() {
    this.isOpen.set(true);     // Mở khung widget lên
    this.showWelcome.set(true); // ✅ HIỆN màn hình Welcome (có nút Bắt đầu) đúng như ảnh bà gửi
    this.needsActivation.set(false); // Không tự động kích hoạt tin nhắn để tránh nhảy trang
  }
}