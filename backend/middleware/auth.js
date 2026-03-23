const jwt = require('jsonwebtoken');
const User = require('../models/User');

function jwtSecret() {
  return process.env.JWT_SECRET || 'secret_key';
}

exports.authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

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
          /** Client (interceptor) nhận biết để bật overlay + đăng xuất — không nhầm 403 khác. */
          accountDisabled: true,
        });
      }
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Lỗi xác thực' });
  }
};

exports.requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      message: 'Bạn không có quyền truy cập tính năng này'
    });
  }
  next();
};

// Middleware tùy chọn: đọc token nếu có, không bắt buộc
// Dùng cho các route mà guest vẫn vào được nhưng user thì có thêm thông tin
exports.optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return next();
  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, jwtSecret());
    req.user = decoded;
  } catch (_) {
    // Token lỗi/hết hạn → bỏ qua, xử lý như guest
  }
  next();
};