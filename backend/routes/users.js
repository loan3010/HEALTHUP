const router   = require('express').Router();
const bcrypt   = require('bcrypt');
const mongoose = require('mongoose');
const User     = require('../models/User');
const Order    = require('../models/Order');
const { authenticateToken } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: tính memberRank theo window 3 tháng
// VIP: tổng tiền đơn delivered (không return completed) trong 3 tháng gần nhất >= 2.000.000₫
// FIX: dùng createdAt thay vì updatedAt — đơn được tạo trong 3 tháng, không phải cập nhật
// ─────────────────────────────────────────────────────────────────────────────
async function calcMemberRank(userId) {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // Tổng chi tiêu trong 3 tháng → dùng để xét hạng
  const aggRecent = await Order.aggregate([
    {
      $match: {
        userId:       new mongoose.Types.ObjectId(String(userId)),
        status:       'delivered',
        returnStatus: { $ne: 'completed' },
        createdAt:    { $gte: threeMonthsAgo }   // FIX: createdAt thay vì updatedAt
      }
    },
    { $group: { _id: null, total: { $sum: '$total' } } }
  ]);
  const recentSpent = aggRecent[0]?.total || 0;
  const memberRank  = recentSpent >= 2_000_000 ? 'vip' : 'member';

  // Tổng chi tiêu toàn lịch sử → lưu vào DB để admin xem
  const aggAll = await Order.aggregate([
    {
      $match: {
        userId:       new mongoose.Types.ObjectId(String(userId)),
        status:       'delivered',
        returnStatus: { $ne: 'completed' }
      }
    },
    { $group: { _id: null, total: { $sum: '$total' } } }
  ]);
  const totalSpent = aggAll[0]?.total || 0;

  return { memberRank, totalSpent, recentSpent };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền truy cập' });
    }

    const user = await User.findById(req.params.id).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    const { memberRank, totalSpent, recentSpent } = await calcMemberRank(req.params.id);

    // Cập nhật DB nếu lệch (chạy ngầm, không block response)
    if (totalSpent !== (user.totalSpent || 0) || memberRank !== (user.memberRank || 'member')) {
      User.findByIdAndUpdate(req.params.id, { totalSpent, memberRank }).catch(() => {});
    }

    res.json({
      id:          String(user._id),
      username:    user.username,
      phone:       user.phone,
      email:       user.email   || '',
      dob:         user.dob     || '',
      gender:      user.gender  || 'male',
      address:     user.address || '',
      role:        user.role,
      memberRank,
      totalSpent,
      recentSpent,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/users/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền chỉnh sửa' });
    }

    const { username, email, phone, dob, gender, address } = req.body;

    if (username) {
      const exists = await User.findOne({ username, _id: { $ne: req.params.id } });
      if (exists) return res.status(409).json({ message: 'Tên tài khoản đã tồn tại' });
    }
    if (email) {
      const exists = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.params.id } });
      if (exists) return res.status(409).json({ message: 'Email đã tồn tại' });
    }

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
      message: 'Cập nhật thành công',
      user: {
        id:       String(updated._id),
        username: updated.username,
        phone:    updated.phone,
        email:    updated.email   || '',
        dob:      updated.dob     || '',
        gender:   updated.gender  || 'male',
        address:  updated.address || '',
        role:     updated.role,
      }
    });
  } catch (err) {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      const map   = { phone: 'Số điện thoại', email: 'Email', username: 'Tên tài khoản' };
      return res.status(409).json({ message: `${map[field] || field} đã tồn tại` });
    }
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/users/:id/change-password
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/:id/wishlist
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/wishlist', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền truy cập' });
    }

    const user = await User.findById(req.params.id)
      .populate('wishlist', 'name price oldPrice images cat badge')
      .lean();

    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    res.json({ wishlist: user.wishlist || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/users/:id/wishlist
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/wishlist', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Không có quyền' });
    }
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ message: 'Thiếu productId' });

    await User.findByIdAndUpdate(req.params.id, { $addToSet: { wishlist: productId } });
    res.json({ message: 'Đã thêm vào yêu thích' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/users/:id/wishlist/:productId
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id/wishlist/:productId', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Không có quyền' });
    }
    await User.findByIdAndUpdate(req.params.id, { $pull: { wishlist: req.params.productId } });
    res.json({ message: 'Đã xóa khỏi yêu thích' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// ADDRESS ROUTES
// ═══════════════════════════════════════════════════════

router.get('/:id/addresses', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền' });
    }
    const user = await User.findById(req.params.id).select('addresses').lean();
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
    res.json({ addresses: user.addresses || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/addresses', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Không có quyền' });
    }
    const { name, phone, address, isDefault } = req.body;
    if (!name || !phone || !address) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    if (isDefault) {
      user.addresses.forEach(a => a.isDefault = false);
    }

    const autoDefault = isDefault || user.addresses.length === 0;
    user.addresses.push({ name, phone, address, isDefault: autoDefault });
    await user.save();

    const newAddr = user.addresses[user.addresses.length - 1];
    res.status(201).json({ message: 'Đã thêm địa chỉ', address: newAddr });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/addresses/:addrId', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Không có quyền' });
    }
    const { name, phone, address, isDefault } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    const addr = user.addresses.id(req.params.addrId);
    if (!addr) return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });

    if (isDefault) user.addresses.forEach(a => a.isDefault = false);

    if (name)    addr.name    = name;
    if (phone)   addr.phone   = phone;
    if (address) addr.address = address;
    addr.isDefault = isDefault || false;

    await user.save();
    res.json({ message: 'Đã cập nhật địa chỉ', address: addr });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id/addresses/:addrId', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Không có quyền' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    user.addresses = user.addresses.filter(
      a => a._id.toString() !== req.params.addrId
    );

    if (user.addresses.length > 0 && !user.addresses.some(a => a.isDefault)) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    res.json({ message: 'Đã xóa địa chỉ' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id/addresses/:addrId/set-default', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Không có quyền' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    user.addresses.forEach(a => {
      a.isDefault = a._id.toString() === req.params.addrId;
    });

    await user.save();
    res.json({ message: 'Đã đặt làm địa chỉ mặc định' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;