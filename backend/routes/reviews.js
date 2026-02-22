const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Product = require('../models/Product');

// GET reviews by product
router.get('/product/:productId', async (req, res) => {
  try {
    const { filter, sort = 'newest', page = 1, limit = 10 } = req.query;
    let query = { productId: req.params.productId };

    if (filter && filter !== 'all') {
      if (filter === 'photo') {
        query.imgs = { $exists: true, $not: { $size: 0 } };
      } else {
        query.rating = Number(filter);
      }
    }

    let sortObj = {};
    switch (sort) {
      case 'highest': sortObj = { rating: -1 }; break;
      case 'lowest':  sortObj = { rating: 1 }; break;
      case 'helpful': sortObj = { helpful: -1 }; break;
      default:        sortObj = { createdAt: -1 };
    }

    const total = await Review.countDocuments(query);
    const reviews = await Review.find(query)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Rating distribution
    const allReviews = await Review.find({ productId: req.params.productId });
    const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalRating = 0;
    allReviews.forEach(r => {
      ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
      totalRating += r.rating;
    });
    const average = allReviews.length ? (totalRating / allReviews.length).toFixed(1) : 0;
    const photoCount = allReviews.filter(r => r.imgs && r.imgs.length > 0).length;

    res.json({
      reviews,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      ratingCounts,
      averageRating: Number(average),
      photoReviewCount: photoCount
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

    // Update product rating
    const allReviews = await Review.find({ productId: req.body.productId });
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await Product.findByIdAndUpdate(req.body.productId, {
      rating: Math.round(avg * 10) / 10,
      reviewCount: allReviews.length
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
    );
    res.json(review);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;