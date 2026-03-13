import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().default(3002),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // PostgreSQL
  db: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(5432),
    database: z.string().default('radiology_documents'),
    user: z.string().default('postgres'),
    password: z.string().default('postgres'),
    ssl: z.coerce.boolean().default(false),
    maxConnections: z.coerce.number().default(20),
  }),

  // Redis
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(6379),
    password: z.string().optional(),
    db: z.coerce.number().default(0),
  }),

  // MinIO / S3
  minio: z.object({
    endPoint: z.string().default('localhost'),
    port: z.coerce.number().default(9000),
    useSSL: z.coerce.boolean().default(false),
    accessKey: z.string().default('minioadmin'),
    secretKey: z.string().default('minioadmin'),
    bucketName: z.string().default('radiology-documents'),
    previewBucket: z.string().default('radiology-previews'),
  }),

  // Email IMAP
  email: z.object({
    enabled: z.coerce.boolean().default(false),
    host: z.string().default(''),
    port: z.coerce.number().default(993),
    user: z.string().default(''),
    password: z.string().default(''),
    tls: z.coerce.boolean().default(true),
    mailbox: z.string().default('INBOX'),
    pollIntervalMs: z.coerce.number().default(30000),
  }),

  // OCR settings
  ocr: z.object({
    language: z.string().default('eng'),
    confidenceThreshold: z.coerce.number().default(60),
    maxPages: z.coerce.number().default(100),
  }),

  // Upload limits
  upload: z.object({
    maxFileSizeMb: z.coerce.number().default(50),
    allowedMimeTypes: z.string().default(
      'application/pdf,image/tiff,image/jpeg,image/png,image/gif,image/bmp'
    ),
  }),

  // Order service for forwarding extracted data
  orderServiceUrl: z.string().default('http://order-service:3001'),

  // Queue settings
  queue: z.object({
    concurrency: z.coerce.number().default(3),
    maxRetries: z.coerce.number().default(3),
    retryDelayMs: z.coerce.number().default(5000),
  }),
});

function loadConfig() {
  const raw = {
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,
    db: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL,
      maxConnections: process.env.DB_MAX_CONNECTIONS,
    },
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB,
    },
    minio: {
      endPoint: process.env.MINIO_ENDPOINT,
      port: process.env.MINIO_PORT,
      useSSL: process.env.MINIO_USE_SSL,
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      bucketName: process.env.MINIO_BUCKET,
      previewBucket: process.env.MINIO_PREVIEW_BUCKET,
    },
    email: {
      enabled: process.env.EMAIL_ENABLED,
      host: process.env.EMAIL_IMAP_HOST,
      port: process.env.EMAIL_IMAP_PORT,
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD,
      tls: process.env.EMAIL_TLS,
      mailbox: process.env.EMAIL_MAILBOX,
      pollIntervalMs: process.env.EMAIL_POLL_INTERVAL_MS,
    },
    ocr: {
      language: process.env.OCR_LANGUAGE,
      confidenceThreshold: process.env.OCR_CONFIDENCE_THRESHOLD,
      maxPages: process.env.OCR_MAX_PAGES,
    },
    upload: {
      maxFileSizeMb: process.env.UPLOAD_MAX_FILE_SIZE_MB,
      allowedMimeTypes: process.env.UPLOAD_ALLOWED_MIME_TYPES,
    },
    orderServiceUrl: process.env.ORDER_SERVICE_URL,
    queue: {
      concurrency: process.env.QUEUE_CONCURRENCY,
      maxRetries: process.env.QUEUE_MAX_RETRIES,
      retryDelayMs: process.env.QUEUE_RETRY_DELAY_MS,
    },
  };

  return configSchema.parse(raw);
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;
