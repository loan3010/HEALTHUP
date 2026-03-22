const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
// Cho phép header giỏ hàng (preflight OPTIONS) — thiếu mục này trình duyệt có thể không gửi x-guest-cart-id / x-user-id.
app.use(cors({
  origin(origin, callback) {
    if (
      !origin ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-guest-cart-id'],
  exposedHeaders: ['Content-Type'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthup';

console.log("ENV URI:", process.env.MONGODB_URI);
mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected successfully');
    // Index cũ userId unique KHÔNG sparse → mọi giỏ khách (userId null) trùng khóa → E11000 khi /carts/add.
    try {
      const Cart = require('./models/Cart');
      const User = require('./models/User');
      await Cart.syncIndexes();
      await User.syncIndexes();
      console.log('✅ Cart + User indexes synced (sparse unique where needed)');
    } catch (e) {
      console.warn('⚠️ syncIndexes:', e?.message || e);
    }
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/products',        require('./routes/products'));
app.use('/api/reviews',         require('./routes/reviews'));
app.use('/api/blogs',           require('./routes/blogs'));
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/orders',          require('./routes/orders'));
app.use('/api/vn-address',      require('./routes/vnAddress'));
app.use('/api/carts',           require('./routes/carts'));
app.use('/api/users',           require('./routes/users'));
app.use('/api/chatbot',         require('./routes/chatbot.routes'));
app.use('/api/promotions',      require('./routes/promotion.routes'));
app.use('/api/categories',      require('./routes/categories'));
app.use('/api/admin/customers', require('./routes/customer'));
app.use('/api/admin/dashboard', require('./routes/admin-dashboard'));
app.use('/api/about-images', require('./routes/about-images'));
app.use('/api/consulting', require('./routes/consulting.routes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'HealthUp API is running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;