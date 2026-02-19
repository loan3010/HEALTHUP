import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

export interface WeightOption  { label: string; outOfStock?: boolean; }
export interface NutritionRow  { name: string; value: string; percent: number; }
export interface PolicyItem    { icon: string; title: string; desc: string; }
export interface ProductDetail {
  id: number;
  images: string[];
  name: string;
  cat: string;
  rating: number;
  starsDisplay: string;
  reviewCount: number;
  sold: number;
  price: number;
  oldPrice?: number;
  saving?: string;
  shortDesc: string;
  description: string;
  stock: number;
  weights: WeightOption[];
  packagingTypes: string[];
  nutrition: NutritionRow[];
}

export interface RelatedProduct {
  id: number;
  image: string;
  name: string;
  cat: string;
  price: number;
}

@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CurrencyPipe],
  templateUrl: './product-detail-page.html',
  styleUrls: ['./product-detail-page.css']
})
export class ProductDetailPageComponent implements OnInit {

  product: ProductDetail | null = null;
  activeImage = '';
  selectedWeight  = '250g';
  selectedType    = 'Hu thuy tinh';
  activeTab: 'desc' | 'nutrition' | 'policy' = 'desc';
  qty = 1;
  addedToCart = false;
  isWishlisted = false;

  policyItems: PolicyItem[] = [
    { icon: 'bi-arrow-repeat', title: 'Doi tra trong 7 ngay', desc: 'Ap dung khi san pham loi, hu hong do van chuyen hoac khong dung don hang.' },
    { icon: 'bi-truck',        title: 'Giao hang toan quoc',  desc: 'Tu 2-5 ngay lam viec. Noi thanh TP.HCM & Ha Noi giao trong ngay hoac hom sau.' },
    { icon: 'bi-credit-card',  title: 'Thanh toan an toan',   desc: 'Ho tro COD, VNPay, Momo. Khong thu phi giao dich.' },
    { icon: 'bi-patch-check',  title: 'Chat luong kiem dinh', desc: 'San pham dat chung nhan VSATTP, nguon goc ro rang, truy xuat duoc.' },
  ];

  relatedProducts: RelatedProduct[] = [
    { id: 2, image: 'assets/images/products/granola.png',   name: 'Granola Hanh Nhan Mat Ong', cat: 'Granola',        price: 145000 },
    { id: 3, image: 'assets/images/products/nho-kho.png',  name: 'Nho Kho Khong Hat',          cat: 'Trai cay say',   price: 98000  },
    { id: 4, image: 'assets/images/products/tra.png',      name: 'Tra Hoa Cuc Tam Sen',         cat: 'Tra thao moc',   price: 125000 },
    { id: 5, image: 'assets/images/products/hat-dieu.png', name: 'Hat Dieu Rang Muoi',          cat: 'Hat dinh duong', price: 155000 },
  ];

  private mockProduct: ProductDetail = {
    id: 1,
    images: [
      'assets/images/products/macadamia.png',
      'assets/images/products/macadamia-2.png',
      'assets/images/products/macadamia-3.png',
      'assets/images/products/macadamia-4.png',
    ],
    name: 'Hat Macadamia Rang Muoi Uc',
    cat: 'Hat dinh duong',
    rating: 4.9,
    starsDisplay: '★★★★★',
    reviewCount: 128,
    sold: 342,
    price: 185000,
    oldPrice: 220000,
    saving: '35.000d',
    shortDesc: 'Hat Macadamia nguyen hat nhap khau tu Uc, rang muoi vua phai bang cong nghe rang nhiet do thap giu nguyen duong chat. Giau axit beo khong bao hoa, tot cho tim mach va nao bo.',
    description: `<p>Hat Macadamia <strong>Rang Muoi Bien</strong> duoc chon loc tu nhung hat Macadamia tuoi nhap tu bang Queensland, Uc.</p>
      <br><p>Quy trinh che bien: <strong>Rang nhiet do thap 120°C</strong> trong vong 25 phut, giu nguyen mau vang nhat tu nhien va mui thom dac trung.</p>
      <br><p>Bao quan: Noi kho rao, thoang mat. Sau khi mo nap, bao quan trong ngan mat tu lanh, dung trong vong 30 ngay.</p>`,
    stock: 48,
    weights: [{ label: '250g' }, { label: '500g' }, { label: '1kg', outOfStock: true }],
    packagingTypes: ['Hu thuy tinh', 'Hu nhua', 'Tui zip'],
    nutrition: [
      { name: 'Nang luong',             value: '718 kcal', percent: 36  },
      { name: 'Chat beo tong',          value: '75.8g',    percent: 108 },
      { name: 'Axit beo bao hoa',       value: '12.1g',    percent: 61  },
      { name: 'Axit beo khong bao hoa', value: '58.8g',    percent: 0   },
      { name: 'Protein',                value: '7.9g',     percent: 16  },
      { name: 'Carbohydrate',           value: '13.8g',    percent: 5   },
      { name: 'Chat xo',                value: '8.6g',     percent: 34  },
      { name: 'Natri',                  value: '120mg',    percent: 5   },
    ],
  };

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.product     = this.mockProduct;
    this.activeImage = this.mockProduct.images[0];
    this.selectedWeight = this.mockProduct.weights[0].label;
    this.selectedType   = this.mockProduct.packagingTypes[0];
  }

  selectWeight(label: string): void { this.selectedWeight = label; }

  decreaseQty(): void {
    if (this.qty > 1) this.qty--;
  }

  increaseQty(): void {
    if (this.product && this.qty < this.product.stock) this.qty++;
  }

  addToCart(): void {
    if (this.addedToCart) return;
    this.addedToCart = true;
    console.log('Added to cart', { qty: this.qty, weight: this.selectedWeight, type: this.selectedType });
    setTimeout(() => (this.addedToCart = false), 2500);
  }

  buyNow(): void { this.addToCart(); this.router.navigate(['/checkout']); }

  toggleWishlist(): void { this.isWishlisted = !this.isWishlisted; }

  share(): void {
    if (navigator.share) {
      navigator.share({ title: this.product?.name, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  }

  addRelated(event: Event, id: number): void {
    event.stopPropagation();
    console.log('Add related to cart:', id);
  }

  goToProduct(id: number): void { this.router.navigate(['/product-detail-page', id]); }
}