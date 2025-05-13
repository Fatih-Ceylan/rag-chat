// server.js --------------------------------------------------------------
import express from "express";
import cors from "cors";
import routes from './routes/index.js';

const app = express();

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Body parsing middleware
app.use(express.json());

// Mount all routes
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error'
  });
});

app.listen(4000, () => console.log("RAG API 4000'de"));
