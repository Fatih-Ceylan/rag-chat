import express from 'express';
import { ask } from '../rag_chat.js';

const router = express.Router();

router.post('/', async (req, res) => {
  console.log('[Debug] Received chat request');
  
  // Set proper JSON response headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { question, history = [] } = req.body;
  console.log('[Debug] Question:', question);
  console.log('[Debug] History:', history);

  try {
    console.log('[Debug] Getting response from ask function');
    const response = await ask(question, history);
    
    console.log('[Debug] Sending response to client');
    res.json({ 
      success: true, 
      data: response
    });
  } catch (e) {
    console.error('[Debug] Error in chat route:', e);
    res.status(500).json({ 
      success: false, 
      error: e.message 
    });
  }
});

export default router; 