import { Routes } from '@angular/router';

import { HomepageComponent } from './homepage/homepage';
import { ProductListingPageComponent } from './product-listing-page/product-listing-page';
import { ProductDetailPageComponent } from './product-detail-page/product-detail-page';
import { OrderReviewComponent } from './order-review/order-review';

import { AboutTheBrand } from './about-the-brand/about-the-brand';
import { BlogComponent } from './blog/blog';
import { PoliciesComponent } from './policies/policies';

import { Login } from './login/login';
import { Forgotpw } from './forgotpw/forgotpw';
import { Register } from './register/register';

import { Checkout } from './checkout/checkout';
import { Cart } from './cart/cart';
import { Wishlist } from './wishlist/wishlist';
import { ChatbotComponent } from './chatbot/chatbot';

import { UserProfile } from './user-profile/user-profile';
import { ProfileOverview } from './profile-overview/profile-overview';
import { AddressBook } from './address-book/address-book';

import { OrderManagement } from './order-management/order-management';

export const routes: Routes = [

  // ===== HOME =====
  { path: '', component: HomepageComponent },

  // ===== PRODUCT =====
  { path: 'product-listing-page', component: ProductListingPageComponent },
  { path: 'product-detail-page/:id', component: ProductDetailPageComponent },

  // ===== ORDER REVIEW =====
  { path: 'order-review', component: OrderReviewComponent },

  // ===== AUTH =====
  { path: 'login', component: Login },
  { path: 'forgotpw', component: Forgotpw },
  { path: 'register', component: Register },

  // ===== STATIC PAGES =====
  { path: 'about-the-brand', component: AboutTheBrand },
  { path: 'blog', component: BlogComponent },
  { path: 'policies', component: PoliciesComponent },

  // ===== SHOPPING =====
  { path: 'checkout', component: Checkout },
  { path: 'cart', component: Cart },

  // ===== CHATBOT =====
  { path: 'chatbot', component: ChatbotComponent },

  // ===== USER PROFILE =====
  {
    path: 'profile',
    component: UserProfile,
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', component: ProfileOverview },
      { path: 'address', component: AddressBook },
      { path: 'wishlist', component: Wishlist },
      { path: 'order-management', component: OrderManagement }
    ]
  },

  // ===== NOT FOUND =====
  { path: '**', redirectTo: '' }

];