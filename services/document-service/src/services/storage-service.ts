import * as Minio from 'minio';
import { Readable } from 'stream';
import { config } from '../config';
import { logger } from '../utils/logger';

const minioClient = new Minio.Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

export async function ensureBucket(name: string): Promise<void> {
  const exists = await minioClient.bucketExists(name);
  if (!exists) {
    await minioClient.makeBucket(name);
    logger.info(`Created MinIO bucket: ${name}`);
  }
}

export async function uploadDocument(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string,
  metadata?: Record<string, string>
): Promise<{ etag: string; versionId: string | null }> {
  await ensureBucket(bucket);

  const metaHeaders: Record<string, string> = {
    'Content-Type': contentType,
    ...metadata,
  };

  const result = await minioClient.putObject(bucket, key, buffer, buffer.length, metaHeaders);
  logger.debug('Uploaded document to MinIO', { bucket, key, size: buffer.length });
  return result;
}

export async function getDocument(bucket: string, key: string): Promise<Buffer> {
  const stream: Readable = await minioClient.getObject(bucket, key);
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export async function generatePresignedUrl(
  bucket: string,
  key: string,
  expirySeconds: number = 3600
): Promise<string> {
  return minioClient.presignedGetObject(bucket, key, expirySeconds);
}

export async function deleteDocument(bucket: string, key: string): Promise<void> {
  await minioClient.removeObject(bucket, key);
  logger.debug('Deleted document from MinIO', { bucket, key });
}

export async function statDocument(
  bucket: string,
  key: string
): Promise<Minio.BucketItemStat> {
  return minioClient.statObject(bucket, key);
}

export async function initializeStorage(): Promise<void> {
  await ensureBucket(config.minio.bucketName);
  await ensureBucket(config.minio.previewBucket);
  logger.info('MinIO storage initialized');
}
