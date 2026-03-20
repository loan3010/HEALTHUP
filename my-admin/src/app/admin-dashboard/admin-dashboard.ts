import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import {
  AdminDashboardService,
  DashboardPreset,
  DashboardResponse,
  TopProductItem,
} from './admin-dashboard.service';

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

  constructor(private dashboardService: AdminDashboardService) {}

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

  shortOrderId(orderId: string): string {
    return `#${orderId.slice(-6).toUpperCase()}`;
  }

  getDeltaText(value: number): string {
    if (value === 0) return 'không đổi so với hôm qua';
    const signText = value > 0 ? 'tăng' : 'giảm';
    return `${signText} ${Math.abs(value).toFixed(1)}% so với hôm qua`;
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
      this.createChart('promotion-pie-chart', 'doughnut', this.promotionPieLabels, [{ data: this.promotionPieValues, backgroundColor: ['#66bb6a', '#8bc34a', '#ffd54f', '#4dd0e1', '#bdbdbd', '#f48fb1'] }], true),
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
    return new Chart(canvas, {
      type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: isPie,
            position: 'bottom',
            labels: isPie
              ? {
                  boxWidth: 10,
                  boxHeight: 10,
                  padding: 8,
                  font: { size: 11 },
                }
              : undefined,
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
