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
      // Tăng view count
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
    
    // Log analytics
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

// ==================== ANALYTICS ====================

exports.getStats = (req, res) => {
  try {
    const stats = ChatbotModel.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};