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
  selectedType    = 'Hũ thủy tinh';
  activeTab: 'desc' | 'nutrition' | 'policy' = 'desc';
  qty = 1;
  addedToCart = false;
  isWishlisted = false;

  policyItems: PolicyItem[] = [
    { icon: 'bi-arrow-repeat', title: 'Đổi trả trong 7 ngày',  desc: 'Áp dụng khi sản phẩm lỗi, hư hỏng do vận chuyển hoặc không đúng đơn hàng.' },
    { icon: 'bi-truck',        title: 'Giao hàng toàn quốc',   desc: 'Từ 2-5 ngày làm việc. Nội thành TP.HCM & Hà Nội giao trong ngày hoặc hôm sau.' },
    { icon: 'bi-credit-card',  title: 'Thanh toán an toàn',    desc: 'Hỗ trợ COD, VNPay, Momo. Không thu phí giao dịch.' },
    { icon: 'bi-patch-check',  title: 'Chất lượng kiểm định',  desc: 'Sản phẩm đạt chứng nhận VSATTP, nguồn gốc rõ ràng, truy xuất được.' },
  ];

  relatedProducts: RelatedProduct[] = [
    { id: 2, image: 'assets/images/products/granola.png',   name: 'Granola Hạnh Nhân Mật Ong',  cat: 'Granola',        price: 145000 },
    { id: 3, image: 'assets/images/products/nho-kho.png',  name: 'Nho Khô Không Hạt',           cat: 'Trái cây sấy',   price: 98000  },
    { id: 4, image: 'assets/images/products/tra.png',      name: 'Trà Hoa Cúc Tâm Sen',          cat: 'Trà thảo mộc',   price: 125000 },
    { id: 5, image: 'assets/images/products/hat-dieu.png', name: 'Hạt Điều Rang Muối',           cat: 'Hạt dinh dưỡng', price: 155000 },
  ];

  private mockProduct: ProductDetail = {
    id: 1,
    images: [
      'assets/images/products/macadamia.png',
      'assets/images/products/macadamia-2.png',
      'assets/images/products/macadamia-3.png',
      'assets/images/products/macadamia-4.png',
    ],
    name: 'Hạt Macadamia Rang Muối Úc',
    cat: 'Hạt dinh dưỡng',
    rating: 4.9,
    starsDisplay: '★★★★★',
    reviewCount: 128,
    sold: 342,
    price: 185000,
    oldPrice: 220000,
    saving: '35.000đ',
    shortDesc: 'Hạt Macadamia nguyên hạt nhập khẩu từ Úc, rang muối vừa phải bằng công nghệ rang nhiệt độ thấp giữ nguyên dưỡng chất. Giàu axit béo không bão hòa, tốt cho tim mạch và não bộ.',
    description: `<p>Hạt Macadamia <strong>Rang Muối Biển</strong> được chọn lọc từ những hạt Macadamia tươi nhập từ bang Queensland, Úc.</p>
      <br><p>Quy trình chế biến: <strong>Rang nhiệt độ thấp 120°C</strong> trong vòng 25 phút, giữ nguyên màu vàng nhạt tự nhiên và mùi thơm đặc trưng.</p>
      <br><p>Bảo quản: Nơi khô ráo, thoáng mát. Sau khi mở nắp, bảo quản trong ngăn mát tủ lạnh, dùng trong vòng 30 ngày.</p>`,
    stock: 48,
    weights: [{ label: '250g' }, { label: '500g' }, { label: '1kg', outOfStock: true }],
    packagingTypes: ['Hũ thủy tinh', 'Hũ nhựa', 'Túi zip'],
    nutrition: [
      { name: 'Năng lượng',              value: '718 kcal', percent: 36  },
      { name: 'Chất béo tổng',           value: '75.8g',    percent: 108 },
      { name: 'Axit béo bão hòa',        value: '12.1g',    percent: 61  },
      { name: 'Axit béo không bão hòa',  value: '58.8g',    percent: 0   },
      { name: 'Protein',                 value: '7.9g',     percent: 16  },
      { name: 'Carbohydrate',            value: '13.8g',    percent: 5   },
      { name: 'Chất xơ',                 value: '8.6g',     percent: 34  },
      { name: 'Natri',                   value: '120mg',    percent: 5   },
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

  decreaseQty(): void { if (this.qty > 1) this.qty--; }

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