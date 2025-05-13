// rag.service.js ---------------------------------------------------------------
import { QdrantVectorStore } from "@langchain/qdrant";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { Readable } from "node:stream";
import { TextDecoder } from "node:util";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLLECTION = "student_services";
const QDRANT_URL = "http://localhost:6333";
const OLLAMA_URL = "http://localhost:11434/api/chat";

// 1) Embedding nesnesi (daha hızlı model)
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-MiniLM-L6-v2", // Daha hızlı ve hafif model
  cacheDir: path.join(__dirname, "../../.models"),
});

// 2) Qdrant vektör store – var olan koleksiyona bağlan
const store = await QdrantVectorStore.fromExistingCollection(
  embeddings,
  { 
    url: QDRANT_URL, 
    collectionName: COLLECTION,
    searchParams: {
      limit: 2, // Daha az sonuç getir
      score_threshold: 0.7, // Benzerlik eşiği
      exact: false, // Yaklaşık arama
    }
  },
);

// 3) SSE'yi satır satır okumak için yardımcı
async function* streamToAsyncIterable(stream) {
  const decoder = new TextDecoder();
  let buffer = "";
  
  for await (const chunk of stream) {
    const rawChunk = decoder.decode(chunk, { stream: true });
    console.log("[Debug] Raw chunk from Ollama:", rawChunk);
    
    buffer += rawChunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || ""; // Son satırı buffer'da tut
    
    for (const line of lines) {
      if (line.trim()) {
        console.log("[Debug] Processing line:", line);
        try {
          const data = JSON.parse(line);
          console.log("[Debug] Parsed data:", data);
          if (data.message?.content) {
            console.log("[Debug] Yielding content:", data.message.content);
            yield data.message.content;
          }
        } catch (e) {
          console.error("[Debug] Error parsing line:", e);
          console.log("[Debug] Failed line:", line);
        }
      }
    }
  }
  
  // Buffer'da kalan son satırı işle
  if (buffer.trim()) {
    try {
      const data = JSON.parse(buffer);
      console.log("[Debug] Parsed final buffer:", data);
      if (data.message?.content) {
        console.log("[Debug] Yielding final content:", data.message.content);
        yield data.message.content;
      }
    } catch (e) {
      console.error("[Debug] Error parsing final buffer:", e);
      console.log("[Debug] Failed final buffer:", buffer);
    }
  }
}

// 4) Ana fonksiyon
export async function ask(question, history = []) {
  /*---------- 4.1 Bağlam getir ----------*/
  const relDocs = await store.similaritySearch(question, 2);   // top-2'ye düşürdük
  const context = relDocs.map(
    (d, i) => `### Kaynak ${i + 1}\n${d.pageContent.trim()}`
  ).join("\n\n");

  /*---------- 4.2 Mesaj dizisi ----------*/
  const messages = [
    {
      role: "system",
      content:
`Sen üniversite "Öğrenci İşleri" danışmanısın.
Yanıtların TÜRKÇE olacak. Sadece verdiğim bağlamdaki
bilgilere dayan. Kaynak yoksa "Bu konuda bilgim yok." de.
Yanıtların kısa ve öz olsun.`,
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

CEVAP (kısa ve net):`,
    },
  ];

  /*---------- 4.3 Ollama'ya POST ----------*/
  console.log("[Debug] Sending request to Ollama with context length:", context.length);
  console.log("[Debug] Messages:", JSON.stringify(messages, null, 2));
  
  const resp = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemma3:12b", messages, stream: true }),
  });

  console.log("[Debug] Ollama response status:", resp.status);
  console.log("[Debug] Ollama response headers:", Object.fromEntries(resp.headers.entries()));

  if (!resp.body) {
    console.error("[Debug] No response body from Ollama!");
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
      console.log("[Debug] Raw chunk from Ollama:", chunk);
      
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
            console.log("[Debug] Failed line:", line);
          }
        }
      }
    }

    console.log("[Debug] Final response:", fullResponse);
    return {
      content: fullResponse,
      context: context,
      sources: relDocs.map(doc => ({
        content: doc.pageContent,
        metadata: doc.metadata
      }))
    };
  } catch (error) {
    console.error("[Debug] Error processing stream:", error);
    throw error;
  } finally {
    reader.releaseLock();
  }
} 