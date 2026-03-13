import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { singleUpload, multiUpload } from '../middleware/upload';
import { logger } from '../utils/logger';
import * as ingestionService from '../services/ingestion-service';
import * as storageService from '../services/storage-service';
import * as faxService from '../services/fax-service';
import * as emailIngestionService from '../services/email-ingestion-service';
import { config } from '../config';

const router = Router();

// --- Validation schemas ---

const faxWebhookSchema = z.object({
  faxId: z.string().optional(),
  FaxSid: z.string().optional(),
  from: z.string().optional(),
  From: z.string().optional(),
  to: z.string().optional(),
  To: z.string().optional(),
  status: z.string().optional(),
  Status: z.string().optional(),
  numPages: z.number().optional(),
  NumPages: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  MediaUrl: z.string().url().optional(),
  timestamp: z.string().optional(),
}).refine(
  (data) => data.mediaUrl || data.MediaUrl,
  { message: 'Either mediaUrl or MediaUrl is required' }
);

const hl7MessageSchema = z.object({
  message: z.string().min(1, 'HL7 message content is required'),
  messageType: z.string().default('ORM^O01'),
});

const fhirBundleSchema = z.object({
  resourceType: z.literal('Bundle'),
  type: z.string(),
  entry: z.array(z.object({
    resource: z.record(z.unknown()),
  })).min(1),
});

const uploadMetadataSchema = z.object({
  patientName: z.string().optional(),
  patientId: z.string().optional(),
  accessionNumber: z.string().optional(),
  referringPhysician: z.string().optional(),
  orderDate: z.string().optional(),
  facility: z.string().optional(),
}).passthrough();

// --- Middleware ---

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function handleMulterError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: 'File too large',
      message: `Maximum file size is ${config.upload.maxFileSizeMb}MB`,
    });
    return;
  }
  if (err && err.message?.includes('File type')) {
    res.status(415).json({
      error: 'Unsupported file type',
      message: err.message,
    });
    return;
  }
  next(err);
}

// --- Routes ---

/**
 * POST /documents/upload
 * Upload a document (PDF, TIFF, JPEG, PNG) via multipart form data
 */
router.post(
  '/upload',
  (req: Request, res: Response, next: NextFunction) => {
    singleUpload(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    let metadata: ingestionService.DocumentMetadata = {};
    if (req.body.metadata) {
      try {
        const parsed = typeof req.body.metadata === 'string'
          ? JSON.parse(req.body.metadata)
          : req.body.metadata;
        metadata = uploadMetadataSchema.parse(parsed) as ingestionService.DocumentMetadata;
      } catch (err) {
        logger.warn('Invalid upload metadata', { error: err });
      }
    }

    const documentId = await ingestionService.ingestDocument(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'upload',
      metadata
    );

    res.status(201).json({
      id: documentId,
      status: 'queued',
      message: 'Document uploaded and queued for processing',
    });
  })
);

/**
 * POST /documents/fax
 * Receive fax webhook notification
 */
router.post(
  '/fax',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = faxWebhookSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid fax webhook payload',
        details: parseResult.error.issues,
      });
      return;
    }

    const documentId = await faxService.processFaxWebhook(parseResult.data as faxService.FaxWebhookPayload);

    res.status(201).json({
      id: documentId,
      status: 'queued',
      message: 'Fax document received and queued for processing',
    });
  })
);

/**
 * POST /documents/email
 * Trigger email processing (manual trigger or webhook)
 */
router.post(
  '/email',
  asyncHandler(async (req: Request, res: Response) => {
    // If attachments are provided directly (webhook-style)
    if (req.body.attachments && Array.isArray(req.body.attachments)) {
      const documentIds: string[] = [];
      const metadata: ingestionService.DocumentMetadata = {
        emailFrom: req.body.from || '',
        emailSubject: req.body.subject || '',
      };

      for (const attachment of req.body.attachments) {
        if (!attachment.content || !attachment.filename || !attachment.contentType) {
          continue;
        }

        const buffer = Buffer.from(attachment.content, 'base64');
        const docId = await ingestionService.ingestDocument(
          buffer,
          attachment.filename,
          attachment.contentType,
          'email',
          metadata
        );
        documentIds.push(docId);
      }

      res.status(201).json({
        ids: documentIds,
        count: documentIds.length,
        message: `${documentIds.length} document(s) from email queued for processing`,
      });
      return;
    }

    // Otherwise, trigger IMAP poll
    const count = await emailIngestionService.pollForNewMessages();

    res.status(200).json({
      processed: count,
      message: `Polled email inbox, processed ${count} message(s)`,
    });
  })
);

/**
 * POST /documents/hl7
 * Receive HL7v2 message (ORM^O01) with embedded or referenced document
 */
