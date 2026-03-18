// backend/middleware/auth.js

const jwt = require('jsonwebtoken');

// Middleware xác thực token
exports.authenticateToken = (req, res, next) => {
  try {
    // Lấy token từ header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        message: 'Không có token, vui lòng đăng nhập' 
      });
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ 
          message: 'Token không hợp lệ hoặc đã hết hạn' 
        });
      }

      // Lưu thông tin user vào req
      req.user = decoded;
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Lỗi xác thực' });
  }
};