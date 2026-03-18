import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';

export interface PolicyItem {
  icon: string;
  title: string;
  desc: string;
}

@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CurrencyPipe],
  templateUrl: './product-detail-page.html',
  styleUrls: ['./product-detail-page.css']
})
export class ProductDetailPageComponent implements OnInit {

  product: any = null;
  relatedProducts: any[] = [];

  activeImage = '';
  selectedWeight = '';
  selectedType = '';

  activeTab: 'desc' | 'nutrition' | 'policy' = 'desc';

  qty = 1;

  addedToCart = false;
  isWishlisted = false;
  isLoading = true;

  policyItems: PolicyItem[] = [
    {
      icon: 'bi-arrow-repeat',
      title: 'Đổi trả trong 7 ngày',
      desc: 'Áp dụng khi sản phẩm lỗi hoặc không đúng đơn hàng.'
    },
    {
      icon: 'bi-truck',
      title: 'Giao hàng toàn quốc',
      desc: 'Từ 2-5 ngày làm việc.'
    },
    {
      icon: 'bi-credit-card',
      title: 'Thanh toán an toàn',
      desc: 'Hỗ trợ COD, VNPay, Momo.'
    },
    {
      icon: 'bi-patch-check',
      title: 'Chất lượng kiểm định',
      desc: 'Sản phẩm đạt chứng nhận VSATTP.'
    }
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {

    this.route.paramMap.subscribe(params => {

      const id = params.get('id');

      if (id) {
        this.product = null;
        this.relatedProducts = [];
        this.isLoading = true;

        this.loadProduct(id);
        this.loadRelated(id);
      }

    });

  }

  loadProduct(id: string): void {

    this.api.getProductById(id).subscribe({

      next: (data: any) => {

        this.product = data;

        this.activeImage = data.images?.[0] || '';
        this.selectedWeight = data.weights?.[0]?.label || '';
        this.selectedType = data.packagingTypes?.[0] || '';

        this.isLoading = false;
        this.cdr.detectChanges();
      },

      error: (err: any) => {

        console.error('Lỗi tải sản phẩm:', err);
        this.isLoading = false;
      }

    });

  }

  loadRelated(id: string): void {

    this.api.getRelatedProducts(id).subscribe({

      next: (data: any[]) => {

        this.relatedProducts = data;
        this.cdr.detectChanges();
      },

      error: (err: any) => {
        console.error('Lỗi tải SP liên quan:', err);
      }

    });

  }

  getStars(rating: number): string {

    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);

  }

  selectWeight(label: string): void {
    this.selectedWeight = label;
  }

  decreaseQty(): void {

    if (this.qty > 1) {
      this.qty--;
    }

  }

  increaseQty(): void {

    if (this.product && this.qty < this.product.stock) {
      this.qty++;
    }

  }

  addToCart(): void {

    if (!this.product) return;

    const cartItem = {

      userId: 'guest',

      productId: this.product._id,

      name: this.product.name,

      price: this.product.price,

      image: this.product.images?.[0],

      weight: this.selectedWeight,

      type: this.selectedType,

      quantity: this.qty

    };

    this.api.addToCart(cartItem).subscribe({

      next: () => {

        this.addedToCart = true;

        setTimeout(() => {
          this.addedToCart = false;
        }, 2000);

      },

      error: (err: any) => {
        console.error('Lỗi thêm vào giỏ hàng:', err);
      }

    });

  }

  buyNow(): void {

    if (!this.product) return;

    const checkoutItem = {

      productId: this.product._id,

      name: this.product.name,

      price: this.product.price,

      quantity: this.qty,

      imageUrl: this.product.images?.[0] || null,

      weight: this.selectedWeight,

      type: this.selectedType

    };

    try {

      localStorage.setItem(
        'checkout_v1',
        JSON.stringify([checkoutItem])
      );

    } catch (e) {

      console.error('Lỗi lưu checkout:', e);
      return;

    }

    this.router.navigate(['/checkout']);

  }

  toggleWishlist(): void {

    this.isWishlisted = !this.isWishlisted;

  }

  share(): void {

    if (navigator.share) {

      navigator.share({
        title: this.product?.name,
        url: window.location.href
      });

    } else {

      navigator.clipboard.writeText(window.location.href);

    }

  }

  addRelated(event: Event, id: string): void {

    event.stopPropagation();

    console.log('Add related to cart:', id);

  }

  goToProduct(id: string): void {

    if (!id) return;

    this.router.navigate(['/product-detail-page', id]);

  }

}