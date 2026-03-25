import { Routes } from '@angular/router';
import { AdminLogin } from './admin-login/admin-login';
import { AdminLayout } from './admin-layout/admin-layout';
import { AdminGuard } from './admin.guard';
import { AdminForgotPassword } from './admin-forgot-password/admin-forgot-password';
import { NotFoundComponent } from './not-found/not-found';

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

  // 5. Luôn cuối: URL không tồn tại → trang 404 thân thiện (có nút về đăng nhập)
  { path: '**', component: NotFoundComponent },
];