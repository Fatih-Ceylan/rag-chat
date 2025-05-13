// rag_chat.js ---------------------------------------------------------------
import { QdrantVectorStore } from "@langchain/qdrant";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { Readable } from "node:stream";
import { TextDecoder } from "node:util";

const COLLECTION = "student_services";
const QDRANT_URL = "http://localhost:6333";
const OLLAMA_URL = "http://localhost:11434/api/chat";

// 1) Embedding nesnesi (aynen ingest'te kullandığın)
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/e5-small-v2",
});

// 2) Qdrant vektör store – var olan koleksiyona bağlan
const store = await QdrantVectorStore.fromExistingCollection(
  embeddings,
  { url: QDRANT_URL, collectionName: COLLECTION },
);

// 3) SSE'yi satır satır okumak için yardımcı
async function* streamToAsyncIterable(stream) {
  const decoder = new TextDecoder();
  let buffer = "";
  
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop();
    for (const line of parts) {
      console.log("[Debug] Stream line:", line);
      yield line;
    }
  }
  
  if (buffer) {
    console.log("[Debug] Final buffer:", buffer);
    yield buffer;
  }
}

// 4) Ana fonksiyon
export async function ask(question, history = []) {
  /*---------- 4.1 Bağlam getir ----------*/
  const relDocs = await store.similaritySearch(question, 4);   // top-4
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
bilgilere dayan. Kaynak yoksa "Bu konuda bilgim yok." de.`,
    },
    ...history,                                   // {role, content}...
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
    body: JSON.stringify({ model: "llama3", messages, stream: true }),
  });

  console.log("[Debug] Ollama response status:", resp.status);
  console.log("[Debug] Ollama response headers:", Object.fromEntries(resp.headers.entries()));

  // Enhanced debug logging
  console.log("[Debug] Full Ollama response:", {
    status: resp.status,
    statusText: resp.statusText,
    headers: Object.fromEntries(resp.headers.entries()),
    body: resp.body ? "Stream available" : "No stream",
    type: resp.type,
    url: resp.url
  });

  if (!resp.body) {
    console.error("[Debug] No response body from Ollama!");
    throw new Error("Ollama akışı yok!");
  }
  
  console.log("[Debug] Starting to process stream");
  return streamToAsyncIterable(resp.body);
}
