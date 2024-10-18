const express = require('express');
const multer = require('multer');
const cors = require('cors');
const morgan = require('morgan');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); // Enable CORS for all routes
app.use(morgan('combined')); // Log requests

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Set up multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Example route for registration
app.post('/submit', upload.single('image'), (req, res) => {
    const { name, id } = req.body;
    // Here, implement the logic to save user data in Google Sheets
    // For now, let's just log the received data
    console.log(`Name: ${name}, ID: ${id}, Image: ${req.file}`);
    
    // Simulate success response
    res.json({ success: true });
});

// Example route to get user data from Google Sheets
app.get('/getUserData', async (req, res) => {
    const { id } = req.query;
    // Implement the logic to get user data from Google Sheets
    res.json({ name: 'John Doe', id });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

