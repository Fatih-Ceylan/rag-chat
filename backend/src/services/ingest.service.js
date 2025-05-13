import fs from "fs/promises";
import path from "path";
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

// 1) Embeddings (daha hızlı model)
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-MiniLM-L6-v2", // Daha hızlı ve hafif model
  cacheDir: path.join(__dirname, "../../.models"),
});

// 2) Qdrant istemcisi
const qdrant = new QdrantClient({ url: "http://localhost:6333" });
const COLLECTION = "student_services";

async function ensureCollection() {
  const exists = await qdrant.getCollections();
  if (!exists.collections.find(c => c.name === COLLECTION)) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { 
        size: 384, // MiniLM modeli için vektör boyutu
        distance: "Dot", // Cosine yerine Dot Product (daha hızlı)
      },
      optimizers_config: {
        default_segment_number: 2, // Daha az segment
        indexing_threshold: 0, // Hemen indeksle
      },
      quantization_config: {
        scalar: {
          type: "int8", // 8-bit quantization
          quantile: 0.99,
          always_ram: true,
        },
      },
    });
    console.log("Collection created.");
  }
}

// 3) Belge yükle & parçalara ayır
export async function loadDocs(dir) {
  const files = await fs.readdir(dir);
  const docs = [];

  for (const f of files) {
    if (!f.endsWith(".pdf")) continue;
    const data = await pdf(await fs.readFile(path.join(dir, f)));
    docs.push({ pageContent: data.text, metadata: { source: f } });
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000, // Daha küçük chunk'lar
    chunkOverlap: 50, // Daha az overlap
    separators: ["\n", " "],
  });

  const splitDocs = await splitter.splitDocuments(docs);
  console.log(`[Debug] Docs array after splitting (length): ${splitDocs.length}`);
  return splitDocs;
}

// 4) Vektör mağazasına ekle
export async function ingest(docs) {
  await ensureCollection();
  const vectorStore = await QdrantVectorStore.fromDocuments(
    docs,
    embeddings,
    {
      url: "http://qdrant:6333",
      collectionName: COLLECTION,
      batchSize: 100, // Batch işleme
    },
  );
  console.log(`✅  ${docs.length} parça yüklendi.`);
  return vectorStore;
} 