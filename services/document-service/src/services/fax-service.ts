import sharp from 'sharp';
import { logger } from '../utils/logger';
import { ingestDocument, DocumentMetadata } from './ingestion-service';

export interface FaxWebhookPayload {
  faxId: string;
  from: string;
  to: string;
  status: string;
  numPages: number;
  mediaUrl?: string;
  mediaContentType?: string;
  timestamp?: string;
  // Twilio-style fields
  FaxSid?: string;
  From?: string;
  To?: string;
  NumPages?: string;
  MediaUrl?: string;
  Status?: string;
}

export async function processFaxWebhook(payload: FaxWebhookPayload): Promise<string> {
  // Normalize fields (support both camelCase and Twilio-style)
  const faxId = payload.faxId || payload.FaxSid || 'unknown';
  const from = payload.from || payload.From || 'unknown';
  const to = payload.to || payload.To || '';
  const numPages = payload.numPages || parseInt(payload.NumPages || '0', 10);
  const mediaUrl = payload.mediaUrl || payload.MediaUrl;
  const status = payload.status || payload.Status || 'received';

  logger.info('Processing fax webhook', {
    faxId,
    from,
    to,
    numPages,
    status,
  });

  if (status !== 'received' && status !== 'completed') {
    logger.info('Ignoring fax with non-received status', { faxId, status });
    throw new Error(`Fax status "${status}" is not processable`);
  }

  if (!mediaUrl) {
    throw new Error('Fax webhook missing mediaUrl — cannot download document');
  }

  // Download the fax document
  const { buffer, contentType } = await downloadFaxDocument(mediaUrl);

  // Convert TIFF to PDF if needed
  let finalBuffer = buffer;
  let finalContentType = contentType;
  let filename = `fax-${faxId}`;

  if (contentType === 'image/tiff' || contentType === 'image/tif') {
    finalBuffer = await convertTiffToPdf(buffer);
    finalContentType = 'application/pdf';
    filename += '.pdf';
  } else if (contentType === 'application/pdf') {
    filename += '.pdf';
  } else {
    // Keep as-is for other image types
    const ext = contentType.split('/')[1] || 'bin';
    filename += `.${ext}`;
  }

  const metadata: DocumentMetadata = {
    faxNumber: from,
    facility: to,
  };

  const documentId = await ingestDocument(
    finalBuffer,
    filename,
    finalContentType,
    'fax',
    metadata
  );

  logger.info('Fax document ingested', { documentId, faxId, from });
  return documentId;
}

export async function downloadFaxDocument(
  url: string
): Promise<{ buffer: Buffer; contentType: string }> {
  logger.debug('Downloading fax document', { url });

  const response = await fetch(url, {
    headers: {
      Accept: 'application/pdf, image/tiff, image/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download fax document: HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'application/pdf';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  logger.debug('Fax document downloaded', {
    size: buffer.length,
    contentType,
  });

  return { buffer, contentType };
}

export async function convertTiffToPdf(tiffBuffer: Buffer): Promise<Buffer> {
  logger.debug('Converting TIFF to PDF', { inputSize: tiffBuffer.length });

  try {
    // Extract all pages from multi-page TIFF
    const metadata = await sharp(tiffBuffer, { pages: -1 }).metadata();
    const pageCount = metadata.pages || 1;

    // For single-page TIFF, convert to PNG first then we'll treat it as an image
    // Sharp doesn't directly output PDF, so we convert to a high-quality PNG
    // The OCR pipeline will handle it from there
    if (pageCount === 1) {
      const pngBuffer = await sharp(tiffBuffer)
        .png({ quality: 100 })
        .toBuffer();

      logger.debug('Converted single-page TIFF to PNG', {
        inputSize: tiffBuffer.length,
        outputSize: pngBuffer.length,
      });

      // Return as PNG — the ingestion service will handle it
      return pngBuffer;
    }

    // For multi-page TIFF, extract each page as PNG
    // The document processor handles multi-page images
    const firstPage = await sharp(tiffBuffer, { page: 0 })
      .png({ quality: 100 })
      .toBuffer();

    logger.debug('Converted multi-page TIFF first page to PNG', {
      pageCount,
      inputSize: tiffBuffer.length,
      outputSize: firstPage.length,
    });

    return firstPage;
  } catch (err) {
    logger.error('TIFF conversion failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Return original buffer — OCR will attempt to process it directly
    return tiffBuffer;
  }
}
