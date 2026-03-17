import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface WishlistItem {
  id: string;
  name: string;
  price: number;
  unit: string;
  image?: string;
}

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css',
})
export class Wishlist implements OnInit {

  wishlistItems: WishlistItem[] = [];
  sortBy: 'newest' | 'price-asc' | 'price-desc' = 'newest';
  
  private API = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadWishlist();
  }

  loadWishlist(): void {
    // TODO: Load from API
    // Tạm thời dùng data mẫu
    this.wishlistItems = [
      {
        id: '1',
        name: 'Cà phê uống liền My Cafe Latte vị Mild 220ml - CX - F',
        price: 5000,
        unit: 'Hộp / 220ml',
        image: ''
      },
      {
        id: '2',
        name: 'Bột Cơ Cao Ceraveille gói 300g',
        price: 102500,
        unit: '300g / gói',
        image: ''
      },
      {
        id: '3',
        name: 'Cà phê sữa 3in1 Chinh Vina hộp 240g',
        price: 43500,
        unit: '240g / hộp',
        image: ''
      }
    ];
  }

  removeFromWishlist(productId: string): void {
    if (confirm('Bạn có muốn xóa sản phẩm này khỏi danh sách yêu thích?')) {
      this.wishlistItems = this.wishlistItems.filter(item => item.id !== productId);
      // TODO: Call API to remove from wishlist
    }
  }

  addToCart(product: WishlistItem): void {
    // TODO: Add to cart logic
    alert(`Đã thêm "${product.name}" vào giỏ hàng!`);
    // Call API to add to cart
  }

}