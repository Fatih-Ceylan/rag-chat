// cli.js --------------------------------------------------------------------
import readline from "readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ask } from "./rag_chat.js";

const rl = readline.createInterface({ input, output });
const history = [];   // basit sohbet belleği

console.log("🟢  RAG CLI — çıkmak için Ctrl+C");

while (true) {
  const question = (await rl.question("👤 ")).trim();
  if (!question) continue;

  // --- RAG + Ollama akışını başlat ---
  const stream = await ask(question, history);

  let answer = "";
  process.stdout.write("🤖 ");

  try {
    for await (const line of stream) {
      
      // Ollama SSE satırları: "data: {...}"  | keep-alive boş satırlar da gelebilir
      if (!line.startsWith("data:")) {
        continue;
      }

      const payloadRaw = line.slice(5).trim();
      if (!payloadRaw) {
        console.log("[Debug] Skipping empty payload (keep-alive)");
        continue;          // keep-alive
      }

      if (payloadRaw === "[DONE]") {
        console.log("[Debug] Stream completed");
        break; // akış sonu
      }

      console.log("[Debug] Parsing JSON payload:", payloadRaw);
      const payload = JSON.parse(payloadRaw);
      const token   = payload.message?.content ?? "";
      if (!token) {
        console.log("[Debug] No content in payload");
        continue;
      }

      process.stdout.write(token);
      answer += token;
    }
  } catch (err) {
    console.error("\n⚠️  Akış hatası:", err.message);
    console.error("[Debug] Full error:", err);
  }

  console.log("\n");
  history.push({ role: "user",      content: question });
  history.push({ role: "assistant", content: answer   });
}
