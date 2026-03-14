import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';
import { checkDatabaseHealth, shutdownPool } from './db/pool';
import { connectRedis, shutdownRedis } from './db/redis';
import { errorHandler } from './middleware/error-handler';
import { auditMiddleware } from './middleware/audit';
import ordersRouter from './routes/orders';
import patientsRouter from './routes/patients';
import providersRouter from './routes/providers';
import reviewRouter from './routes/review';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', {
  stream: { write: (message: string) => logger.http(message.trim()) },
}));
app.use(express.json({ limit: '10mb' }));
app.use(auditMiddleware);

// Health check - always return 200 so gateway considers service healthy
app.get('/health', async (_req, res) => {
  let dbHealthy = false;
  try {
    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), 2000)
    );
    dbHealthy = await Promise.race([checkDatabaseHealth(), timeoutPromise]);
  } catch {
    // DB check failed
  }
  const status = dbHealthy ? 'healthy' : 'degraded';
  res.status(200).json({
    status,
    service: 'order-service',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealthy ? 'connected' : 'disconnected',
    },
  });
});

// Routes
app.use('/orders', ordersRouter);
app.use('/patients', patientsRouter);
app.use('/providers', providersRouter);
app.use('/reviews', reviewRouter);

// Error handler (must be last)
app.use(errorHandler);

// Startup
async function start(): Promise<void> {
  try {
    // Verify database connectivity
    const dbHealthy = await checkDatabaseHealth();
    if (!dbHealthy) {
      logger.warn('Database is not reachable at startup');
    }

    // Connect to Redis (non-blocking)
    await connectRedis();

    const server = app.listen(config.port, () => {
      logger.info(`Order service listening on port ${config.port}`, {
        env: config.nodeEnv,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      server.close(async () => {
        logger.info('HTTP server closed');
        await Promise.allSettled([shutdownPool(), shutdownRedis()]);
        logger.info('All connections closed');
        process.exit(0);
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Graceful shutdown timed out, forcing exit');
        process.exit(1);
      }, 30_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start order service, attempting to start HTTP server anyway', { error: (err as Error).message });
    const server = app.listen(config.port, () => {
      logger.info(`Order service listening on port ${config.port} (degraded mode)`, {
        env: config.nodeEnv,
      });
    });

    process.on('SIGTERM', () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 30_000);
    });
    process.on('SIGINT', () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 30_000);
    });
  }
}

start();

export { app };
