const ChatbotModel = require('../models/Chatbot');
const ChatbotSettings = require('../models/ChatbotSettings');
const Category = require('../models/Categories');
const Product = require('../models/Product'); 
const Fuse = require('fuse.js');

// --- KIỂM TRA TRẠNG THÁI KẾT NỐI KHI KHỞI ĐỘNG ---
console.log('------------------------------------');
console.log('HỆ THỐNG: Kiểm tra Mô hình Chatbot:', typeof ChatbotModel.find === 'function' ? '✅ Đã nhận diện' : '❌ Lỗi nhận diện');
console.log('------------------------------------');

/**
 * ============================================================
 * HÀM CÔNG CỤ: CHUẨN HÓA ĐƯỜNG DẪN ẢNH (BẢN FIX 404 TUYỆT ĐỐI)
 * ============================================================
 * Hàm này đảm bảo mọi ảnh từ Backend gửi đi đều có tiền tố /images/products/
 */
const formatImagePath = (imgName) => {
  if (!imgName || imgName.trim() === '' || imgName.startsWith('http')) return imgName;
  
  let fileName = imgName.trim();

  // 1. Loại bỏ dấu gạch chéo ở đầu nếu có để xử lý thống nhất
  if (fileName.startsWith('/')) {
    fileName = fileName.substring(1);
  }

  // 2. Nếu tên file chưa chứa đường dẫn thư mục, ta thêm vào
  if (!fileName.includes('images/products/')) {
    return `/images/products/${fileName}`;
  } 
  
  // 3. Nếu đã có sẵn đường dẫn images/products/ thì chỉ cần thêm dấu / ở đầu để làm đường dẫn tuyệt đối
  return `/${fileName}`;
};

// ==========================================
// 1. QUẢN LÝ DANH MỤC (CATEGORIES)
// ==========================================

