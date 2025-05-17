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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Qdrant client
const qdrant = new QdrantClient({ url: "http://localhost:6333" });
const COLLECTION = "student_services";

// Embeddings model
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-MiniLM-L6-v2",
  cacheDir: path.join(__dirname, "../../.models"),
});

// 🔒 Hash hesaplayıcı
function calculateHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// 📊 Collection'daki mevcut hash'leri kontrol et
async function checkExistingHashes() {
  try {
    const response = await qdrant.scroll(COLLECTION, {
      limit: 1000,
      with_payload: true,
    });

    const hashMap = new Map();
    response.points.forEach(point => {
      if (point.payload && point.payload.hash && point.payload.source) {
        hashMap.set(point.payload.hash, point.payload.source);
      }
    });

    console.log('\n📚 Mevcut PDF\'ler ve Hash\'leri:');
    hashMap.forEach((source, hash) => {
      console.log(`File: ${source}`);
      console.log(`Hash: ${hash}\n`);
    });

    return hashMap;
  } catch (error) {
    console.error("Error checking existing hashes:", error);
    return new Map();
  }
}

// 🔍 Qdrant'ta aynı hash'e sahip doküman var mı kontrolü
async function checkFileByHash(hash) {
  try {
    const response = await qdrant.scroll(COLLECTION, {
      limit: 1,
      with_payload: true,
      filter: {
        must: [
          {
            key: "hash",
            match: {
              value: hash
            }
          }
        ]
      }
    });

    if (response.points.length > 0) {
      const existingFile = response.points[0].payload.source;
      console.log(`⚠️ Aynı hash'e sahip dosya bulundu: ${existingFile}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error checking file by hash:", error);
    return false;
  }
}

// 📤 Ana yükleme fonksiyonu
export async function uploadDocuments(dir) {
  try {
    // Mevcut hash'leri kontrol et
    console.log('Mevcut dosyaların hash\'leri kontrol ediliyor...');
    await checkExistingHashes();

    const files = await fs.readdir(dir);
    const newFiles = [];
    const skippedFiles = [];

    for (const file of files) {
      if (!file.endsWith('.pdf')) continue;

      const filePath = path.join(dir, file);
      const fileBuffer = await fs.readFile(filePath);
      const fileHash = calculateHash(fileBuffer);

      console.log(`\n📄 İşleniyor: ${file}`);
      console.log(`🔑 Hash: ${fileHash}`);

      const alreadyExists = await checkFileByHash(fileHash);
      if (alreadyExists) {
        console.log(`❌ Dosya zaten yüklü, atlanıyor: ${file}`);
        skippedFiles.push(file);
        continue;
      }

      // PDF içeriğini ayrıştır
      const pdfData = await pdf(fileBuffer);
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 50,
      });

      const docs = await splitter.splitDocuments([{
        pageContent: pdfData.text,
        metadata: { 
          source: file,
          hash: fileHash,
          uploadTime: new Date().toISOString(),
          loc: {
            lines: {
              from: 1,
              to: pdfData.numpages
            }
          }
        }
      }]);

      // Qdrant'a yükle
      await QdrantVectorStore.fromDocuments(
        docs,
        embeddings,
        {
          url: "http://localhost:6333",
          collectionName: COLLECTION,
        }
      );

      newFiles.push(file);
      console.log(`✅ Başarıyla yüklendi: ${file}`);
    }

    return {
      success: true,
      newFiles,
      skippedFiles
    };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error.message
    };
  }
}
