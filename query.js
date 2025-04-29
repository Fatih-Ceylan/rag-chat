import { QdrantVectorStore } from "@langchain/qdrant";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";

const COLLECTION = "student_services";

const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/e5-small-v2",
});

const store = await QdrantVectorStore.fromExistingCollection(
  embeddings,
  { url: "http://localhost:6333", collectionName: COLLECTION },
);

const query = "bu ne";
const results = await store.similaritySearch(query, 4);  // top-4

console.log("\n=== EN YAKIN PARÇALAR ===");
results.forEach(r => {
  console.log("-".repeat(40));
  console.log(r.pageContent.trim().slice(0, 500), "\n[Kaynak:", r.metadata.source, "]");
});
