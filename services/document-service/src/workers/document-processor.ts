import Queue, { Job } from 'bull';
import sharp from 'sharp';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as ocrService from '../services/ocr-service';
import * as storageService from '../services/storage-service';
import * as ingestionService from '../services/ingestion-service';

interface ProcessJobData {
  documentId: string;
  storageKey: string;
  mimeType: string;
}

let processorQueue: Queue.Queue<ProcessJobData> | null = null;

export function startProcessor(): Queue.Queue<ProcessJobData> {
  processorQueue = new Queue<ProcessJobData>('document-processing', {
    redis: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
    },
  });

  processorQueue.process('process', config.queue.concurrency, processDocumentJob);

  processorQueue.on('completed', (job) => {
    logger.info('Document processing completed', {
      jobId: job.id,
      documentId: job.data.documentId,
    });
  });

  processorQueue.on('failed', (job, err) => {
    logger.error('Document processing failed', {
      jobId: job.id,
      documentId: job.data.documentId,
      error: err.message,
      attemptsMade: job.attemptsMade,
    });
  });

  processorQueue.on('stalled', (job) => {
    logger.warn('Document processing job stalled', {
      jobId: job.id,
    });
  });

  // Dead letter queue handling — jobs that exhaust all retries
  processorQueue.on('failed', async (job, err) => {
    if (job.attemptsMade >= (job.opts.attempts || config.queue.maxRetries)) {
      logger.error('Document moved to dead letter state after exhausting retries', {
        documentId: job.data.documentId,
        attempts: job.attemptsMade,
        error: err.message,
      });

      try {
        await ingestionService.updateDocumentStatus(job.data.documentId, 'failed', {
          errorMessage: `Processing failed after ${job.attemptsMade} attempts: ${err.message}`,
          retryCount: job.attemptsMade,
        });
      } catch (updateErr) {
        logger.error('Failed to update document status after DLQ', {
          documentId: job.data.documentId,
          error: updateErr instanceof Error ? updateErr.message : String(updateErr),
        });
      }
    }
  });

  logger.info('Document processor worker started', {
    concurrency: config.queue.concurrency,
  });

  return processorQueue;
}

async function processDocumentJob(job: Job<ProcessJobData>): Promise<void> {
  const { documentId, storageKey, mimeType } = job.data;
  const jobLogger = logger.child({ documentId, jobId: job.id });

  jobLogger.info('Processing document', { storageKey, mimeType });

  try {
    // Update status to processing
    await ingestionService.updateDocumentStatus(documentId, 'processing');
    await job.progress(10);

    // Download from MinIO
    jobLogger.debug('Downloading document from storage');
    const buffer = await storageService.getDocument(config.minio.bucketName, storageKey);
    await job.progress(20);

    // Run OCR pipeline
    jobLogger.debug('Starting OCR processing');
    const ocrResult = await ocrService.processDocument(buffer, mimeType);
    await job.progress(70);

    // Generate preview thumbnail
    jobLogger.debug('Generating preview thumbnail');
    const previewKey = await generatePreview(documentId, buffer, mimeType);
    await job.progress(80);

    // Update document record with results
    await ingestionService.updateDocumentStatus(documentId, 'completed', {
      extractedText: ocrResult.text,
      ocrConfidence: ocrResult.confidence,
      pageCount: ocrResult.pages.length,
      isDigitalPdf: ocrResult.isDigitalPdf,
      processingTimeMs: ocrResult.processingTimeMs,
      previewKey: previewKey || undefined,
    });
    await job.progress(90);

    // Notify order service about extracted document
    await notifyOrderService(documentId, ocrResult);
    await job.progress(100);

    jobLogger.info('Document processing completed', {
      confidence: ocrResult.confidence,
      pageCount: ocrResult.pages.length,
      isDigitalPdf: ocrResult.isDigitalPdf,
      processingTimeMs: ocrResult.processingTimeMs,
      textLength: ocrResult.text.length,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    jobLogger.error('Document processing error', { error: errorMessage });

    // Update status for non-final failures (Bull will retry)
    if (job.attemptsMade < (job.opts.attempts || config.queue.maxRetries) - 1) {
      await ingestionService.updateDocumentStatus(documentId, 'queued', {
        errorMessage: `Attempt ${job.attemptsMade + 1} failed: ${errorMessage}`,
        retryCount: job.attemptsMade + 1,
      });
    }

    throw err; // Re-throw so Bull handles retry logic
  }
}

async function generatePreview(
  documentId: string,
  buffer: Buffer,
  mimeType: string
): Promise<string | null> {
  try {
    let imageBuffer: Buffer;

    if (mimeType === 'application/pdf') {
      // Convert first page of PDF to image
      imageBuffer = await sharp(buffer, { page: 0 })
        .resize({ width: 400, height: 566, fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();
    } else {
      // Resize image for thumbnail
      imageBuffer = await sharp(buffer)
        .resize({ width: 400, height: 566, fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();
    }

    const previewKey = `previews/${documentId}.jpg`;
    await storageService.uploadDocument(
      config.minio.previewBucket,
      previewKey,
      imageBuffer,
      'image/jpeg'
    );

    return previewKey;
  } catch (err) {
    logger.warn('Preview generation failed', {
      documentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function notifyOrderService(
  documentId: string,
  ocrResult: ocrService.OcrResult
): Promise<void> {
  try {
    const doc = await ingestionService.getDocumentById(documentId);
    if (!doc) {
      logger.warn('Document not found for order service notification', { documentId });
      return;
    }

    const payload = {
      documentId,
      source: doc.source,
      metadata: doc.metadata,
      extractedText: ocrResult.text,
      confidence: ocrResult.confidence,
      pageCount: ocrResult.pages.length,
      isDigitalPdf: ocrResult.isDigitalPdf,
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
    };

    const response = await fetch(`${config.orderServiceUrl}/orders/from-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.warn('Order service notification returned non-OK status', {
        documentId,
        status: response.status,
        statusText: response.statusText,
      });
    } else {
      logger.info('Order service notified of processed document', { documentId });
    }
  } catch (err) {
    // Don't fail the job if order service is unreachable
    logger.warn('Failed to notify order service', {
      documentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function stopProcessor(): Promise<void> {
  if (processorQueue) {
    await processorQueue.close();
    processorQueue = null;
    logger.info('Document processor worker stopped');
  }
}

export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = ingestionService.getQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}
