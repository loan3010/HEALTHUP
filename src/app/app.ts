import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './header/header';
import { Footer } from './footer/footer';
import { UserProfile } from './user-profile/user-profile';
import { Wishlist } from './wishlist/wishlist';
import { HomepageComponent } from './homepage/homepage';
import { ProductListingPageComponent } from './product-listing-page/product-listing-page';
import { SidebarComponent } from './sidebar/sidebar';
import { ProductDetailPageComponent } from './product-detail-page/product-detail-page';
import { OrderReviewComponent } from './order-review/order-review';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    Header,
    Footer,
    UserProfile,
    Wishlist,
    HomepageComponent,
    ProductListingPageComponent,
    SidebarComponent,
    ProductDetailPageComponent,
    OrderReviewComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}