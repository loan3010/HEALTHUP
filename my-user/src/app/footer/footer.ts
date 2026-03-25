import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { buildZaloMeUrl, STORE_ZALO_PHONE } from '../constants/store-contact.constants';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  /** Zalo cửa hàng — cùng số với nút nổi / chatbot */
  readonly zaloHref = buildZaloMeUrl(STORE_ZALO_PHONE);

  /** Thay bằng URL fanpage chính thức khi có */
  readonly facebookHref = 'https://www.facebook.com/';
  readonly instagramHref = 'https://www.instagram.com/';
  readonly tiktokHref = 'https://www.tiktok.com/';
}