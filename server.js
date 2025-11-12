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
// 🔒 --- CORS Configuration (UPDATED FOR GOOGLE SIGN-IN AND FRONTEND) ---
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
            'https://rotwave.vercel.app', // <-- ADDED YOUR VERCEL FRONTEND HERE
        ];
        
        if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost')) {
            callback(null, true);
        } else {
            console.log('Blocked origin:', origin);
            // **SECURITY NOTE**: For production, change this to 'callback(new Error('Not allowed by CORS'));'
            callback(null, true); 
        }
    },
    // Ensure all necessary methods and credentials are allowed
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json()); // Middleware to parse JSON bodies

// Assumed imports and configuration for MongoDB connection
// You should have MONGODB_URI defined in your .env file
// mongoose.connect(process.env.MONGODB_URI)
//     .then(() => console.log('✅ MongoDB connected'))
//     .catch(err => console.error('❌ MongoDB connection error:', err));


// =================================================================
// 📚 --- Data Schema and Models (Example) ---
// =================================================================

// This is likely where your mongoose models (e.g., CommentSchema, ReplySchema) are defined
// Assuming your models are correctly defined and imported/required here.

// =================================================================
// 🛣️ --- Routes (Assuming /comments, /reply, /like, /delete-comment, /delete-reply) ---
// =================================================================

// Placeholder for your routes, which were not provided but are necessary
// for the application to function. E.g.:

/*
app.get('/:contentId', async (req, res) => {
    // Logic to fetch comments for a specific contentId
});

app.post('/comment', async (req, res) => {
    // Logic to create a new comment
});
*/
app.get('/:contentId', async (req, res) => {
    try {
        const comments = await Comment.find({ contentId: req.params.contentId }).sort({ date: -1 });
        res.json(comments);
    } catch (err) {
        console.error('Error fetching comments:', err.message);
        res.status(500).json({ error: 'Server error fetching comments.' });
    }
});
// [ ... Assume all previous route definitions are here ... ]

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
    // console.log(`📍 Environment: ${process.env... (Truncated in snippet)
});

