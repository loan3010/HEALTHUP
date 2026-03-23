import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './header/header';
import { Footer } from './footer/footer';
import { RouterModule } from '@angular/router';
import { ChatbotComponent } from './chatbot/chatbot';
import { ToastComponent } from './toast/toast';
import { AccountDisabledOverlay } from './account-disabled/account-disabled-overlay';
import { UserAccountRealtimeService } from './account-disabled/user-account-realtime.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    Header,
    Footer,
    RouterModule,
    ChatbotComponent,
    ToastComponent,
    AccountDisabledOverlay,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  constructor() {
    // Khởi tạo socket/poll theo token (constructor service chạy tại đây).
    inject(UserAccountRealtimeService);
  }
}