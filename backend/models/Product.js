const mongoose = require('mongoose');

const NutritionSchema = new mongoose.Schema({
  name: String,
  value: String,
  percent: Number
});

const WeightOptionSchema = new mongoose.Schema({
  label: String,
  outOfStock: { type: Boolean, default: false }
});

const ProductSchema = new mongoose.Schema({
  images: [String],
  name: { type: String, required: true },
  cat: { type: String, required: true },
  rating: { type: Number, default: 0 },
  starsDisplay: String,
  reviewCount: { type: Number, default: 0 },
  sold: { type: Number, default: 0 },
  price: { type: Number, required: true },
  oldPrice: Number,
  saving: String,
  shortDesc: String,
  description: String,
  stock: { type: Number, default: 100 },
  weights: [WeightOptionSchema],
  packagingTypes: [String],
  nutrition: [NutritionSchema],
  badge: { type: String, enum: ['new', 'hot', null] },
  sale: String,
  weight: String,
  stars: String,
  reviews: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', ProductSchema);