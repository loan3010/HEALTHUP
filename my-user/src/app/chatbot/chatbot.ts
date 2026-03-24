import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule, NgClass, NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';

// --- INTERFACES ---

interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface FAQ {
  _id: string;
  category: string;
  question: string;
  answer: string;
  variations?: string[];
  relatedProducts?: any[]; 
}

interface Message {
  type: 'user' | 'bot';
  text: SafeHtml;
  time: string;
  suggestions?: FAQ[];
  suggestionIndex: number; // Theo dõi vị trí câu hỏi đang hiển thị (phân trang)
  products?: any[]; 
}

interface ConversationHistory {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, NgClass, NgIf, NgFor, RouterModule],
  templateUrl: './chatbot.html',
  styleUrls: ['./chatbot.css']
})
export class ChatbotComponent implements OnInit {

  private apiUrl = 'http://localhost:3000/api/chatbot';
  readonly serverUrl = 'http://localhost:3000';
  protected readonly Math = Math; // Cho phép sử dụng Math trong template HTML

  isOpen = false;
  showWelcome = true;
  sessionId: string;
  categories: Category[] = [];
  messages: Message[] = [];
  userInput = '';
  isTyping = false;

  // ✅ Trạng thái đóng/mở danh sách chủ đề (Quick Replies)
  isQuickRepliesOpen = false;

  private conversationHistory: ConversationHistory[] = [];

  botName = 'HealthUp Assistant';

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

  fallbackImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150">
      <rect width="150" height="150" fill="#f8f9fa"/>
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="bold" fill="#adb5bd">HealthUp</text>
      <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#ced4da">No Image</text>
    </svg>
  `)}`;

