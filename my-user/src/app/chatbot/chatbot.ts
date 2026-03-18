import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule, NgClass, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
}

interface FAQ {
  id: number;
  category_id: number;
  question: string;
  answer: string;
  view_count: number;
  category_name?: string;
}

interface Message {
  type: 'user' | 'bot';
  text: string;
  time: string;
  suggestions?: FAQ[];
}

interface ConversationHistory {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, NgClass, NgIf, NgFor],
  templateUrl: './chatbot.html',
  styleUrls: ['./chatbot.css']
})
export class ChatbotComponent implements OnInit {

  private apiUrl = 'http://localhost:3000/api/chatbot';

  isOpen = false;
  showWelcome = true;
  sessionId: string;
  categories: Category[] = [];
  messages: Message[] = [];
  userInput = '';
  isTyping = false;

  private conversationHistory: ConversationHistory[] = [];

  botName = 'HealthUp Assistant';

  // FIX: Dùng inline SVG data URI thay vì đường dẫn file có thể bị lỗi
  botAvatar = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="24" fill="#36873A"/>
      <text x="24" y="30" text-anchor="middle" font-size="22" font-family="sans-serif">🌿</text>
    </svg>
  `)}`;

  userAvatar = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="24" fill="#D4A017"/>
      <text x="24" y="30" text-anchor="middle" font-size="22" font-family="sans-serif">👤</text>
    </svg>
  `)}`;

