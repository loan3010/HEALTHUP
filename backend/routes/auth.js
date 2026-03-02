// =======================đăng nhập đăng ký============================
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');


// =============================
// ===== REGISTER ==============
// =============================
router.post('/register', async (req, res) => {
  try {
    const { username, phone, email, password, role } = req.body;

    if (!username || !phone || !password) {
      return res.status(400).json({
        message: 'Thiếu username/phone/password'
      });
    }

    const usernameVal = String(username).trim();
    const phoneVal = String(phone).trim();
    const emailVal = (email || '').trim().toLowerCase();

    // Check trùng username
    const existsUsername = await User.findOne({ username: usernameVal });
    if (existsUsername) {
      return res.status(409).json({ message: 'Tên tài khoản đã tồn tại' });
    }

    // Check trùng phone
    const existsPhone = await User.findOne({ phone: phoneVal });
    if (existsPhone) {
      return res.status(409).json({ message: 'Số điện thoại đã tồn tại' });
    }

    // Check email nếu có nhập
    if (emailVal) {
      const existsEmail = await User.findOne({ email: emailVal });
      if (existsEmail) {
        return res.status(409).json({ message: 'Email đã tồn tại' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: usernameVal,
      phone: phoneVal,
      email: emailVal || undefined,
      passwordHash,
      role: role === 'admin' ? 'admin' : 'user'
    });

    const token = jwt.sign(
      { userId: String(user._id), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'registered',
      token,
      user: {
        id: String(user._id),
        username: user.username,
        phone: user.phone,
        email: user.email || '',
        role: user.role
      }
    });

  } catch (err) {
    console.error('REGISTER ERROR:', err);

    if (err?.code === 11000) {
      const field =
        Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';

      const map = {
        phone: 'Số điện thoại đã tồn tại',
        email: 'Email đã tồn tại',
        username: 'Tên tài khoản đã tồn tại'
      };

      return res.status(409).json({
        message: map[field] || `${field} đã tồn tại`
      });
    }

    return res.status(500).json({ message: err.message });
  }
});


// =============================
// ===== LOGIN =================
// =============================
router.post('/login', async (req, res) => {
  try {
    const { username, password, identifier, emailOrPhone } = req.body;

    const loginId = String(
      username || identifier || emailOrPhone || ''
    ).trim();

    if (!loginId || !password) {
      return res.status(400).json({
        message: 'Thiếu tài khoản hoặc mật khẩu'
      });
    }

    // Ưu tiên tìm theo username
    let user = await User.findOne({ username: loginId });

    // Fallback
    if (!user) {
      if (loginId.includes('@')) {
        user = await User.findOne({ email: loginId.toLowerCase() });
      } else if (/^[0-9]{9,11}$/.test(loginId)) {
        user = await User.findOne({ phone: loginId });
      }
    }

    if (!user) {
      return res.status(401).json({
        message: 'Sai tài khoản hoặc mật khẩu'
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({
        message: 'Sai tài khoản hoặc mật khẩu'
      });
    }

    const token = jwt.sign(
      { userId: String(user._id), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: String(user._id),
        username: user.username,
        phone: user.phone,
        email: user.email || '',
        role: user.role
      }
    });

  } catch (err) {
    console.error('LOGIN ERROR:', err);
    return res.status(500).json({ message: err.message });
  }
});


// =====================================
// ===== FORGOT PASSWORD (NO OTP CHECK)
// =====================================
router.post('/forgotpw/verify', async (req, res) => {
  try {
    const { phone } = req.body;

    const phoneVal = String(phone || '').trim();

    if (!phoneVal) {
      return res.status(400).json({
        message: 'Thiếu số điện thoại'
      });
    }

    // ❌ KHÔNG CHECK OTP
    const user = await User.findOne({ phone: phoneVal });

    if (!user) {
      return res.status(404).json({
        message: 'Số điện thoại chưa đăng ký'
      });
    }

    const token = jwt.sign(
      { userId: String(user._id), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'verified',
      token,
      user: {
        id: String(user._id),
        username: user.username,
        phone: user.phone,
        email: user.email || '',
        role: user.role
      }
    });

  } catch (err) {
    console.error('FORGOT VERIFY ERROR:', err);
    return res.status(500).json({ message: err.message });
  }
});


module.exports = router;