const express = require('express');
const mongoose = require('mongoose');
const AdminNotification = require('../models/AdminNotification');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { serializeNotification } = require('../services/adminNotificationService');

const router = express.Router();

/** Chỉ lấy thông báo trong 7 ngày (khớp TTL; tránh list quá dài). */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// GET danh sách + số chưa đọc
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const since = new Date(Date.now() - MAX_AGE_MS);
    const [rows, unreadCount] = await Promise.all([
      AdminNotification.find({ createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      AdminNotification.countDocuments({ createdAt: { $gte: since }, isRead: false }),
    ]);
    res.json({
      notifications: rows.map((r) => serializeNotification(r)),
      unreadCount,
    });
  } catch (err) {
    console.error('admin-notifications GET:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Đánh dấu tất cả đã đọc — đặt trước route :id
router.patch('/read-all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await AdminNotification.updateMany({ isRead: false }, { $set: { isRead: true } });
    res.json({ ok: true });
  } catch (err) {
    console.error('admin-notifications read-all:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/read', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID không hợp lệ' });
    }
    const row = await AdminNotification.findByIdAndUpdate(
      id,
      { $set: { isRead: true } },
      { new: true }
    ).lean();
    if (!row) return res.status(404).json({ message: 'Không tìm thấy' });
    res.json({ notification: serializeNotification(row) });
  } catch (err) {
    console.error('admin-notifications read one:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
