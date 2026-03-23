import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import {
  AdminDashboardService,
  DashboardPreset,
  DashboardResponse,
  TopProductItem,
} from './admin-dashboard.service';
import { AdminNavBridgeService } from '../admin-nav-bridge.service';

Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboard implements OnInit {
  isLoading = false;
  errorText = '';
  selectedPreset: DashboardPreset = 'today';
  customFrom = '';
  customTo = '';
  topMode: 'best' | 'slow' = 'best';

  kpiRevenue = 0;
  kpiOrders = 0;
  kpiNewCustomers = 0;
  kpiProducts = 0;
  deltaRevenue = 0;
  deltaOrders = 0;
  deltaNewCustomers = 0;
  deltaProducts = 0;

  recentOrders: DashboardResponse['recentOrders'] = [];
  bestProducts: TopProductItem[] = [];
  slowProducts: TopProductItem[] = [];

  lineLabels: string[] = [];
  lineCurrent: Array<number | null> = [];
  linePrevious: Array<number | null> = [];
  ordersLabels: string[] = [];
  ordersValues: number[] = [];
  newCustomersLabels: string[] = [];
  newCustomersValues: number[] = [];
  orderPieLabels: string[] = [];
  orderPieValues: number[] = [];
  promotionPieLabels: string[] = [];
  promotionPieValues: number[] = [];
  customerPieLabels: string[] = [];
  customerPieValues: number[] = [];

  private chartInstances: Chart[] = [];
  private readonly navBridge = inject(AdminNavBridgeService);

  constructor(private dashboardService: AdminDashboardService) {}

  /** Chuyển sang tab Đơn hàng (cùng cơ chế header thông báo). */
  goToAllOrders(): void {
    this.navBridge.switchTab$.next('don-hang');
  }

  /** Chuyển sang tab Sản phẩm. */
  goToAllProducts(): void {
    this.navBridge.switchTab$.next('san-pham');
  }

  /** Click dòng đơn gần đây → tab Đơn hàng + mở chi tiết (Mongo _id). */
  openOrderDetailFromRow(orderId: string): void {
    this.navBridge.goToOrder(orderId);
  }

  /** Click dòng top SP → tab Sản phẩm + mở form chỉnh sửa đúng id. */
  openProductEditorFromRow(productId: string): void {
    this.navBridge.goToProduct(productId);
  }

  ngOnInit(): void {
    const today = this.formatDate(new Date());
    this.customFrom = today;
    this.customTo = today;
    this.loadDashboard();
  }

  onPresetChange(preset: DashboardPreset): void {
    this.selectedPreset = preset;
    if (preset !== 'custom') this.loadDashboard();
  }

  applyCustomRange(): void {
    if (!this.customFrom || !this.customTo) return;
    const from = new Date(this.customFrom);
    const to = new Date(this.customTo);
    const diff = Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (diff < 1 || diff > 30) {
      this.errorText = 'Khoảng ngày custom phải từ 1 đến 30 ngày.';
      return;
    }
    this.selectedPreset = 'custom';
    this.loadDashboard();
  }

  get productRows(): TopProductItem[] {
    return this.topMode === 'best' ? this.bestProducts : this.slowProducts;
  }

  /**
   * Mã đơn hiển thị: ưu tiên orderCode (ORD...) từ API;
   * đơn chưa có mã — fallback # + 6 ký tự cuối Mongo _id (hành vi cũ).
   */
  displayRecentOrderCode(o: { orderId: string; orderCode?: string }): string {
    const code = String(o.orderCode || '').trim();
    if (code) return code;
    return `#${o.orderId.slice(-6).toUpperCase()}`;
  }

  /**
   * Màu pill theo trạng thái (nhãn đã là tiếng Việt từ API).
   */
  orderStatusPillClass(label: string): string {
    const map: Record<string, string> = {
      'Chờ xử lý': 'pill-pending',
      'Đã xác nhận': 'pill-confirmed',
      'Đang giao hàng': 'pill-shipping',
      'Giao thất bại': 'pill-failed',
      'Đã giao': 'pill-delivered',
      'Đã hủy': 'pill-cancelled',
    };
    return map[label] || 'pill-unknown';
  }

  getDeltaText(value: number): string {
    if (value === 0) return 'không đổi so với kỳ trước';
    const signText = value > 0 ? 'tăng' : 'giảm';
    return `${signText} ${Math.abs(value).toFixed(1)}% so với kỳ trước`;
  }

  getDeltaClass(value: number): string {
    if (value > 0) return 'delta-up';
    if (value < 0) return 'delta-down';
    return 'delta-flat';
  }

  exportReport(): void {
    this.dashboardService
      .exportDashboard({
        preset: this.selectedPreset,
        from: this.customFrom,
        to: this.customTo,
      })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const from = this.customFrom || this.formatDate(new Date());
          const to = this.customTo || this.formatDate(new Date());
          a.download = `dashboard-${from}-to-${to}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.errorText = 'Xuất báo cáo thất bại.';
        },
      });
  }

  private loadDashboard(): void {
    this.isLoading = true;
    this.errorText = '';

    this.dashboardService
      .getDashboard({
        preset: this.selectedPreset,
        from: this.customFrom,
        to: this.customTo,
      })
      .subscribe({
        next: (res) => {
          this.kpiRevenue = res.kpis.revenue;
          this.kpiOrders = res.kpis.orders;
          this.kpiNewCustomers = res.kpis.newCustomers;
          this.kpiProducts = res.kpis.products;
          this.deltaRevenue = res.kpiChangeVsYesterday.revenue;
          this.deltaOrders = res.kpiChangeVsYesterday.orders;
          this.deltaNewCustomers = res.kpiChangeVsYesterday.newCustomers;
          this.deltaProducts = res.kpiChangeVsYesterday.products;
          this.recentOrders = res.recentOrders;
          this.bestProducts = res.topProducts.bestSelling;
          this.slowProducts = res.topProducts.slowSelling;

          this.lineLabels = res.revenueLine.labels;
          this.lineCurrent = res.revenueLine.current;
          this.linePrevious = res.revenueLine.previous;
          this.ordersLabels = res.ordersBar.labels;
          this.ordersValues = res.ordersBar.values;
          this.newCustomersLabels = res.newCustomersBar.labels;
          this.newCustomersValues = res.newCustomersBar.values;
          this.orderPieLabels = res.orderStatusPie.map((x) => x.label);
          this.orderPieValues = res.orderStatusPie.map((x) => x.value);
          this.promotionPieLabels = res.promotionPie.map((x) => x.label);
          this.promotionPieValues = res.promotionPie.map((x) => x.value);
          this.customerPieLabels = res.customerTierPie.map((x) => x.label);
          this.customerPieValues = res.customerTierPie.map((x) => x.value);

          // Vẽ lại sau khi đã có dữ liệu mới từ API.
          setTimeout(() => this.renderCharts(), 0);
          this.isLoading = false;
        },
        error: (err) => {
          this.errorText = err?.error?.message || 'Không tải được dữ liệu dashboard';
          this.isLoading = false;
        },
      });
  }

  private renderCharts(): void {
    this.chartInstances.forEach((c) => c.destroy());
    this.chartInstances = [];

    const charts = [
      this.createChart('revenue-line-chart', 'line', this.lineLabels, [
        { label: 'Kỳ hiện tại', data: this.lineCurrent, borderColor: '#2f7d32', backgroundColor: 'rgba(47,125,50,0.15)', tension: 0.35, fill: true },
        { label: 'Kỳ trước', data: this.linePrevious, borderColor: '#9e9e9e', backgroundColor: 'transparent', tension: 0.35, fill: false, borderDash: [6, 4] },
      ]),
      this.createChart('orders-bar-chart', 'bar', this.ordersLabels, [{ label: 'Tổng đơn hàng', data: this.ordersValues, backgroundColor: '#74b3e3' }]),
      this.createChart('new-customers-bar-chart', 'bar', this.newCustomersLabels, [{ label: 'Khách hàng mới', data: this.newCustomersValues, backgroundColor: '#ef7c31' }]),
      this.createChart('status-pie-chart', 'doughnut', this.orderPieLabels, [{ data: this.orderPieValues, backgroundColor: ['#66bb6a', '#8bc34a', '#ffd54f', '#4dd0e1', '#bdbdbd', '#f48fb1'] }], true),
      // 3 cung cố định: đang diễn ra | chưa diễn ra | đã kết thúc (API đếm theo startDate/endDate).
      this.createChart('promotion-pie-chart', 'doughnut', this.promotionPieLabels, [{ data: this.promotionPieValues, backgroundColor: ['#66bb6a', '#42a5f5', '#9e9e9e'] }], true),

      this.createChart('customer-pie-chart', 'doughnut', this.customerPieLabels, [{ data: this.customerPieValues, backgroundColor: ['#66bb6a', '#8bc34a', '#ffd54f', '#4dd0e1', '#bdbdbd', '#f48fb1'] }], true),
    ];
    this.chartInstances = charts.filter((c): c is Chart => c !== null);
  }

  private createChart(
    id: string,
    type: 'line' | 'bar' | 'doughnut',
    labels: string[],
    datasets: any[],
    isPie = false,
  ): Chart | null {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null;
    if (!canvas) return null;

    // Một ngày: line chỉ có 1 điểm — cần bán kính điểm lớn mới thấy; bar thu hẹp để không bị một cột quá dày.
    const singleBucket = labels.length === 1;
    const linePointRadius = singleBucket ? 10 : 4;
    const linePointHover = singleBucket ? 12 : 6;

    return new Chart(canvas, {
      type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        datasets: {
          bar: {
            barPercentage: singleBucket ? 0.28 : 0.85,
            categoryPercentage: singleBucket ? 0.45 : 0.75,
          },
        },
        elements: {
          point: {
            radius: type === 'line' ? linePointRadius : 0,
            hoverRadius: type === 'line' ? linePointHover : 0,
          },
          line: {
            borderWidth: type === 'line' ? 2.5 : 1,
          },
        },
        plugins: {
          legend: {
            display: isPie,
            position: 'bottom',
            labels: isPie
              ? {
                  boxWidth: 10,
                  boxHeight: 10,
                  padding: 8,
                  font: { family: "'Be Vietnam Pro', system-ui, sans-serif", size: 11 },
                }
              : undefined,
          },
          // Pie/doughnut: tooltip mặc định có thể lẫn chữ tiếng Anh — dùng nhãn Việt + "đơn".
          ...(isPie
            ? {
                tooltip: {
                  callbacks: {
                    label: (ctx: { label?: string; raw: unknown; chart: Chart }) => {
                      const n = Number(ctx.raw) || 0;
                      const label = String(ctx.label || '');
                      const dataArr = ctx.chart.data.datasets[0]?.data as unknown;
                      const arr = Array.isArray(dataArr) ? (dataArr as number[]) : [];
                      const sum = arr.reduce((a, b) => a + Number(b || 0), 0);
                      const pct = sum ? ((n / sum) * 100).toFixed(1) : '0';
                      return `${label}: ${n} đơn (${pct}%)`;
                    },
                  },
                },
              }
            : {}),
        },
        scales:
          type === 'doughnut'
            ? undefined
            : {
                x: {
                  ticks: { font: { family: "'Be Vietnam Pro', system-ui, sans-serif", size: 11 } },
                  grid: { display: type === 'line' },
                },
                y: {
                  beginAtZero: true,
                  ticks: { font: { family: "'Be Vietnam Pro', system-ui, sans-serif", size: 11 } },
                  grid: { color: 'rgba(0,0,0,0.06)' },
                },
              },
      },
    });
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
