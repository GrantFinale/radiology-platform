import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import Queue from 'bull';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as storageService from './storage-service';
import mime from 'mime-types';

export type DocumentSource = 'upload' | 'fax' | 'email' | 'hl7' | 'fhir';

export type DocumentStatus =
  | 'received'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'reprocessing';

export interface DocumentMetadata {
  patientName?: string;
  patientId?: string;
  accessionNumber?: string;
  referringPhysician?: string;
  orderDate?: string;
  facility?: string;
  faxNumber?: string;
  emailFrom?: string;
  emailSubject?: string;
  hl7MessageId?: string;
  fhirRequestId?: string;
  [key: string]: string | undefined;
}

export interface DocumentRecord {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  previewKey: string | null;
  source: DocumentSource;
  status: DocumentStatus;
  metadata: DocumentMetadata;
  extractedText: string | null;
  ocrConfidence: number | null;
  pageCount: number | null;
  isDigitalPdf: boolean | null;
  processingTimeMs: number | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  max: config.db.maxConnections,
});

const documentQueue = new Queue('document-processing', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
  },
  defaultJobOptions: {
    attempts: config.queue.maxRetries,
    backoff: {
      type: 'exponential',
      delay: config.queue.retryDelayMs,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export async function initializeDatabase(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY,
      original_filename VARCHAR(512) NOT NULL,
      mime_type VARCHAR(128) NOT NULL,
      file_size_bytes BIGINT NOT NULL,
      storage_key VARCHAR(1024) NOT NULL,
      preview_key VARCHAR(1024),
      source VARCHAR(32) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'received',
      metadata JSONB DEFAULT '{}',
      extracted_text TEXT,
      ocr_confidence REAL,
      page_count INTEGER,
      is_digital_pdf BOOLEAN,
      processing_time_ms INTEGER,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);
    CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
    CREATE INDEX IF NOT EXISTS idx_documents_patient_id ON documents((metadata->>'patientId'));
    CREATE INDEX IF NOT EXISTS idx_documents_accession ON documents((metadata->>'accessionNumber'));
  `);
  logger.info('Documents table initialized');
}

export async function ingestDocument(
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string,
  source: DocumentSource,
  metadata: DocumentMetadata = {}
): Promise<string> {
  const documentId = uuidv4();
  const extension = mime.extension(mimeType) || 'bin';
  const storageKey = `${source}/${new Date().toISOString().slice(0, 10)}/${documentId}.${extension}`;

  logger.info('Ingesting document', {
    documentId,
    originalFilename,
    mimeType,
    source,
    size: fileBuffer.length,
  });

  // Store original in MinIO
  await storageService.uploadDocument(
    config.minio.bucketName,
    storageKey,
    fileBuffer,
    mimeType,
    {
      'X-Amz-Meta-Document-Id': documentId,
      'X-Amz-Meta-Source': source,
      'X-Amz-Meta-Original-Filename': encodeURIComponent(originalFilename),
    }
  );

  // Create DB record
  await pool.query(
    `INSERT INTO documents (
      id, original_filename, mime_type, file_size_bytes, storage_key,
      source, status, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      documentId,
      originalFilename,
      mimeType,
      fileBuffer.length,
      storageKey,
      source,
      'queued',
      JSON.stringify(metadata),
    ]
  );

  // Queue for processing
  await documentQueue.add(
    'process',
    { documentId, storageKey, mimeType },
    { jobId: documentId }
  );

  logger.info('Document queued for processing', { documentId });
  return documentId;
}

export async function getDocumentById(id: string): Promise<DocumentRecord | null> {
  const result = await pool.query(
    `SELECT
      id, original_filename, mime_type, file_size_bytes, storage_key,
      preview_key, source, status, metadata, extracted_text,
      ocr_confidence, page_count, is_digital_pdf, processing_time_ms,
      error_message, retry_count, created_at, updated_at
    FROM documents WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes),
    storageKey: row.storage_key,
    previewKey: row.preview_key,
    source: row.source,
    status: row.status,
    metadata: row.metadata,
    extractedText: row.extracted_text,
    ocrConfidence: row.ocr_confidence,
    pageCount: row.page_count,
    isDigitalPdf: row.is_digital_pdf,
    processingTimeMs: row.processing_time_ms,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  updates: Partial<{
    extractedText: string;
    ocrConfidence: number;
    pageCount: number;
    isDigitalPdf: boolean;
    processingTimeMs: number;
    errorMessage: string;
    previewKey: string;
    retryCount: number;
  }> = {}
): Promise<void> {
  const setClauses: string[] = ['status = $2', 'updated_at = NOW()'];
  const values: unknown[] = [id, status];
  let paramIndex = 3;

  const fieldMap: Record<string, string> = {
    extractedText: 'extracted_text',
    ocrConfidence: 'ocr_confidence',
    pageCount: 'page_count',
    isDigitalPdf: 'is_digital_pdf',
    processingTimeMs: 'processing_time_ms',
    errorMessage: 'error_message',
    previewKey: 'preview_key',
    retryCount: 'retry_count',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (key in updates) {
      setClauses.push(`${column} = $${paramIndex}`);
      values.push((updates as Record<string, unknown>)[key]);
      paramIndex++;
    }
  }

  await pool.query(
    `UPDATE documents SET ${setClauses.join(', ')} WHERE id = $1`,
    values
  );
}

export async function reprocessDocument(id: string): Promise<void> {
  const doc = await getDocumentById(id);
  if (!doc) throw new Error(`Document ${id} not found`);

  await updateDocumentStatus(id, 'reprocessing', {
    extractedText: '',
    ocrConfidence: 0,
    errorMessage: '',
  });

  await documentQueue.add(
    'process',
    { documentId: id, storageKey: doc.storageKey, mimeType: doc.mimeType },
    { jobId: `${id}-reprocess-${Date.now()}` }
  );

  logger.info('Document queued for reprocessing', { documentId: id });
}

export function getQueue(): Queue.Queue {
  return documentQueue;
}

export function getPool(): Pool {
  return pool;
}

export async function shutdown(): Promise<void> {
  await documentQueue.close();
  await pool.end();
  logger.info('Ingestion service shut down');
}
