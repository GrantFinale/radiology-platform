import Tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
import sharp from 'sharp';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface OcrResult {
  text: string;
  confidence: number;
  pages: PageResult[];
  isDigitalPdf: boolean;
  processingTimeMs: number;
}

export interface PageResult {
  pageNumber: number;
  text: string;
  confidence: number;
}

let scheduler: Tesseract.Scheduler | null = null;

async function getScheduler(): Promise<Tesseract.Scheduler> {
  if (scheduler) return scheduler;

  scheduler = Tesseract.createScheduler();
  const workerCount = Math.min(config.queue.concurrency, 4);

  for (let i = 0; i < workerCount; i++) {
    const worker = await Tesseract.createWorker(config.ocr.language);
    scheduler.addWorker(worker);
  }

  logger.info(`Tesseract scheduler initialized with ${workerCount} workers`);
  return scheduler;
}

export async function processDocument(
  buffer: Buffer,
  mimeType: string
): Promise<OcrResult> {
  const startTime = Date.now();

  if (mimeType === 'application/pdf') {
    return processPdf(buffer, startTime);
  }

  if (mimeType.startsWith('image/')) {
    return processImage(buffer, startTime);
  }

  throw new Error(`Unsupported MIME type for OCR: ${mimeType}`);
}

async function processPdf(buffer: Buffer, startTime: number): Promise<OcrResult> {
  // First try digital text extraction
  const digitalResult = await extractTextFromPDF(buffer);

  if (digitalResult.text.trim().length > 50) {
    logger.info('PDF contains extractable digital text');
    return {
      text: digitalResult.text,
      confidence: 99,
      pages: digitalResult.pages,
      isDigitalPdf: true,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Fall back to OCR for scanned PDFs
  logger.info('PDF appears scanned, falling back to OCR');
  return ocrPdfPages(buffer, startTime);
}

export async function extractTextFromPDF(
  buffer: Buffer
): Promise<{ text: string; pages: PageResult[] }> {
  const data = await pdfParse(buffer, {
    max: config.ocr.maxPages,
  });

  // pdf-parse gives us the full text; we split by form feed for pages
  const pageTexts = data.text.split('\f').filter((t) => t.trim().length > 0);

  const pages: PageResult[] = pageTexts.map((text, i) => ({
    pageNumber: i + 1,
    text: text.trim(),
    confidence: 99,
  }));

  return {
    text: data.text.trim(),
    pages,
  };
}

async function ocrPdfPages(buffer: Buffer, startTime: number): Promise<OcrResult> {
  // Convert PDF pages to images using sharp
  // sharp can handle first page of PDF; for multi-page we process sequentially
  const pages: PageResult[] = [];
  let totalConfidence = 0;

  try {
    // Get page count by checking metadata
    const metadata = await sharp(buffer, { pages: -1 }).metadata();
    const pageCount = Math.min(metadata.pages || 1, config.ocr.maxPages);

    for (let i = 0; i < pageCount; i++) {
      const pageImage = await sharp(buffer, { page: i })
        .png()
        .toBuffer();

      const preprocessed = await preprocessImage(pageImage);
      const result = await extractTextFromImage(preprocessed);

      pages.push({
        pageNumber: i + 1,
        text: result.text,
        confidence: result.confidence,
      });
      totalConfidence += result.confidence;
    }
  } catch (err) {
    // If multi-page extraction fails, try single page
    logger.warn('Multi-page PDF OCR failed, trying single page', { error: err });
    const pageImage = await sharp(buffer).png().toBuffer();
    const preprocessed = await preprocessImage(pageImage);
    const result = await extractTextFromImage(preprocessed);

    pages.push({
      pageNumber: 1,
      text: result.text,
      confidence: result.confidence,
    });
    totalConfidence = result.confidence;
  }

  const avgConfidence = pages.length > 0 ? totalConfidence / pages.length : 0;

  return {
    text: pages.map((p) => p.text).join('\n\n--- Page Break ---\n\n'),
    confidence: Math.round(avgConfidence),
    pages,
    isDigitalPdf: false,
    processingTimeMs: Date.now() - startTime,
  };
}

async function processImage(buffer: Buffer, startTime: number): Promise<OcrResult> {
  const preprocessed = await preprocessImage(buffer);
  const result = await extractTextFromImage(preprocessed);

  return {
    text: result.text,
    confidence: result.confidence,
    pages: [
      {
        pageNumber: 1,
        text: result.text,
        confidence: result.confidence,
      },
    ],
    isDigitalPdf: false,
    processingTimeMs: Date.now() - startTime,
  };
}

export async function extractTextFromImage(
  buffer: Buffer
): Promise<{ text: string; confidence: number }> {
  const sched = await getScheduler();

  const {
    data: { text, confidence },
  } = await sched.addJob('recognize', buffer);

  return {
    text: text.trim(),
    confidence: calculateConfidence(confidence),
  };
}

export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  try {
    const metadata = await sharp(buffer).metadata();
    let pipeline = sharp(buffer);

    // Convert to grayscale for better OCR
    pipeline = pipeline.grayscale();

    // Normalize/enhance contrast
    pipeline = pipeline.normalize();

    // Apply mild sharpening to improve character edges
    pipeline = pipeline.sharpen({ sigma: 1.5 });

    // Resize if the image is very small (OCR works better at higher DPI)
    if (metadata.width && metadata.width < 1000) {
      const scaleFactor = Math.ceil(2000 / metadata.width);
      pipeline = pipeline.resize({
        width: metadata.width * scaleFactor,
        kernel: sharp.kernel.lanczos3,
      });
    }

    // Threshold for binarization — improves OCR on faded/noisy docs
    pipeline = pipeline.threshold(128);

    // Output as PNG for lossless OCR input
    return pipeline.png().toBuffer();
  } catch (err) {
    logger.warn('Image preprocessing failed, using original', { error: err });
    return buffer;
  }
}

export function calculateConfidence(rawConfidence: number): number {
  // Tesseract returns 0-100 confidence; we normalize and clamp
  const clamped = Math.max(0, Math.min(100, rawConfidence));
  return Math.round(clamped);
}

export async function shutdownOcr(): Promise<void> {
  if (scheduler) {
    await scheduler.terminate();
    scheduler = null;
    logger.info('Tesseract scheduler terminated');
  }
}
