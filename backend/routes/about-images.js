// backend/routes/about-images.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Cấu hình multer lưu vào public/images/about-the-brand/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/images/about-the-brand'));
  },
  filename: (req, file, cb) => {
    const key = req.params.key;
    const ext = path.extname(file.originalname);
    cb(null, `${key}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file ảnh'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// GET /api/about-images — trả về danh sách URL hình
router.get('/', (req, res) => {
  const dir = path.join(__dirname, '../public/images/about-the-brand');
  const base = `${req.protocol}://${req.get('host')}`;

  const keys = ['hero', 'story', 'dist1', 'dist2', 'dist3', 'dist4'];
  const exts = ['.jpg', '.jpeg', '.png', '.webp'];

  const images = {};
  keys.forEach(key => {
    let found = null;
    for (const ext of exts) {
      const filePath = path.join(dir, `${key}${ext}`);
      if (fs.existsSync(filePath)) {
        found = `${base}/images/about-the-brand/${key}${ext}`;
        break;
      }
    }
    images[key] = found;
  });

  res.json({ success: true, images });
});

// POST /api/about-images/upload/:key — admin upload hình mới
router.post('/upload/:key', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Không có file' });

  const base = `${req.protocol}://${req.get('host')}`;
  const url = `${base}/images/about-the-brand/${req.file.filename}`;

  res.json({ success: true, key: req.params.key, url });
});

module.exports = router;