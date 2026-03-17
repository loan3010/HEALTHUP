const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbot.controller');

// Categories
router.get('/categories', chatbotController.getCategories);
router.post('/categories', chatbotController.createCategory);

// FAQs
router.get('/faqs', chatbotController.getFAQs);
router.get('/faqs/:id', chatbotController.getFAQById);
router.post('/faqs', chatbotController.createFAQ);
router.put('/faqs/:id', chatbotController.updateFAQ);
router.delete('/faqs/:id', chatbotController.deleteFAQ);

// Chat
router.post('/chat/search', chatbotController.searchFAQs);
router.post('/chat/conversations', chatbotController.saveConversation);
router.get('/chat/conversations/:session_id', chatbotController.getConversations);

// Analytics
router.get('/analytics/stats', chatbotController.getStats);

module.exports = router;