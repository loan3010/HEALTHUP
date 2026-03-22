/**
 * Proxy địa giới hành chính VN (provinces.open-api.vn) để tránh CORS từ trình duyệt.
 * Admin dùng khi tạo đơn hotline — chỉ đọc, không lưu DB.
 */
const express = require('express');

const router = express.Router();
const OPEN_API = 'https://provinces.open-api.vn/api';

async function forward(pathAndQuery) {
  const url = `${OPEN_API}${pathAndQuery}`;
  const r = await fetch(url);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `HTTP ${r.status}`);
  }
  return r.json();
}

// Danh sách tỉnh/thành
router.get('/p', async (req, res) => {
  try {
    const data = await forward('/p/');
    res.json(data);
  } catch (e) {
    res.status(502).json({ message: e.message || 'Không tải được danh sách tỉnh' });
  }
});

// Một tỉnh + quận/huyện (depth=2)
router.get('/p/:code', async (req, res) => {
  try {
    const code = encodeURIComponent(req.params.code);
    const data = await forward(`/p/${code}?depth=2`);
    res.json(data);
  } catch (e) {
    res.status(502).json({ message: e.message || 'Không tải được quận/huyện' });
  }
});

// Một quận/huyện + phường/xã (depth=2)
router.get('/d/:code', async (req, res) => {
  try {
    const code = encodeURIComponent(req.params.code);
    const data = await forward(`/d/${code}?depth=2`);
    res.json(data);
  } catch (e) {
    res.status(502).json({ message: e.message || 'Không tải được phường/xã' });
  }
});

module.exports = router;
