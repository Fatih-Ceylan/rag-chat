// RAG Chat Backend Server
import express from "express";
import cors from "cors";
import path from "path";
import fs from 'fs/promises';
import { fileURLToPath } from "url";
import { uploadDocuments } from './services/ingest.service.js';
import { ask } from './services/rag.service.js';
import { QdrantClient } from "@qdrant/js-client-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const pdfApp = express(); // PDF server için ayrı Express app
const qdrant = new QdrantClient({ url: "http://localhost:6333" });

app.use(cors({ origin: '*' }));
app.use(express.json());
pdfApp.use(cors({ origin: '*' }));

// API Endpoints

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

// PDF dokümanlarını vektör veritabanına yükle
app.post('/api/documents/upload', async (req, res) => {
  try {
    const { university } = req.body;
    if (!university) return res.status(400).json({ success: false, error: 'Üniversite seçimi gerekli' });

    const docsDir = path.join(__dirname, '../../../documents', university);
    const result = await uploadDocuments(docsDir, university);
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

    // Dosya yolunu oluştur (backend/src/server.js'den documents klasörüne)
    const filePath = path.join(__dirname, '../..', 'documents', university, filename);

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