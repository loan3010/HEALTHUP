// ======================= AUTH ROUTER =========================
const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Admin = require('../models/Admin');

/**
 * Các dạng SĐT có thể trùng nhau trong DB (đăng ký nhập 09… / 9 số / form quên MK nhập +84…).
 * Trả về mảng chuỗi để query $or — tránh báo "chưa đăng ký" khi chỉ khác định dạng.
 */
function vietnamPhoneLookupVariants(raw) {
  const trimmed = String(raw || '').trim();
  const onlyDigits = trimmed.replace(/\D/g, '');
  const set = new Set();
  if (trimmed) set.add(trimmed);
  if (onlyDigits) set.add(onlyDigits);
  // 84xxxxxxxxx → 0xxxxxxxxx
  if (onlyDigits.startsWith('84') && onlyDigits.length >= 10) {
    set.add('0' + onlyDigits.slice(2));
  }
  // 0xxxxxxxxx → bỏ số 0 đầu (một số bản ghi chỉ lưu 9 số)
  if (onlyDigits.startsWith('0') && onlyDigits.length >= 10) {
    set.add(onlyDigits.slice(1));
  }
  // 9 số không 0 → thử thêm 0 đầu
  if (!onlyDigits.startsWith('0') && onlyDigits.length === 9) {
    set.add('0' + onlyDigits);
  }
  return [...set];
}

// ===== OTP quên mật khẩu (demo, RAM) — key = user.phone đúng trong DB =====
const forgotPwOtpStore = new Map();

function sweepForgotPwOtps() {
  const now = Date.now();
  for (const [k, v] of forgotPwOtpStore) {
    if (now > v.expiresAt) forgotPwOtpStore.delete(k);
  }
}

/** 6 chữ số, luôn đủ 6 ký tự (100000–999999) */
function randomSixDigitOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Kiểm tra SĐT cho luồng quên MK — dùng chung request-otp và verify.
 * Trả { user } hoặc { err: { status, body } }.
 */
