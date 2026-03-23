import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Thay `alert()` trình duyệt (localhost says) bằng modal trong app admin. */
export interface AdminAlertModalPayload {
  title: string;
  message: string;
  /** true = nhấn mạnh lỗi (màu đỏ tiêu đề). */
  isError?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminAlertModalService {
  private readonly _open = new BehaviorSubject<AdminAlertModalPayload | null>(null);

  /** Component modal subscribe để hiển thị. */
  readonly open$ = this._open.asObservable();

  show(payload: AdminAlertModalPayload): void {
    this._open.next(payload);
  }

  close(): void {
    this._open.next(null);
  }
}
