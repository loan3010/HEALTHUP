const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');

// GET reviews by product
router.get('/product/:productId', async (req, res) => {
  try {
    const { filter, sort = 'newest', page = 1, limit = 10 } = req.query;

    // ✅ Cast sang ObjectId
    const productObjectId = new mongoose.Types.ObjectId(req.params.productId);

    let query = { productId: productObjectId };

    if (filter && filter !== 'all') {
      if (filter === 'photo') {
        query.imgs = { $exists: true, $ne: [] };
      } else {
        const ratingNum = Number(filter);
        if (!isNaN(ratingNum)) query.rating = ratingNum;
      }
    }

    let sortObj = {};
    switch (sort) {
      case 'highest': sortObj = { rating: -1 };  break;
      case 'lowest':  sortObj = { rating: 1 };   break;
      case 'helpful': sortObj = { helpful: -1 }; break;
      default:        sortObj = { createdAt: -1 };
    }

    const total = await Review.countDocuments({ productId: productObjectId });

    const reviews = await Review.find(query)
      .sort(sortObj)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    const allReviews = await Review.find({ productId: productObjectId }).lean();

    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalRating = 0;
    allReviews.forEach(r => {
      if (counts[r.rating] !== undefined) counts[r.rating]++;
      totalRating += r.rating;
    });
    const average = allReviews.length
      ? Number((totalRating / allReviews.length).toFixed(1))
      : 0;

    const photoCount = allReviews.filter(r => r.imgs && r.imgs.length > 0).length;

    const tagMap = {};
    allReviews.forEach(r => {
      (r.tags || []).forEach(tag => {
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      });
    });
    const praiseTags = Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    const product = await Product.findById(req.params.productId)
      .select('name sold weights packagingTypes')
      .lean();

    res.json({
      reviews,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      stats: { total, average, counts, praiseTags, photoCount },
      product: product ? {
        name:           product.name,
        sold:           product.sold,
        weights:        product.weights?.map(w => w.label) || [],
        packagingTypes: product.packagingTypes || [],
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create review
router.post('/', async (req, res) => {
  try {
    const review = new Review(req.body);
    await review.save();

    const productObjectId = new mongoose.Types.ObjectId(req.body.productId);
    const allReviews = await Review.find({ productId: productObjectId });
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await Product.findByIdAndUpdate(req.body.productId, {
      rating:      Math.round(avg * 10) / 10,
      reviewCount: allReviews.length,
    });

    res.status(201).json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH mark helpful
router.patch('/:id/helpful', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpful: 1 } },
      { new: true }
    ).lean();
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;