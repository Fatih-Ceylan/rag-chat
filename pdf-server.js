import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';

const app = express();
app.use(cors());

app.get('/api/documents/pdf/:university/:filename', async (req, res) => {
  try {
    const { university, filename } = req.params;
    if (!filename.endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only PDF files allowed' });
    }
    const filePath = '/Users/fatih/Downloads/NEW_RAG/rag-chat/documents/' + university + '/' + filename;
    await fs.access(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    res.send(await fs.readFile(filePath));
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

app.listen(4002, () => console.log('PDF Server running on 4002'));
