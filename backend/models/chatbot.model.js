const fs = require('fs');
const path = require('path');

// Đường dẫn đến file data
const DATA_FILE = path.join(__dirname, 'data.json');

// Khởi tạo dữ liệu mặc định
const defaultData = {
  categories: [
    { id: 1, name: 'Tất cả', slug: 'tat-ca', icon: '📋', created_at: new Date().toISOString() },
    { id: 2, name: 'Granola', slug: 'granola', icon: '🥣', created_at: new Date().toISOString() },
    { id: 3, name: 'Trà thảo mộc', slug: 'tra-thao-moc', icon: '🍵', created_at: new Date().toISOString() },
    { id: 4, name: 'Trái cây sấy', slug: 'trai-cay-say', icon: '🍎', created_at: new Date().toISOString() },
    { id: 5, name: 'Chính sách chung', slug: 'chinh-sach-chung', icon: '📜', created_at: new Date().toISOString() }
  ],
  faqs: [
    {
      id: 1,
      category_id: 2,
      question: 'Granola có giảm cân không?',
      answer: 'Granola là một lựa chọn tốt cho việc giảm cân khi sử dụng đúng cách. Granola chứa nhiều chất xơ, giúp bạn no lâu hơn và kiểm soát cảm giác thèm ăn. Tuy nhiên, bạn cần lưu ý:\n\n- Kiểm soát khẩu phần: 1 serving (khoảng 30-40g) là đủ\n- Kết hợp với sữa tươi không đường hoặc sữa chua Hy Lạp\n- Granola của HealthUp không có đường tinh luyện, sử dụng mật ong tự nhiên\n- Nên ăn vào bữa sáng hoặc bữa phụ\n\nKết hợp với chế độ ăn cân bằng và tập luyện đều đặn sẽ mang lại hiệu quả tốt nhất!',
      view_count: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 2,
      category_id: 5,
      question: 'Ship hàng bao lâu?',
      answer: 'Thời gian giao hàng của HealthUp:\n\n🚚 Nội thành TP.HCM: 1-2 ngày làm việc\n🚚 Các tỉnh thành khác: 2-4 ngày làm việc\n\nChúng tôi hỗ trợ:\n- Giao hàng nhanh trong ngày (với đơn đặt trước 10h sáng tại TP.HCM)\n- Miễn phí ship cho đơn hàng từ 300.000đ\n- Đóng gói cẩn thận, đảm bảo sản phẩm nguyên vẹn\n\nBạn sẽ nhận được mã tracking để theo dõi đơn hàng qua SMS/Email nhé!',
      view_count: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 3,
      category_id: 3,
      question: 'Trà thảo mộc có dễ ngủ không?',
      answer: 'Trà thảo mộc của HealthUp hoàn toàn KHÔNG gây khó ngủ vì:\n\n✅ Không chứa caffeine\n✅ Thành phần 100% thảo mộc tự nhiên\n✅ Có các dòng trà giúp thư giãn, dễ ngủ:\n   - Trà hoa cúc: Giúp thư giãn, giảm stress\n   - Trà hoa lavender: Hỗ trợ giấc ngủ ngon\n   - Trà bạc hà: Giúp tinh thần thoải mái\n\n💡 Gợi ý: Uống trà thảo mộc 30-60 phút trước khi ngủ sẽ giúp bạn có giấc ngủ sâu hơn. Tránh uống quá nhiều nước trước khi ngủ để không phải thức dậy đi vệ sinh nhé!',
      view_count: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 4,
      category_id: 2,
      question: 'Granola có bổ dưỡng không?',
      answer: 'Granola của HealthUp rất bổ dưỡng với các thành phần:\n\n🌾 Yến mạch nguyên hạt: Giàu chất xơ, protein\n🥜 Hạt dinh dưỡng: Hạnh nhân, óc chó, hạt điều\n🍯 Mật ong tự nhiên: Thay thế đường tinh luyện\n🍇 Trái cây sấy: Vitamin và khoáng chất\n\nLợi ích sức khỏe:\n✅ Cung cấp năng lượng bền vững\n✅ Tốt cho tim mạch\n✅ Hỗ trợ tiêu hóa\n✅ Giàu chất chống oxi hóa\n\nPhù hợp cho: Người tập gym, ăn kiêng, bận rộn, và mọi người muốn ăn sáng healthy!',
      view_count: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 5,
      category_id: 4,
      question: 'Trái cây sấy có tốt hơn trái cây tươi không?',
      answer: 'Trái cây sấy và trái cây tươi đều có giá trị dinh dưỡng riêng:\n\n🍎 TRÁI CÂY TƯƠI:\n+ Nhiều nước\n+ Vitamin C cao hơn\n+ Ít calo hơn\n- Dễ hỏng, khó bảo quản\n\n🍊 TRÁI CÂY SẤY:\n+ Bảo quản lâu (6-12 tháng)\n+ Dễ mang theo\n+ Chất xơ cô đặc\n+ Khoáng chất cao hơn\n- Calo tập trung hơn\n\n💡 Lời khuyên:\n- Kết hợp cả hai loại\n- Chọn trái cây sấy không đường của HealthUp\n- Khẩu phần: 30-40g/ngày\n- Uống nhiều nước khi ăn trái cây sấy',
      view_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  conversations: [],
  analytics: [],
  nextId: {
    category: 6,
    faq: 6,
    conversation: 1,
    analytics: 1
  }
};

// Database class để quản lý dữ liệu
class Database {
  constructor() {
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(fileContent);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    // Nếu không có file hoặc lỗi, dùng dữ liệu mặc định
    this.saveData(defaultData);
    return defaultData;
  }

  saveData(data = this.data) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }

  // ==================== CATEGORIES ====================
  
  getAllCategories() {
    return this.data.categories;
  }

  getCategoryById(id) {
    return this.data.categories.find(c => c.id === parseInt(id));
  }

  addCategory(category) {
    const newCategory = {
      id: this.data.nextId.category++,
      ...category,
      created_at: new Date().toISOString()
    };
    this.data.categories.push(newCategory);
    this.saveData();
    return newCategory;
  }

  // ==================== FAQs ====================
  
  getAllFAQs(categoryId = null) {
    let faqs = this.data.faqs;
    
    if (categoryId && categoryId !== 'all') {
      faqs = faqs.filter(f => f.category_id === parseInt(categoryId));
    }
    
    // Join với category info
    return faqs.map(faq => {
      const category = this.getCategoryById(faq.category_id);
      return {
        ...faq,
        category_name: category ? category.name : 'Unknown',
        category_slug: category ? category.slug : 'unknown'
      };
    }).sort((a, b) => b.view_count - a.view_count);
  }

  getFAQById(id) {
    const faq = this.data.faqs.find(f => f.id === parseInt(id));
    if (faq) {
      const category = this.getCategoryById(faq.category_id);
      return {
        ...faq,
        category_name: category ? category.name : 'Unknown',
        category_slug: category ? category.slug : 'unknown'
      };
    }
    return null;
  }

  addFAQ(faq) {
    const newFAQ = {
      id: this.data.nextId.faq++,
      ...faq,
      view_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.faqs.push(newFAQ);
    this.saveData();
    return newFAQ;
  }

  updateFAQ(id, updates) {
    const index = this.data.faqs.findIndex(f => f.id === parseInt(id));
    if (index !== -1) {
      this.data.faqs[index] = {
        ...this.data.faqs[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.saveData();
      return this.data.faqs[index];
    }
    return null;
  }

  deleteFAQ(id) {
    const index = this.data.faqs.findIndex(f => f.id === parseInt(id));
    if (index !== -1) {
      this.data.faqs.splice(index, 1);
      this.saveData();
      return true;
    }
    return false;
  }

  incrementViewCount(id) {
    const faq = this.data.faqs.find(f => f.id === parseInt(id));
    if (faq) {
      faq.view_count++;
      this.saveData();
      return faq;
    }
    return null;
  }

  searchFAQs(query) {
    const lowerQuery = query.toLowerCase();
    return this.getAllFAQs().filter(faq => 
      faq.question.toLowerCase().includes(lowerQuery) ||
      faq.answer.toLowerCase().includes(lowerQuery)
    ).slice(0, 5);
  }

  // ==================== CONVERSATIONS ====================
  
  addConversation(conversation) {
    const newConversation = {
      id: this.data.nextId.conversation++,
      ...conversation,
      created_at: new Date().toISOString()
    };
    this.data.conversations.push(newConversation);
    this.saveData();
    return newConversation;
  }

  getConversationsBySession(sessionId) {
    return this.data.conversations
      .filter(c => c.session_id === sessionId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  // ==================== ANALYTICS ====================
  
  addAnalytics(event) {
    const newEvent = {
      id: this.data.nextId.analytics++,
      ...event,
      created_at: new Date().toISOString()
    };
    this.data.analytics.push(newEvent);
    this.saveData();
    return newEvent;
  }

  getStats() {
    return {
      totalFAQs: this.data.faqs.length,
      totalCategories: this.data.categories.length,
      totalConversations: this.data.conversations.length,
      topFAQs: this.getAllFAQs()
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 5)
        .map(faq => ({
          question: faq.question,
          view_count: faq.view_count,
          category_name: faq.category_name
        }))
    };
  }
}

// Khởi tạo database
const db = new Database();

console.log('✅ Database initialized successfully!');
console.log(`📊 Loaded ${db.data.faqs.length} FAQs and ${db.data.categories.length} categories`);

module.exports = db;