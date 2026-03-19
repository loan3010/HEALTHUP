// ======================= AUTH ROUTER =========================
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');


// ======================================================
// ================= REGISTER ===========================
// ======================================================
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

    // check username
    const existsUsername = await User.findOne({ username: usernameVal });
    if (existsUsername) {
      return res.status(409).json({ message: 'Tên tài khoản đã tồn tại' });
    }

    // check phone
    const existsPhone = await User.findOne({ phone: phoneVal });
    if (existsPhone) {
      return res.status(409).json({ message: 'Số điện thoại đã tồn tại' });
    }

    // check email
    if (emailVal) {
      const existsEmail = await User.findOne({ email: emailVal });
      if (existsEmail) {
        return res.status(409).json({ message: 'Email đã tồn tại' });
      }
    }

    // hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // ============================
    // CREATE CUSTOMER ID
    // ============================

    const count = await User.countDocuments();
    const customerID = "CUS" + String(count + 1).padStart(4, "0");

    // create user
    const user = await User.create({
      customerID,
      username: usernameVal,
      phone: phoneVal,
      email: emailVal || undefined,
      passwordHash,
      role: role === 'admin' ? 'admin' : 'user'
    });

    // create token
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
        customerID: user.customerID,
        username: user.username,
        phone: user.phone,
        email: user.email || '',
        role: user.role
      }
    });

  } catch (err) {

    console.error('REGISTER ERROR:', err);

    if (err.code === 11000) {

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

    return res.status(500).json({
      message: err.message
    });
  }
});


// ======================================================
// ================= LOGIN ==============================
// ======================================================
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

    let user = await User.findOne({ username: loginId });

    if (!user) {

      if (loginId.includes('@')) {
        user = await User.findOne({
          email: loginId.toLowerCase()
        });
      }

      else if (/^[0-9]{9,11}$/.test(loginId)) {
        user = await User.findOne({
          phone: loginId
        });
      }
    }

    if (!user) {
      return res.status(401).json({
        message: 'Sai tài khoản hoặc mật khẩu'
      });
    }

    const ok = await bcrypt.compare(
      password,
      user.passwordHash
    );

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
        customerID: user.customerID,
        username: user.username,
        phone: user.phone,
        email: user.email || '',
        role: user.role
      }
    });

  } catch (err) {

    console.error('LOGIN ERROR:', err);

    return res.status(500).json({
      message: err.message
    });
  }
});


// ======================================================
// =============== FORGOT PASSWORD ======================
// ======================================================
router.post('/forgotpw/verify', async (req, res) => {

  try {

    const { phone } = req.body;

    const phoneVal = String(phone || '').trim();

    if (!phoneVal) {
      return res.status(400).json({
        message: 'Thiếu số điện thoại'
      });
    }

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
        customerID: user.customerID,
        username: user.username,
        phone: user.phone,
        email: user.email || '',
        role: user.role
      }
    });

  } catch (err) {

    console.error('FORGOT VERIFY ERROR:', err);

    return res.status(500).json({
      message: err.message
    });
  }
});

module.exports = router;