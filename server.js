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

// =================================================================
// 🔒 --- CORS Configuration (UPDATED FOR GOOGLE SIGN-IN) ---
// =================================================================
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // List of allowed origins
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'https://rookie973-s.github.io',
            'https://accounts.google.com',
            // Add your production domain here
            // 'https://yourdomain.com'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost')) {
            callback(null, true);
        } else {
            console.log('Blocked origin:', origin);
            callback(null, true); // Still allow for development, change to false in production
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json()); // Body parser for JSON requests

// =================================================================
// 💾 --- Connect to MongoDB ---
// =================================================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// =================================================================
// 📝 --- Comment Schema and Model ---
// =================================================================
const replySchema = new mongoose.Schema({
    email: {
        type: String,
        required: false,
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

const commentSchema = new mongoose.Schema({
    contentId: {
        type: String,
        required: true,
        index: true // Added index for better query performance
    },
    email: {
        type: String,
        required: false,
        default: 'Guest'
    },
    text: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    replies: [replySchema]
});

const Comment = mongoose.model('Comment', commentSchema);

// =================================================================
// 🛡️ --- Security Headers Middleware ---
// =================================================================
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// =================================================================
// 📊 --- Logging Middleware (Optional but helpful) ---
// =================================================================
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// =================================================================
// 🛣️ --- Routes ---
// =================================================================

// Root route for testing
app.get('/', (req, res) => {
    res.json({ 
        message: 'Wave Backend API is running!',
        version: '1.0.0',
        endpoints: {
            'GET /:contentId': 'Get comments for content',
            'POST /': 'Create new comment',
            'DELETE /:commentId': 'Delete comment',
            'POST /reply': 'Add reply to comment',
            'DELETE /reply/:commentId/:replyId': 'Delete reply'
        }
    });
});

// GET: Get all comments for a specific content ID
app.get('/:contentId', async (req, res) => {
    try {
        const { contentId } = req.params;
        
        if (!contentId) {
            return res.status(400).json({ error: 'Content ID is required.' });
        }

        const comments = await Comment.find({ contentId }).sort({ date: -1 });
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

        // Validation
        if (!contentId || !text) {
            return res.status(400).json({ 
                error: 'Missing required fields.',
                required: ['contentId', 'text']
            });
        }

        if (text.trim().length === 0) {
            return res.status(400).json({ error: 'Comment text cannot be empty.' });
        }

        if (text.length > 1000) {
            return res.status(400).json({ error: 'Comment text too long (max 1000 characters).' });
        }

        const newComment = new Comment({ 
            contentId, 
            email: email || 'Guest', 
            text: text.trim() 
        });
        
        await newComment.save();

        console.log(`✅ New comment created for ${contentId} by ${email || 'Guest'}`);
        res.status(201).json(newComment);

    } catch (err) {
        console.error('Error posting comment:', err.message);
        res.status(500).json({ error: 'Server error posting comment.' });
    }
});

// DELETE: Delete a comment by ID
app.delete('/:commentId', async (req, res) => {
    try {
        const { commentId } = req.params;

        // In production, add authentication check here:
        // const userEmail = req.headers['x-user-email'];
        // Verify the user owns this comment before deleting

        const result = await Comment.findByIdAndDelete(commentId);

        if (!result) {
            return res.status(404).json({ error: 'Comment not found.' });
        }

        console.log(`🗑️ Comment deleted: ${commentId}`);
        res.json({ 
            message: 'Comment deleted successfully', 
            deletedComment: result 
        });
    } catch (err) {
        console.error('Error deleting comment:', err.message);
        
        if (err.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid comment ID format.' });
        }
        
        res.status(500).json({ error: 'Server error deleting comment.' });
    }
});

// POST: Add a reply to a comment
app.post('/reply', async (req, res) => {
    try {
        const { contentId, parentCommentId, email, text } = req.body;

        // Validation
        if (!contentId || !parentCommentId || !text) {
            return res.status(400).json({ 
                error: 'Missing required fields.',
                required: ['contentId', 'parentCommentId', 'text']
            });
        }

        if (text.trim().length === 0) {
            return res.status(400).json({ error: 'Reply text cannot be empty.' });
        }

        if (text.length > 500) {
            return res.status(400).json({ error: 'Reply text too long (max 500 characters).' });
        }

        const comment = await Comment.findById(parentCommentId);
        
        if (!comment) {
            return res.status(404).json({ error: 'Parent comment not found.' });
        }

        const newReply = {
            email: email || 'Guest',
            text: text.trim(),
            date: new Date()
        };

        comment.replies.push(newReply);
        await comment.save();

        console.log(`💬 Reply added to comment ${parentCommentId} by ${email || 'Guest'}`);
        res.status(201).json(comment);

    } catch (err) {
        console.error('Error posting reply:', err.message);
        
        if (err.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid comment ID format.' });
        }
        
        res.status(500).json({ error: 'Server error posting reply.' });
    }
});

// DELETE: Delete a reply from a comment
app.delete('/reply/:commentId/:replyId', async (req, res) => {
    try {
        const { commentId, replyId } = req.params;

        const comment = await Comment.findById(commentId);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found.' });
        }

        const replyIndex = comment.replies.findIndex(r => r._id.toString() === replyId);
        
        if (replyIndex === -1) {
            return res.status(404).json({ error: 'Reply not found.' });
        }

        comment.replies.splice(replyIndex, 1);
        await comment.save();

        console.log(`🗑️ Reply deleted from comment ${commentId}`);
        res.json({ 
            message: 'Reply deleted successfully', 
            comment 
        });

    } catch (err) {
        console.error('Error deleting reply:', err.message);
        
        if (err.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid ID format.' });
        }
        
        res.status(500).json({ error: 'Server error deleting reply.' });
    }
});

// =================================================================
// 🚫 --- 404 Handler ---
// =================================================================
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.path,
        method: req.method
    });
});

// =================================================================
// ⚠️ --- Global Error Handler ---
// =================================================================
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// =================================================================
// 🚀 --- Start Server ---
// =================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 CORS enabled for multiple origins`);
});
