const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Notification = require('../models/Notification');

/** Phải trùng auth.js / consulting — nếu thiếu env, verify không lỗi. */
function jwtSecret() {
  return process.env.JWT_SECRET || 'secret_key';
}

function getUserId(req) {
  const fromHeader = req.header('x-user-id');
  if (fromHeader) return fromHeader;

  if (req.query.userId) return req.query.userId;

  const auth = req.header('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const token = auth.slice(7);
      const decoded = jwt.verify(token, jwtSecret());
      const uid = decoded._id || decoded.id || decoded.userId;
      return uid != null ? String(uid) : null;
    } catch {
      return null;
    }
  }

  return null;
}

// GET — lấy thông báo của user
router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST — tạo thông báo mới
router.post('/', async (req, res) => {
  try {
    const { userId, type, title, message, link, icon } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });

    const noti = await Notification.create({
      userId, type, title, message,
      link: link || '',
      icon: icon || '🔔',
    });

    res.status(201).json(noti);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH read-all — PHẢI đặt TRƯỚC /:id/read
router.patch('/read-all', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });

    await Notification.updateMany({ userId, isRead: false }, { isRead: true });
    res.json({ message: 'ok' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH — đánh dấu 1 thông báo đã đọc
router.patch('/:id/read', async (req, res) => {
  try {
    const noti = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!noti) return res.status(404).json({ message: 'Not found' });
    res.json(noti);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ DELETE — xóa tất cả thông báo của user (PHẢI đặt TRƯỚC /:id)
router.delete('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ message: 'userId invalid' });

    await Notification.deleteMany({ userId });
    res.json({ message: 'ok' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ DELETE — xóa 1 thông báo
router.delete('/:id', async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: 'ok' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;