router.post(
  '/hl7',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = hl7MessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid HL7 message',
        details: parseResult.error.issues,
      });
      return;
    }

    const { message } = parseResult.data;
    const segments = message.split('\r').filter((s) => s.length > 0);

    // Parse key HL7 segments
    const metadata: ingestionService.DocumentMetadata = {};
    let embeddedData: string | null = null;
    let embeddedType: string | null = null;

    for (const segment of segments) {
      const fields = segment.split('|');
      const segType = fields[0];

      switch (segType) {
        case 'MSH':
          metadata.hl7MessageId = fields[9] || undefined; // Message Control ID
          break;

        case 'PID':
          // PID-3: Patient ID, PID-5: Patient Name
          metadata.patientId = fields[3]?.split('^')[0] || undefined;
          if (fields[5]) {
            const nameParts = fields[5].split('^');
            metadata.patientName = [nameParts[1], nameParts[0]].filter(Boolean).join(' ');
          }
          break;

        case 'ORC':
          // ORC-2: Placer Order Number, ORC-12: Ordering Provider
          metadata.accessionNumber = fields[2]?.split('^')[0] || undefined;
          if (fields[12]) {
            const provParts = fields[12].split('^');
            metadata.referringPhysician = [provParts[1], provParts[0]].filter(Boolean).join(' ');
          }
          break;

        case 'OBR':
          // OBR-4: Universal Service ID (exam code)
          if (fields[4]) {
            metadata.facility = fields[4];
          }
          break;

        case 'OBX':
          // OBX-5: Observation Value (may contain base64-encoded document)
          // OBX-5.3: encoding type, OBX-5.4: data
          if (fields[5] && fields[2] === 'ED') {
            const obxParts = fields[5].split('^');
            embeddedType = obxParts[2] || 'application/pdf';
            embeddedData = obxParts[4] || obxParts[0];
          }
          break;
      }
    }

    if (!embeddedData) {
      // No embedded document — just record the HL7 message metadata
      res.status(200).json({
        message: 'HL7 message received (no embedded document)',
        metadata,
      });
      return;
    }

    // Decode and ingest embedded document
    const buffer = Buffer.from(embeddedData, 'base64');
    const mimeType = embeddedType || 'application/pdf';

    const documentId = await ingestionService.ingestDocument(
      buffer,
      `hl7-${metadata.hl7MessageId || 'unknown'}.pdf`,
      mimeType,
      'hl7',
      metadata
    );

    res.status(201).json({
      id: documentId,
      status: 'queued',
      metadata,
      message: 'HL7 document received and queued for processing',
    });
  })
);

/**
 * POST /documents/fhir
 * Receive FHIR ServiceRequest bundle with document references
 */
router.post(
  '/fhir',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = fhirBundleSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid FHIR bundle',
        details: parseResult.error.issues,
      });
      return;
    }

    const bundle = parseResult.data;
    const documentIds: string[] = [];
    const metadata: ingestionService.DocumentMetadata = {};

    for (const entry of bundle.entry) {
      const resource = entry.resource as Record<string, any>;

      if (resource.resourceType === 'ServiceRequest') {
        metadata.fhirRequestId = resource.id;
        metadata.accessionNumber = resource.identifier?.[0]?.value;

        // Extract patient reference
        if (resource.subject?.reference) {
          metadata.patientId = resource.subject.reference.replace('Patient/', '');
        }
        if (resource.subject?.display) {
          metadata.patientName = resource.subject.display;
        }

        // Extract requester (referring physician)
        if (resource.requester?.display) {
          metadata.referringPhysician = resource.requester.display;
        }
      }

      if (resource.resourceType === 'DocumentReference') {
        for (const content of resource.content || []) {
          const attachment = content.attachment;
          if (!attachment?.data) continue;

          const buffer = Buffer.from(attachment.data, 'base64');
          const contentType = attachment.contentType || 'application/pdf';
          const filename = attachment.title || `fhir-doc-${resource.id || 'unknown'}`;

          const docId = await ingestionService.ingestDocument(
            buffer,
            filename,
            contentType,
            'fhir',
            metadata
          );
          documentIds.push(docId);
        }

        // Handle URL-referenced documents
        for (const content of resource.content || []) {
          const attachment = content.attachment;
          if (!attachment?.url || attachment.data) continue;

          try {
            const response = await fetch(attachment.url);
            if (!response.ok) continue;

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = attachment.contentType || response.headers.get('content-type') || 'application/pdf';

            const docId = await ingestionService.ingestDocument(
              buffer,
              attachment.title || `fhir-doc-${resource.id || 'unknown'}`,
              contentType,
              'fhir',
              metadata
            );
            documentIds.push(docId);
          } catch (err) {
            logger.warn('Failed to fetch FHIR document reference', {
              url: attachment.url,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    res.status(201).json({
      ids: documentIds,
      count: documentIds.length,
      metadata,
      message: `${documentIds.length} document(s) from FHIR bundle queued for processing`,
    });
  })
);

/**
 * GET /documents/:id
 * Get document details and extracted text
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const doc = await ingestionService.getDocumentById(id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Generate a presigned URL for the original document
    let downloadUrl: string | null = null;
    try {
      downloadUrl = await storageService.generatePresignedUrl(
        config.minio.bucketName,
        doc.storageKey,
        3600
      );
    } catch {
      // Storage might not be accessible
    }

    res.json({
      ...doc,
      downloadUrl,
    });
  })
);

/**
 * GET /documents/:id/preview
 * Get document preview/thumbnail
 */
router.get(
  '/:id/preview',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const doc = await ingestionService.getDocumentById(id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    if (!doc.previewKey) {
      res.status(404).json({ error: 'Preview not available' });
      return;
    }

    try {
      const previewUrl = await storageService.generatePresignedUrl(
        config.minio.previewBucket,
        doc.previewKey,
        3600
      );
      res.redirect(previewUrl);
    } catch {
      res.status(404).json({ error: 'Preview not found in storage' });
    }
  })
);

/**
 * POST /documents/:id/reprocess
 * Re-run OCR/extraction on a document
 */
router.post(
  '/:id/reprocess',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const doc = await ingestionService.getDocumentById(id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    await ingestionService.reprocessDocument(id);

    res.json({
      id,
      status: 'reprocessing',
      message: 'Document queued for reprocessing',
    });
  })
);

export default router;
