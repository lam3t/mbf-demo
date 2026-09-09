import express from 'express';
import cors from 'cors';
import path from 'path';
import { CONFIG } from './config';
import { initDatabase } from './db/connection';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

// Initialize Database Schema on start
initDatabase();

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman) or matching dev ports
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory
app.use('/uploads', express.static(CONFIG.UPLOAD_DIR));

// API Routes
app.use('/api', routes);

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(CONFIG.PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 PA04 Backend Server running on port ${CONFIG.PORT}`);
  console.log(`📡 API Base URL: http://localhost:${CONFIG.PORT}/api`);
  console.log(`📁 SQLite DB: ${CONFIG.DB_PATH}`);
  console.log(`====================================================`);
});

export default app;
