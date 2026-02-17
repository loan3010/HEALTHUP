import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './header/header';
import { Footer } from './footer/footer';
import { User } from './user/user';
import { Favorite } from './favorite/favorite';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    Header,
    Footer,
    User, 
    Favorite   
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
