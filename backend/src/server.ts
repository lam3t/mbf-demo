import fs from 'fs';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { CONFIG } from './config';
import { initDatabase } from './db/connection';
import { initDeadlineCheckerCron } from './services/deadlineChecker';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

// Initialize Database Schema on start
initDatabase();

// Initialize Deadline Checker Cron
initDeadlineCheckerCron();


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
app.use(routes);

// Serve Angular static frontend build in production if present
const possibleFrontendPaths = [
  path.resolve(__dirname, '../../frontend/dist/frontend/browser'),
  path.resolve(__dirname, '../frontend/dist/frontend/browser'),
  path.resolve(process.cwd(), 'frontend/dist/frontend/browser'),
  path.resolve(process.cwd(), 'dist/frontend/browser')
];
const frontendDist = possibleFrontendPaths.find(p => fs.existsSync(p));

if (frontendDist) {
  console.log(`📦 Serving static frontend from: ${frontendDist}`);
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Global Error Handler
app.use(errorHandler);

// Start Server (only when executed directly, not when imported in serverless function)
if (require.main === module) {
  app.listen(CONFIG.PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 TNT Backend Server running on port ${CONFIG.PORT}`);
    console.log(`📡 API Base URL: http://localhost:${CONFIG.PORT}/api`);
    console.log(`📁 SQLite DB: ${CONFIG.DB_PATH}`);
    console.log(`====================================================`);
  });
}

export default app;
