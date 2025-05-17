import express from 'express';
import { uploadDocuments } from '../services/ingest.service.js';
import { ask } from '../services/rag.service.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// PDF listesi endpoint'i
router.get('/documents/list', async (req, res) => {
  try {
    const docsDir = path.join(__dirname, '../../../documents');
    const files = await fs.readdir(docsDir);
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
    res.json({ success: true, documents: pdfFiles });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PDF yükleme endpoint'i
router.post('/documents/upload', async (req, res) => {
  try {
    const docsDir = path.join(__dirname, '../../../documents');
    const result = await uploadDocuments(docsDir);
    res.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// Soru sorma endpoint'i
router.post('/ask', async (req, res) => {
  try {
    const { question, history } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, error: 'Soru gerekli' });
    }
    const response = await ask(question, history);
    res.json({ success: true, ...response });
  } catch (error) {
    console.error('Ask error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router; 