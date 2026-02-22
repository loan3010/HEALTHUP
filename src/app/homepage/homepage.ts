import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterModule } from '@angular/router';

export interface Category {
  icon: string;
  name: string;
  count: string;
  color: string;
}

export interface Product {
  id: number;
  image: string;
  name: string;
  cat: string;
  weight: string;
  price: number;
  oldPrice?: number;
  stars: string;
  reviews: number;
  sold?: number;
  badge?: 'new' | 'hot';
  sale?: string;
}

export interface BlogPost {
  icon: string;
  tag: string;
  title: string;
  excerpt: string;
  date: string;
}

export interface TrustItem {
  icon: string;
  title: string;
  sub: string;
}

export interface FooterColumn {
  title: string;
  links: string[];
}

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyPipe],
  templateUrl: './homepage.html',
  styleUrls: ['./homepage.css']
})
export class HomepageComponent implements OnInit {

  activeCategory = 0;
  wishlist: number[] = [];

  trustItems: TrustItem[] = [
    { icon: 'bi-patch-check',  title: 'Nguồn gốc rõ ràng',   sub: 'Truy xuất tận nơi sản xuất' },
    { icon: 'bi-star-fill',    title: '4.9/5 đánh giá',       sub: 'Từ 10.000+ khách hàng'      },
    { icon: 'bi-arrow-repeat', title: 'Đổi trả 7 ngày',       sub: 'Không cần lý do'             },
    { icon: 'bi-shield-check', title: 'Thanh toán bảo mật',   sub: 'VNPay · Momo · COD'         },
  ];

  categories: Category[] = [
    { icon: 'bi-egg-fried',  name: 'Hạt dinh dưỡng', count: '24 sp', color: '#EAF2E3' },
    { icon: 'bi-cup-hot',    name: 'Granola',         count: '18 sp', color: '#FFF8EE' },
    { icon: 'bi-apple',      name: 'Trái cây sấy',    count: '32 sp', color: '#F5EEFF' },
    { icon: 'bi-basket2',    name: 'Đồ ăn vặt',       count: '15 sp', color: '#FFF0E8' },
    { icon: 'bi-droplet',    name: 'Trà thảo mộc',    count: '20 sp', color: '#E8F5FF' },
    { icon: 'bi-gift',       name: 'Combo',           count: '10 sp', color: '#FFF5E8' },
  ];

  featuredProducts: Product[] = [
    { id: 1, image: 'assets/images/products/macadamia.png', name: 'Hạt Macadamia Rang Muối Úc',   cat: 'Hạt dinh dưỡng', weight: '250g / Hũ thủy tinh', price: 185000, oldPrice: 220000, stars: '★★★★★', reviews: 128, badge: 'hot', sale: '-16%' },
    { id: 2, image: 'assets/images/products/granola.png',   name: 'Granola Hạnh Nhân Mật Ong',    cat: 'Granola',        weight: '400g / Túi zip',      price: 145000,                  stars: '★★★★☆', reviews: 89,  badge: 'new'              },
    { id: 3, image: 'assets/images/products/nho-kho.png',  name: 'Nho Khô Không Hạt Nhập Khẩu',  cat: 'Trái cây sấy',   weight: '300g / Hộp giấy',     price: 98000,  oldPrice: 120000, stars: '★★★★★', reviews: 204, sale: '-18%'              },
    { id: 4, image: 'assets/images/products/tra.png',      name: 'Trà Hoa Cúc Tâm Sen',           cat: 'Trà thảo mộc',   weight: '100g / Hộp thiếc',    price: 125000,                  stars: '★★★★☆', reviews: 56                               },
  ];

  blogPosts: BlogPost[] = [
    { icon: 'bi-journal-richtext', tag: 'Eat Clean',  title: 'Top 5 loại hạt nên ăn hàng ngày để tăng cường sức khỏe', excerpt: 'Hạt dinh dưỡng là nguồn cung cấp chất béo tốt, protein và vi chất khoáng thiết yếu cho cơ thể...', date: '15/01/2025' },
    { icon: 'bi-fire',             tag: 'Công thức', title: 'Cách làm Granola thơm ngon tại nhà chỉ trong 30 phút',    excerpt: 'Granola tự làm vừa đảm bảo chất lượng, vừa tiết kiệm và có thể tùy chỉnh khẩu vị theo sở thích...', date: '10/01/2025' },
    { icon: 'bi-heart-pulse',      tag: 'Sức khỏe',  title: 'Lợi ích của trà thảo mộc đối với hệ miễn dịch mùa lạnh', excerpt: 'Các loại trà thảo mộc tự nhiên có tác dụng tăng cường miễn dịch, giảm stress và cải thiện giấc ngủ...', date: '05/01/2025' },
  ];

  footerColumns: FooterColumn[] = [
    { title: 'Sản phẩm',    links: ['Hạt dinh dưỡng', 'Granola', 'Trái cây sấy', 'Trà thảo mộc', 'Combo']              },
    { title: 'Hỗ trợ',      links: ['Chính sách đổi trả', 'Hướng dẫn mua hàng', 'Tra cứu đơn hàng', 'Liên hệ']        },
    { title: 'Về chúng tôi', links: ['Câu chuyện thương hiệu', 'Blog sức khỏe', 'Đại lý phân phối', 'Tuyển dụng']     },
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {}

  onCategoryClick(index: number): void {
    this.activeCategory = index;
    this.router.navigate(['/product-listing-page']);
  }

  isWishlisted(id: number): boolean {
    return this.wishlist.includes(id);
  }

  toggleWishlist(event: Event, id: number): void {
    event.stopPropagation();
    this.wishlist = this.wishlist.includes(id)
      ? this.wishlist.filter(x => x !== id)
      : [...this.wishlist, id];
  }

  addToCart(event: Event, id: number): void {
    event.stopPropagation();
    console.log('Added to cart:', id);
  }

  goToDetail(id: number): void {
    this.router.navigate(['/product-detail-page', id]);
  }
}