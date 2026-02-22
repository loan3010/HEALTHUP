const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// GET all products with filters
router.get('/', async (req, res) => {
  try {
    const { cat, minPrice, maxPrice, sort, badge, page = 1, limit = 9 } = req.query;
    let query = {};

    if (cat) query.cat = { $in: cat.split(',') };
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (badge) query.badge = badge;

    let sortObj = {};
    switch (sort) {
      case 'price-asc':  sortObj = { price: 1 }; break;
      case 'price-desc': sortObj = { price: -1 }; break;
      case 'newest':     sortObj = { createdAt: -1 }; break;
      case 'rating':     sortObj = { rating: -1 }; break;
      default:           sortObj = { sold: -1 };
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ products, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET featured/bestsellers
router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({}).sort({ sold: -1 }).limit(4);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET related products
router.get('/:id/related', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    const related = await Product.find({ cat: product.cat, _id: { $ne: product._id } }).limit(4);
    res.json(related);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create product
router.post('/', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;