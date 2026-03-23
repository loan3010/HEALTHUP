import {
  Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, filter } from 'rxjs/operators';
import { TrackOrderModal } from '../track-order-modal/track-order-modal';
import { SearchService, SearchProduct } from '../services/search.service';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TrackOrderModal],
  templateUrl: './header.html',
  styleUrls: ['./header.css']
})
export class Header implements OnInit, OnDestroy {

  isLoggedIn = false;
  userName = '';
  showDropdown = false;
  menuOpen = false;
  showTrackOrderModal = false;
  showLogoutConfirm = false;

  cartCount = 0;
  private cartCountSub!: Subscription;

  // ✅ UNREAD NOTIFICATION COUNT (từ THnew)
  unreadCount = 0;
  private unreadCountSub!: Subscription;
  private navSub!: Subscription;

  // ── SEARCH STATE ──
  searchQuery = '';
  searchResults: SearchProduct[] = [];
  isSearching = false;
  showSearchDropdown = false;
  activeIndex = -1;

  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;

  @ViewChild('searchInput') searchInputRef!: ElementRef;

  constructor(
    private router: Router,
    private searchService: SearchService,
    private cdr: ChangeDetectorRef,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.checkLoginStatus();
    this.initSearch();

    // ✅ Subscribe cart count
    this.cartCountSub = this.api.cartCount$.subscribe(count => {
      this.cartCount = count;
      this.cdr.detectChanges();
    });

    // ✅ Subscribe unread notification count — badge chuông tự cập nhật
    this.unreadCountSub = this.api.unreadCount$.subscribe(count => {
      this.unreadCount = count;
      this.cdr.detectChanges();
    });

    // Sau mỗi lần chuyển trang: đồng bộ lại số chuông (ví dụ vừa đọc thông báo / có phản hồi tư vấn mới).
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => {
        this.checkLoginStatus();
        if (this.isLoggedIn) {
          this.api.refreshUnreadCount();
        }
      });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.cartCountSub?.unsubscribe();
    this.unreadCountSub?.unsubscribe(); // ✅ Unsubscribe tránh memory leak
    this.navSub?.unsubscribe();
  }

  initSearch(): void {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(250), // giữ 250ms từ THnew (phản hồi người dùng tốt hơn 150ms)
      distinctUntilChanged(),
      switchMap(keyword => {
        if (!keyword.trim()) {
          this.isSearching = false;
          this.searchResults = [];
          this.showSearchDropdown = false;
          this.cdr.detectChanges();
          return of([] as SearchProduct[]);
        }
        this.isSearching = true;
        this.showSearchDropdown = true;
        this.cdr.detectChanges();
        return this.searchService.search(keyword);
      })
    ).subscribe({
      next: (results: SearchProduct[]) => {
        this.searchResults = results;
        this.isSearching = false;
        if (this.searchQuery.trim()) this.showSearchDropdown = true;
        this.activeIndex = -1;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isSearching = false;
        this.searchResults = [];
        if (this.searchQuery.trim()) this.showSearchDropdown = true;
        this.cdr.detectChanges();
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    if (!value.trim()) {
      this.searchResults = [];
      this.showSearchDropdown = false;
      this.isSearching = false;
      this.cdr.detectChanges();
      return;
    }
    this.showSearchDropdown = true;
    this.isSearching = true;
    this.cdr.detectChanges();
    this.searchSubject.next(value.trim());
  }

  onSearchFocus(): void {
    if (this.searchQuery.trim()) {
      this.showSearchDropdown = true;
      if (this.searchResults.length === 0 && !this.isSearching) {
        this.isSearching = true;
        this.cdr.detectChanges();
        this.searchSubject.next(this.searchQuery.trim());
      }
    }
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.closeSearchDropdown();
      this.cdr.detectChanges();
    }, 200);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex = Math.min(this.activeIndex + 1, this.searchResults.length - 1);
        this.cdr.detectChanges();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex = Math.max(this.activeIndex - 1, -1);
        this.cdr.detectChanges();
        break;
      case 'Enter':
        event.preventDefault();
        if (this.activeIndex >= 0 && this.searchResults[this.activeIndex]) {
          this.selectProduct(this.searchResults[this.activeIndex]);
        } else {
          this.submitSearch();
        }
        break;
      case 'Escape':
        this.closeSearchDropdown();
        this.cdr.detectChanges();
        this.searchInputRef?.nativeElement?.blur();
        break;
    }
  }

  selectProduct(product: SearchProduct): void {
    this.closeSearchDropdown();
    this.router.navigate(['/product-detail-page', product._id]).then(() => {
      this.searchQuery = '';
      this.searchResults = [];
      this.cdr.detectChanges();
    });
  }

  submitSearch(): void {
    const keyword = this.searchQuery.trim();
    if (!keyword) return;

    this.closeSearchDropdown();
    this.searchInputRef?.nativeElement?.blur();

    // ✅ Nếu đang ở /products rồi: chỉ update queryParams, không recreate component
    const isOnProductPage = this.router.url.split('?')[0] === '/products';

    this.router.navigate(['/products'], {
      queryParams: { search: keyword },
      replaceUrl: isOnProductPage,
    }).then(() => {
      this.searchQuery = '';
      this.searchResults = [];
      this.cdr.detectChanges();
    });
  }

  closeSearchDropdown(): void {
    this.showSearchDropdown = false;
    this.activeIndex = -1;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency: 'VND', maximumFractionDigits: 0
    }).format(price);
  }

  checkLoginStatus(): void {
    const token   = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user      = JSON.parse(userStr);
        this.isLoggedIn = true;
        this.userName   = user.username || user.email || user.phone || 'Người dùng';
      } catch {
        this.isLoggedIn = false;
        this.userName   = '';
      }
    } else {
      this.isLoggedIn = false;
      this.userName   = '';
    }
    this.cdr.detectChanges();
  }

  getInitials(): string {
    if (!this.userName) return 'U';
    const words = this.userName.trim().split(' ');
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return this.userName.substring(0, 2).toUpperCase();
  }

  toggleMenu()     { this.menuOpen     = !this.menuOpen;     this.cdr.detectChanges(); }
  closeMenu()      { this.menuOpen     = false;               this.cdr.detectChanges(); }
  toggleDropdown() { this.showDropdown = !this.showDropdown; this.cdr.detectChanges(); }
  closeDropdown()  { this.showDropdown = false;               this.cdr.detectChanges(); }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu') && !target.closest('.logout-confirm-modal')) {
      this.showDropdown = false;
      this.cdr.detectChanges();
    }
  }

  openTrackOrder()       { this.showTrackOrderModal = true;  this.cdr.detectChanges(); }
  closeTrackOrderModal() { this.showTrackOrderModal = false; this.cdr.detectChanges(); }

  /** Tra cứu đơn trên menu = mở modal xanh (app-track-order-modal), không tách luồng mới. */
  openTrackOrderFromNav(event: Event, closeMobileMenu: boolean): void {
    event.preventDefault();
    if (closeMobileMenu) this.closeMenu();
    this.openTrackOrder();
  }

  /** Gạch chân menu khi đang xem trang chi tiết tra cứu (sau khi modal redirect). */
  get isTrackOrderPage(): boolean {
    return this.router.url.split('?')[0] === '/tra-cuu-don';
  }

  logout(): void {
    this.showDropdown = false;
    this.showLogoutConfirm = true;
    this.cdr.detectChanges();
  }

  confirmLogout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId'); // từ main
    this.isLoggedIn        = false;
    this.userName          = '';
    this.showDropdown      = false;
    this.showLogoutConfirm = false; // từ main
    this.unreadCount       = 0; //
    this.cdr.detectChanges();
    this.router.navigate(['/']);
  }

  cancelLogout(): void {
    this.showLogoutConfirm = false;
    this.cdr.detectChanges();
  }
}