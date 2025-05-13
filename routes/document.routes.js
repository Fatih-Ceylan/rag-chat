import express from 'express';
import { loadDocs, ingest } from '../ingest.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Get list of processed PDFs
router.get('/list', async (req, res) => {
  try {
    const docsDir = path.join(__dirname, '../documents');
    const files = await fs.readdir(docsDir);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
    
    res.json({ 
      success: true, 
      data: pdfFiles 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Upload and process a new document
router.post('/upload', async (req, res) => {
  try {
    const docs = await loadDocs("./documents");
    await ingest(docs);
    res.json({ success: true, message: 'Document processed successfully', data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get list of processed documents
router.get('/', async (req, res) => {
  try {
    // TODO: Implement document listing functionality
    res.json({ success: true, message: 'Documents retrieved successfully', data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router; 