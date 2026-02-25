import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConsultingList } from '../consulting-list/consulting-list';
import { ConsultingDetail } from '../consulting-detail/consulting-detail';

@Component({
  selector: 'app-consulting',
  standalone: true,
  imports: [CommonModule, ConsultingList, ConsultingDetail], // Phải có cả 2 ở đây
  templateUrl: './consulting.html',
  styleUrls: ['./consulting.css'],
  encapsulation: ViewEncapsulation.None
})
export class Consulting {
  viewMode: 'list' | 'detail' = 'list';
  selectedProduct: any = null;

  handleSelectProduct(product: any) {
    this.selectedProduct = product;
    this.viewMode = 'detail'; // Bay vào trang chi tiết câu hỏi
  }

  handleBack() {
    this.viewMode = 'list';
  }
}