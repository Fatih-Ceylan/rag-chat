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

// Embeddings model (Türkçe destekli çok dilli model)
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  cacheDir: path.join(__dirname, "../../.models"),
});

// 🔒 Hash hesaplayıcı
function calculateHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// 📤 Ana yükleme fonksiyonu
export async function uploadDocuments(dir, university) {
  try {
    const COLLECTION = `university_${university}`;
    
    // Mevcut hash'leri kontrol et
    console.log(`${university} üniversitesi için mevcut dosyaların hash'leri kontrol ediliyor...`);
    await checkExistingHashes(COLLECTION);

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

      const alreadyExists = await checkFileByHash(fileHash, COLLECTION);
      if (alreadyExists) {
        console.log(`❌ Dosya zaten yüklü, atlanıyor: ${file}`);
        skippedFiles.push(file);
        continue;
      }

      // PDF içeriğini ayrıştır
      const pdfData = await pdf(fileBuffer);
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 800, // Türkçe için daha küçük chunk
        chunkOverlap: 100, // Daha fazla overlap
        separators: ["\n\n", "\n", ". ", "! ", "? ", " "], // Türkçe noktalama
      });

      const docs = await splitter.splitDocuments([{
        pageContent: pdfData.text,
        metadata: { 
          source: file,
          hash: fileHash,
          uploadTime: new Date().toISOString(),
          university: university,
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

// 📊 Collection'daki mevcut hash'leri kontrol et
async function checkExistingHashes(collection) {
  try {
    const response = await qdrant.scroll(collection, {
      limit: 1000,
      with_payload: true,
    });

    const hashMap = new Map();
    response.points.forEach(point => {
      if (point.payload && point.payload.metadata && point.payload.metadata.hash && point.payload.metadata.source) {
        hashMap.set(point.payload.metadata.hash, point.payload.metadata.source);
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
async function checkFileByHash(hash, collection) {
  try {
    const response = await qdrant.scroll(collection, {
      limit: 1,
      with_payload: true,
      filter: {
        must: [
          {
            key: "metadata.hash",
            match: {
              value: hash
            }
          }
        ]
      }
    });

    return response.points.length > 0;
  } catch (error) {
    console.error('Error checking file hash:', error);
    return false;
  }
}
