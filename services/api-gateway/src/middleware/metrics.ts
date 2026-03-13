import { Request, Response, NextFunction, Router } from 'express';
import client from 'prom-client';

// Create a custom registry so we don't pollute the global one
const register = new client.Registry();

// Add default Node.js metrics (event loop lag, heap size, etc.)
client.collectDefaultMetrics({ register, prefix: 'rip_' });

// ─────────────────────────────────────────────
// Custom Metrics
// ─────────────────────────────────────────────

/** Total HTTP requests received */
const httpRequestsTotal = new client.Counter({
  name: 'rip_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

/** Histogram of HTTP request durations in seconds */
const httpRequestDuration = new client.Histogram({
  name: 'rip_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

/** Currently in-flight requests */
const httpRequestsInFlight = new client.Gauge({
  name: 'rip_http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed',
  registers: [register],
});

/** Request body size in bytes */
const httpRequestSize = new client.Histogram({
  name: 'rip_http_request_size_bytes',
  help: 'Size of HTTP request bodies in bytes',
  labelNames: ['method', 'route'] as const,
  buckets: [100, 1000, 10_000, 100_000, 1_000_000, 10_000_000, 50_000_000],
  registers: [register],
});

/** Response body size in bytes */
const httpResponseSize = new client.Histogram({
  name: 'rip_http_response_size_bytes',
  help: 'Size of HTTP response bodies in bytes',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [100, 1000, 10_000, 100_000, 1_000_000, 10_000_000],
  registers: [register],
});

// ─────────────────────────────────────────────
// Domain-specific Metrics
// ─────────────────────────────────────────────

/** Orders processed by status */
export const ordersProcessed = new client.Counter({
  name: 'rip_orders_processed_total',
  help: 'Total orders processed, labeled by status',
  labelNames: ['status'] as const,
  registers: [register],
});

/** Documents ingested */
export const documentsIngested = new client.Counter({
  name: 'rip_documents_ingested_total',
  help: 'Total documents ingested',
  labelNames: ['type'] as const,
  registers: [register],
});

/** OCR processing time in seconds */
export const ocrProcessingDuration = new client.Histogram({
  name: 'rip_ocr_processing_duration_seconds',
  help: 'Time taken to process OCR on a document',
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

/** OCR confidence score distribution */
export const ocrConfidence = new client.Histogram({
  name: 'rip_ocr_confidence',
  help: 'OCR confidence score distribution',
  buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0],
  registers: [register],
});

/** Queue depth gauges */
export const queueDepth = new client.Gauge({
  name: 'rip_queue_depth',
  help: 'Current depth of processing queues',
  labelNames: ['queue'] as const,
  registers: [register],
});

/** Active human review tasks */
export const activeReviewTasks = new client.Gauge({
  name: 'rip_active_review_tasks',
  help: 'Number of active human review tasks',
  registers: [register],
});

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Normalise an Express path so high-cardinality segments (UUIDs, numeric IDs)
 * are replaced with a placeholder. This keeps the label space bounded.
 */
function normalisePath(req: Request): string {
  const route = req.route?.path;
  if (route) return route;

  // Fallback: collapse IDs/UUIDs in the raw URL
  return req.path
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    )
    .replace(/\/\d+/g, '/:id');
}

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

/**
 * Express middleware that records request count, latency, and sizes
 * per method / route / status_code.
 */
export function metricsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Don't instrument the metrics endpoint itself
  if (req.path === '/metrics') {
    next();
    return;
  }

  const start = process.hrtime.bigint();
  httpRequestsInFlight.inc();

  // Record request body size if available
  const reqContentLength = req.headers['content-length'];
  if (reqContentLength) {
    const route = normalisePath(req);
    httpRequestSize.observe({ method: req.method, route }, Number(reqContentLength));
  }

  // Hook into response finish to capture final status code and duration
  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationS = durationNs / 1e9;
    const route = normalisePath(req);
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationS);
    httpRequestsInFlight.dec();

    // Record response size
    const resContentLength = res.getHeader('content-length');
    if (resContentLength) {
      httpResponseSize.observe(labels, Number(resContentLength));
    }
  });

  next();
}

// ─────────────────────────────────────────────
// /metrics endpoint router
// ─────────────────────────────────────────────

export const metricsRouter = Router();

metricsRouter.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).end(String(err));
  }
});

export { register };
export default metricsMiddleware;
