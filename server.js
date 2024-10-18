const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
const pdf = require('pdfkit');
const qr = require('qrcode'); // To generate QR codes
const { promisify } = require('util');

// Initialize the app
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for your HTML, CSS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Google Sheets API Setup
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const sheets = google.sheets('v4');
const SPREADSHEET_ID = 'your-google-sheet-id-here'; // Replace with your Google Sheet ID

// Multer configuration for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Helper to authenticate with Google Sheets API
async function authorize() {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json', // Path to your credentials.json file
    scopes: SCOPES
  });
  return await auth.getClient();
}

// Route: Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html')); // Main homepage or redirect to registration form
});

// Route: Registration form (Submit form data)
app.post('/register', upload.single('photo'), async (req, res) => {
  const { name, position } = req.body;
  const photoPath = req.file.path;

  // Generate a 6-digit ID number
  const idNumber = Math.floor(100000 + Math.random() * 900000).toString();

  // Add registration data to Google Sheets
  const authClient = await authorize();
  const request = {
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A1', // Modify to match your sheet and range
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    resource: {
      values: [[name, position, idNumber, photoPath]]
    },
    auth: authClient
  };

  try {
    await sheets.spreadsheets.values.append(request);
    res.json({ success: true, idNumber });
  } catch (error) {
    console.error('Error adding to Google Sheets:', error);
    res.status(500).send('Error saving registration data');
  }
});

// Route: Download ID Card as PDF
app.get('/download-id/:id', async (req, res) => {
  const idNumber = req.params.id;
  // Get the data from Google Sheets (like name, position, photo)
  const authClient = await authorize();
  const request = {
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A:D', // Modify to match your sheet and range
    auth: authClient
  };

  try {
    const response = await sheets.spreadsheets.values.get(request);
    const rows = response.data.values;
    const row = rows.find(row => row[2] === idNumber);
    
    if (row) {
      const [name, position, , photoPath] = row;

      // Generate QR Code
      const qrCodeData = await promisify(qr.toDataURL)(idNumber);

      // Generate PDF
      const doc = new pdf();
      const filePath = `uploads/${idNumber}_id_card.pdf`;
      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);
      doc.image('path-to-your-id-template-image', 0, 0, { width: 600 });
      doc.text(`Name: ${name}`, 150, 150);
      doc.text(`Position: ${position}`, 150, 180);
      doc.text(`ID: ${idNumber}`, 150, 210);
      doc.image(qrCodeData, 150, 250, { width: 100 });
      doc.end();

      writeStream.on('finish', () => {
        res.download(filePath);
      });
    } else {
      res.status(404).send('ID not found');
    }
  } catch (error) {
    console.error('Error fetching from Google Sheets:', error);
    res.status(500).send('Error generating ID card');
  }
});

// Route: Bulk PDF Generation for Admin
app.get('/generate-bulk-id-cards', async (req, res) => {
  const authClient = await authorize();
  const request = {
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A:D', // Modify to match your sheet and range
    auth: authClient
  };

  try {
    const response = await sheets.spreadsheets.values.get(request);
    const rows = response.data.values;

    // Generate a PDF for each entry
    const bulkPdf = new pdf();
    const filePath = `uploads/all_id_cards.pdf`;
    const writeStream = fs.createWriteStream(filePath);

    bulkPdf.pipe(writeStream);
    
    for (let row of rows) {
      const [name, position, idNumber, photoPath] = row;

      const qrCodeData = await promisify(qr.toDataURL)(idNumber);
      bulkPdf.addPage();
      bulkPdf.image('path-to-your-id-template-image', 0, 0, { width: 600 });
      bulkPdf.text(`Name: ${name}`, 150, 150);
      bulkPdf.text(`Position: ${position}`, 150, 180);
      bulkPdf.text(`ID: ${idNumber}`, 150, 210);
      bulkPdf.image(qrCodeData, 150, 250, { width: 100 });
    }

    bulkPdf.end();

    writeStream.on('finish', () => {
      res.download(filePath);
    });
  } catch (error) {
    console.error('Error generating bulk ID cards:', error);
    res.status(500).send('Error generating bulk ID cards');
  }
});

// Route: Attendance (QR code scanning)
app.post('/attendance', async (req, res) => {
  const { idNumber } = req.body;

  // Verify attendance by checking the ID in Google Sheets
  const authClient = await authorize();
  const request = {
    spreadsheetId: SPREADSHEET_ID,
    range: 'Sheet1!A:C', // Modify to match your sheet and range
    auth: authClient
  };

  try {
    const response = await sheets.spreadsheets.values.get(request);
    const rows = response.data.values;
    const row = rows.find(row => row[2] === idNumber);

    if (row) {
      res.json({ success: true, message: 'Attendance recorded for ' + row[0] });
    } else {
      res.status(404).send('ID not found');
    }
  } catch (error) {
    console.error('Error checking attendance:', error);
    res.status(500).send('Error recording attendance');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});