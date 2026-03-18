const router = require('express').Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// ─────────────────────────────────────────
// GET /api/users/:id  →  Lấy thông tin user
// ─────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // Chỉ cho phép user xem chính mình (hoặc admin)
    if (req.user.userId !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền truy cập' });
    }

    const user = await User.findById(req.params.id).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    res.json({
      id:       String(user._id),
      username: user.username,
      phone:    user.phone,
      email:    user.email || '',
      dob:      user.dob || '',
      gender:   user.gender || 'male',
      address:  user.address || '',
      role:     user.role,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────
// PUT /api/users/:id  →  Cập nhật thông tin profile
// ─────────────────────────────────────────────────
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // Chỉ cho phép user sửa chính mình (hoặc admin)
    if (req.user.userId !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền chỉnh sửa' });
    }

    const { username, email, phone, dob, gender, address } = req.body;

    // Kiểm tra username trùng (nếu đổi)
    if (username) {
      const exists = await User.findOne({
        username,
        _id: { $ne: req.params.id }
      });
      if (exists) return res.status(409).json({ message: 'Tên tài khoản đã tồn tại' });
    }

    // Kiểm tra email trùng (nếu đổi)
    if (email) {
      const exists = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: req.params.id }
      });
      if (exists) return res.status(409).json({ message: 'Email đã tồn tại' });
    }

    // Chỉ update các field được phép — không cho đổi password/role ở đây
    const updateData = {};
    if (username !== undefined) updateData.username = username.trim();
    if (email     !== undefined) updateData.email    = email.trim().toLowerCase();
    if (phone     !== undefined) updateData.phone    = phone.trim();
    if (dob       !== undefined) updateData.dob      = dob;
    if (gender    !== undefined) updateData.gender   = gender;
    if (address   !== undefined) updateData.address  = address.trim();

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-passwordHash').lean();

    if (!updated) return res.status(404).json({ message: 'Không tìm thấy user' });

    res.json({
      message:  'Cập nhật thành công',
      user: {
        id:       String(updated._id),
        username: updated.username,
        phone:    updated.phone,
        email:    updated.email || '',
        dob:      updated.dob || '',
        gender:   updated.gender || 'male',
        address:  updated.address || '',
        role:     updated.role,
      }
    });
  } catch (err) {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      const map = { phone: 'Số điện thoại', email: 'Email', username: 'Tên tài khoản' };
      return res.status(409).json({ message: `${map[field] || field} đã tồn tại` });
    }
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────
// PUT /api/users/:id/change-password  →  Đổi mật khẩu
// ─────────────────────────────────────────────────
router.put('/:id/change-password', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Không có quyền' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Thiếu mật khẩu' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;