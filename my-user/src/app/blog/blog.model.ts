export interface Blog {
  _id: string;
  tag: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  date: string;       // Ngày cập nhật (định dạng chuỗi từ Admin)
  createdAt: string;  // Ngày đăng gốc (định dạng ISO từ hệ thống)
  views: number;      // Trường lượt xem mới thêm
}