/** Lấy danh sách toàn bộ danh mục đang hoạt động */
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1 });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/** Tạo danh mục sản phẩm mới */
exports.createCategory = async (req, res) => {
  try {
    const { name, slug, description } = req.body;
    const newCat = new Category({ name, slug, description });
    await newCat.save();
    res.json({ success: true, data: newCat });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// 2. KHO TRI THỨC (CÂU HỎI & TRẢ LỜI - FAQs)
// ==========================================

/** Truy xuất danh sách FAQ, hỗ trợ lọc theo danh mục */
exports.getFAQs = async (req, res) => {
  try {
    const { category } = req.query; 
    let query = {};
    if (category && category.toLowerCase() !== 'all') {
      query.category = category;
    }
    
    const faqs = await ChatbotModel.find(query)
      .populate('relatedProducts')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: faqs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/** Lấy chi tiết một câu hỏi cụ thể */
exports.getFAQById = async (req, res) => {
  try {
    const faq = await ChatbotModel.findById(req.params.id).populate('relatedProducts');
    if (faq) {
      res.json({ success: true, data: faq });
    } else {
      res.status(404).json({ success: false, error: 'Không tìm thấy nội dung yêu cầu.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/** Khởi tạo câu hỏi mới */
exports.createFAQ = async (req, res) => {
  try {
    const { question, answer, category, variations, relatedProducts } = req.body;
    const newFAQ = new ChatbotModel({ 
      question, 
      answer, 
      category: category || 'Chính sách chung',
      variations: variations || [],
      relatedProducts: relatedProducts || []
    });
    await newFAQ.save();
    res.json({ success: true, data: newFAQ });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/** Cập nhật nội dung câu hỏi */
exports.updateFAQ = async (req, res) => {
  try {
    const updated = await ChatbotModel.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true }
    ).populate('relatedProducts');

    if (updated) {
      res.json({ success: true, message: 'Cập nhật dữ liệu thành công.', data: updated });
    } else {
      res.status(404).json({ success: false, error: 'Không tìm thấy dữ liệu để cập nhật.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/** Xóa vĩnh viễn câu hỏi */
exports.deleteFAQ = async (req, res) => {
  try {
    const result = await ChatbotModel.findByIdAndDelete(req.params.id);
    if (result) {
      res.json({ success: true, message: 'Xóa dữ liệu thành công.' });
    } else {
      res.status(404).json({ success: false, error: 'Không tìm thấy dữ liệu để xóa.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// 3. HỖ TRỢ CHỌN SẢN PHẨM (ADMIN ĐÍNH KÈM)
// ==========================================

/** Truy xuất sản phẩm để Admin lựa chọn, chuẩn hóa ảnh ngay tại đây */
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({ isHidden: { $ne: true } })
                                  .select('name price images cat');
    
    const data = products.map(p => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      // Áp dụng hàm sửa lỗi ảnh 404
      image: formatImagePath(p.images && p.images.length > 0 ? p.images[0] : ''),
      category: p.cat 
    }));

    res.json({ success: true, data: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// 4. CÀI ĐẶT CẤU HÌNH LOGIC (SETTINGS)
// ==========================================

/** Lấy cấu hình Fuzzy Matching và từ điển chuẩn hóa */
exports.getSettings = async (req, res) => {
  try {
    let settings = await ChatbotSettings.findOne();
    if (!settings) {
      settings = await ChatbotSettings.create({
        fuzzyThreshold: 0.4,
        normalizationMap: [
          { from: 'k, ko', to: 'không' },
          { from: 'v', to: 'về' },
          { from: 'bn', to: 'bao nhiêu' },
          { from: 'dc', to: 'được' }
        ]
      });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/** Lưu thay đổi cấu hình logic */
exports.saveSettings = async (req, res) => {
  try {
    const settings = await ChatbotSettings.findOneAndUpdate({}, req.body, { 
      upsert: true, 
      new: true 
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// 5. CƠ CHẾ TÌM KIẾM THÔNG MINH (CHAT LOGIC)
// ==========================================

/** Tìm kiếm câu trả lời bằng Fuse.js, chuẩn hóa ảnh cho thẻ sản phẩm trả về */
exports.searchFAQs = async (req, res) => {
  try {
    const { query, message } = req.body;
    const userQuery = query || message;

    if (!userQuery || userQuery.trim() === '') {
      return res.json({ success: true, data: [], answer: "Bạn vui lòng nhập nội dung câu hỏi nhé!" });
    }

    let settings = await ChatbotSettings.findOne() || { fuzzyThreshold: 0.4, normalizationMap: [] };
    const allFaqs = await ChatbotModel.find({ isActive: true }).populate('relatedProducts');

    if (!allFaqs || allFaqs.length === 0) {
      return res.json({ success: false, answer: "Hiện tại tôi chưa có dữ liệu cho câu hỏi này." });
    }

    // Tiến hành chuẩn hóa câu hỏi của người dùng
    let processedMsg = userQuery.toLowerCase();
    if (settings.normalizationMap && Array.isArray(settings.normalizationMap)) {
      settings.normalizationMap.forEach(map => {
        if (map.from && map.to) {
          const aliasList = map.from.split(',').map(s => s.trim());
          aliasList.forEach(alias => {
            const regex = new RegExp(`\\b${alias}\\b`, 'g');
            processedMsg = processedMsg.replace(regex, map.to);
          });
        }
      });
    }

    // Cấu hình Fuse.js để tìm kiếm mờ
    const fuse = new Fuse(allFaqs, {
      keys: ['question', 'variations'],
      threshold: settings.fuzzyThreshold || 0.4,
      includeScore: true
    });

    const results = fuse.search(processedMsg);

    if (results.length > 0) {
      const bestMatch = results[0].item;

      // Chuẩn hóa danh sách sản phẩm gợi ý và ĐƯỜNG DẪN ẢNH
      const formattedProducts = (bestMatch.relatedProducts || []).map(p => ({
        _id: p._id,
        name: p.name,
        price: p.price,
        // Ép đường dẫn ảnh về chuẩn để tránh lỗi 404
        image: formatImagePath(p.images && p.images.length > 0 ? p.images[0] : ''),
        slug: p._id 
      }));

      res.json({ 
        success: true, 
        answer: bestMatch.answer,
        products: formattedProducts,
        intent: bestMatch.question,
        score: (1 - results[0].score) * 100
      });
    } else {
      res.json({ 
        success: false, 
        answer: "HealthUp chưa hiểu rõ ý của bạn, bạn có thể diễn đạt cụ thể hơn một chút được không? 🌿" 
      });
    }
  } catch (error) {
    console.error("LỖI TRONG QUÁ TRÌNH TÌM KIẾM:", error);
    res.status(500).json({ success: false, error: "Hệ thống đang gặp sự cố tạm thời." });
  }
};

// ==========================================
// 6. CÁC CHỨC NĂNG HỖ TRỢ KHÁC
// ==========================================

/** Ghi nhận lịch sử trò chuyện (Dự phòng) */
exports.saveConversation = async (req, res) => {
  try {
    res.json({ success: true, message: 'Đã lưu lại lịch sử cuộc trò chuyện.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/** Proxy kết nối với trí tuệ nhân tạo Claude */
exports.claudeProxy = async (req, res) => {
  try {
    const { messages } = req.body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1024,
        system: "Bạn là Trợ lý ảo HealthUp. Phản hồi thân thiện.",
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });
    const data = await response.json();
    res.json({ success: true, reply: data?.content?.[0]?.text });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Lỗi AI Fallback' });
  }
};

/** Truy xuất các chỉ số thống kê kho tri thức */
exports.getStats = async (req, res) => {
  try {
    const totalFaqs = await ChatbotModel.countDocuments();
    const totalCategories = await Category.countDocuments();
    res.json({ success: true, data: { totalFaqs, totalCategories } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/** Lấy lịch sử theo phiên làm việc */
exports.getConversations = async (req, res) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};