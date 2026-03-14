import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { logger } from './utils/logger';
import documentRoutes from './routes/documents';
import { initializeStorage } from './services/storage-service';
import { initializeDatabase, shutdown as shutdownIngestion } from './services/ingestion-service';
import { startProcessor, stopProcessor, getQueueStats } from './workers/document-processor';
import { startEmailIngestion, stopEmailIngestion } from './services/email-ingestion-service';
import { shutdownOcr } from './services/ocr-service';

const app = express();

// --- Middleware ---
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.path}`, {
    ip: req.ip,
    contentType: req.headers['content-type'],
  });
  next();
});

// --- Routes ---
app.use('/documents', documentRoutes);

// Health check
app.get('/health', async (_req: Request, res: Response) => {
  let queueStats = null;
  try {
    // Timeout queue stats check to avoid hanging when Redis is unavailable
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 2000)
    );
    queueStats = await Promise.race([getQueueStats(), timeoutPromise]);
  } catch {
    // Queue not available, that's OK
  }
  res.json({
    status: 'healthy',
    service: 'document-service',
    timestamp: new Date().toISOString(),
    ...(queueStats ? { queue: queueStats } : {}),
  });
});

// Readiness check
app.get('/ready', async (_req: Request, res: Response) => {
  try {
    const queueStats = await getQueueStats();
    res.json({
      status: 'ready',
      queue: queueStats,
    });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});

// --- Error handling ---
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// --- Startup ---
async function start(): Promise<void> {
  logger.info('Starting document service...');

  // Initialize storage buckets (non-blocking)
  try {
    await initializeStorage();
    logger.info('Storage initialized');
  } catch (err) {
    logger.warn('Storage initialization failed, continuing without storage', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Initialize database schema (non-blocking)
  try {
    await initializeDatabase();
    logger.info('Database initialized');
  } catch (err) {
    logger.warn('Database initialization failed, continuing without database', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Start the document processing worker (non-blocking)
  try {
    startProcessor();
    logger.info('Document processor started');
  } catch (err) {
    logger.warn('Document processor failed to start, continuing without processor', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Start email ingestion if enabled (non-blocking)
  try {
    await startEmailIngestion();
  } catch (err) {
    logger.warn('Email ingestion failed to start', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Start HTTP server - this must succeed
  const server = app.listen(config.port, () => {
    logger.info(`Document service listening on port ${config.port}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    server.close(async () => {
      try {
        await stopEmailIngestion();
        await stopProcessor();
        await shutdownOcr();
        await shutdownIngestion();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', {
          error: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
      }
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();

export default app;
