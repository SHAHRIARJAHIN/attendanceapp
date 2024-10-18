const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const QRCode = require('qrcode');
const app = express();

const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.post('/submit', upload.single('image'), (req, res) => {
    const { name, id } = req.body;
    // Save user data in Google Sheets
    res.json({ success: true });
});

app.get('/getUserData', (req, res) => {
    const { id } = req.query;
    // Retrieve user data from Google Sheets
    res.json({ name: 'John Doe', id });
});

app.listen(3000, () => console.log('Server running on port 3000'));
