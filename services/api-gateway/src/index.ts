import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import winston from 'winston';
import path from 'path';
import { config } from './config';
import { authMiddleware } from './middleware/auth';
import { apiRateLimiter } from './middleware/rate-limit';
import authRoutes from './routes/auth';
import proxyRoutes from './routes/proxy';
import healthRoutes from './routes/health';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.nodeEnv === 'development'
      ? winston.format.combine(winston.format.colorize(), winston.format.simple())
      : winston.format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [new winston.transports.Console()],
});

const app = express();

// Security headers (relaxed CSP for landing page inline styles/scripts and Google Fonts)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  })
);

// CORS
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Request logging
app.use(
  morgan('short', {
    stream: { write: (message: string) => logger.info(message.trim()) },
  })
);

// Rate limiting
app.use(apiRateLimiter);

// Serve static landing page
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve review-ui SPA at /app
app.use('/app', express.static(path.join(__dirname, '..', '..', '..', 'apps', 'review-ui', 'dist')));
app.get('/app/*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', '..', 'apps', 'review-ui', 'dist', 'index.html'));
});

// Health check (before auth)
app.use('/health', healthRoutes);

// Body parsing for auth routes
app.use(express.json());

// Auth routes (before auth middleware for login/refresh)
app.use('/auth', authRoutes);

// JWT authentication for all /api/* routes
app.use('/api', authMiddleware);

// Proxy routes
app.use('/api', proxyRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  logger.info(`API Gateway running on port ${config.port}`, {
    env: config.nodeEnv,
    services: config.services,
  });
});

export default app;
