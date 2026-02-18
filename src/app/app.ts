import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './header/header';
import { Footer } from './footer/footer';
import { UserProfile } from './user-profile/user-profile';
import { Wishlist } from './wishlist/wishlist';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    Header,
    Footer,
    UserProfile, 
    Wishlist   
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
