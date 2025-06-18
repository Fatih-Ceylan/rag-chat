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
