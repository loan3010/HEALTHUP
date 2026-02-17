import { Routes } from '@angular/router';
import { User } from './user/user';
import { Favorite } from './favorite/favorite';

export const routes: Routes = [
  { path: 'user', component: User },
  { path: 'favorite', component: Favorite }
];
