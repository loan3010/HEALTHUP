const ChatbotModel = require('../models/chatbot.model');

// ==================== CATEGORIES ====================

exports.getCategories = (req, res) => {
  try {
    const categories = ChatbotModel.getAllCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createCategory = (req, res) => {
  try {
    const { name, slug, icon } = req.body;
    const result = ChatbotModel.addCategory({ name, slug, icon: icon || '📁' });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==================== FAQs ====================

exports.getFAQs = (req, res) => {
  try {
    const { category_id } = req.query;
    const faqs = ChatbotModel.getAllFAQs(category_id);
    res.json({ success: true, data: faqs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getFAQById = (req, res) => {
  try {
    const faq = ChatbotModel.getFAQById(req.params.id);
    if (faq) {
      ChatbotModel.incrementViewCount(req.params.id);
      res.json({ success: true, data: faq });
    } else {
      res.status(404).json({ success: false, error: 'FAQ not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createFAQ = (req, res) => {
  try {
    const { category_id, question, answer } = req.body;
    const result = ChatbotModel.addFAQ({ category_id, question, answer });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateFAQ = (req, res) => {
  try {
    const { category_id, question, answer } = req.body;
    const result = ChatbotModel.updateFAQ(req.params.id, { category_id, question, answer });
    if (result) {
      res.json({ success: true, message: 'FAQ updated successfully', data: result });
    } else {
      res.status(404).json({ success: false, error: 'FAQ not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteFAQ = (req, res) => {
  try {
    const result = ChatbotModel.deleteFAQ(req.params.id);
    if (result) {
      res.json({ success: true, message: 'FAQ deleted successfully' });
    } else {
      res.status(404).json({ success: false, error: 'FAQ not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==================== CHAT ====================

exports.searchFAQs = (req, res) => {
  try {
    const { query } = req.body;
    if (!query || query.trim() === '') {
      return res.json({ success: true, data: [] });
    }
    const results = ChatbotModel.searchFAQs(query);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.saveConversation = (req, res) => {
  try {
    const { session_id, user_message, bot_response } = req.body;
    const result = ChatbotModel.addConversation({ session_id, user_message, bot_response });
    ChatbotModel.addAnalytics({
      event_type: 'chat_message',
      data: JSON.stringify({ query: user_message })
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getConversations = (req, res) => {
  try {
    const conversations = ChatbotModel.getConversationsBySession(req.params.session_id);
    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==================== CLAUDE PROXY ====================
// Xử lý API key ở server để không lộ key ra frontend

exports.claudeProxy = async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'messages array is required' });
    }

    // System prompt mô tả HealthUp
    const systemPrompt = `Bạn là trợ lý ảo của HealthUp - thương hiệu thực phẩm healthy Việt Nam với slogan "Sống khỏe mỗi ngày".

HealthUp chuyên cung cấp:
- Granola: các loại granola không đường tinh luyện, dùng mật ong tự nhiên, phù hợp ăn sáng/ăn kiêng
- Trà thảo mộc: trà hoa cúc, lavender, bạc hà - không caffeine, hỗ trợ thư giãn
- Trái cây sấy: sấy tự nhiên không đường, bảo quản 6-12 tháng

Chính sách:
- Giao hàng nội thành TP.HCM: 1-2 ngày, các tỉnh: 2-4 ngày
- Miễn phí ship cho đơn từ 300.000đ
- Giao nhanh trong ngày với đơn đặt trước 10h tại TP.HCM

Phong cách trả lời:
- Thân thiện, nhiệt tình, dùng emoji phù hợp
- Trả lời bằng tiếng Việt
- Ngắn gọn, rõ ràng, dễ hiểu
- Nếu không chắc, hướng dẫn khách liên hệ hotline: 1900 xxxx
- KHÔNG bịa thông tin về giá cả hoặc sản phẩm không rõ`;

    // Gọi Anthropic API từ phía server (API key an toàn)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, // Lưu trong file .env
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', errText);
      return res.status(500).json({ success: false, error: 'Claude API error' });
    }

    const data = await response.json();
    const reply = data?.content?.[0]?.text || '';

    res.json({ success: true, data: { reply } });

  } catch (error) {
    console.error('Claude proxy error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==================== ANALYTICS ====================

exports.getStats = (req, res) => {
  try {
    const stats = ChatbotModel.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};