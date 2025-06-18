// debug-upload.js - Dosya yükleme hatalarını debug etmek için
import { uploadDocuments } from './backend/src/services/ingest.service.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function debugUpload() {
  console.log("🔍 Dosya yükleme debug başlıyor...\n");
  
  try {
    // Test için arel üniversitesini kullan
    const university = "arel";
    const docsDir = path.join(__dirname, 'documents', university);
    
    console.log(`📁 Doküman dizini: ${docsDir}`);
    console.log(`🏫 Üniversite: ${university}`);
    
    // Qdrant bağlantısını test et
    console.log("\n🔗 Qdrant bağlantısı test ediliyor...");
    const response = await fetch("http://localhost:6333/collections");
    if (response.ok) {
      const collections = await response.json();
      console.log("✅ Qdrant bağlantısı başarılı");
      console.log("📊 Mevcut collections:", collections.result?.collections?.map(c => c.name) || []);
    } else {
      throw new Error("Qdrant'a bağlanılamıyor");
    }
    
    // Dosya yüklemeyi test et
    console.log("\n📤 Dosya yükleme test ediliyor...");
    const result = await uploadDocuments(docsDir, university);
    
    console.log("\n📋 Sonuç:");
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log("✅ Dosya yükleme başarılı!");
      console.log(`📄 Yeni dosyalar: ${result.newFiles.length}`);
      console.log(`⏭️  Atlanan dosyalar: ${result.skippedFiles.length}`);
    } else {
      console.log("❌ Dosya yükleme başarısız!");
      console.log(`🚨 Hata: ${result.error}`);
    }
    
  } catch (error) {
    console.error("💥 Debug sırasında hata:", error);
    console.error("📍 Stack trace:", error.stack);
  }
}

// Debug'ı çalıştır
debugUpload();
