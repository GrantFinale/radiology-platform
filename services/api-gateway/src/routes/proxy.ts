import { Router } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { config } from '../config';
import { logger } from '../index';

const router = Router();

function createProxy(target: string, pathRewrite?: Record<string, string>): any {
  const options: Options = {
    target,
    changeOrigin: true,
    pathRewrite,
    on: {
      proxyReq: (proxyReq, req) => {
        // Forward user info from JWT to downstream services
        const user = (req as any).user;
        if (user) {
          proxyReq.setHeader('X-User-Id', user.userId);
          proxyReq.setHeader('X-User-Role', user.role);
          proxyReq.setHeader('X-User-Name', user.username);
        }
      },
      error: (err, req, res) => {
        logger.error(`Proxy error: ${err.message}`, {
          target,
          path: (req as any).originalUrl,
        });
        if ('writeHead' in res && typeof res.writeHead === 'function') {
          (res as any).writeHead(502, { 'Content-Type': 'application/json' });
          (res as any).end(JSON.stringify({ error: 'Service unavailable' }));
        }
      },
    },
  };

  return createProxyMiddleware(options);
}

// Order service
router.use(
  '/orders',
  createProxy(config.services.orderService, {
    '^/api/orders': '/api/orders',
  })
);

// Reviews route to order service
router.use(
  '/reviews',
  createProxy(config.services.orderService, {
    '^/api/reviews': '/api/reviews',
  })
);

// Document service
router.use(
  '/documents',
  createProxy(config.services.documentService, {
    '^/api/documents': '/api/documents',
  })
);

// NLP service
router.use(
  '/nlp',
  createProxy(config.services.nlpService, {
    '^/api/nlp': '/api/nlp',
  })
);

// Integration service
router.use(
  '/integrations',
  createProxy(config.services.integrationService, {
    '^/api/integrations': '/api/integrations',
  })
);

export default router;
