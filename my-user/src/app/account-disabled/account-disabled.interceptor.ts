import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AccountDisabledService } from './account-disabled.service';

/**
 * Mọi API user: nếu JWT còn hợp lệ nhưng tài khoản đã bị khóa → middleware trả 403 + accountDisabled.
 * Bật overlay ngay (dự phòng khi socket mất kết nối).
 */
export const accountDisabledInterceptor: HttpInterceptorFn = (req, next) => {
  const accountDisabled = inject(AccountDisabledService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 403 && err.error && err.error.accountDisabled === true) {
        accountDisabled.blockSessionAndShow(String(err.error.deactivationReason || ''));
      }
      return throwError(() => err);
    })
  );
};
