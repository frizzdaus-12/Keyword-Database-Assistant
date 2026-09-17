import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { closeBrowser } from './services/scraper.js';
import { cleanOldJobs } from './services/queue.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Parse allowed origins from ALLOWED_ORIGINS env var (comma-separated list)
// Falls back to permissive dev mode if not set
const buildAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  const defaults = [
    'http://localhost:3000',
    'http://localhost:3001',
    `chrome-extension://pcbpgghengakafkklhljpndjpajgjphc`
  ];
  if (!envOrigins) return defaults;
  const parsed = envOrigins.split(',').map((o) => o.trim()).filter(Boolean);
  return [...new Set([...defaults, ...parsed])];
};

const ALLOWED_ORIGINS = buildAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin header (e.g., server-to-server, curl, Playwright)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      // Allow any chrome-extension:// origin dynamically
      if (origin.startsWith('chrome-extension://')) return callback(null, true);
      callback(new Error(`CORS: Origin "${origin}" is not allowed.`));
    },
    credentials: true
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Periodic cleanup of completed jobs every 30 minutes
setInterval(cleanOldJobs, 30 * 60 * 1000);

// Root route
app.get('/', (req, res) => {
  res.send({
    message: 'Data2Pro API Service is running 🚀',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      processKeywords: 'POST /api/keywords/process',
      jobStatus: 'GET /api/jobs/:jobId',
      generateVariants: 'POST /api/keywords/:id/generate-variants'
    }
  });
});

// Register API Routes
app.use('/api', apiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start listening
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`🚀 Data2Pro Backend is running on port ${PORT}`);
  console.log(`📡 URL: http://0.0.0.0:${PORT}`);
  console.log(`=========================================`);
});

// Graceful shutdown handling
const handleShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Closing server and Playwright browser...`);
  server.close(async () => {
    await closeBrowser();
    console.log('[Server] Successfully cleaned up and exited.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
