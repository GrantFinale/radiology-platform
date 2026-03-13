import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  services: {
    orderService: process.env.ORDER_SERVICE_URL || 'http://localhost:3001',
    documentService: process.env.DOCUMENT_SERVICE_URL || 'http://localhost:3002',
    nlpService: process.env.NLP_SERVICE_URL || 'http://localhost:3003',
    integrationService: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:3004',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
} as const;
