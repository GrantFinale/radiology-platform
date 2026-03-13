import { createTransport, Transporter } from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ingestDocument, DocumentMetadata } from './ingestion-service';

interface ImapMessage {
  uid: number;
  from: string;
  subject: string;
  date: Date;
  textBody: string;
  htmlBody: string;
  attachments: ImapAttachment[];
}

interface ImapAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  size: number;
}

// We use nodemailer's built-in IMAP support via a simplified approach.
// For production, a dedicated IMAP library like imapflow would be preferred.
// This implementation uses a polling model with basic IMAP commands.

let pollTimer: NodeJS.Timeout | null = null;
let isPolling = false;

const ALLOWED_ATTACHMENT_TYPES = new Set([
  'application/pdf',
  'image/tiff',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
]);

export async function startEmailIngestion(): Promise<void> {
  if (!config.email.enabled) {
    logger.info('Email ingestion is disabled');
    return;
  }

  logger.info('Starting email ingestion polling', {
    host: config.email.host,
    user: config.email.user,
    interval: config.email.pollIntervalMs,
  });

  // Initial poll
  await pollForNewMessages();

  // Set up recurring poll
  pollTimer = setInterval(async () => {
    if (isPolling) {
      logger.debug('Skipping email poll — previous poll still running');
      return;
    }
    await pollForNewMessages();
  }, config.email.pollIntervalMs);
}

export async function stopEmailIngestion(): Promise<void> {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  logger.info('Email ingestion stopped');
}

export async function pollForNewMessages(): Promise<number> {
  if (!config.email.enabled) return 0;

  isPolling = true;
  let processedCount = 0;

  try {
    // Use nodemailer's MailListener-like approach via IMAP
    // In production, replace with imapflow for robust IMAP handling
    const messages = await fetchUnseenMessages();

    for (const message of messages) {
      try {
        await processEmailOrder(message);
        processedCount++;
      } catch (err) {
        logger.error('Failed to process email message', {
          uid: message.uid,
          subject: message.subject,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (processedCount > 0) {
      logger.info(`Processed ${processedCount} email messages`);
    }
  } catch (err) {
    logger.error('Email polling failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    isPolling = false;
  }

  return processedCount;
}

async function fetchUnseenMessages(): Promise<ImapMessage[]> {
  // This is a simplified IMAP fetch implementation.
  // In production, use imapflow or similar for full IMAP support.
  // nodemailer itself is primarily for sending; for receiving we need
  // to use its underlying IMAP connection or a dedicated library.

  const { ImapFlow } = await loadImapFlow();

  const client = new ImapFlow({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.tls,
    auth: {
      user: config.email.user,
      pass: config.email.password,
    },
    logger: false,
  });

  const messages: ImapMessage[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock(config.email.mailbox);

    try {
      const searchResults = await client.search({ seen: false });

      for (const uid of searchResults) {
        const message = await client.fetchOne(uid, {
          source: true,
          envelope: true,
          uid: true,
        });

        if (!message?.source) continue;

        const parsed = await parseEmail(message.source);
        messages.push({
          uid: message.uid,
          from: parsed.from,
          subject: parsed.subject,
          date: parsed.date,
          textBody: parsed.textBody,
          htmlBody: parsed.htmlBody,
          attachments: parsed.attachments,
        });

        // Mark as seen
        await client.messageFlagsAdd(uid, ['\\Seen']);
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    logger.error('IMAP connection failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    try {
      await client.logout();
    } catch {
      // ignore logout errors
    }
  }

  return messages;
}

async function loadImapFlow(): Promise<{ ImapFlow: any }> {
  // Dynamic import to handle optional dependency
  try {
    return await import('imapflow' as string);
  } catch {
    throw new Error(
      'imapflow package is required for email ingestion. Install it with: npm install imapflow'
    );
  }
}

async function parseEmail(
  source: Buffer
): Promise<{
  from: string;
  subject: string;
  date: Date;
  textBody: string;
  htmlBody: string;
  attachments: ImapAttachment[];
}> {
  const { simpleParser } = await import('mailparser' as string);
  const parsed = await simpleParser(source);

  const attachments: ImapAttachment[] = (parsed.attachments || [])
    .filter((att: any) => ALLOWED_ATTACHMENT_TYPES.has(att.contentType))
    .map((att: any) => ({
      filename: att.filename || 'attachment',
      contentType: att.contentType,
      content: att.content,
      size: att.size,
    }));

  return {
    from: typeof parsed.from?.text === 'string' ? parsed.from.text : '',
    subject: parsed.subject || '',
    date: parsed.date || new Date(),
    textBody: parsed.text || '',
    htmlBody: parsed.html || '',
    attachments,
  };
}

export function extractAttachments(message: ImapMessage): ImapAttachment[] {
  return message.attachments.filter((att) => ALLOWED_ATTACHMENT_TYPES.has(att.contentType));
}

export async function processEmailOrder(message: ImapMessage): Promise<string[]> {
  const attachments = extractAttachments(message);

  if (attachments.length === 0) {
    logger.info('Email has no valid attachments, skipping', {
      uid: message.uid,
      subject: message.subject,
    });
    return [];
  }

  logger.info('Processing email order', {
    uid: message.uid,
    from: message.from,
    subject: message.subject,
    attachmentCount: attachments.length,
  });

  const metadata: DocumentMetadata = {
    emailFrom: message.from,
    emailSubject: message.subject,
  };

  // Extract patient info from subject line if it follows a pattern
  // e.g., "Order - Smith, John - MRN12345"
  const subjectMatch = message.subject.match(
    /(?:order|req(?:uest)?)\s*[-:]\s*([^-]+)\s*[-:]\s*(?:mrn\s*)?(\w+)/i
  );
  if (subjectMatch) {
    metadata.patientName = subjectMatch[1].trim();
    metadata.patientId = subjectMatch[2].trim();
  }

  const documentIds: string[] = [];

  for (const attachment of attachments) {
    const docId = await ingestDocument(
      attachment.content,
      attachment.filename,
      attachment.contentType,
      'email',
      metadata
    );
    documentIds.push(docId);
  }

  return documentIds;
}
