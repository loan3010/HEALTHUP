const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbot.controller');

// ============================================================
// 1. QUẢN LÝ SẢN PHẨM ĐÍNH KÈM (CẬP NHẬT QUAN TRỌNG)
// ============================================================
/** * Đưa lên đầu để tránh bị Express nhầm lẫn 'products' là một ':id' của FAQ.
 * Route này giúp lấy danh sách sản phẩm để Admin tick chọn gắn vào câu trả lời.
 */
router.get('/products/all', chatbotController.getAllProducts);


// ============================================================
// 2. QUẢN LÝ KHO TRI THỨC (KNOWLEDGE BASE / FAQS)
// ============================================================
// Lấy danh sách tất cả FAQ (có lọc theo Category nếu cần)
router.get('/faqs', chatbotController.getFAQs);

// Lấy chi tiết một câu hỏi cụ thể
router.get('/faqs/:id', chatbotController.getFAQById);

// Thêm mới câu hỏi (Huấn luyện Bot)
router.post('/faqs', chatbotController.createFAQ);

// Cập nhật câu hỏi theo ID
router.put('/faqs/:id', chatbotController.updateFAQ);

// Xóa vĩnh viễn câu hỏi khỏi kho tri thức
router.delete('/faqs/:id', chatbotController.deleteFAQ);


// ============================================================
// 3. QUẢN LÝ DANH MỤC (CATEGORIES)
// ============================================================
router.get('/categories', chatbotController.getCategories);
router.post('/categories', chatbotController.createCategory);


// ============================================================
// 4. CÀI ĐẶT CHUẨN HÓA & LOGIC (SETTINGS)
// ============================================================
// Lấy cấu hình Fuzzy Matching và Normalization Map
router.get('/settings', chatbotController.getSettings);

// Lưu cấu hình Logic Engine
router.post('/settings', chatbotController.saveSettings);


// ============================================================
// 5. GIAO TIẾP VỚI NGƯỜI DÙNG (CHAT LOGIC)
// ============================================================
// Cổng tiếp nhận câu hỏi chính (Dùng thuật toán Fuse.js)
router.post('/ask', chatbotController.searchFAQs);

// Cổng tiếp nhận cũ (Duy trì tính tương thích hệ thống)
router.post('/chat/search', chatbotController.searchFAQs);

// Ghi nhận lịch sử trò chuyện của khách hàng
router.post('/chat/conversations', chatbotController.saveConversation);

// Truy xuất lịch sử trò chuyện theo mã phiên (Session ID)
router.get('/chat/conversations/:session_id', chatbotController.getConversations);

// AI Fallback - Kết nối Claude API để xử lý câu hỏi khó
router.post('/chat/claude', chatbotController.claudeProxy);


// ============================================================
// 6. THỐNG KÊ & PHÂN TÍCH (ANALYTICS)
// ============================================================
router.get('/analytics/stats', chatbotController.getStats);

module.exports = router;