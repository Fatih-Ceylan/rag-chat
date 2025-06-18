// rag.service.js ---------------------------------------------------------------
import { QdrantVectorStore } from "@langchain/qdrant";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { TextDecoder } from "node:util";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QDRANT_URL = "http://localhost:6333";
const OLLAMA_URL = "http://localhost:11434/api/chat";

// 1) Embedding nesnesi (Türkçe destekli çok dilli model)
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  cacheDir: path.join(__dirname, "../../.models"),
});

// 2) Ana fonksiyon
export async function ask(question, history = [], university) {
  if (!university) {
    throw new Error("Üniversite seçimi gerekli");
  }

  const COLLECTION = `university_${university}`;

  /*---------- 4.1 Bağlam getir ----------*/
  const store = await QdrantVectorStore.fromExistingCollection(
    embeddings,
    { 
      url: QDRANT_URL, 
      collectionName: COLLECTION,
      searchParams: {
        limit: 8, // Türkçe için daha fazla sonuç
        score_threshold: 0.5, // Türkçe için daha düşük eşik
        exact: false,
      }
    },
  );

  const relDocsWithScore = await store.similaritySearchWithScore(question, 8);
  const relDocs = relDocsWithScore.map(([doc, score]) => ({ ...doc, score }));

  const context = relDocs.map(
    (d, i) => `### Kaynak ${i + 1} (Benzerlik: ${(d.score * 100).toFixed(1)}%)
Dosya: ${d.metadata.source}
Sayfa: ${d.metadata.loc?.lines?.from || 'Bilinmiyor'}
İçerik:
${d.pageContent.trim()}`
  ).join("\n\n");

  /*---------- 4.2 Mesaj dizisi ----------*/
  const messages = [
    {
      role: "system",
      content:
`Sen ${university} üniversitesinin "Öğrenci İşleri" danışmanısın.
1. Yanıtların TÜRKÇE olacak. Sadece verdiğim bağlamdaki
bilgilere dayan. Kaynak yoksa "Bu konuda bilgim yok." de.
2. Yanıtta kullandığın cevap içinde madde numarası varsa belirt yoksa belirtme.
3. Tüm kaynakları dikkatlice incele ve en doğru bilgiyi seç`,
    },
    ...history,
    {
      role: "user",
      content:
`KULLANILACAK BAĞLAM
-------------------
${context}

SORU
----
${question}

CEVAP (anlaşılabilir ve net:`,
    },
  ];

  /*---------- 4.3 Ollama'ya POST ----------*/
  const resp = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemma3:12b", messages, stream: true }),
  });

  if (!resp.body) {
    throw new Error("Ollama akışı yok!");
  }

  // Stream'i işle ve tüm içeriği birleştir
  let fullResponse = '';
  const decoder = new TextDecoder();
  const reader = resp.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              fullResponse += data.message.content;
            }
          } catch (e) {
            console.error("[Debug] Error parsing line:", e);
          }
        }
      }
    }

    return {
      content: fullResponse,
      context: context,
      sources: relDocs.map(doc => ({
        content: doc.pageContent,
        metadata: {
          source: doc.metadata.source,
          page: doc.metadata.loc?.lines?.from,
          score: doc.score
        }
      }))
    };
  } catch (error) {
    console.error("[Debug] Error processing stream:", error);
    throw error;
  } finally {
    reader.releaseLock();
  }
} 