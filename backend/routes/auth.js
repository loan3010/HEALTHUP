const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// REGISTER – tạo user trong DB (dùng cho phần sau/admin)
router.post('/register', async (req, res) => {
  try {
    const { username, phone, email, password, role } = req.body;

    // ✅ bắt buộc: username + phone + password
    if (!username || !phone || !password) {
      return res.status(400).json({ message: 'Thiếu username/phone/password' });
    }

    // ✅ check trùng phone
    const existsPhone = await User.findOne({ phone: String(phone).trim() });
    if (existsPhone) return res.status(409).json({ message: 'Số điện thoại đã tồn tại' });

    // ✅ email optional: nếu có mới check
    const emailVal = (email || '').trim();
    if (emailVal) {
      const existsEmail = await User.findOne({ email: emailVal.toLowerCase() });
      if (existsEmail) return res.status(409).json({ message: 'Email đã tồn tại' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: String(username).trim(),
      phone: String(phone).trim(),
      email: emailVal ? emailVal.toLowerCase() : undefined,
      passwordHash,
      role: role === 'admin' ? 'admin' : 'user',
    });

    // ✅ (tuỳ chọn) trả token luôn để khỏi login lại
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
        role: user.role,
      },
    });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    return res.status(500).json({ message: err.message });
  }
});

// LOGIN – cho phép login bằng email hoặc phone
router.post('/login', async (req, res) => {
  try {
    const { emailOrPhone, password, email, phone } = req.body;

    const identifier = (emailOrPhone || email || phone || '').trim();
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Thiếu thông tin đăng nhập' });
    }

    const query = identifier.includes('@')
      ? { email: identifier.toLowerCase() }
      : { phone: identifier };

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });

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
        role: user.role,
      },
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;