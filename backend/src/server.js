// RAG Chat Backend Server
import express from "express";
import cors from "cors";
import path from "path";
import fs from 'fs/promises';
import { fileURLToPath } from "url";
import { uploadCombinedDocuments } from './services/ingest.service.js';
import { ask } from './services/rag.service.js';
import { QdrantClient } from "@qdrant/js-client-rest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const app = express();
const pdfApp = express(); // PDF server için ayrı Express app
const qdrant = new QdrantClient({ url: "http://localhost:6333" });

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: 'application/pdf', limit: '50mb' }));
pdfApp.use(cors({ origin: '*' }));

// API Endpoints

// Test endpoint
app.get('/api/test-path', (req, res) => {
  const { university } = req.query;
  const docsDir = path.join(projectRoot, 'documents', university || 'arel');
  res.json({
    projectRoot,
    docsDir,
    cwd: process.cwd(),
    __dirname
  });
});

// Yüklenmiş PDF dosyalarının listesini getir
app.get('/api/documents/list', async (req, res) => {
  try {
    const { university } = req.query;
    if (!university) return res.status(400).json({ success: false, error: 'Üniversite seçimi gerekli' });

    const response = await qdrant.scroll(`university_${university}`, { limit: 1000, with_payload: true });
    const uniqueFiles = new Set();
    response.points.forEach(point => {
      if (point.payload?.metadata?.source) uniqueFiles.add(point.payload.metadata.source);
    });

    res.json({ success: true, documents: Array.from(uniqueFiles) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Birleşik endpoint: Hem yeni dosya yükleme hem mevcut dosya kontrolü
app.post('/api/documents/upload-combined', async (req, res) => {
  try {
    const { university, files } = req.body;
    if (!university) return res.status(400).json({ success: false, error: 'Üniversite seçimi gerekli' });

    const result = await uploadCombinedDocuments(files || [], university);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// RAG sistemi ile soru-cevap
app.post('/api/ask', async (req, res) => {
  try {
    const { question, history, university } = req.body;
    if (!question || !university) return res.status(400).json({ success: false, error: 'Soru ve üniversite seçimi gerekli' });

    const response = await ask(question, history, university);
    res.json({ success: true, ...response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PDF Server Endpoint'i (ayrı port için)
pdfApp.get('/api/documents/pdf/:university/:filename', async (req, res) => {
  try {
    const { university, filename } = req.params;

    // Güvenlik kontrolü - sadece PDF dosyalarına izin ver
    if (!filename.endsWith('.pdf')) {
      return res.status(400).json({ success: false, error: 'Sadece PDF dosyalarına erişim izni var' });
    }

    // Dosya yolunu oluştur (proje root'undan documents klasörüne)
    const filePath = '/Users/fatih/Downloads/NEW_RAG/rag-chat/documents/' + university + '/' + filename;

    // Dosya var mı kontrol et
    await fs.access(filePath);

    // PDF dosyasını browser'da açılacak şekilde serve et
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(await fs.readFile(filePath));
  } catch (error) {
    res.status(404).json({ success: false, error: 'Dosya bulunamadı' });
  }
});

// Her iki server'ı da başlat
app.listen(4000, () => console.log("RAG API 4000'de"));
pdfApp.listen(4002, () => console.log("PDF Server 4002'de"));