  private systemPrompt = `Bạn là trợ lý ảo của HealthUp - thương hiệu thực phẩm healthy Việt Nam với slogan "Sống khỏe mỗi ngày".

HealthUp chuyên cung cấp:
- Granola: các loại granola không đường tinh luyện, dùng mật ong tự nhiên, phù hợp ăn sáng/ăn kiêng
- Trà thảo mộc: trà hoa cúc, lavender, bạc hà - không caffeine, hỗ trợ thư giãn
- Trái cây sấy: sấy tự nhiên không đường, bảo quản 6-12 tháng

Chính sách:
- Giao hàng nội thành TP.HCM: 1-2 ngày, các tỉnh: 2-4 ngày
- Miễn phí ship cho đơn từ 300.000đ
- Giao nhanh trong ngày với đơn đặt trước 10h tại TP.HCM

Phong cách trả lời:
- Thân thiện, nhiệt tình, dùng emoji phù hợp
- Trả lời bằng tiếng Việt
- Ngắn gọn, rõ ràng, dễ hiểu
- Nếu không chắc, hướng dẫn khách liên hệ hotline: 1900 xxxx
- KHÔNG bịa thông tin về giá cả hoặc sản phẩm không rõ`;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {
    this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  getCurrentTime(): string {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' +
      now.getMinutes().toString().padStart(2, '0');
  }

  sanitizeHtml(html: string): SafeHtml {
    const formatted = html.replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
  }

  startChat(): void {
    this.showWelcome = false;
    this.addBotMessage(
      'Xin chào! 👋 Tôi có thể giúp gì cho bạn hôm nay?\n\n' +
      'Bạn có thể chọn một chủ đề bên dưới hoặc nhập câu hỏi của bạn trực tiếp.'
    );
  }

  addMessage(type: 'user' | 'bot', text: string, suggestions?: FAQ[]): void {
    this.messages.push({ type, text, time: this.getCurrentTime(), suggestions });
    setTimeout(() => this.scrollToBottom(), 100);
  }

  addUserMessage(text: string): void { this.addMessage('user', text); }
  addBotMessage(text: string, suggestions?: FAQ[]): void { this.addMessage('bot', text, suggestions); }
  showTypingIndicator(): void { this.isTyping = true; }
  hideTypingIndicator(): void { this.isTyping = false; }

  scrollToBottom(): void {
    const container = document.querySelector('.hu-chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }

  loadCategories(): void {
    this.http.get<any>(`${this.apiUrl}/categories`).subscribe({
      next: (response) => {
        if (response.success) {
          this.categories = response.data.filter((cat: Category) => cat.slug !== 'tat-ca');
        }
      },
      error: (error) => console.error('Error loading categories:', error)
    });
  }

  handleCategoryClick(category: Category): void {
    this.addUserMessage(`Tôi muốn biết về ${category.name}`);
    this.showTypingIndicator();

    this.http.get<any>(`${this.apiUrl}/faqs?category_id=${category.id}`).subscribe({
      next: (response) => {
        this.hideTypingIndicator();
        if (response.success && response.data.length > 0) {
          const faqs = response.data.slice(0, 5);
          const botText = `Đây là một số câu hỏi phổ biến về **${category.name}**:`;
          this.addBotMessage(botText, faqs);
          this.pushToHistory('user', `Tôi muốn biết về ${category.name}`);
          this.pushToHistory('assistant', botText);
        } else {
          const botText = `Xin lỗi, hiện chưa có thông tin về ${category.name}. Bạn có thể hỏi câu hỏi khác nhé!`;
          this.addBotMessage(botText);
          this.pushToHistory('user', `Tôi muốn biết về ${category.name}`);
          this.pushToHistory('assistant', botText);
        }
        this.saveConversation(`Tôi muốn biết về ${category.name}`, 'Showed category FAQs');
      },
      error: () => {
        this.hideTypingIndicator();
        this.addBotMessage('Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau!');
      }
    });
  }

  handleFAQClick(faq: FAQ): void {
    this.addUserMessage(faq.question);
    this.showTypingIndicator();
    setTimeout(() => {
      this.hideTypingIndicator();
      this.addBotMessage(faq.answer);
      this.pushToHistory('user', faq.question);
      this.pushToHistory('assistant', faq.answer);
      this.saveConversation(faq.question, faq.answer);
      this.http.get<any>(`${this.apiUrl}/faqs/${faq.id}`).subscribe();
    }, 800);
  }

  sendMessage(): void {
    const query = this.userInput.trim();
    if (!query) return;

    this.userInput = '';
    this.addUserMessage(query);
    this.showTypingIndicator();

    this.http.post<any>(`${this.apiUrl}/chat/search`, { query }).subscribe({
      next: (response) => {
        if (response.success && response.data.length > 0) {
          this.hideTypingIndicator();
          const results = response.data;
          const topResult = results[0];
          this.addBotMessage(topResult.answer);
          this.pushToHistory('user', query);
          this.pushToHistory('assistant', topResult.answer);
          if (results.length > 1) {
            setTimeout(() => {
              this.addBotMessage('Bạn có thể quan tâm đến:', results.slice(1, 4));
            }, 500);
          }
          this.saveConversation(query, topResult.answer);
        } else {
          this.askClaude(query);
        }
      },
      error: () => this.askClaude(query)
    });
  }

  private askClaude(userQuery: string): void {
    const historyToSend: ConversationHistory[] = [
      ...this.conversationHistory,
      { role: 'user', content: userQuery }
    ];

    // Gọi qua backend proxy để bảo mật API key
    this.http.post<any>(`${this.apiUrl}/chat/claude`, { messages: historyToSend }).subscribe({
      next: (response) => {
        this.hideTypingIndicator();
        const claudeReply = response?.data?.reply ||
          'Xin lỗi, tôi không thể trả lời lúc này. Vui lòng liên hệ hotline: 1900 xxxx 🙏';
        this.addBotMessage(claudeReply);
        this.pushToHistory('user', userQuery);
        this.pushToHistory('assistant', claudeReply);
        this.saveConversation(userQuery, claudeReply);
      },
      error: () => {
        this.hideTypingIndicator();
        const fallback =
          'Xin lỗi, tôi không tìm thấy câu trả lời phù hợp. 🙏\n\n' +
          'Bạn có thể:\n- Thử đặt câu hỏi theo cách khác\n- Chọn chủ đề bên dưới\n- Liên hệ hotline: 1900 xxxx';
        this.addBotMessage(fallback);
        this.saveConversation(userQuery, fallback);
      }
    });
  }

  private pushToHistory(role: 'user' | 'assistant', content: string): void {
    this.conversationHistory.push({ role, content });
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }
  }

  saveConversation(userMessage: string, botResponse: string): void {
    this.http.post<any>(`${this.apiUrl}/chat/conversations`, {
      session_id: this.sessionId,
      user_message: userMessage,
      bot_response: botResponse
    }).subscribe({ error: (e) => console.error('Save error:', e) });
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}