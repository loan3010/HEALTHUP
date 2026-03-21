import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { ApiService, API_BASE, STATIC_BASE } from '../services/api.service';

interface WishlistItem {
  _id: string;
  name: string;
  price: number;
  oldPrice?: number;
  cat: string;
  images: string[];
  badge?: string;
}

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css',
})
export class Wishlist implements OnInit {

  wishlistItems: WishlistItem[] = [];
  sortBy: 'newest' | 'price-asc' | 'price-desc' = 'newest';
  isLoading = false;

  private userId = '';
  private token  = '';

  constructor(
    private http:   HttpClient,
    private router: Router,
    private api:    ApiService,
    private cdr:    ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const userStr = localStorage.getItem('user');
    this.token    = localStorage.getItem('token') || '';

    if (!userStr || !this.token) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const user  = JSON.parse(userStr);
      this.userId = user._id || user.id || '';
      this.loadWishlist();
    } catch {
      this.router.navigate(['/login']);
    }
  }

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }

  loadWishlist(): void {
    this.isLoading = true;

    this.http.get<any>(`${API_BASE}/users/${this.userId}/wishlist`, {
      headers: this.headers
    }).subscribe({
      next: (res) => {
        this.wishlistItems = (res?.wishlist || []).map((p: any) => ({
          ...p,
          images: (p.images || []).map((img: string) =>
            img.startsWith('http') ? img : `${STATIC_BASE}${img}`
          )
        }));
        // Đồng bộ wishlist$ stream → icon tim trên product listing cũng đúng
        (this.api as any)['_wishlist'].next(this.wishlistItems.map(p => p._id));
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get sortedItems(): WishlistItem[] {
    const items = [...this.wishlistItems];
    switch (this.sortBy) {
      case 'price-asc':  return items.sort((a, b) => a.price - b.price);
      case 'price-desc': return items.sort((a, b) => b.price - a.price);
      default:           return items;
    }
  }

  removeFromWishlist(productId: string): void {
    // Optimistic: xóa UI ngay
    this.wishlistItems = this.wishlistItems.filter(i => i._id !== productId);
    this.cdr.detectChanges();
    // Gọi API qua service (tự show toast + cập nhật stream)
    this.api.toggleWishlist(productId);
  }

  addToCart(product: WishlistItem): void {
    this.api.addToCart(product._id, 1, product.name).subscribe({
      error: () => this.api.showToast('Thêm vào giỏ thất bại!', 'error')
    });
  }

  goToProduct(id: string): void {
    this.router.navigate(['/product-detail-page', id]);
  }

  getImage(item: WishlistItem): string {
    const img = item.images?.[0];
    if (!img) return '/assets/images/placeholder.png';
    return img.startsWith('http') ? img : `${STATIC_BASE}${img.startsWith('/') ? img : '/' + img}`;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency: 'VND', maximumFractionDigits: 0
    }).format(price);
  }
}