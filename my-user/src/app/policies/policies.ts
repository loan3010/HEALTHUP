import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Policy {
  icon: string;
  tag: string;
  title: string;
  content: string;
  color: string;
  open: boolean;
}

@Component({
  selector: 'app-policies',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './policies.html',
  styleUrls: ['./policies.css']
})
export class PoliciesComponent {

  policies: Policy[] = [
    {
      icon: 'bi-arrow-repeat',
      tag: 'Đổi trả',
      title: 'Chính sách đổi trả',
      color: '#3d6f2f',
      open: false,
      content: `
        <h4>Thời gian đổi trả</h4>
        <p>Chúng tôi chấp nhận đổi trả trong vòng <strong>7 ngày</strong> kể từ ngày nhận hàng. Sản phẩm phải còn nguyên vẹn, chưa qua sử dụng và đầy đủ hộp đựng, bao bì.</p>

        <h4>Điều kiện đổi trả nông sản tươi sống</h4>
        <p>Thời gian đổi trả là <strong>24 giờ</strong> kể từ khi nhận hàng nếu xảy ra một trong các trường hợp:</p>
        <ul>
          <li>Sản phẩm bị hư hỏng do vận chuyển</li>
          <li>Sản phẩm không đúng chất lượng cam kết</li>
          <li>Sản phẩm giao sai loại hoặc thiếu số lượng</li>
        </ul>

        <h4>Quy trình đổi trả</h4>
        <ol>
          <li>Chụp ảnh / quay video sản phẩm cần đổi trả</li>
          <li>Liên hệ hotline <strong>0123 456 789</strong> hoặc email vgreenshopro@gmail.com</li>
          <li>Đóng gói sản phẩm và chờ nhân viên đến lấy hàng</li>
          <li>Nhận sản phẩm mới hoặc hoàn tiền trong vòng <strong>3–5 ngày làm việc</strong></li>
        </ol>

        <div class="content-note">
          <i class="bi bi-info-circle"></i>
          Chi phí vận chuyển đổi trả do cả hai bên cùng thương lượng và phân chịu hợp lý.
        </div>
      `
    },
    {
      icon: 'bi-credit-card',
      tag: 'Thanh toán',
      title: 'Chính sách thanh toán',
      color: '#2980b9',
      open: false,
      content: `
        <h4>Phương thức thanh toán</h4>
        <p>HealthUp hỗ trợ nhiều phương thức thanh toán linh hoạt:</p>
        <ul>
          <li><strong>Thanh toán khi nhận hàng (COD)</strong> — áp dụng toàn quốc</li>
          <li><strong>Chuyển khoản ngân hàng</strong> — xác nhận trong 30 phút</li>
          <li><strong>Ví điện tử</strong> — MoMo, ZaloPay, VNPay</li>
          <li><strong>Thẻ tín dụng / ghi nợ</strong> — Visa, Mastercard</li>
        </ul>

        <h4>Bảo mật thanh toán</h4>
        <p>Tất cả giao dịch đều được mã hóa SSL 256-bit. Chúng tôi không lưu trữ thông tin thẻ của bạn.</p>

        <div class="content-note">
          <i class="bi bi-info-circle"></i>
          Đơn hàng sẽ được xử lý ngay sau khi xác nhận thanh toán thành công.
        </div>
      `
    },
    {
      icon: 'bi-shield-lock',
      tag: 'Bảo mật',
      title: 'Chính sách bảo mật',
      color: '#8e44ad',
      open: false,
      content: `
        <h4>Thu thập thông tin</h4>
        <p>Chúng tôi chỉ thu thập thông tin cần thiết để xử lý đơn hàng: họ tên, địa chỉ, số điện thoại và email. Thông tin của bạn <strong>không bao giờ</strong> được bán cho bên thứ ba.</p>

        <h4>Quyền của bạn</h4>
        <ul>
          <li>Yêu cầu xem, chỉnh sửa hoặc xóa dữ liệu cá nhân</li>
          <li>Rút lại sự đồng ý chia sẻ thông tin bất cứ lúc nào</li>
          <li>Nhận thông báo nếu có sự cố bảo mật xảy ra</li>
        </ul>

        <div class="content-note">
          <i class="bi bi-info-circle"></i>
          Mọi thắc mắc về bảo mật, vui lòng liên hệ privacy@healthup.vn
        </div>
      `
    },
    {
      icon: 'bi-truck',
      tag: 'Giao hàng',
      title: 'Chính sách giao hàng',
      color: '#e67e22',
      open: false,
      content: `
        <h4>Phạm vi & thời gian giao hàng</h4>
        <p>Giao hàng toàn quốc. Khu vực nội thành TP.HCM và Hà Nội hỗ trợ giao trong ngày với đơn đặt trước <strong>11:00 SA</strong>.</p>
        <ul>
          <li><strong>Nội thành TP.HCM / Hà Nội:</strong> 2–4 giờ hoặc trong ngày</li>
          <li><strong>Tỉnh thành khác:</strong> 1–3 ngày làm việc</li>
          <li><strong>Vùng sâu / xa:</strong> 3–7 ngày làm việc</li>
        </ul>

        <h4>Phí giao hàng</h4>
        <p>Miễn phí giao hàng cho đơn từ <strong>299.000đ</strong>. Đơn hàng dưới mức này áp dụng phí vận chuyển theo khoảng cách thực tế.</p>
      `
    },
    {
      icon: 'bi-tools',
      tag: 'Bảo hành',
      title: 'Chính sách bảo hành',
      color: '#c0392b',
      open: false,
      content: `
        <h4>Cam kết chất lượng</h4>
        <p>Tất cả sản phẩm HealthUp đều được kiểm định trước khi giao. Chúng tôi cam kết <strong>100% hàng chính hãng</strong>, nguồn gốc rõ ràng, minh bạch.</p>

        <h4>Thời gian bảo hành theo từng loại</h4>
        <ul>
          <li><strong>Thực phẩm đóng gói:</strong> theo hạn sử dụng in trên bao bì</li>
          <li><strong>Nông sản tươi:</strong> cam kết tươi ngon tại thời điểm giao hàng</li>
          <li><strong>Sản phẩm chế biến:</strong> bảo hành 30 ngày kể từ ngày sản xuất</li>
        </ul>

        <div class="content-note">
          <i class="bi bi-info-circle"></i>
          Bảo hành không áp dụng cho sản phẩm bị hư hỏng do bảo quản không đúng cách.
        </div>
      `
    }
  ];

  toggle(index: number) {
    this.policies[index].open = !this.policies[index].open;
  }
}