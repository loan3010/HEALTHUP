// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { HomepageComponent }           from './homepage/homepage';
import { ProductListingPageComponent } from './product-listing-page/product-listing-page';
import { ProductDetailPageComponent }  from './product-detail-page/product-detail-page';
import { OrderReviewComponent }        from './order-review/order-review';

export const routes: Routes = [
  { path: '',                        component: HomepageComponent },
  { path: 'product-listing-page',    component: ProductListingPageComponent },
  { path: 'product-detail-page', component: ProductDetailPageComponent },
  { path: 'order-review',            component: OrderReviewComponent },
  { path: '**',                      redirectTo: '' }
  // ⚠️ KHÔNG có route 'sidebar' — sidebar là component con dùng bên trong product-listing-page
];