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
// 🔒 --- CORS Configuration ---
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
            'https://rotwave.vercel.app',
            'https://wave-backend-umi8.onrender.com',
            'https://wave-backend-umi8.onrender.com/comments',
        ];
        
        if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost')) {
            callback(null, true);
        } else {
            console.log('Blocked origin:', origin);
            callback(null, true); // Allow all for now (change to false in production)
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// =================================================================
// 🗄️ --- MongoDB Connection ---
// =================================================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://RookieWI:Rich1234@cluster0.bp6qycl.mongodb.net/?retryWrites=true&w=maojority&appName=Cluster0';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

// =================================================================
// 📚 --- Data Schema and Models ---
// =================================================================

// Reply Schema
const replySchema = new mongoose.Schema({
    email: { type: String, required: true },
    text: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

// Comment Schema
const commentSchema = new mongoose.Schema({
    contentId: { type: String, required: true, index: true },
    email: { type: String, required: true },
    text: { type: String, required: true },
    date: { type: Date, default: Date.now },
    replies: [replySchema]
});

const Comment = mongoose.model('Comment', commentSchema);

// =================================================================
// 🛣️ --- API Routes ---
// =================================================================

// Test route
app.get('/', (req, res) => {
    res.json({ 
        message: 'ROTWAVE Comments API is running!',
        version: '1.0.0',
        endpoints: {
            'GET /comments/:contentId': 'Get all comments for content',
            'POST /comments': 'Create a new comment',
            'DELETE /comments/:commentId': 'Delete a comment',
            'POST /comments/reply': 'Add a reply to a comment'
        }
    });
});

// GET - Fetch all comments for a specific content ID
app.get('/comments/:contentId', async (req, res) => {
    try {
        const { contentId } = req.params;
        console.log(`📥 Fetching comments for contentId: ${contentId}`);
        
        const comments = await Comment.find({ contentId }).sort({ date: -1 });
        
        console.log(`✅ Found ${comments.length} comments for ${contentId}`);
        res.json(comments);
    } catch (err) {
        console.error('❌ Error fetching comments:', err.message);
        res.status(500).json({ 
            error: 'Server error fetching comments',
            details: err.message 
        });
    }
});

// POST - Create a new comment
app.post('/comments', async (req, res) => {
    try {
        const { contentId, email, text } = req.body;
        
        console.log(`📝 Creating comment for contentId: ${contentId}, email: ${email}`);
        
        // Validation
        if (!contentId || !email || !text) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['contentId', 'email', 'text']
            });
        }
        
        if (text.trim().length === 0) {
            return res.status(400).json({ error: 'Comment text cannot be empty' });
        }
        
        // Create new comment
        const newComment = new Comment({
            contentId,
            email,
            text: text.trim(),
            replies: []
        });
        
        await newComment.save();
        console.log(`✅ Comment created with ID: ${newComment._id}`);
        
        res.status(201).json(newComment);
    } catch (err) {
        console.error('❌ Error creating comment:', err.message);
        res.status(500).json({ 
            error: 'Server error creating comment',
            details: err.message 
        });
    }
});

// POST - Add a reply to a comment
app.post('/comments/reply', async (req, res) => {
    try {
        const { contentId, parentCommentId, email, text } = req.body;
        
        console.log(`💬 Adding reply to comment: ${parentCommentId}`);
        
        // Validation
        if (!parentCommentId || !email || !text) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['parentCommentId', 'email', 'text']
            });
        }
        
        if (text.trim().length === 0) {
            return res.status(400).json({ error: 'Reply text cannot be empty' });
        }
        
        // Find the parent comment
        const comment = await Comment.findById(parentCommentId);
        
        if (!comment) {
            return res.status(404).json({ error: 'Parent comment not found' });
        }
        
        // Add reply
        const reply = {
            email,
            text: text.trim(),
            date: new Date()
        };
        
        comment.replies.push(reply);
        await comment.save();
        
        console.log(`✅ Reply added to comment ${parentCommentId}`);
        res.status(201).json(comment);
    } catch (err) {
        console.error('❌ Error adding reply:', err.message);
        res.status(500).json({ 
            error: 'Server error adding reply',
            details: err.message 
        });
    }
});

// DELETE - Delete a comment by ID
app.delete('/comments/:commentId', async (req, res) => {
    try {
        const { commentId } = req.params;
        
        console.log(`🗑️ Deleting comment: ${commentId}`);
        
        const deletedComment = await Comment.findByIdAndDelete(commentId);
        
        if (!deletedComment) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        console.log(`✅ Comment deleted: ${commentId}`);
        res.json({ 
            message: 'Comment deleted successfully',
            deletedComment 
        });
    } catch (err) {
        console.error('❌ Error deleting comment:', err.message);
        res.status(500).json({ 
            error: 'Server error deleting comment',
            details: err.message 
        });
    }
});

// =================================================================
// 🚫 --- 404 Handler ---
// =================================================================
app.use((req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        availableEndpoints: {
            'GET /': 'API info',
            'GET /comments/:contentId': 'Get comments',
            'POST /comments': 'Create comment',
            'DELETE /comments/:commentId': 'Delete comment',
            'POST /comments/reply': 'Add reply'
        }
    });
});

// =================================================================
// ⚠️ --- Global Error Handler ---
// =================================================================
app.use((err, req, res, next) => {
    console.error('❌ Global error handler:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// =================================================================
// 🚀 --- Start Server ---
// =================================================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║  🚀 ROTWAVE Comments API Server Running   ║
║  📍 Port: ${PORT}                           ║
║  🗄️  MongoDB: Connected                    ║
║  🌐 CORS: Enabled                          ║
╚════════════════════════════════════════════╝
    `);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
});


