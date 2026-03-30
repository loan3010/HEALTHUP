import {
  Component,
  ViewChild,
  ViewContainerRef,
  ComponentRef,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AdminHeader } from '../admin-header/admin-header';
import { AdminSidebar } from '../admin-sidebar/admin-sidebar';
import { AdminNavBridgeService } from '../admin-nav-bridge.service';
import { AdminDashboard } from '../admin-dashboard/admin-dashboard';
import { ProductComponent } from '../admin-product/product/product';
import { Customer } from '../admin-customer/customer/customer';
// import { CustomerDetail } from '../admin-customer/customer-detail/customer-detail';
import { Order } from '../admin-order/order/order';
import { Promotion } from '../admin-promotion/promotion/promotion';
import { AdminBanner } from '../admin-banner/admin-banner';
import { AdminBlog } from '../adminblog/admin-blog/admin-blog';
import { Consulting } from '../admin-consulting/consulting/consulting';
import { AdminChatbot } from '../admin_chatbot/admin-chatbot/admin-chatbot';
import { AdminReviewComponent } from '../admin-review/admin-review';
import { AdminAlertModalComponent } from '../admin-alert-modal/admin-alert-modal.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, AdminHeader, AdminSidebar, AdminAlertModalComponent],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.css']
})
export class AdminLayout implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('contentContainer', { read: ViewContainerRef, static: true }) contentContainer!: ViewContainerRef;
  @ViewChild('sideNav') sideNav?: AdminSidebar;

  isSidebarOpen = true;
  currentTab = 'tong-quan';
  private routerSubscription!: Subscription;
  private currentComponentRef: ComponentRef<any> | null = null;

  private readonly navBridge = inject(AdminNavBridgeService);
  private readonly destroyRef = inject(DestroyRef);

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Lắng nghe sự kiện navigation để đồng bộ activeTab từ URL nếu cần
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      // Có thể parse URL để set activeTab nếu muốn
    });
    
    // Mặc định load dashboard
    this.loadComponent('tong-quan');
  }

  ngAfterViewInit(): void {
    /** Chuông thông báo / dashboard gọi goToOrder, goToProduct — chỉ emit switchTab$; cần đổi tab thật. */
    this.navBridge.switchTab$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((tabName) => {
        const t = String(tabName || '').trim();
        if (!t) return;
        this.currentTab = t;
        this.sideNav?.setActiveTabSilent(t);
        this.loadComponent(t);
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  onTabChange(tabName: string): void {
    this.currentTab = tabName;
    this.loadComponent(tabName);
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  private loadComponent(tabName: string): void {
    // Xóa component hiện tại
    if (this.currentComponentRef) {
      this.currentComponentRef.destroy();
      this.currentComponentRef = null;
    }

    this.contentContainer.clear();

    let component: any;

    switch (tabName) {
      case 'tong-quan':
        component = AdminDashboard;
        break;
      case 'san-pham':
        component = ProductComponent;
        break;
      case 'khach-hang':
        component = Customer;
        break;
      case 'don-hang':
        component = Order;
        break;
      case 'khuyen-mai':
        component = Promotion;
        break;
      case 'banner':
        component = AdminBanner;
        break;
      case 'blog':
        component = AdminBlog;
        break;
      case 'danh-gia':
        component = AdminReviewComponent;
        break;
      case 'tu-van':
        component = Consulting;
        break;
      case 'chatbot':
        component = AdminChatbot;
        break;
      default:
        component = AdminDashboard;
    }

    this.currentComponentRef = this.contentContainer.createComponent(component);
  }
}