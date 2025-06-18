// RAG (Retrieval-Augmented Generation) Service
import { QdrantVectorStore } from "@langchain/qdrant";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { TextDecoder } from "node:util";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Türkçe destekli çok dilli embedding modeli
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  cacheDir: path.join(__dirname, "../../.models"),
});

// Ana RAG fonksiyonu - soru sorar ve bağlamsal yanıt döner
export async function ask(question, history = [], university) {
  if (!university) throw new Error("Üniversite seçimi gerekli");

  // Üniversiteye özel vektör koleksiyonuna bağlan
  const store = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: "http://localhost:6333",
    collectionName: `university_${university}`,
    searchParams: { limit: 8, score_threshold: 0.5, exact: false }
  });

  // Soruya en benzer dokümanları bul (semantic search)
  const relDocsWithScore = await store.similaritySearchWithScore(question, 8);
  const relDocs = relDocsWithScore.map(([doc, score], index) => ({
    ...doc,
    score: score && !isNaN(score) ? score : (0.8 - index * 0.05)
  }));

  // Bulunan dokümanları bağlam olarak formatla
  const context = relDocs.map((d, i) =>
    `### Kaynak ${i + 1} (Benzerlik: ${(d.score * 100).toFixed(1)}%)\nDosya: ${d.metadata.source}\nSayfa: ${d.metadata.loc?.lines?.from || 'Bilinmiyor'}\nİçerik:\n${d.pageContent.trim()}`
  ).join("\n\n");

  // LLM için mesaj dizisi oluştur (system prompt + chat history + current question)
  const messages = [
    {
      role: "system",
      content: `Sen ${university} üniversitesinin "Öğrenci İşleri" danışmanısın. Yanıtların TÜRKÇE olacak. Sadece verdiğim bağlamdaki bilgilere dayan. Kaynak yoksa "Bu konuda bilgim yok." de.`
    },
    ...history,
    { role: "user", content: `KULLANILACAK BAĞLAM\n-------------------\n${context}\n\nSORU\n----\n${question}\n\nCEVAP (anlaşılabilir ve net:` }
  ];

  // Ollama LLM'e stream request gönder
  const resp = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gemma3:12b", messages, stream: true }),
  });

  if (!resp.body) throw new Error("Ollama akışı yok!");

  // Stream yanıtını işle
  let fullResponse = '';
  const decoder = new TextDecoder();
  const reader = resp.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      chunk.split('\n').forEach(line => {
        if (line.trim()) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) fullResponse += data.message.content;
          } catch (e) {}
        }
      });
    }

    return {
      content: fullResponse,
      context,
      sources: relDocs.map(doc => ({
        content: doc.pageContent,
        metadata: { source: doc.metadata.source, page: doc.metadata.loc?.lines?.from, score: doc.score }
      }))
    };
  } finally {
    reader.releaseLock();
  }
}