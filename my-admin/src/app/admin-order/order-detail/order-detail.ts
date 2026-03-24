import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { STATIC_BASE } from '../../services/api.service';
import {
  AdminOrder,
  AdminOrderService,
  AdminOrderStatus,
  AdminReturnLine,
  AdminReturnStatus,
  DeliveryFailurePreset,
} from '../order/order.service';
import { AdminAlertModalService } from '../../admin-alert-modal/admin-alert-modal.service';

/** Lý do hủy nhanh — điền sẵn ô textarea (khách vẫn thấy đúng chuỗi này). */
const CANCEL_QUICK_REASONS: ReadonlyArray<{ label: string; text: string }> = [
  { label: 'Hết hàng', text: 'Cửa hàng hết hàng / tạm ngừng cung ứng sản phẩm trong đơn.' },
  { label: 'Khách hủy', text: 'Khách hàng yêu cầu hủy đơn.' },
  { label: 'Sai thông tin đơn', text: 'Thông tin đơn sai / trùng lặp — đã thống nhất hủy với khách.' },
  { label: 'Không liên hệ được', text: 'Không liên hệ được khách để xác nhận đơn.' },
];

/** Loại thao tác đang chờ xác nhận trong modal (tránh admin bấm nhầm). */
type PendingStatusConfirm =
  | { kind: 'order'; next: AdminOrderStatus }
  | { kind: 'delivery_failed' }
  | { kind: 'return'; next: AdminReturnStatus };

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.css',
})
export class OrderDetail implements OnChanges {
  @Input() orderId = '';
  @Output() back = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  order: AdminOrder | null = null;
  isLoading = false;
  errorMsg = '';
  actionLoading = false;

  /** Khớp backend MAX_REDELIVERY_ATTEMPTS */
  readonly maxRedeliveryAttempts = 2;

  /** Form đánh dấu giao thất bại (từ trạng thái đang giao). */
  showDeliveryFailForm = false;
  deliveryFailPreset: DeliveryFailurePreset | '' = '';
  deliveryFailDetail = '';

  /** Modal xác nhận trước khi PATCH trạng thái / trả hàng. */
  statusConfirmVisible = false;
  pendingConfirm: PendingStatusConfirm | null = null;
  /** Khi từ chối hoàn: nhập trong modal (thay window.prompt). */
  returnRejectReasonDraft = '';
  /** Khi hủy đơn: gửi lên backend → lưu `cancelReason` (khách xem ở chi tiết đơn). */
  cancelReasonDraft = '';
  /** Lỗi validate trong modal xác nhận (không dùng alert trình duyệt). */
  confirmModalInlineError = '';

  readonly cancelQuickReasons = CANCEL_QUICK_REASONS;

