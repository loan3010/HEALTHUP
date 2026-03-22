// backend/middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

function jwtSecret() {
  return process.env.JWT_SECRET || 'secret_key';
}

// Middleware xác thực token (async: kiểm tra tài khoản user còn hoạt động sau khi admin khóa)
exports.authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        message: 'Không có token, vui lòng đăng nhập',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret());
    } catch (err) {
      return res.status(403).json({
        message: 'Token không hợp lệ hoặc đã hết hạn',
      });
    }

    req.user = decoded;

    // User thường: chặn token cũ nếu admin đã vô hiệu hóa tài khoản
    if (decoded.role === 'user') {
      const u = await User.findById(decoded.userId).select('isActive deactivationReason').lean();
      if (!u) {
        return res.status(403).json({ message: 'Tài khoản không tồn tại' });
      }
      const active = typeof u.isActive === 'boolean' ? u.isActive : true;
      if (!active) {
        return res.status(403).json({
          message: 'Tài khoản của bạn đã bị vô hiệu hóa',
          deactivationReason: String(u.deactivationReason || '').trim(),
        });
      }
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Lỗi xác thực' });
  }
};

// Middleware kiểm tra role admin
// Dùng SAU authenticateToken: router.use(authenticateToken, requireAdmin)
exports.requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Bạn không có quyền truy cập tính năng này' 
    });
  }
  next();
};