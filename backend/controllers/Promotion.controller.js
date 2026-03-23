const Promotion = require('../models/Promotion');
const User      = require('../models/User');

// --- 1. LẤY DANH SÁCH KHUYẾN MÃI ---
exports.getAllPromotions = async (req, res) => {
  try {
    const list = await Promotion.find().sort({ createdAt: -1 });
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách: " + error.message });
  }
};

// --- 2. TẠO MỚI KHUYẾN MÃI ---
exports.createPromotion = async (req, res) => {
  try {
    const newPromo = new Promotion(req.body);
    const savedPromo = await newPromo.save();
    res.status(201).json(savedPromo);
  } catch (error) {
    res.status(400).json({ message: "Không thể tạo mã: " + error.message });
  }
};

// --- 3. GOM NHÓM HÀNG LOẠT ---
exports.bulkGroupPromotions = async (req, res) => {
  try {
    const { ids, groupName } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: 'Danh sách ID không hợp lệ bà ơi!' });
    }
    await Promotion.updateMany(
      { _id: { $in: ids } },
      { $set: { groupName: groupName } }
    );
    res.status(200).json({ message: 'Đã gom nhóm thành công rực rỡ!' });
  } catch (error) {
    console.error('Lỗi gom nhóm hàng loạt:', error);
    res.status(500).json({ message: "Lỗi server khi gom nhóm: " + error.message });
  }
};

// --- 4. CẬP NHẬT KHUYẾN MÃI ---
exports.updatePromotion = async (req, res) => {
  try {
    const updated = await Promotion.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.status(200).json(updated);
  } catch (error) {
    res.status(400).json({ message: "Cập nhật thất bại: " + error.message });
  }
};

// --- 5. XÓA KHUYẾN MÃI ---
exports.deletePromotion = async (req, res) => {
  try {
    await Promotion.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Đã xóa khuyến mãi thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa: " + error.message });
  }
};