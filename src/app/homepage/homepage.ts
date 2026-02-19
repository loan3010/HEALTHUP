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
  emoji: string;
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
    { icon: 'bi bi-patch-check',  title: 'Nguon goc ro rang',    sub: 'Truy xuat tan noi san xuat' },
    { icon: 'bi bi-star-fill',    title: '4.9/5 danh gia',       sub: 'Tu 10.000+ khach hang'      },
    { icon: 'bi bi-arrow-repeat', title: 'Doi tra 7 ngay',       sub: 'Khong can ly do'             },
    { icon: 'bi bi-shield-check', title: 'Thanh toan bao mat',   sub: 'VNPay · Momo · COD'         },
  ];

  categories: Category[] = [
    { icon: 'bi bi-circle', name: 'Hat dinh duong', count: '24 sp', color: '#EAF2E3' },
    { icon: 'bi bi-circle', name: 'Granola',        count: '18 sp', color: '#FFF8EE' },
    { icon: 'bi bi-circle', name: 'Trai cay say',   count: '32 sp', color: '#F5EEFF' },
    { icon: 'bi bi-circle', name: 'Do an vat',      count: '15 sp', color: '#FFF0E8' },
    { icon: 'bi bi-circle', name: 'Tra thao moc',   count: '20 sp', color: '#E8F5FF' },
    { icon: 'bi bi-circle', name: 'Combo',          count: '10 sp', color: '#FFF5E8' },
  ];

  featuredProducts: Product[] = [
    { id: 1, image: 'assets/images/products/macadamia.png', name: 'Hat Macadamia Rang Muoi Uc',   cat: 'Hat dinh duong', weight: '250g / Hu thuy tinh', price: 185000, oldPrice: 220000, stars: '★★★★★', reviews: 128, badge: 'hot', sale: '-16%' },
    { id: 2, image: 'assets/images/products/granola.png',   name: 'Granola Hanh Nhan Mat Ong',    cat: 'Granola',        weight: '400g / Tui zip',      price: 145000,                  stars: '★★★★☆', reviews: 89,  badge: 'new'              },
    { id: 3, image: 'assets/images/products/nho-kho.png',  name: 'Nho Kho Khong Hat Nhap Khau',  cat: 'Trai cay say',   weight: '300g / Hop giay',     price: 98000,  oldPrice: 120000, stars: '★★★★★', reviews: 204, sale: '-18%'              },
    { id: 4, image: 'assets/images/products/tra.png',      name: 'Tra Hoa Cuc Tam Sen',           cat: 'Tra thao moc',   weight: '100g / Hop thiec',    price: 125000,                  stars: '★★★★☆', reviews: 56                               },
  ];

  blogPosts: BlogPost[] = [
    { emoji: '🥗', tag: 'Eat Clean',  title: 'Top 5 loai hat nen an hang ngay de tang cuong suc khoe', excerpt: 'Hat dinh duong la nguon cung cap chat beo tot, protein va vi chat khoang thiet yeu cho co the...', date: '15/01/2025' },
    { emoji: '🌾', tag: 'Cong thuc', title: 'Cach lam Granola thom ngon tai nha chi trong 30 phut',   excerpt: 'Granola tu lam vua dam bao chat luong, vua tiet kiem va co the tuy chinh khau vi theo so thich...', date: '10/01/2025' },
    { emoji: '🍵', tag: 'Suc khoe',  title: 'Loi ich cua tra thao moc doi voi he mien dich mua lanh', excerpt: 'Cac loai tra thao moc tu nhien co tac dung tang cuong mien dich, giam stress va cai thien giac ngu...', date: '05/01/2025' },
  ];

  footerColumns: FooterColumn[] = [
    { title: 'San pham',     links: ['Hat dinh duong', 'Granola', 'Trai cay say', 'Tra thao moc', 'Combo']                  },
    { title: 'Ho tro',       links: ['Chinh sach doi tra', 'Huong dan mua hang', 'Tra cuu don hang', 'Lien he']             },
    { title: 'Ve chung toi', links: ['Cau chuyen thuong hieu', 'Blog suc khoe', 'Dai ly phan phoi', 'Tuyen dung']          },
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