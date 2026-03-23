import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router'; 
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { accountDisabledInterceptor } from './account-disabled/account-disabled.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // ── TỰ ĐỘNG CUỘN LÊN ĐẦU TRANG ──
      withInMemoryScrolling({ 
        scrollPositionRestoration: 'top' 
      }),
      // ── HIỆU ỨNG CHUYỂN TRANG MƯỢT MÀ (VIEW TRANSITIONS) ──
      withViewTransitions()
    ),
    provideHttpClient(withInterceptors([accountDisabledInterceptor])),
  ],
};