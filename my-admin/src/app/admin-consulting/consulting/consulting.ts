import {
  Component,
  ViewEncapsulation,
  inject,
  DestroyRef,
  ChangeDetectorRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ConsultingList } from '../consulting-list/consulting-list';
import { ConsultingDetail } from '../consulting-detail/consulting-detail';
import { AdminNavBridgeService } from '../../admin-nav-bridge.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-consulting',
  standalone: true,
  imports: [CommonModule, ConsultingList, ConsultingDetail], // Phải có cả 2 ở đây
  templateUrl: './consulting.html',
  styleUrls: ['./consulting.css'],
  encapsulation: ViewEncapsulation.None
})
export class Consulting {
  private readonly navBridge = inject(AdminNavBridgeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  viewMode: 'list' | 'detail' = 'list';
  selectedProduct: any = null;

  constructor() {
    // Chuông thông báo: mở đúng sản phẩm có câu hỏi chờ trả lời.
    this.navBridge.openConsultingProduct$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((productId) => this.openConsultingForProductId(productId));
  }

  /**
   * Ưu tiên dòng từ summary (đủ pending/total); không có thì gọi API sản phẩm.
   */
  private openConsultingForProductId(productId: string): void {
    const pid = String(productId || '').trim();
    if (!pid) return;

    this.api.getConsultingSummary().subscribe({
      next: (rows: any[]) => {
        const row = (rows || []).find((r) => String(r._id) === pid);
        if (row) {
          this.applyConsultingDetail(row);
          return;
        }
        this.api.getProductById(pid).subscribe({
          next: (p: any) =>
            this.applyConsultingDetail({
              _id: pid,
              name: p?.name || 'Sản phẩm',
              sku: p?.sku || '',
              total: 0,
              pending: 0,
              answered: 0,
            }),
          error: () =>
            this.applyConsultingDetail({
              _id: pid,
              name: 'Sản phẩm',
              sku: '',
              total: 0,
              pending: 0,
              answered: 0,
            }),
        });
      },
      error: () =>
        this.applyConsultingDetail({
          _id: pid,
          name: 'Sản phẩm',
          sku: '',
          total: 0,
          pending: 0,
          answered: 0,
        }),
    });
  }

  private applyConsultingDetail(row: any): void {
    this.selectedProduct = row;
    this.viewMode = 'detail';
    this.cdr.detectChanges();
  }

  handleSelectProduct(product: any) {
    this.selectedProduct = product;
    this.viewMode = 'detail'; // Bay vào trang chi tiết câu hỏi
  }

  handleBack() {
    this.viewMode = 'list';
  }
}