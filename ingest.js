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
const __dirname  = path.dirname(__filename);

// 1) Embeddings (intfloat/e5-small-v2 ≈ 384 dims; ilk run'da modeli indirir)
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/e5-small-v2",
  cacheDir: path.join(__dirname, ".models"),
});

// 2) Qdrant istemcisi
const qdrant = new QdrantClient({ url: "http://localhost:6333" });
const COLLECTION = "student_services";

async function ensureCollection() {
  const exists = await qdrant.getCollections();
  if (!exists.collections.find(c => c.name === COLLECTION)) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: 384, distance: "Cosine" },
      // öneri: `on_disk: true` → büyük veri için
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
    docs.push({ pageContent: data.text, metadata: { source: f } }); // <-- düzeltildi
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 2000,
    chunkOverlap: 120,
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
      url: "http://localhost:6333",
      collectionName: COLLECTION,
    },
  );
  console.log(`✅  ${docs.length} parça yüklendi.`);
  return vectorStore;
}
