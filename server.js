// =================================================================
// ⚙️ --- Basic Setup and Middleware ---
// =================================================================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();

// Middleware
app.use(express.json()); // Body parser for JSON requests
app.use(cors()); // Enable CORS for all origins

// =================================================================
// 💾 --- Connect to MongoDB ---
// =================================================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// =================================================================
// 📝 --- Comment Schema and Model ---
// =================================================================
const commentSchema = new mongoose.Schema({
    contentId: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: false, // Assuming email is optional or handled by the client prompt
        default: 'Guest'
    },
    text: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const Comment = mongoose.model('Comment', commentSchema);

// =================================================================
// 🛣️ --- Routes ---
// =================================================================

// Root route for testing
app.get('/', (req, res) => {
    res.json({ message: 'Wave Backend API is running!' });
});

// GET: Get all comments for a specific content ID
app.get('/:contentId', async (req, res) => {
    try {
        const comments = await Comment.find({ contentId: req.params.contentId }).sort({ date: -1 });
        res.json(comments);
    } catch (err) {
        console.error('Error fetching comments:', err.message);
        res.status(500).json({ error: 'Server error fetching comments.' });
    }
});

// POST: Post a new comment
app.post('/', async (req, res) => {
    try {
        const { contentId, email, text } = req.body;

        if (!contentId || !text) {
            return res.status(400).json({ error: 'Missing contentId or text in request body.' });
        }

        const newComment = new Comment({ contentId, email, text });
        await newComment.save();

        res.status(201).json(newComment); // Use 201 for resource creation

    } catch (err) {
        console.error('Error posting comment:', err.message);
        res.status(500).json({ error: 'Server error posting comment.' });
    }
});

// DELETE: Delete a comment by ID
app.delete('/:commentId', async (req, res) => {
    try {
        // Note: In a real application, you'd add authentication/authorization here
        // to ensure only the owner or an admin can delete the comment.

        const result = await Comment.findByIdAndDelete(req.params.commentId);

        if (!result) {
            return res.status(404).json({ error: 'Comment not found with the provided ID.' });
        }

        res.json({ message: 'Comment deleted successfully', deletedComment: result });
    } catch (err) {
        console.error('Error deleting comment:', err.message);
        // Check for invalid ID format (CastError)
        if (err.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid comment ID format.' });
        }
        res.status(500).json({ error: 'Server error deleting comment.' });
    }
});

// =================================================================
// 🚀 --- Start Server ---
// =================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
