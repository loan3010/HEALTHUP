import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './header/header';
import { Footer } from './footer/footer';
import { ChatbotComponent } from './chatbot/chatbot';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Header, Footer, ChatbotComponent,],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}