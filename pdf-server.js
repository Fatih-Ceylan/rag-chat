// pdf-server.js - Basit PDF serve server
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS
app.use(cors({
  origin: '*',
  methods: ['GET'],
  allowedHeaders: ['Content-Type']
}));

// PDF serve endpoint
app.get('/api/documents/pdf/:university/:filename', async (req, res) => {
  try {
    const { university, filename } = req.params;
    console.log('PDF route çağrıldı:', req.params);
    
    // Güvenlik kontrolü
    if (!filename.endsWith('.pdf')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Sadece PDF dosyalarına erişim izni var' 
      });
    }

    const filePath = path.join(__dirname, 'documents', university, filename);
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

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'PDF Server çalışıyor' });
});

app.listen(4001, () => console.log("PDF Server 4001'de çalışıyor"));