  constructor(
    private orderService: AdminOrderService,
    private adminAlert: AdminAlertModalService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderId'] && this.orderId) {
      this.loadDetail();
    }
  }

  loadDetail(): void {
    this.isLoading = true;
    this.errorMsg = '';
    this.orderService.getById(this.orderId).subscribe({
      next: (res) => {
        this.order = res;
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMsg = err?.error?.message || 'Không thể tải chi tiết đơn hàng';
        this.isLoading = false;
      }
    });
  }

  /**
   * PATCH chỉ trả document Order; không có buyerAccount / customerSummary (chỉ GET enrich).
   * Spread sau prev để giữ các trường enrich khi res không gửi kèm.
   */
  private mergeOrderAfterPatch(res: AdminOrder): void {
    const prev = this.order;
    this.order = prev ? { ...prev, ...res } : res;
  }

  /**
   * Mở modal xác nhận trước khi đổi trạng thái đơn (xác nhận / giao / hủy / giao lại…).
   */
  requestSetStatus(next: AdminOrderStatus): void {
    if (!this.order || this.actionLoading) return;
    this.confirmModalInlineError = '';
    if (next === 'cancelled') {
      this.cancelReasonDraft = '';
    }
    this.pendingConfirm = { kind: 'order', next };
    this.statusConfirmVisible = true;
  }

  /** Đóng modal, không gọi API. */
  closeStatusConfirm(): void {
    this.statusConfirmVisible = false;
    this.pendingConfirm = null;
    this.returnRejectReasonDraft = '';
    this.cancelReasonDraft = '';
    this.confirmModalInlineError = '';
  }

  /** Gán lý do hủy có sẵn vào textarea (có thể sửa trước khi xác nhận). */
  applyCancelQuickReason(text: string): void {
    this.cancelReasonDraft = text;
    this.confirmModalInlineError = '';
  }

  /**
   * Người dùng bấm «Xác nhận» trên modal: kiểm tra lý do từ chối (nếu có) rồi thực hiện API.
   */
  confirmStatusAction(): void {
    if (!this.pendingConfirm || !this.order || this.actionLoading) return;
    const p = this.pendingConfirm;

    this.confirmModalInlineError = '';

    if (p.kind === 'return' && p.next === 'rejected') {
      if (!this.returnRejectReasonDraft.trim()) {
        this.confirmModalInlineError = 'Vui lòng nhập lý do từ chối yêu cầu hoàn.';
        return;
      }
    }

    let cancelReasonToSend = '';
    if (p.kind === 'order' && p.next === 'cancelled') {
      cancelReasonToSend = this.cancelReasonDraft.trim();
      const must = this.order.status === 'pending' || this.order.status === 'confirmed';
      if (must && cancelReasonToSend.length < 3) {
        this.confirmModalInlineError =
          'Chọn một lý do nhanh bên dưới hoặc nhập tay (tối thiểu 3 ký tự). Khách sẽ thấy ở chi tiết đơn.';
        return;
      }
    }

    const rejectReason =
      p.kind === 'return' && p.next === 'rejected' ? this.returnRejectReasonDraft.trim() : '';

    this.statusConfirmVisible = false;
    this.pendingConfirm = null;
    this.returnRejectReasonDraft = '';
    this.cancelReasonDraft = '';
    this.confirmModalInlineError = '';

    if (p.kind === 'order') {
      this.runSetStatus(p.next, cancelReasonToSend);
    } else if (p.kind === 'delivery_failed') {
      this.runDeliveryFailed();
    } else if (p.kind === 'return') {
      this.runReturnStatus(p.next, rejectReason);
    }
  }

  /**
   * Tiêu đề modal.
   * Hai loại hủy đơn (trước giao vs sau giao thất bại) dùng tiêu đề khác nhau cho dễ phân biệt.
   */
  confirmModalTitle(): string {
    const p = this.pendingConfirm;
    if (p?.kind === 'order' && p.next === 'cancelled') {
      return this.order?.status === 'delivery_failed'
        ? 'Hủy đơn sau giao thất bại'
        : 'Hủy đơn trước khi giao hàng';
    }
    return 'Xác nhận thay đổi';
  }

  /** Nội dung giải thích theo đúng thao tác đang chờ. */
  confirmModalMessage(): string {
    const p = this.pendingConfirm;
    if (!p) return '';
    if (p.kind === 'order') {
      if (p.next === 'cancelled') {
        if (this.order?.status === 'delivery_failed') {
          return (
            'Đơn đang ở trạng thái giao thất bại. Hủy sẽ đóng đơn và không tiếp tục giao lại. ' +
            'Hãy chắc chắn đã thống nhất với khách hoặc hết lượt giao lại trước khi xác nhận.'
          );
        }
        return (
          'Đơn chưa bước vào giao hàng (chờ xác nhận hoặc đã xác nhận nhưng chưa «Bắt đầu giao hàng»). ' +
          'Hủy sẽ đóng đơn. Bạn có chắc muốn tiếp tục?'
        );
      }

      const fromRedeliver = this.order?.status === 'delivery_failed' && p.next === 'shipping';
      const lines: Partial<Record<AdminOrderStatus, string>> = {
        confirmed: 'Bạn có chắc muốn xác nhận đơn và chuyển sang «Chờ giao hàng»?',
        shipping: fromRedeliver
          ? 'Bạn có chắc muốn giao lại đơn hàng này?'
          : 'Bạn có chắc muốn chuyển sang «Đang giao hàng»?',
        delivered: 'Bạn có chắc đơn đã được giao thành công tới khách?',
      };
      return lines[p.next] || `Đổi trạng thái đơn sang «${p.next}»?`;
    }
    if (p.kind === 'delivery_failed') {
      return 'Đánh dấu giao hàng thất bại với lý do đã chọn? Thao tác sẽ cập nhật trạng thái đơn.';
    }
    if (p.kind === 'return') {
      const lines: Partial<Record<AdminReturnStatus, string>> = {
        approved: 'Chấp nhận yêu cầu hoàn / trả hàng của khách?',
        rejected: 'Từ chối yêu cầu hoàn / trả? Nhập lý do ở ô bên dưới.',
        completed: 'Xác nhận đã hoàn tiền / xử lý trả hàng xong?',
      };
      return lines[p.next] || 'Cập nhật trạng thái trả hàng / hoàn tiền?';
    }
    return '';
  }

  /** Hiện ô lý do khi từ chối hoàn (trong modal). */
  get showReturnRejectInModal(): boolean {
    return (
      this.pendingConfirm?.kind === 'return' && this.pendingConfirm.next === 'rejected'
    );
  }

  /** Ô lý do hủy trong modal (luôn hiện khi xác nhận hủy — bắt buộc hay tùy chọn tùy trạng thái). */
  get showCancelReasonInModal(): boolean {
    return this.pendingConfirm?.kind === 'order' && this.pendingConfirm.next === 'cancelled';
  }

  /** Hủy trước khi giao: bắt buộc nhập lý do; hủy sau giao thất bại: tùy chọn. */
  get cancelReasonRequired(): boolean {
    const s = this.order?.status;
    return s === 'pending' || s === 'confirmed';
  }

  cancelReasonFieldLabel(): string {
    return this.cancelReasonRequired ? 'Lý do hủy đơn (bắt buộc)' : 'Lý do hủy đơn (tùy chọn)';
  }

  /**
   * Cùng nhãn ngắn như bảng; chỉ thêm «đơn cũ» khi suy từ role / thiếu field.
   */
  orderSegmentLabelDetail(o: AdminOrder): string {
    if (o.orderSource === 'admin_hotline') return 'Admin tạo đơn';
    const b = o.buyerLinkType;
    if (b === 'user') return 'Khách có tài khoản';
    if (b === 'guest' || b === 'none') return 'Khách vãng lai';
    const r = o.buyerAccount?.role;
    if (r === 'user') return 'Khách có tài khoản (đơn cũ)';
    if (r === 'guest') return 'Khách vãng lai (đơn cũ)';
    if (!o.userId) return 'Khách vãng lai (đơn cũ)';
    return 'Khách có tài khoản (đơn cũ)';
  }

  /**
   * Sai địa chỉ / khách từ chối → backend không cho `delivery_failed` → `shipping`.
   */
  redeliveryAllowedByPreset(o: AdminOrder | null | undefined): boolean {
    const p = String(o?.deliveryFailurePreset || '');
    return p !== 'wrong_address' && p !== 'customer_refused';
  }

  /** Gợi ý khi đơn giao lỗi nhưng preset chặn giao lại (khác với hết lượt). */
  get showRedeliveryBlockedByPresetHint(): boolean {
    return (
      this.order?.status === 'delivery_failed' &&
      !this.redeliveryAllowedByPreset(this.order) &&
      Number(this.order.redeliveryAttempts || 0) < this.maxRedeliveryAttempts
    );
  }

  private runSetStatus(nextStatus: AdminOrderStatus, cancelReason = ''): void {
    if (!this.order || this.actionLoading) return;
    this.actionLoading = true;
    this.orderService
      .updateStatus(
        this.order._id,
        nextStatus,
        '',
        undefined,
        nextStatus === 'cancelled' ? cancelReason : undefined
      )
      .subscribe({
        next: (res) => {
          this.mergeOrderAfterPatch(res);
          this.actionLoading = false;
          this.updated.emit();
          this.showDeliveryFailForm = false;
          this.adminAlert.show({
            title: 'Thành công',
            message:
              nextStatus === 'confirmed' ? 'Đơn hàng đã được xác nhận.' : 'Đã cập nhật trạng thái đơn hàng.',
          });
        },
        error: (err) => {
          this.actionLoading = false;
          this.adminAlert.show({
            title: 'Không thể cập nhật',
            message: err?.error?.message || 'Không thể cập nhật trạng thái.',
            isError: true,
          });
        },
      });
  }

  toggleDeliveryFailForm(): void {
    this.showDeliveryFailForm = !this.showDeliveryFailForm;
    if (!this.showDeliveryFailForm) {
      this.deliveryFailPreset = '';
      this.deliveryFailDetail = '';
    }
  }

  /**
   * Kiểm tra form giao thất bại rồi mở modal (không gọi API ngay).
   */
  requestDeliveryFailedConfirm(): void {
    if (!this.order || this.actionLoading) return;
    if (!this.deliveryFailPreset) {
      this.adminAlert.show({
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn lý do giao thất bại.',
        isError: true,
      });
      return;
    }
    if (this.deliveryFailPreset === 'other' && !this.deliveryFailDetail.trim()) {
      this.adminAlert.show({
        title: 'Thiếu thông tin',
        message: 'Vui lòng nhập lý do chi tiết (lý do khác).',
        isError: true,
      });
      return;
    }
    this.pendingConfirm = { kind: 'delivery_failed' };
    this.statusConfirmVisible = true;
  }

  /** shipping → delivery_failed + lý do (sau khi user xác nhận trên modal). */
  private runDeliveryFailed(): void {
    if (!this.order || this.actionLoading) return;
    if (!this.deliveryFailPreset) return;
    this.actionLoading = true;
    this.orderService
      .updateStatus(this.order._id, 'delivery_failed', '', {
        preset: this.deliveryFailPreset as DeliveryFailurePreset,
        detail: this.deliveryFailDetail,
      })
      .subscribe({
        next: (res) => {
          this.mergeOrderAfterPatch(res);
          this.actionLoading = false;
          this.showDeliveryFailForm = false;
          this.deliveryFailPreset = '';
          this.deliveryFailDetail = '';
          this.updated.emit();
          this.adminAlert.show({
            title: 'Đã cập nhật',
            message: 'Đã ghi nhận giao hàng thất bại. Khách có tài khoản sẽ nhận thông báo kèm lý do.',
          });
        },
        error: (err) => {
          this.actionLoading = false;
          this.adminAlert.show({
            title: 'Lỗi',
            message: err?.error?.message || 'Không thể cập nhật trạng thái.',
            isError: true,
          });
        },
      });
  }

  /**
   * Mở modal xác nhận trước khi đổi trạng thái hoàn / trả.
   */
  requestReturnStatus(next: AdminReturnStatus): void {
    if (!this.order || this.actionLoading) return;
    this.confirmModalInlineError = '';
    this.returnRejectReasonDraft = '';
    this.pendingConfirm = { kind: 'return', next };
    this.statusConfirmVisible = true;
  }

  private runReturnStatus(nextReturnStatus: AdminReturnStatus, returnRejectionReason: string): void {
    if (!this.order || this.actionLoading) return;
    const returnReason = '';
    this.actionLoading = true;
    this.orderService
      .updateReturnStatus(this.order._id, nextReturnStatus, '', returnReason, returnRejectionReason)
      .subscribe({
        next: (res) => {
          this.mergeOrderAfterPatch(res);
          this.actionLoading = false;
          this.updated.emit();
          this.adminAlert.show({
            title: 'Thành công',
            message: 'Đã cập nhật trạng thái trả hàng / hoàn tiền.',
          });
        },
        error: (err) => {
          this.actionLoading = false;
          this.adminAlert.show({
            title: 'Lỗi',
            message: err?.error?.message || 'Không thể cập nhật trạng thái trả hàng / hoàn tiền.',
            isError: true,
          });
        },
      });
  }

  /**
   * Lý do giao thất bại chỉ có nghĩa khi đơn còn trong vòng xử lý lỗi giao / giao lại.
   * Sau khi chuyển «Đã giao», «Hủy», «Chờ xác nhận»… không hiện nữa (tránh nhầm như ảnh chụp màn hình).
   */
  get showDeliveryFailureReasonBlock(): boolean {
    const o = this.order;
    if (!o?.deliveryFailureReason) return false;
    const s = o.status;
    if (s === 'delivery_failed') return true;
    const redeliver = Number(o.redeliveryAttempts || 0) > 0;
    if (s === 'shipping' && redeliver) return true;
    return false;
  }

  get statusLabel(): string {
    const map: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Chờ giao hàng',
      shipping: 'Đang giao',
      delivery_failed: 'Giao thất bại',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy'
    };
    return map[this.order?.status || ''] || (this.order?.status || '');
  }

  /** Nhãn nguồn hủy để phân biệt khách hủy vs admin hủy. */
  get cancelActorLabel(): string {
    const by = String(this.order?.cancelledByType || '').toLowerCase();
    if (by === 'customer') return 'Khách hàng hủy';
    if (by === 'admin') return 'Admin hủy';
    if (by === 'system') return 'Hệ thống hủy';
    return 'Chưa rõ nguồn hủy';
  }

  paymentLabel(m: string): string {
    const map: Record<string, string> = { cod: 'COD', momo: 'MoMo', vnpay: 'VNPay' };
    return map[m] || m;
  }

  tierLabel(tier: string): string {
    if (String(tier || '').toLowerCase() === 'none') return 'Không hạng';
    return String(tier || '').toLowerCase() === 'vip' ? 'VIP' : 'Thành viên';
  }

  getTierClass(tier: string): string {
    const t = String(tier || '').toLowerCase();
    if (t === 'none') return 'tier-none';
    return t === 'vip' ? 'tier-vip' : 'tier-member';
  }

  /** Đơn không có customerID được xem là khách vãng lai (không hạng). */
  isGuestOrder(): boolean {
    return !String(this.order?.customerSummary?.customerID || '').trim();
  }

  displayCustomerId(): string {
    return this.isGuestOrder() ? 'Không có' : String(this.order?.customerSummary?.customerID || '').trim();
  }

  displayMembershipTier(): string {
    if (this.isGuestOrder()) return 'none';
    return String(this.order?.customerSummary?.membershipTier || 'member');
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value || 0) + 'đ';
  }

  /**
   * Ghép địa chỉ giao: bỏ phần rỗng và chữ "N/A" (đơn cũ / placeholder).
   */
  formatShipmentAddress(c: AdminOrder['customer'] | null | undefined): string {
    if (!c) return '—';
    const parts = [c.address, c.ward, c.district, c.province].map((p) =>
      p == null ? '' : String(p).trim()
    );
    const kept = parts.filter((p) => p.length > 0 && !/^n\/a$/i.test(p));
    return kept.length ? kept.join(', ') : '—';
  }

  get itemCount(): number {
    return (this.order?.items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  }

  canConfirm(): boolean {
    return this.order?.status === 'pending';
  }
  canStartShipping(): boolean {
    return this.order?.status === 'confirmed';
  }
  canDeliver(): boolean {
    return this.order?.status === 'shipping';
  }
  /** Hủy từ chờ xác nhận, chờ giao, hoặc sau giao thất bại. */
  canCancel(): boolean {
    const s = this.order?.status;
    return s === 'pending' || s === 'confirmed' || s === 'delivery_failed';
  }
  canMarkDeliveryFailed(): boolean {
    return this.order?.status === 'shipping';
  }
  /** Còn lượt giao lại và preset cho phép (khớp backend). */
  canRedeliver(): boolean {
    const a = Number(this.order?.redeliveryAttempts ?? 0);
    return (
      this.order?.status === 'delivery_failed' &&
      a < this.maxRedeliveryAttempts &&
      this.redeliveryAllowedByPreset(this.order)
    );
  }
  /** Shop chấp nhận xử lý hoàn (sau khi khách đã yêu cầu). */
  canApproveReturn(): boolean {
    return this.order?.status === 'delivered' && this.order?.returnStatus === 'requested';
  }
  canRejectReturn(): boolean {
    return this.order?.status === 'delivered' && this.order?.returnStatus === 'requested';
  }
  /** Đã nhận hàng trả & hoàn tiền — chỉ sau khi đã chấp nhận (approved). */
  canCompleteReturn(): boolean {
    return this.order?.status === 'delivered' && this.order?.returnStatus === 'approved';
  }

  /** Nhãn hiển thị cột trả/hoàn + khối chi tiết. */
  returnFlowLabel(rs: string | undefined): string {
    const map: Record<string, string> = {
      none: 'Không',
      requested: 'Yêu cầu hoàn/trả',
      approved: 'Đã chấp nhận hoàn',
      rejected: 'Từ chối hoàn',
      completed: 'Đã hoàn tiền / trả xong',
    };
    return map[rs || 'none'] || (rs || '');
  }

  /** Lọc URL ảnh hoàn hàng hợp lệ (tránh null/empty). */
  returnProofImages(o: AdminOrder | null): string[] {
    const arr = o?.returnImages;
    if (!Array.isArray(arr)) return [];
    return arr.map((u) => String(u || '').trim()).filter(Boolean);
  }

  /**
   * URL đầy đủ để <img> tải được file tĩnh trên backend.
   * Phải giống logic getImageUrl (return-management): nếu thiếu "/" đầu path
   * mà nối trực tiếp origin sẽ thành http://localhost:3000images/... → ảnh vỡ.
   */
  returnProofUrl(raw: string): string {
    if (raw == null || !String(raw).trim()) return 'assets/no-image.png';
    let u = String(raw).trim().replace(/\\/g, '/');
    if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u;
    const path = u.startsWith('/') ? u : `/${u}`;
    return `${STATIC_BASE}${path}`;
  }

  /** Ảnh 404 hoặc sai đường dẫn — đổi sang placeholder, tránh vòng lặp onerror. */
  onReturnProofImgError(ev: Event): void {
    const el = ev.target as HTMLImageElement;
    const fallback = 'assets/no-image.png';
    if (el && !el.src.endsWith(fallback)) {
      el.src = fallback;
      el.onerror = null;
    }
  }

  /**
   * Dòng yêu cầu trả có số lượng > 0 (API lưu từ form khách — có thể chỉ 2/3 SP).
   */
  returnLinesWithQty(o: AdminOrder | null): AdminReturnLine[] {
    const rows = o?.returnItems;
    if (!Array.isArray(rows)) return [];
    return rows.filter((r) => Number(r?.returnQty ?? 0) > 0);
  }

  /** Tiền hàng tương ứng phần trả (đơn giá × SL trả), chưa gồm ship. */
  returnRequestGoodsTotal(o: AdminOrder | null): number {
    return this.returnLinesWithQty(o).reduce(
      (s, r) => s + Number(r.price || 0) * Number(r.returnQty || 0),
      0
    );
  }

}