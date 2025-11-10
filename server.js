// --- Basic setup ---
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// --- Connect to MongoDB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// --- Comment Schema ---
const commentSchema = new mongoose.Schema({
  contentId: String,   // which article/post this comment belongs to
  email: String,       // commenter email
  text: String,        // comment body
  date: { type: Date, default: Date.now }
});

const Comment = mongoose.model('Comment', commentSchema);

// --- Routes ---

// Get all comments for a specific content ID
app.get('/api/comments/:contentId', async (req, res) => {
  try {
    const comments = await Comment.find({ contentId: req.params.contentId }).sort({ date: -1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Post a new comment
app.post('/api/comments', async (req, res) => {
  try {
    const { contentId, email, text } = req.body;
    if (!contentId || !text) {
      return res.status(400).json({ error: 'Missing data' });
    }
    const newComment = new Comment({ contentId, email, text });
    await newComment.save();
    res.json(newComment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Start Server ---
app.listen(5000, () => console.log('Server running on port 5000'));