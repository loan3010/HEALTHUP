import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './header/header';
import { Footer } from './footer/footer';
import { RouterModule } from '@angular/router';
import { ChatbotComponent } from './chatbot/chatbot';
import { ToastComponent } from './toast/toast';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Header, Footer, RouterModule, ChatbotComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}