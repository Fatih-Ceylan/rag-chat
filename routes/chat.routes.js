import express from 'express';
import { ask } from '../rag_chat.js';

const router = express.Router();

router.post('/', async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const { question, history = [] } = req.body;
  try {
    const stream = await ask(question, history);
    for await (const line of stream) {
      if (!line.startsWith("data:")) continue;
      const payload = JSON.parse(line.slice(5));
      if (payload.message?.content) {
        res.write(`data: ${payload.message.content}\n\n`);
      }
    }
    res.end();
  } catch (e) {
    res.write(`event: error\ndata: ${e.message}\n\n`);
    res.end();
  }
});

export default router; 