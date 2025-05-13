import express from 'express';
import chatRoutes from './chat.routes.js';
import documentRoutes from './document.routes.js';

const router = express.Router();

// Mount routes
router.use('/chat', chatRoutes);
router.use('/documents', documentRoutes);

export default router; 