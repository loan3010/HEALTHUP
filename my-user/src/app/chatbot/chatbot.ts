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

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule, NgClass, NgIf, NgFor],
  templateUrl: './chatbot.html',
  styleUrls: ['./chatbot.css']
})
export class ChatbotComponent implements OnInit {
  
  // Config - ĐỔI URL NÀY THÀNH BACKEND CỦA BẠN
  private apiUrl = 'http://localhost:3000/api/chatbot';
  
  // State
  isOpen = false;
  showWelcome = true;
  sessionId: string;
  categories: Category[] = [];
  messages: Message[] = [];
  userInput = '';
  isTyping = false;

  botName = 'HealthUp Assistant';
botAvatar = 'assets/healthup-logo.svg'; // Hoặc đường dẫn ảnh bot của bạn
userAvatar = 'assets/user-icon.png';
  
  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {
    this.sessionId = this.generateSessionId();
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  // ==================== HELPER FUNCTIONS ====================
  
  generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getCurrentTime(): string {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + 
           now.getMinutes().toString().padStart(2, '0');
  }

  formatMessage(text: string): string {
    return text.replace(/\n/g, '<br>');
  }

  // Sanitize HTML để hiển thị an toàn
  sanitizeHtml(html: string): SafeHtml {
    const formatted = html.replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }

  // ==================== UI ACTIONS ====================
  
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

  // ==================== MESSAGE HANDLING ====================
  
  addMessage(type: 'user' | 'bot', text: string, suggestions?: FAQ[]): void {
    this.messages.push({
      type,
      text,
      time: this.getCurrentTime(),
      suggestions
    });
    
    setTimeout(() => this.scrollToBottom(), 100);
  }

  addUserMessage(text: string): void {
    this.addMessage('user', text);
  }

  addBotMessage(text: string, suggestions?: FAQ[]): void {
    this.addMessage('bot', text, suggestions);
  }

  showTypingIndicator(): void {
    this.isTyping = true;
  }

  hideTypingIndicator(): void {
    this.isTyping = false;
  }

  scrollToBottom(): void {
    const container = document.querySelector('.chat-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // ==================== API CALLS ====================
  
  loadCategories(): void {
    this.http.get<any>(`${this.apiUrl}/categories`).subscribe({
      next: (response) => {
        if (response.success) {
          this.categories = response.data.filter((cat: Category) => cat.slug !== 'tat-ca');
        }
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
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
          this.addBotMessage(
            `Đây là một số câu hỏi phổ biến về ${category.name}:`,
            faqs
          );
        } else {
          this.addBotMessage(
            `Xin lỗi, hiện tại chưa có thông tin về ${category.name}. ` +
            `Bạn có thể hỏi câu hỏi khác nhé!`
          );
        }
        
        this.saveConversation(
          `Tôi muốn biết về ${category.name}`,
          'Showed category FAQs'
        );
      },
      error: (error) => {
        this.hideTypingIndicator();
        console.error('Error loading FAQs:', error);
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
      
      this.saveConversation(faq.question, faq.answer);
      
      // Update view count
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
        this.hideTypingIndicator();
        
        if (response.success && response.data.length > 0) {
          const results = response.data;
          const topResult = results[0];
          
          this.addBotMessage(topResult.answer);
          
          if (results.length > 1) {
            setTimeout(() => {
              this.addBotMessage(
                'Bạn có thể quan tâm đến các câu hỏi sau:',
                results.slice(1, 4)
              );
            }, 500);
          }
          
          this.saveConversation(query, topResult.answer);
        } else {
          const fallbackResponse = 
            'Xin lỗi, tôi không tìm thấy câu trả lời phù hợp. 🙏\n\n' +
            'Bạn có thể:\n' +
            '- Thử đặt câu hỏi theo cách khác\n' +
            '- Chọn một chủ đề cụ thể bên dưới\n' +
            '- Liên hệ trực tiếp với chúng tôi qua hotline: 1900 xxxx';
          
          this.addBotMessage(fallbackResponse);
          this.saveConversation(query, fallbackResponse);
        }
      },
      error: (error) => {
        this.hideTypingIndicator();
        console.error('Error searching FAQs:', error);
        this.addBotMessage('Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau!');
      }
    });
  }

  saveConversation(userMessage: string, botResponse: string): void {
    this.http.post<any>(`${this.apiUrl}/chat/conversations`, {
      session_id: this.sessionId,
      user_message: userMessage,
      bot_response: botResponse
    }).subscribe({
      next: () => {},
      error: (error) => console.error('Error saving conversation:', error)
    });
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}