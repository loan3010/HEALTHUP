import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const AdminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('admin_token');

  if (token) {
    return true; // Đã đăng nhập, cho vào
  } else {
    router.navigate(['/login']); // Chưa có token, đá về login
    return false;
  }
};