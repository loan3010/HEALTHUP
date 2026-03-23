const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { attachAdminIo } = require('./services/adminNotificationService');
const { attachUserAccountNamespace } = require('./services/userAccountRealtime');
require('dotenv').config();

function jwtSecretSocket() {
  return process.env.JWT_SECRET || 'secret_key';
}

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
      const Category = require('./models/Categories');
      await Cart.syncIndexes();
      await User.syncIndexes();
      await Category.syncIndexes();
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
app.use('/api/categories',       require('./routes/categories'));
app.use('/api/admin/categories', require('./routes/admin-categories'));
app.use('/api/admin/customers', require('./routes/customer'));
app.use('/api/admin/dashboard', require('./routes/admin-dashboard'));
app.use('/api/about-images', require('./routes/about-images'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin/notifications', require('./routes/admin-notifications'));
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

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
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
  },
});

// Chỉ admin JWT mới vào room `admin` — thông báo real-time.
io.use((socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      (typeof socket.handshake.query?.token === 'string' ? socket.handshake.query.token : '');
    if (!token) return next(new Error('Unauthorized'));
    const decoded = jwt.verify(token, jwtSecretSocket());
    if (decoded.role !== 'admin') return next(new Error('Forbidden'));
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  socket.join('admin');
});

attachAdminIo(io);
// Khách đăng nhập kết nối namespace này để nhận push khi bị khóa tài khoản.
attachUserAccountNamespace(io);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = { app, server, io };