async function resolveForgotPasswordUser(phoneRaw) {
  const phoneVal = String(phoneRaw || '').trim();
  if (!phoneVal) {
    return { err: { status: 400, body: { message: 'Thiếu số điện thoại' } } };
  }

  const phoneCandidates = vietnamPhoneLookupVariants(phoneVal);
  const orClause = phoneCandidates.map((p) => ({ phone: p }));
  const user = orClause.length ? await User.findOne({ $or: orClause }) : null;

  if (!user) {
    return { err: { status: 404, body: { message: 'Số điện thoại chưa đăng ký' } } };
  }

  if (user.role === 'guest') {
    return {
      err: {
        status: 403,
        body: {
          message:
            'Đây là tài khoản khách tự động khi đặt hàng không đăng nhập. Vui lòng đăng ký tài khoản để đăng nhập.',
        },
      },
    };
  }

  const userIsActive = typeof user.isActive === 'boolean' ? user.isActive : true;
  if (user.role === 'user' && !userIsActive) {
    return {
      err: {
        status: 403,
        body: {
          message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ nếu cần.',
          deactivationReason: String(user.deactivationReason || '').trim(),
          accountDisabled: true,
        },
      },
    };
  }

  return { user };
}

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

    // SĐT đã có tài khoản thật → không cho đăng ký trùng
    const existsPhone = await User.findOne({ phone: phoneVal });
    if (existsPhone && existsPhone.role !== 'guest') {
      return res.status(409).json({ message: 'Số điện thoại đã tồn tại' });
    }

    // Username / email trùng user khác (không tính chính bản ghi guest sẽ nâng cấp)
    const usernameQuery = existsPhone
      ? { username: usernameVal, _id: { $ne: existsPhone._id } }
      : { username: usernameVal };
    const existsUsername = await User.findOne(usernameQuery);
    if (existsUsername) {
      return res.status(409).json({ message: 'Tên tài khoản đã tồn tại' });
    }

    if (emailVal) {
      const emailQuery = existsPhone
        ? { email: emailVal, _id: { $ne: existsPhone._id } }
        : { email: emailVal };
      const existsEmail = await User.findOne(emailQuery);
      if (existsEmail) {
        return res.status(409).json({ message: 'Email đã tồn tại' });
      }
    }

    // hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // ============================
    // CREATE CUSTOMER ID (KH####)
    // ============================
    const khUsers = await User.find(
      { customerID: { $regex: '^KH\\d+$' } },
      { customerID: 1 }
    ).lean();

    let maxNum = 0;
    for (const u of khUsers) {
      const id = String(u.customerID || '');
      const num = parseInt(id.replace(/^KH/, ''), 10);
      if (Number.isFinite(num) && num > maxNum) maxNum = num;
    }

    const nextNum = maxNum + 1;
    const customerID = 'KH' + String(nextNum).padStart(4, '0');

    let user;
    // Nâng cấp guest (đã mua không đăng nhập) → cùng _id, gộp lịch sử đơn
    if (existsPhone && existsPhone.role === 'guest') {
      existsPhone.username = usernameVal;
      existsPhone.phone = phoneVal;
      existsPhone.email = emailVal || undefined;
      existsPhone.passwordHash = passwordHash;
      existsPhone.role = role === 'admin' ? 'admin' : 'user';
      existsPhone.customerID = customerID;
      await existsPhone.save();
      user = existsPhone;
    } else {
      user = await User.create({
        customerID,
        username: usernameVal,
        phone: phoneVal,
        email: emailVal || undefined,
        passwordHash,
        role: role === 'admin' ? 'admin' : 'user',
      });
    }

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

    if (user.role === 'guest') {
      return res.status(403).json({
        message:
          'Đây là tài khoản khách tự động khi đặt hàng không đăng nhập. Vui lòng đăng ký tài khoản để đăng nhập.',
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

    // Khách bị khóa: không cấp token; trả lý do để hiển thị trên app user
    const userIsActive = typeof user.isActive === 'boolean' ? user.isActive : true;
    if (user.role === 'user' && !userIsActive) {
      return res.status(403).json({
        message: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ hỗ trợ nếu cần.',
        deactivationReason: String(user.deactivationReason || '').trim(),
        accountDisabled: true,
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

// Tạo OTP 6 số — demo trả về trong JSON để hiển thị thay SMS (production: chỉ gửi SMS)
router.post('/forgotpw/request-otp', async (req, res) => {
  try {
    sweepForgotPwOtps();
    const resolved = await resolveForgotPasswordUser(req.body.phone);
    if (resolved.err) {
      return res.status(resolved.err.status).json(resolved.err.body);
    }
    const { user } = resolved;

    const code = randomSixDigitOtp();
    // Demo: mã sống 60s — sau đó client gọi request-otp lại để xoay mã
    const ttlMs = 60 * 1000;
    forgotPwOtpStore.set(user.phone, {
      code,
      expiresAt: Date.now() + ttlMs,
    });

    return res.json({
      message: 'otp_issued_demo',
      // Trên thật không trả field này — chỉ dùng khi chưa tích hợp SMS
      demoOtp: code,
      expiresInSeconds: Math.floor(ttlMs / 1000),
    });
  } catch (err) {
    console.error('FORGOT REQUEST OTP ERROR:', err);
    return res.status(500).json({ message: err.message });
  }
});

// Kiểm tra OTP đúng + khớp mã server đã phát — mới cấp resetToken
router.post('/forgotpw/verify', async (req, res) => {
  try {
    const otpRaw = String(req.body.otp || '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(otpRaw)) {
      return res.status(400).json({ message: 'Mã OTP phải gồm đúng 6 chữ số.' });
    }

    sweepForgotPwOtps();
    const resolved = await resolveForgotPasswordUser(req.body.phone);
    if (resolved.err) {
      return res.status(resolved.err.status).json(resolved.err.body);
    }
    const { user } = resolved;

    const entry = forgotPwOtpStore.get(user.phone);
    if (!entry || Date.now() > entry.expiresAt) {
      return res.status(401).json({
        message:
          'Mã OTP đã hết hạn hoặc chưa được gửi. Vui lòng đóng và bấm «Gửi mã OTP» lại.',
      });
    }
    if (entry.code !== otpRaw) {
      return res.status(400).json({ message: 'Mã OTP không đúng. Vui lòng nhập lại.' });
    }
    forgotPwOtpStore.delete(user.phone);

    // JWT riêng cho bước đặt lại MK — không dùng làm đăng nhập (purpose bắt buộc khi gọi set-password)
    const resetToken = jwt.sign(
      { userId: String(user._id), purpose: 'pwd_reset' },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '30m' }
    );

    return res.json({
      message: 'otp_ok',
      resetToken,
      user: {
        id: String(user._id),
        username: user.username,
        phone: user.phone,
      },
    });

  } catch (err) {
    console.error('FORGOT VERIFY ERROR:', err);
    return res.status(500).json({
      message: err.message
    });
  }
});

// Đặt mật khẩu mới sau khi OTP (demo) — body: { resetToken, newPassword }
router.post('/forgotpw/set-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    const pw = String(newPassword || '');

    if (!resetToken || !pw) {
      return res.status(400).json({ message: 'Thiếu mã đặt lại hoặc mật khẩu mới.' });
    }
    if (pw.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới tối thiểu 6 ký tự.' });
    }

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET || 'secret_key');
    } catch {
      return res.status(401).json({
        message: 'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng thử lại từ đầu.',
      });
    }

    if (payload.purpose !== 'pwd_reset' || !payload.userId) {
      return res.status(401).json({ message: 'Mã không hợp lệ cho thao tác này.' });
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
    }
    if (user.role === 'guest') {
      return res.status(403).json({
        message:
          'Tài khoản khách không đổi mật khẩu qua luồng này. Vui lòng đăng ký tài khoản đầy đủ.',
      });
    }

    user.passwordHash = await bcrypt.hash(pw, 10);
    await user.save();

    return res.json({
      message: 'Đặt mật khẩu mới thành công. Vui lòng đăng nhập bằng mật khẩu vừa đặt.',
    });
  } catch (err) {
    console.error('FORGOT SET PASSWORD ERROR:', err);
    return res.status(500).json({ message: err.message || 'Lỗi hệ thống.' });
  }
});

module.exports = router;