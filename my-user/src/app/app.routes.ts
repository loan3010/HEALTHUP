import { Routes } from '@angular/router';
import { HomepageComponent }           from './homepage/homepage';
import { ProductListingPageComponent } from './product-listing-page/product-listing-page';
import { ProductDetailPageComponent }  from './product-detail-page/product-detail-page';
import { OrderReviewComponent }        from './order-review/order-review';
import { AboutTheBrand } from './about-the-brand/about-the-brand';
import { UserProfile } from './user-profile/user-profile';
import { AddressBook } from './address-book/address-book';
import { ProfileOverview } from './profile-overview/profile-overview';

export const routes: Routes = [
  { path: '',                        component: HomepageComponent },
  { path: 'product-listing-page',    component: ProductListingPageComponent },
  { path: 'product-detail-page/:id', component: ProductDetailPageComponent },
  { path: 'order-review',            component: OrderReviewComponent },

  // ✅ THÊM ROUTE MỚI
  { path: 'about-the-brand',         component: AboutTheBrand },

  {
  path: 'user-profile',
  component: UserProfile,
  children: [
    { path: '', redirectTo: 'profile', pathMatch: 'full' },
    { path: 'profile', component: ProfileOverview },
    { path: 'address', component: AddressBook }
  ]
  },
  // { path: 'user-profile',         component: UserProfile },
  // { path: 'address-book',  component: AddressBook},


  { path: '**', redirectTo: '' }
];