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
// 🔒 --- CORS Configuration (MUST BE BEFORE ROUTES) ---
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
        ];
        
        if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost')) {
            callback(null, true);
        } else {
            console.log('⚠️ Blocked origin:', origin);
            callback(null, true); // Allow all for now
        }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600 // Cache preflight for 10 minutes
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path}`, {
        body: req.body,
        query: req.query,
        origin: req.get('origin')
    });
    next();
});

// =================================================================
// 🗄️ --- MongoDB Connection ---
// =================================================================
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ FATAL ERROR: MONGODB_URI is not defined in environment variables!');
    console.error('Please set MONGODB_URI in your .env file or Render environment variables.');
    process.exit(1);
}

// Connection options
const mongooseOptions = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
};

// Connect to MongoDB
mongoose.connect(MONGODB_URI, mongooseOptions)
    .then(() => {
        console.log('✅ MongoDB connected successfully');
        console.log('📊 Database:', mongoose.connection.name);
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err.message);
        console.error('Full error:', err);
        process.exit(1);
    });

// Handle MongoDB connection events
mongoose.connection.on('error', err => {
    console.error('❌ MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
});

// =================================================================
// 📚 --- Data Schema and Models ---
// =================================================================

// Reply Schema
const replySchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: [true, 'Email is required for reply'],
        trim: true
    },
    text: { 
        type: String, 
        required: [true, 'Text is required for reply'],
        trim: true,
        minlength: [1, 'Reply text cannot be empty']
    },
    date: { 
        type: Date, 
        default: Date.now 
    }
}, { _id: true });

// Comment Schema
const commentSchema = new mongoose.Schema({
    contentId: { 
        type: String, 
        required: [true, 'Content ID is required'],
        index: true,
        trim: true
    },
    email: { 
        type: String, 
        required: [true, 'Email is required'],
        trim: true
    },
    text: { 
        type: String, 
        required: [true, 'Comment text is required'],
        trim: true,
        minlength: [1, 'Comment text cannot be empty']
    },
    date: { 
        type: Date, 
        default: Date.now 
    },
    replies: {
        type: [replySchema],
        default: []
    }
}, {
    timestamps: true,
    collection: 'comments'
});

// Create indexes for better performance
commentSchema.index({ contentId: 1, date: -1 });

const Comment = mongoose.model('Comment', commentSchema);

// =================================================================
// 🛣️ --- API Routes ---
// =================================================================

// Health check / Test route
app.get('/', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    res.json({ 
        message: 'ROTWAVE Comments API is running!',
        version: '1.0.0',
        database: dbStatus,
        timestamp: new Date().toISOString(),
        endpoints: {
            'GET /': 'API info (this page)',
            'GET /health': 'Health check',
            'GET /comments/:contentId': 'Get all comments for content',
            'POST /comments': 'Create a new comment',
            'DELETE /comments/:commentId': 'Delete a comment',
            'POST /comments/reply': 'Add a reply to a comment'
        }
    });
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check MongoDB connection
        const dbStatus = mongoose.connection.readyState === 1;
        
        if (!dbStatus) {
            return res.status(503).json({
                status: 'unhealthy',
                database: 'disconnected',
                timestamp: new Date().toISOString()
            });
        }

        // Try to count documents
        const commentCount = await Comment.countDocuments();
        
        res.json({
            status: 'healthy',
            database: 'connected',
            commentCount,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Health check error:', err);
        res.status(503).json({
            status: 'unhealthy',
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET - Fetch all comments for a specific content ID
app.get('/comments/:contentId', async (req, res) => {
    try {
        const { contentId } = req.params;
        console.log(`📥 Fetching comments for contentId: ${contentId}`);
        
        // Validate contentId
        if (!contentId || contentId.trim() === '') {
            return res.status(400).json({ 
                error: 'Content ID is required',
                contentId: contentId
            });
        }
        
        const comments = await Comment.find({ contentId: contentId.trim() })
            .sort({ date: -1 })
            .lean();
        
        console.log(`✅ Found ${comments.length} comments for ${contentId}`);
        res.json(comments);
    } catch (err) {
        console.error('❌ Error fetching comments:', err);
        res.status(500).json({ 
            error: 'Server error fetching comments',
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// POST - Create a new comment
app.post('/comments', async (req, res) => {
    try {
        console.log('📝 Received comment creation request:', req.body);
        
        const { contentId, email, text } = req.body;
        
        // Detailed validation
        const errors = [];
        if (!contentId) errors.push('contentId is required');
        if (!email) errors.push('email is required');
        if (!text) errors.push('text is required');
        
        if (errors.length > 0) {
            console.log('❌ Validation errors:', errors);
            return res.status(400).json({ 
                error: 'Missing required fields',
                details: errors,
                received: { contentId, email, text: text ? 'present' : 'missing' }
            });
        }
        
        // Check for empty text
        if (text.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Comment text cannot be empty'
            });
        }
        
        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            console.error('❌ Database not connected');
            return res.status(503).json({ 
                error: 'Database connection unavailable',
                status: 'Please try again in a moment'
            });
        }
        
        // Create new comment
        const newComment = new Comment({
            contentId: contentId.trim(),
            email: email.trim(),
            text: text.trim(),
            replies: []
        });
        
        console.log('💾 Attempting to save comment...');
        const savedComment = await newComment.save();
        console.log(`✅ Comment created successfully with ID: ${savedComment._id}`);
        
        res.status(201).json(savedComment);
    } catch (err) {
        console.error('❌ Error creating comment:', err);
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);
        
        // Handle validation errors specifically
        if (err.name === 'ValidationError') {
            const validationErrors = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ 
                error: 'Validation failed',
                details: validationErrors
            });
        }
        
        res.status(500).json({ 
            error: 'Server error creating comment',
            message: err.message,
            type: err.name,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// POST - Add a reply to a comment
app.post('/comments/reply', async (req, res) => {
    try {
        console.log('💬 Received reply creation request:', req.body);
        
        const { contentId, parentCommentId, email, text } = req.body;
        
        // Validation
        const errors = [];
        if (!parentCommentId) errors.push('parentCommentId is required');
        if (!email) errors.push('email is required');
        if (!text) errors.push('text is required');
        
        if (errors.length > 0) {
            console.log('❌ Validation errors:', errors);
            return res.status(400).json({ 
                error: 'Missing required fields',
                details: errors
            });
        }
        
        if (text.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Reply text cannot be empty'
            });
        }
        
        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ 
                error: 'Database connection unavailable'
            });
        }
        
        // Find the parent comment
        console.log(`🔍 Looking for comment: ${parentCommentId}`);
        const comment = await Comment.findById(parentCommentId);
        
        if (!comment) {
            console.log('❌ Parent comment not found');
            return res.status(404).json({ 
                error: 'Parent comment not found',
                parentCommentId
            });
        }
        
        // Add reply
        const reply = {
            email: email.trim(),
            text: text.trim(),
            date: new Date()
        };
        
        comment.replies.push(reply);
        const updatedComment = await comment.save();
        
        console.log(`✅ Reply added to comment ${parentCommentId}`);
        res.status(201).json(updatedComment);
    } catch (err) {
        console.error('❌ Error adding reply:', err);
        
        // Handle cast errors (invalid ObjectId)
        if (err.name === 'CastError') {
            return res.status(400).json({ 
                error: 'Invalid comment ID format',
                message: err.message
            });
        }
        
        res.status(500).json({ 
            error: 'Server error adding reply',
            message: err.message,
            type: err.name
        });
    }
});

// DELETE - Delete a comment by ID
app.delete('/comments/:commentId', async (req, res) => {
    try {
        const { commentId } = req.params;
        
        console.log(`🗑️ Attempting to delete comment: ${commentId}`);
        
        // Check database connection
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ 
                error: 'Database connection unavailable'
            });
        }
        
        const deletedComment = await Comment.findByIdAndDelete(commentId);
        
        if (!deletedComment) {
            console.log('❌ Comment not found for deletion');
            return res.status(404).json({ 
                error: 'Comment not found',
                commentId
            });
        }
        
        console.log(`✅ Comment deleted: ${commentId}`);
        res.json({ 
            message: 'Comment deleted successfully',
            deletedComment 
        });
    } catch (err) {
        console.error('❌ Error deleting comment:', err);
        
        // Handle cast errors (invalid ObjectId)
        if (err.name === 'CastError') {
            return res.status(400).json({ 
                error: 'Invalid comment ID format',
                message: err.message
            });
        }
        
        res.status(500).json({ 
            error: 'Server error deleting comment',
            message: err.message,
            type: err.name
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
            'GET /health': 'Health check',
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
    console.error('❌ Global error handler triggered:', err);
    console.error('Error stack:', err.stack);
    
    res.status(err.status || 500).json({ 
        error: 'Internal server error',
        message: err.message,
        type: err.name,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
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
║  🗄️  MongoDB: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Connecting...'}                    ║
║  🌐 CORS: Enabled                          ║
║  📝 Logging: Active                        ║
╚════════════════════════════════════════════╝
    `);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during shutdown:', err);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...');
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during shutdown:', err);
        process.exit(1);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
