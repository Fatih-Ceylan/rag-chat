// server.js --------------------------------------------------------------
import express from "express";
import cors from "cors";
import routes from './routes/index.js';

const app = express();
app.use(cors());                // UI'dan çağrılacaksa
app.use(express.json());

// Mount all routes
app.use('/api', routes);

app.listen(4000, () => console.log("RAG API 4000'de"));
