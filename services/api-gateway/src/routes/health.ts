import { Router, Request, Response } from 'express';
import { config } from '../config';

const router = Router();

interface ServiceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTimeMs?: number;
  error?: string;
}

async function checkService(name: string, url: string): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    return {
      name,
      url,
      status: response.ok ? 'healthy' : 'unhealthy',
      responseTimeMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name,
      url,
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

router.get('/', async (_req: Request, res: Response) => {
  const services = await Promise.all([
    checkService('order-service', config.services.orderService),
    checkService('document-service', config.services.documentService),
    checkService('nlp-service', config.services.nlpService),
    checkService('integration-service', config.services.integrationService),
  ]);

  const allHealthy = services.every((s) => s.status === 'healthy');

  res.status(allHealthy ? 200 : 207).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services,
  });
});

export default router;
