import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';
import { closeBrowser } from './services/scraper.js';
import { cleanOldJobs } from './services/queue.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend requests (support localhost and Vercel production domains)
app.use(
  cors({
    origin: true, // Reflect request origin or specify allowed frontend domains
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
const server = app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Data2Pro Backend is running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
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
