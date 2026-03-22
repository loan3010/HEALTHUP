import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

// --- PHẦN QUAN TRỌNG ĐỂ FIX LỖI NG0701 ---
import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';

// Đăng ký dữ liệu ngôn ngữ tiếng Việt với Angular
registerLocaleData(localeVi);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    
    // Thiết lập ID ngôn ngữ mặc định cho toàn bộ ứng dụng là tiếng Việt
    { provide: LOCALE_ID, useValue: 'vi' }
  ]
};