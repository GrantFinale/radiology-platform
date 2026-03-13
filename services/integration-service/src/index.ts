import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import hl7Routes from './routes/hl7';
import fhirRoutes from './routes/fhir';
import emrRoutes from './routes/emr';
import { startIntegrationWorker, stopIntegrationWorker, getQueueStats } from './workers/integration-worker';
import { EMRAdapterFactory } from './services/emr-adapter';
import { EpicAdapter } from './adapters/epic-adapter';
import { CernerAdapter } from './adapters/cerner-adapter';
import { GenericAdapter } from './adapters/generic-adapter';
import logger from './utils/logger';

// Register EMR adapters
EMRAdapterFactory.register('epic', EpicAdapter);
EMRAdapterFactory.register('cerner', CernerAdapter);
EMRAdapterFactory.register('generic', GenericAdapter);

const app = express();

// Middleware
app.use(helmet());
app.use(cors());

// Parse JSON for FHIR and EMR routes
app.use(express.json({ limit: '10mb' }));

// Parse raw text for HL7 messages
app.use(
  express.text({
    type: ['application/hl7-v2', 'text/plain', 'x-application/hl7-v2+er7'],
    limit: '1mb',
  }),
);

// Health check
app.get('/health', async (_req, res) => {
  let queueStats = null;
  try {
    queueStats = await getQueueStats();
  } catch {
    // Queue may not be available
  }

  res.json({
    status: 'healthy',
    service: 'integration-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    adapters: EMRAdapterFactory.getRegisteredTypes(),
    queue: queueStats,
  });
});

// Routes
app.use('/hl7', hl7Routes);
app.use('/fhir', fhirRoutes);
app.use('/emr', emrRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(config.port, () => {
  logger.info(`Integration service listening on port ${config.port}`, {
    env: config.nodeEnv,
    adapters: EMRAdapterFactory.getRegisteredTypes(),
  });

  // Start the integration worker
  try {
    startIntegrationWorker();
  } catch (error: any) {
    logger.warn('Failed to start integration worker (Redis may not be available)', {
      error: error.message,
    });
  }
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  server.close(async () => {
    try {
      await stopIntegrationWorker();
    } catch {
      // Ignore worker shutdown errors
    }
    logger.info('Integration service shut down');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
