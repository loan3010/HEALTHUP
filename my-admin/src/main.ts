import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Bắt buộc để CurrencyPipe định dạng VND/đúng locale tiếng Việt (tránh ô tiền tệ trống hoặc sai).
registerLocaleData(localeVi);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
