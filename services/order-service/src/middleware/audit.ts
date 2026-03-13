import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATION_METHODS.has(req.method)) {
    next();
    return;
  }

  const startTime = Date.now();
  const originalJson = res.json.bind(res);

  res.json = function auditedJson(body: unknown) {
    const duration = Date.now() - startTime;

    const auditEntry = {
      method: req.method,
      path: req.path,
      params: req.params,
      statusCode: res.statusCode,
      userId: (req as unknown as Record<string, unknown>).userId ?? 'anonymous',
      ip: req.ip,
      userAgent: req.get('user-agent'),
      duration,
      timestamp: new Date().toISOString(),
    };

    logger.info('Audit log', auditEntry);

    pool
      .query(
        `INSERT INTO audit_log (method, path, params, status_code, user_id, ip_address, user_agent, duration_ms, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          auditEntry.method,
          auditEntry.path,
          JSON.stringify(auditEntry.params),
          auditEntry.statusCode,
          auditEntry.userId,
          auditEntry.ip,
          auditEntry.userAgent,
          auditEntry.duration,
        ],
      )
      .catch((err) => {
        logger.warn('Failed to persist audit log', { error: (err as Error).message });
      });

    return originalJson(body);
  };

  next();
}
