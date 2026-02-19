import { Routes } from '@angular/router';
import { HomepageComponent } from './homepage/homepage';
import { ProductListingPageComponent } from './product-listing-page/product-listing-page';
import { ProductDetailPageComponent } from './product-detail-page/product-detail-page';
import { SidebarComponent } from './sidebar/sidebar';
import { OrderReviewComponent } from './order-review/order-review';

export const routes: Routes = [
  { path: '',                     component: HomepageComponent },
  { path: 'product-listing-page', component: ProductListingPageComponent },
  { path: 'product-detail-page',  component: ProductDetailPageComponent },
  { path: 'product-detail-page/:id', component: ProductDetailPageComponent },
  { path: 'sidebar',              component: SidebarComponent },
  { path: 'order-review',         component: OrderReviewComponent },
  { path: '**',                   redirectTo: '' },
];