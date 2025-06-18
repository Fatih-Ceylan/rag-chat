import express from 'express';
import { uploadDocuments } from '../services/ingest.service.js';
import { ask } from '../services/rag.service.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { QdrantClient } from "@qdrant/js-client-rest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const qdrant = new QdrantClient({ url: "http://localhost:6333" });

// PDF listesi endpoint'i
router.get('/documents/list', async (req, res) => {
  try {
    const { university } = req.query;
    if (!university) {
      return res.status(400).json({ 
        success: false, 
        error: 'Üniversite seçimi gerekli' 
      });
    }

    const COLLECTION = `university_${university}`;
    const response = await qdrant.scroll(COLLECTION, {
      limit: 1000,
      with_payload: true,
    });

    // Benzersiz PDF dosyalarını bul
    const uniqueFiles = new Set();
    response.points.forEach(point => {
      if (point.payload && point.payload.metadata && point.payload.metadata.source) {
        uniqueFiles.add(point.payload.metadata.source);
      }
    });

    console.log(`${university} üniversitesi için dosyalar:`, Array.from(uniqueFiles));

    res.json({ 
      success: true, 
      documents: Array.from(uniqueFiles)
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PDF yükleme endpoint'i
router.post('/documents/upload', async (req, res) => {
  try {
    const { university } = req.body;
    if (!university) {
      return res.status(400).json({ 
        success: false, 
        error: 'Üniversite seçimi gerekli' 
      });
    }

    const docsDir = path.join(__dirname, '../../../documents', university);
    const result = await uploadDocuments(docsDir, university);
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
    const { question, history, university } = req.body;
    if (!question || !university) {
      return res.status(400).json({
        success: false,
        error: 'Soru ve üniversite seçimi gerekli'
      });
    }
    const response = await ask(question, history, university);
    res.json({ success: true, ...response });
  } catch (error) {
    console.error('Ask error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Test route çalışıyor' });
});

// PDF dosyalarını serve etme endpoint'i
router.get('/documents/pdf/:university/:filename', async (req, res) => {
  console.log('PDF route çağrıldı:', req.params);
  try {
    const { university, filename } = req.params;

    // Güvenlik kontrolü - sadece PDF dosyalarına izin ver
    if (!filename.endsWith('.pdf')) {
      return res.status(400).json({
        success: false,
        error: 'Sadece PDF dosyalarına erişim izni var'
      });
    }

    const filePath = path.join(__dirname, '../../../documents', university, filename);
    console.log(`PDF dosya yolu: ${filePath}`);

    // Dosya var mı kontrol et
    try {
      await fs.access(filePath);
      console.log(`Dosya bulundu: ${filename}`);
    } catch (error) {
      console.log(`Dosya bulunamadı: ${filePath}`, error.message);
      return res.status(404).json({
        success: false,
        error: 'Dosya bulunamadı'
      });
    }

    // PDF dosyasını serve et
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);

  } catch (error) {
    console.error('PDF serve error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;