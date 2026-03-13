import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/radiology_orders',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  minioEndpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
