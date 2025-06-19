// PDF Doküman Yükleme ve Vektörleştirme Servisi
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qdrant = new QdrantClient({ url: "http://localhost:6333" });

// Türkçe destekli embedding modeli
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  cacheDir: path.join(__dirname, "../../.models"),
});

// Dosya hash hesaplama (duplicate kontrolü için)
const calculateHash = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

// Ana doküman yükleme fonksiyonu
export async function uploadDocuments(dir, university) {
  try {
    const COLLECTION = `university_${university}`;
    await checkExistingHashes(COLLECTION);

    const files = await fs.readdir(dir);
    const newFiles = [];
    const skippedFiles = [];

    // Her PDF dosyasını işle
    for (const file of files) {
      if (!file.endsWith('.pdf')) continue;

      const filePath = path.join(dir, file);
      const fileBuffer = await fs.readFile(filePath);
      const fileHash = calculateHash(fileBuffer);

      // Dosya daha önce yüklendi mi kontrol et (hash ile)
      if (await checkFileByHash(fileHash, COLLECTION)) {
        skippedFiles.push(file);
        continue;
      }

      // PDF içeriğini parse et
      const pdfData = await pdf(fileBuffer);

      // Türkçe için optimize edilmiş text chunking
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 800,        // Daha küçük chunk'lar
        chunkOverlap: 100,     // Fazla overlap
        separators: ["\n\n", "\n", ". ", "! ", "? ", " "], // Türkçe noktalama
      });

      // Dokümanı chunk'lara böl ve metadata ekle
      const docs = await splitter.splitDocuments([{
        pageContent: pdfData.text,
        metadata: {
          source: file,
          hash: fileHash,
          uploadTime: new Date().toISOString(),
          university,
          loc: { lines: { from: 1, to: pdfData.numpages } }
        }
      }]);

      // Vektör veritabanına yükle
      await QdrantVectorStore.fromDocuments(docs, embeddings, {
        url: "http://localhost:6333",
        collectionName: COLLECTION,
      });

      newFiles.push(file);
    }

    return { success: true, newFiles, skippedFiles };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Mevcut hash'leri kontrol et (şimdilik basit implementasyon)
const checkExistingHashes = async () => new Map();

// Hash ile dosya duplicate kontrolü
const checkFileByHash = async (hash, collection) => {
  try {
    const response = await qdrant.scroll(collection, {
      limit: 1,
      with_payload: true,
      filter: { must: [{ key: "metadata.hash", match: { value: hash } }] }
    });
    return response.points.length > 0;
  } catch (error) {
    return false;
  }
};

