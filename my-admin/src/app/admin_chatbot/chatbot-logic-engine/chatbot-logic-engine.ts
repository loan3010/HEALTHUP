import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Mapping {
  from: string;
  to: string;
}

@Component({
  selector: 'app-chatbot-logic-engine',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './chatbot-logic-engine.html',
  styleUrls: ['./chatbot-logic-engine.css']
})
export class ChatbotLogicEngine implements OnInit {
  // --- TRẠNG THÁI DỮ LIỆU ---
  
  // Danh sách từ điển viết tắt/chuẩn hóa
  mappingList: Mapping[] = [];
  
  // Số lượng dòng hiển thị mặc định
  displayLimit: number = 5; 
  
  isLoading: boolean = false;
  private apiUrl = 'http://localhost:3000/api/chatbot/settings';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadSettings();
  }

  // --- THAO TÁC VỚI DATABASE ---

  // Lấy cấu hình từ server khi vừa mở tab
  loadSettings() {
    this.isLoading = true;
    this.http.get<any>(this.apiUrl).subscribe({
      next: (res) => {
        const settings = res.data || res;
        if (settings && settings.normalizationMap) {
          // Lấy danh sách ánh xạ từ Database
          this.mappingList = settings.normalizationMap;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Lỗi tải cấu hình logic:', err);
        this.isLoading = false;
      }
    });
  }

  // Lưu toàn bộ cấu hình xuống Database
  saveSettings() {
    this.isLoading = true;

    const payload = {
      // Chỉ gửi bảng chuẩn hóa, lọc bỏ các dòng gõ trống
      normalizationMap: this.mappingList.filter(m => m.from.trim() && m.to.trim()) 
    };

    this.http.post(this.apiUrl, payload).subscribe({
      next: () => {
        this.isLoading = false;
        alert('✅ Đã lưu Bảng Ánh Xạ Chuẩn Hóa thành công! Bot đã thông minh hơn rồi đó bà.');
      },
      error: (err) => {
        console.error('Lỗi lưu cấu hình:', err);
        this.isLoading = false;
        alert('❌ Không thể lưu cấu hình. Bà kiểm tra lại Backend nha!');
      }
    });
  }

  // --- THAO TÁC TRÊN GIAO DIỆN ---

  // Thêm một dòng trống vào ĐẦU bảng ánh xạ
  addNewMapping() {
    // Dùng unshift để đẩy dòng mới lên vị trí ĐẦU TIÊN của mảng
    this.mappingList.unshift({ from: '', to: '' });
  }

  // Xóa một dòng ánh xạ theo vị trí index
  removeMapping(index: number) {
    this.mappingList.splice(index, 1);
  }

  // Xem thêm danh sách
  showMore() {
    // Tăng số lượng hiển thị thêm 5 dòng mỗi lần bấm
    this.displayLimit += 5;
  }

  // Thu gọn danh sách
  showLess() {
    // Thu gọn lại về 5 dòng mặc định
    this.displayLimit = 5;
  }
}