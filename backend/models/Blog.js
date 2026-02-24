const mongoose = require('mongoose');

const BlogSchema = new mongoose.Schema({
  tag:        { type: String, required: true },
  title:      { type: String, required: true },
  excerpt:    { type: String, required: true },
  content:    { type: String, default: '' },
  coverImage: { type: String, default: '' },
  author:     { type: String, default: 'HealthUp' },
  date:       { type: String },
  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('Blog', BlogSchema);