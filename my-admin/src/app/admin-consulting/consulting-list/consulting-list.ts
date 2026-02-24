import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-consulting-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './consulting-list.html',
  styleUrls: ['./consulting-list.css']
})
export class ConsultingList {
  @Output() selectProduct = new EventEmitter<any>(); // Chốt chặn lỗi selectProduct

  // Dữ liệu mẫu để bà test giao diện
  products = [
    { name: 'Nấm hương khô Xuân Hồng gói 50g', sku: '3579025', total: 1, pending: 0, answered: 1 },
    { name: 'Sả cây 100g – Huy Vũ', sku: '3412005', total: 6, pending: 5, answered: 1 },
    { name: 'Cà phê Nescafe 3in1 nguyên bản 20 gói x 16g', sku: '3138561', total: 1, pending: 0, answered: 1 }
  ];
}