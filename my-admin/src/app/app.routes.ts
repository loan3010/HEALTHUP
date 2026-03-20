import { Routes } from '@angular/router';
import { AdminLogin } from './admin-login/admin-login';
import { AdminLayout } from './admin-layout/admin-layout';
import { AdminGuard } from './admin.guard';
import { AdminForgotPassword } from './admin-forgot-password/admin-forgot-password';

export const routes: Routes = [
  // 1. Mặc định vào là Login
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  
  // 2. Trang Login
  { path: 'login', component: AdminLogin },

  // 3. Trang Quên mật khẩu (Phải nằm TRÊN dấu ** thì link mới chạy bà nhé)
  { path: 'forgot-password', component: AdminForgotPassword },

  // 4. Khu vực Quản trị - Có bảo vệ
  { 
    path: 'admin', 
    component: AdminLayout, 
    canActivate: [AdminGuard] 
  },

  // 5. CÁI NÀY PHẢI LUÔN NẰM CUỐI CÙNG: Nếu gõ bậy bạ thì về Login
  { path: '**', redirectTo: 'login' }
];