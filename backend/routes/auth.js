// ======================= AUTH ROUTER =========================
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Admin = require('../models/Admin');

// ======================================================
// ============ CẤU HÌNH GỬI MAIL (NODEMAILER) ==========
// ======================================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // healthup.official@gmail.com
    pass: process.env.EMAIL_PASS  // ggbhpxgbjffzgaax
  }
});

// ======================================================
// ================= REGISTER (USER) ====================
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
      process.env.JWT_SECRET || 'secret_key',
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
      const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
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
// ================= LOGIN (USER) ======================
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
      process.env.JWT_SECRET || 'secret_key',
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
// ============= LOGIN (ADMIN) ==========================
// ======================================================
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ email và mật khẩu' });
    }

    const admin = await Admin.findOne({ email: email.trim() });
    if (!admin) {
      return res.status(401).json({ message: 'Tài khoản quản trị không tồn tại' });
    }

    if (admin.password !== password) {
      return res.status(401).json({ message: 'Mật khẩu quản trị không chính xác' });
    }

    const token = jwt.sign(
      { userId: String(admin._id), role: 'admin' },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: 'admin'
      }
    });

  } catch (err) {
    console.error('ADMIN LOGIN ERROR:', err);
    return res.status(500).json({ message: 'Lỗi hệ thống khi đăng nhập admin' });
  }
});

// ======================================================
// ============= FORGOT PASSWORD (ADMIN - UPDATED) ======
// ======================================================
router.post('/admin/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const emailVal = String(email || '').trim();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpire = Date.now() + 5 * 60 * 1000;

    const admin = await Admin.findOneAndUpdate(
      { email: emailVal },
      { $set: { otp: otp, otpExpire: otpExpire } },
      { new: true }
    );

    if (!admin) {
      return res.status(403).json({ 
        message: 'Cảnh báo: Thư điện tử này không thuộc quyền quản trị hệ thống!' 
      });
    }

    // Giao diện email trau chuốt hơn
    const mailOptions = {
      from: `"HealthUp Security" <${process.env.EMAIL_USER}>`,
      to: admin.email,
      subject: '[HealthUp] Mã Xác Thực Khôi Phục Mật Mã Quản Trị',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #2f6b38; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase;">HealthUp Admin Security</h1>
          </div>
          <div style="padding: 40px 30px; color: #333333; line-height: 1.6;">
            <p style="font-size: 18px; margin-top: 0;">Xin chào <strong>${admin.name}</strong>,</p>
            <p style="font-size: 15px;">Chúng tôi nhận được yêu cầu xác thực để khôi phục mật mã cho tài khoản quản trị của bạn. Vui lòng sử dụng mã OTP dưới đây để hoàn tất quy trình:</p>
            
            <div style="background-color: #f4f7f4; border: 2px dashed #2f6b38; border-radius: 8px; padding: 25px; margin: 30px 0; text-align: center;">
              <span style="display: block; font-size: 13px; color: #2f6b38; font-weight: bold; margin-bottom: 10px; text-transform: uppercase;">Mã xác thực (OTP) của bạn</span>
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 42px; font-weight: 900; color: #d10000; letter-spacing: 10px;">${otp}</span>
            </div>
            
            <p style="font-size: 14px; color: #666666;">* Lưu ý: Mã này chỉ có hiệu lực trong vòng <strong>1 phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai khác để bảo mật hệ thống.</p>
            
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
            <p style="font-size: 13px; color: #999999; text-align: center;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua thư này hoặc liên hệ bộ phận kỹ thuật.</p>
          </div>
          <div style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
            <p style="font-size: 12px; color: #aaaaaa; margin: 0;">&copy; 2026 HealthUp Official System. Bảo mật là ưu tiên hàng đầu.</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Mã OTP đã được gửi đến Gmail quản trị!' });

  } catch (err) {
    console.error('GỬI MAIL LỖI:', err);
    res.status(500).json({ message: 'Không thể gửi mã xác thực lúc này!' });
  }
});

// ======================================================
// ============= RESET PASSWORD (ADMIN - UPDATED) =======
// ======================================================
router.post('/admin/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const emailVal = String(email || '').trim();

    const admin = await Admin.findOneAndUpdate(
      { 
        email: emailVal, 
        otp: otp, 
        otpExpire: { $gt: Date.now() } 
      },
      { 
        $set: { password: newPassword }, 
        $unset: { otp: "", otpExpire: "" } 
      },
      { new: true }
    );

    if (!admin) {
      return res.status(400).json({ message: 'Mã OTP không chính xác hoặc đã hết hạn!' });
    }

    res.json({ message: 'Đổi mật mã quản trị thành công!' });
  } catch (err) {
    console.error('RESET PASSWORD ERROR:', err);
    res.status(500).json({ message: 'Lỗi hệ thống khi đặt lại mật mã!' });
  }
});

// ======================================================
// =============== FORGOT PASSWORD (USER) ===============
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
      process.env.JWT_SECRET || 'secret_key',
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