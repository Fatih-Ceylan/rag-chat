import express from 'express';
import { loadDocs, ingest } from '../ingest.js';

const router = express.Router();

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