  constructor(
    private http: HttpClient, 
    private sanitizer: DomSanitizer,
    private router: Router,
    private cdr: ChangeDetectorRef // Inject thuốc đặc trị lỗi click 2 lần
  ) {
    this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  getCurrentTime(): string {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' +
      now.getMinutes().toString().padStart(2, '0');
  }

  getFullImageUrl(data: any): string {
    if (!data) return this.fallbackImage;

    let imgName = '';
    if (typeof data === 'object' && !Array.isArray(data)) {
      imgName = data.image || data.thumbnail || data.imageUrl || (data.images?.[0]);
    } else if (Array.isArray(data) && data.length > 0) {
      imgName = data[0];
    } else if (typeof data === 'string') {
      imgName = data;
    }

    if (!imgName || typeof imgName !== 'string' || imgName.trim() === '') return this.fallbackImage;
    if (imgName.startsWith('http')) return imgName;

    let fileName = imgName.trim();
    if (fileName.startsWith('/')) fileName = fileName.substring(1);

    if (!fileName.includes('images/products/')) {
      return `${this.serverUrl}/images/products/${fileName}`;
    }
    return `${this.serverUrl}/${fileName}`;
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    this.cdr.detectChanges();
  }

  // ✅ Hàm đóng/mở cụm chủ đề tư vấn
  toggleQuickReplies(): void {
    this.isQuickRepliesOpen = !this.isQuickRepliesOpen;
    this.cdr.detectChanges();
  }

  startChat(): void {
    this.showWelcome = false;
    this.addBotMessage(
      'Xin chào! 👋 Tôi là trợ lý ảo của HealthUp.\n\n' +
      'Tôi có thể giúp bạn giải đáp thắc mắc về sản phẩm và chính sách. Bạn có thể chọn chủ đề bên dưới hoặc nhập câu hỏi trực tiếp nhé!'
    );
  }

  addMessage(type: 'user' | 'bot', text: string, suggestions?: FAQ[], products?: any[]): void {
    const formattedText = (text || '').replace(/\n/g, '<br>');
    const safeContent = this.sanitizer.bypassSecurityTrustHtml(formattedText);

    this.messages.push({ 
      type, 
      text: safeContent, 
      time: this.getCurrentTime(), 
      suggestions: suggestions || [],
      suggestionIndex: 0, 
      products 
    });

    this.cdr.detectChanges(); // Cập nhật UI ngay khi thêm tin nhắn
    setTimeout(() => {
      this.scrollToBottom();
      this.cdr.detectChanges();
    }, 100);
  }

  addUserMessage(text: string): void { this.addMessage('user', text); }
  addBotMessage(text: string, suggestions?: FAQ[], products?: any[]): void { 
    this.addMessage('bot', text, suggestions, products); 
  }
  
  scrollToBottom(): void {
    const container = document.querySelector('.hu-chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }

  loadCategories(): void {
    this.http.get<any>(`${this.apiUrl}/categories`).subscribe({
      next: (res) => {
        this.categories = Array.isArray(res) ? res : (res.data || []);
        this.cdr.detectChanges();
      },
      error: (error) => console.error('Lỗi tải danh mục:', error)
    });
  }

  // --- ĐIỀU HƯỚNG PHÂN TRANG FAQ (3 câu mỗi lượt) ---

  nextSuggestions(message: Message): void {
    if (message.suggestions && message.suggestionIndex + 3 < message.suggestions.length) {
      message.suggestionIndex += 3;
      this.cdr.detectChanges();
    }
  }

  prevSuggestions(message: Message): void {
    if (message.suggestionIndex >= 3) {
      message.suggestionIndex -= 3;
      this.cdr.detectChanges();
    }
  }

  handleCategoryClick(category: Category): void {
    this.addUserMessage(`Tôi muốn tư vấn về ${category.name}`);
    this.isTyping = true;
    this.cdr.detectChanges();

    this.http.get<any>(`${this.apiUrl}/faqs?category=${category.name}`).subscribe({
      next: (res) => {
        setTimeout(() => {
          this.isTyping = false;
          const faqs = Array.isArray(res) ? res : (res.data || []);
          if (faqs.length > 0) {
            const botText = `Dưới đây là các câu hỏi thường gặp về **${category.name}**, bạn nhấn vào để xem câu trả lời nhé:`;
            this.addBotMessage(botText, faqs);
          } else {
            this.addBotMessage(`Hiện tại tôi đang cập nhật thêm thông tin về ${category.name}. Bạn có thể đặt câu hỏi cụ thể hơn cho tôi nhé!`);
          }
          // Sau khi chọn, tự động đóng menu chủ đề lại cho gọn
          this.isQuickRepliesOpen = false;
          this.cdr.detectChanges();
        }, 1000);
      },
      error: () => {
        this.isTyping = false;
        this.addBotMessage('Xin lỗi, tôi gặp chút trục trặc. Thử lại sau nhé!');
        this.cdr.detectChanges();
      }
    });
  }

  handleFAQClick(faq: FAQ): void {
    this.addUserMessage(faq.question);
    this.isTyping = true;
    this.cdr.detectChanges();
    
    setTimeout(() => {
      this.isTyping = false;
      this.addBotMessage(faq.answer, undefined, faq.relatedProducts);
      this.pushToHistory('user', faq.question);
      this.pushToHistory('assistant', faq.answer);
      this.saveConversation(faq.question, faq.answer);
      this.cdr.detectChanges();
    }, 1000);
  }

  sendMessage(): void {
    const query = this.userInput.trim();
    if (!query) return;

    this.userInput = '';
    this.addUserMessage(query);
    this.isTyping = true;
    this.cdr.detectChanges();

    this.http.post<any>(`${this.apiUrl}/ask`, { message: query }).subscribe({
      next: (response) => {
        setTimeout(() => {
          this.isTyping = false;
          if (response.success || (response.score && response.score > 0)) {
            console.log('📦 DỮ LIỆU SẢN PHẨM TỪ BACKEND:', response.products); 
            this.addBotMessage(response.answer, undefined, response.products);
            this.pushToHistory('user', query);
            this.pushToHistory('assistant', response.answer);
            this.saveConversation(query, response.answer);
          } else {
            this.askClaude(query);
          }
          this.cdr.detectChanges();
        }, 1000);
      },
      error: () => {
        setTimeout(() => {
          this.isTyping = false;
          this.askClaude(query);
          this.cdr.detectChanges();
        }, 1000);
      }
    });
  }

  goToProductDetail(id: string): void {
    if (!id) return;
    this.router.navigate(['/product-detail-page', id]);
  }

  private askClaude(userQuery: string): void {
    const historyToSend: ConversationHistory[] = [
      ...this.conversationHistory,
      { role: 'user', content: userQuery }
    ];

    this.isTyping = true;
    this.cdr.detectChanges();

    this.http.post<any>(`${this.apiUrl}/chat/claude`, { messages: historyToSend }).subscribe({
      next: (response) => {
        setTimeout(() => {
          this.isTyping = false;
          const claudeReply = response?.reply || response?.data?.reply || 
                              'Xin lỗi, hiện tại tôi không thể phản hồi. Bạn vui lòng liên hệ hotline nhé! 🙏';
          
          this.addBotMessage(claudeReply);
          this.pushToHistory('user', userQuery);
          this.pushToHistory('assistant', claudeReply);
          this.saveConversation(userQuery, claudeReply);
          this.cdr.detectChanges();
        }, 1200);
      },
      error: () => {
        this.isTyping = false;
        const fallback = 'Hiện tại hệ thống AI đang bận. Bạn vui lòng đặt lại câu hỏi sau ạ! 🌿';
        this.addBotMessage(fallback);
        this.cdr.detectChanges();
      }
    });
  }

  private pushToHistory(role: 'user' | 'assistant', content: string): void {
    this.conversationHistory.push({ role, content });
    if (this.conversationHistory.length > 10) {
      this.conversationHistory = this.conversationHistory.slice(-10);
    }
  }

  private saveConversation(userMessage: string, botResponse: string): void {
    this.http.post<any>(`${this.apiUrl}/chat/conversations`, {
      session_id: this.sessionId,
      user_message: userMessage,
      bot_response: botResponse
    }).subscribe({
      error: (err) => console.error('Lỗi lưu lịch sử chat:', err)
    });
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}