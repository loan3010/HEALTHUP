import { Component, ViewEncapsulation } from '@angular/core'; // Thêm ViewEncapsulation vào đây
import { CommonModule } from '@angular/common';
import { PromotionList } from '../promotion-list/promotion-list';
import { PromotionForm } from '../promotion-form/promotion-form';

@Component({
  selector: 'app-promotion',
  standalone: true,
  imports: [CommonModule, PromotionList, PromotionForm],
  templateUrl: './promotion.html',
  styleUrls: ['./promotion.css'],
  encapsulation: ViewEncapsulation.None // THÊM DÒNG NÀY ĐỂ ÉP CSS CHẠY
})
export class Promotion {
  isModalOpen: boolean = false;
  formMode: 'add' | 'edit' = 'add';
  selectedPromotion: any = null;

  get breadcrumbActiveText(): string {
    if (!this.isModalOpen) return 'Danh sách khuyến mãi';
    return this.formMode === 'add' ? 'Thêm khuyến mãi' : 'Chi tiết khuyến mãi';
  }

  handleGoEdit(promo: any) {
    this.selectedPromotion = promo;
    this.formMode = 'edit';
    this.isModalOpen = true;
  }

  handleGoAdd() {
    this.selectedPromotion = null;
    this.formMode = 'add';
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }
}