// Yeni dosyaları yükle ve vektör DB'ye kaydet
export async function uploadNewDocuments(files, university) {
  try {
    const COLLECTION = `university_${university}`;
    await checkExistingHashes(COLLECTION);

    const docsDir = '/Users/fatih/Downloads/NEW_RAG/rag-chat/documents/' + university;

    // Klasör yoksa oluştur
    try {
      await fs.access(docsDir);
    } catch {
      await fs.mkdir(docsDir, { recursive: true });
    }

    const newFiles = [];
    const skippedFiles = [];
    const errorFiles = [];

    for (const file of files) {
      try {
        // Base64'ü buffer'a çevir
        const fileBuffer = Buffer.from(file.data, 'base64');
        const fileHash = calculateHash(fileBuffer);

        // Dosya zaten var mı kontrol et (hash ile)
        if (await checkFileByHash(fileHash, COLLECTION)) {
          skippedFiles.push(file.name);
          continue;
        }

        // Disk'te aynı isimde dosya var mı kontrol et
        const filePath = path.join(docsDir, file.name);
        try {
          await fs.access(filePath);
          // Dosya var, hash'ini kontrol et
          const existingBuffer = await fs.readFile(filePath);
          const existingHash = calculateHash(existingBuffer);
          if (existingHash === fileHash) {
            skippedFiles.push(file.name);
            continue;
          }
        } catch {
          // Dosya yok, devam et
        }

        // Dosyayı disk'e kaydet
        await fs.writeFile(filePath, fileBuffer);

        // PDF içeriğini parse et
        const pdfData = await pdf(fileBuffer);

        // Türkçe için optimize edilmiş text chunking
        const splitter = new RecursiveCharacterTextSplitter({
          chunkSize: 800,
          chunkOverlap: 100,
          separators: ["\n\n", "\n", ". ", "! ", "? ", " "],
        });

        // Dokümanı chunk'lara böl ve metadata ekle
        const docs = await splitter.splitDocuments([{
          pageContent: pdfData.text,
          metadata: {
            source: file.name,
            hash: fileHash,
            uploadTime: new Date().toISOString(),
            university,
            loc: { lines: { from: 1, to: pdfData.numpages } }
          }
        }]);

        // Vektör veritabanına yükle
        await QdrantVectorStore.fromDocuments(docs, embeddings, {
          url: "http://localhost:6333",
          collectionName: COLLECTION,
        });

        newFiles.push(file.name);
      } catch (error) {
        console.error(`Dosya yükleme hatası (${file.name}):`, error);
        errorFiles.push({ name: file.name, error: error.message });
      }
    }

    return {
      success: true,
      newFiles,
      skippedFiles,
      errorFiles,
      message: `${newFiles.length} yeni dosya yüklendi, ${skippedFiles.length} dosya atlandı${errorFiles.length > 0 ? `, ${errorFiles.length} dosyada hata` : ''}`
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Basit dosya yükleme fonksiyonu: Sadece vektör DB hash kontrolü
export async function uploadCombinedDocuments(newFiles, university) {
  try {
    const COLLECTION = `university_${university}`;
    await checkExistingHashes(COLLECTION);

    const docsDir = '/Users/fatih/Downloads/NEW_RAG/rag-chat/documents/' + university;

    // Klasör yoksa oluştur
    try {
      await fs.access(docsDir);
    } catch {
      await fs.mkdir(docsDir, { recursive: true });
    }

    let allNewFiles = [];
    let allSkippedFiles = [];
    let allErrorFiles = [];

    // Sadece yeni dosyaları işle (eğer varsa)
    if (newFiles && newFiles.length > 0) {
      for (const file of newFiles) {
        try {
          // Base64'ü buffer'a çevir
          const fileBuffer = Buffer.from(file.data, 'base64');
          const fileHash = calculateHash(fileBuffer);

          // Sadece vektör DB'de hash kontrolü yap
          if (await checkFileByHash(fileHash, COLLECTION)) {
            allSkippedFiles.push(file.name);
            continue;
          }

          // Dosyayı disk'e kaydet
          const filePath = path.join(docsDir, file.name);
          await fs.writeFile(filePath, fileBuffer);

          // PDF içeriğini parse et ve vektör DB'ye yükle
          await processAndUploadPDF(fileBuffer, file.name, fileHash, university, COLLECTION);
          allNewFiles.push(file.name);
        } catch (error) {
          console.error(`Dosya yükleme hatası (${file.name}):`, error.message);
          allErrorFiles.push({ name: file.name, error: error.message });
        }
      }
    }

    const totalNew = allNewFiles.length;
    const totalSkipped = allSkippedFiles.length;
    const totalErrors = allErrorFiles.length;

    let message = '';
    if (totalNew > 0 && totalSkipped > 0) {
      message = `${totalNew} dosya yüklendi, ${totalSkipped} dosya zaten mevcuttu`;
    } else if (totalNew > 0) {
      message = `${totalNew} dosya başarıyla yüklendi`;
    } else if (totalSkipped > 0) {
      message = `${totalSkipped} dosya zaten vektör DB'de mevcut`;
    } else {
      message = 'Dosya seçilmedi';
    }

    if (totalErrors > 0) {
      message += `, ${totalErrors} dosyada hata oluştu`;
    }

    return {
      success: true,
      newFiles: allNewFiles,
      skippedFiles: allSkippedFiles,
      errorFiles: allErrorFiles,
      message
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// PDF işleme ve vektör DB'ye yükleme helper fonksiyonu
async function processAndUploadPDF(fileBuffer, fileName, fileHash, university, collection) {
  try {
    // PDF dosyasının geçerli olup olmadığını kontrol et
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('Boş dosya');
    }

    // PDF header kontrolü
    const pdfHeader = fileBuffer.slice(0, 4).toString();
    if (pdfHeader !== '%PDF') {
      throw new Error('Geçersiz PDF dosyası');
    }

    // PDF içeriğini parse et
    const pdfData = await pdf(fileBuffer);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new Error('PDF dosyasında metin bulunamadı');
    }

    // Türkçe için optimize edilmiş text chunking
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
      separators: ["\n\n", "\n", ". ", "! ", "? ", " "],
    });

    // Dokümanı chunk'lara böl ve metadata ekle
    const docs = await splitter.splitDocuments([{
      pageContent: pdfData.text,
      metadata: {
        source: fileName,
        hash: fileHash,
        uploadTime: new Date().toISOString(),
        university,
        loc: { lines: { from: 1, to: pdfData.numpages } }
      }
    }]);

    // Vektör veritabanına yükle
    await QdrantVectorStore.fromDocuments(docs, embeddings, {
      url: "http://localhost:6333",
      collectionName: collection,
    });
  } catch (error) {
    throw new Error(`${error.message}`);
  }
}
