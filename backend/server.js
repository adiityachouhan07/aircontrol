'use strict';
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const SOFFICE = process.env.SOFFICE_PATH || 'soffice';
const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 50);
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const FRONTEND = path.join(__dirname, '..', 'frontend');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = new Set(['.pdf', '.ppt', '.pptx']);
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED.has(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error('Only PDF, PPT and PPTX files are supported.'), ok);
  },
});

app.use(cors());
app.use(express.json());

// Public config for the browser (the Maps key is a browser key – restrict it by HTTP referrer in Google Cloud).
app.get('/api/config', (_req, res) => {
  res.json({ googleEarthApiKey: process.env.GOOGLE_EARTH_API_KEY || '' });
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

function convertToPdf(inputPath) {
  return new Promise((resolve, reject) => {
    execFile(
      SOFFICE,
      ['--headless', '--convert-to', 'pdf', '--outdir', UPLOAD_DIR, inputPath],
      { timeout: 120000 },
      (err) => {
        const out = inputPath.replace(/\.(pptx?|PPTX?)$/, '.pdf');
        if (err || !fs.existsSync(out)) return reject(err || new Error('Conversion failed'));
        resolve(out);
      }
    );
  });
}

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received.' });
  const ext = path.extname(req.file.filename).toLowerCase();
  try {
    let finalName = req.file.filename;
    let converted = false;
    if (ext === '.ppt' || ext === '.pptx') {
      const pdfPath = await convertToPdf(req.file.path);
      finalName = path.basename(pdfPath);
      converted = true;
    }
    res.json({
      url: `/uploads/${finalName}`,
      name: req.file.originalname,
      converted,
    });
  } catch (e) {
    console.error('Conversion error:', e.message);
    res.status(422).json({
      error:
        'Could not convert the presentation. Install LibreOffice (soffice) on the server or export the deck as PDF.',
    });
  }
});

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1h' }));
app.use('/src', express.static(path.join(FRONTEND, 'src')));
app.use(express.static(path.join(FRONTEND, 'public')));

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => console.log(`AirControl running → http://localhost:${PORT}`));
