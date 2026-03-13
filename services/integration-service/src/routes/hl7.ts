import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parseHL7Message, generateACK, HL7Message } from '../services/hl7-parser';
import { sendHL7Result } from '../services/outbound-service';
import logger from '../utils/logger';

const router = Router();

// In-memory message store (use database in production)
interface StoredMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  messageType: string;
  messageEvent: string;
  messageControlId: string;
  sendingApplication: string;
  receivingApplication: string;
  status: 'received' | 'processed' | 'error' | 'sent' | 'pending';
  raw: string;
  parsed?: HL7Message;
  ackCode?: string;
  errorMessage?: string;
  receivedAt: string;
  processedAt?: string;
}

const messageStore: StoredMessage[] = [];

/**
 * POST /hl7/receive — Receive inbound HL7v2 message (MLLP-style over HTTP)
 *
 * Accepts raw HL7v2 messages wrapped in MLLP framing or plain text.
 * Returns an ACK message.
 */
router.post('/receive', async (req: Request, res: Response) => {
  try {
    let rawMessage: string = typeof req.body === 'string' ? req.body : req.body?.message || req.body?.data || '';

    if (!rawMessage) {
      res.status(400).json({ error: 'No HL7 message provided' });
      return;
    }

    // Strip MLLP framing characters if present (VT=0x0B, FS=0x1C, CR=0x0D)
    rawMessage = rawMessage.replace(/^\x0b/, '').replace(/\x1c\x0d?$/, '');

    const parsed = parseHL7Message(rawMessage);

    const storedMessage: StoredMessage = {
      id: parsed.id,
      direction: 'inbound',
      messageType: parsed.messageType,
      messageEvent: parsed.messageEvent,
      messageControlId: parsed.messageControlId,
      sendingApplication: parsed.sendingApplication,
      receivingApplication: parsed.receivingApplication,
      status: 'received',
      raw: rawMessage,
      parsed,
      receivedAt: new Date().toISOString(),
    };

    // Process message based on type
    try {
      await processInboundMessage(parsed);
      storedMessage.status = 'processed';
      storedMessage.ackCode = 'AA';
      storedMessage.processedAt = new Date().toISOString();
    } catch (processingError: any) {
      storedMessage.status = 'error';
      storedMessage.ackCode = 'AE';
      storedMessage.errorMessage = processingError.message;
      logger.error('Error processing HL7 message', {
        messageId: parsed.id,
        error: processingError.message,
      });
    }

    messageStore.unshift(storedMessage);
    // Keep last 1000 messages in memory
    if (messageStore.length > 1000) messageStore.length = 1000;

    const ack = generateACK(parsed, storedMessage.ackCode as any, storedMessage.errorMessage);

    logger.info('HL7 message received and processed', {
      messageId: parsed.id,
      type: `${parsed.messageType}^${parsed.messageEvent}`,
      controlId: parsed.messageControlId,
      ackCode: storedMessage.ackCode,
    });

    // Return ACK in MLLP framing
    res.set('Content-Type', 'application/hl7-v2');
    res.status(200).send(`\x0b${ack}\x1c\x0d`);
  } catch (error: any) {
    logger.error('Failed to process inbound HL7 message', { error: error.message });

    // Try to send a reject ACK
    try {
      const minimalMessage = {
        messageControlId: 'UNKNOWN',
        sendingApplication: '',
        sendingFacility: '',
        receivingApplication: '',
        receivingFacility: '',
        version: '2.5.1',
      } as HL7Message;
      const ack = generateACK(minimalMessage, 'AR', error.message);
      res.set('Content-Type', 'application/hl7-v2');
      res.status(400).send(`\x0b${ack}\x1c\x0d`);
    } catch {
      res.status(400).json({ error: 'Invalid HL7 message', details: error.message });
    }
  }
});

/**
 * POST /hl7/send — Send outbound HL7 message
 *
 * Queue an HL7 message for delivery to a remote system.
 */
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { orderId, destination, messageType, payload } = req.body;

    if (!orderId || !destination) {
      res.status(400).json({ error: 'orderId and destination are required' });
      return;
    }

    const storedMessage: StoredMessage = {
      id: uuidv4(),
      direction: 'outbound',
      messageType: messageType || 'ORU',
      messageEvent: 'R01',
      messageControlId: uuidv4().replace(/-/g, '').substring(0, 20),
      sendingApplication: 'RADIOLOGY_PLATFORM',
      receivingApplication: destination,
      status: 'pending',
      raw: '',
      receivedAt: new Date().toISOString(),
    };

    messageStore.unshift(storedMessage);

    const result = await sendHL7Result(orderId, destination, payload);

    storedMessage.status = 'sent';
    storedMessage.processedAt = new Date().toISOString();

    logger.info('HL7 outbound message queued', {
      messageId: storedMessage.id,
      jobId: result.jobId,
      orderId,
      destination,
    });

    res.status(202).json({
      id: storedMessage.id,
      jobId: result.jobId,
      status: 'queued',
      message: 'HL7 message queued for delivery',
    });
  } catch (error: any) {
    logger.error('Failed to queue outbound HL7 message', { error: error.message });
    res.status(500).json({ error: 'Failed to queue HL7 message', details: error.message });
  }
});

/**
 * GET /hl7/messages — List recent HL7 messages with status
 */
router.get('/messages', (req: Request, res: Response) => {
  const { direction, status, type, limit = '50', offset = '0' } = req.query;

  let filtered = [...messageStore];

  if (direction) {
    filtered = filtered.filter((m) => m.direction === direction);
  }
  if (status) {
    filtered = filtered.filter((m) => m.status === status);
  }
  if (type) {
    filtered = filtered.filter((m) => `${m.messageType}^${m.messageEvent}` === type || m.messageType === type);
  }

  const total = filtered.length;
  const limitNum = Math.min(parseInt(limit as string, 10) || 50, 200);
  const offsetNum = parseInt(offset as string, 10) || 0;
  const page = filtered.slice(offsetNum, offsetNum + limitNum);

  // Return without raw message body for listing
  const items = page.map(({ raw, parsed, ...rest }) => rest);

  res.json({
    total,
    limit: limitNum,
    offset: offsetNum,
    items,
  });
});

/**
 * Process an inbound HL7 message based on its type.
 */
async function processInboundMessage(message: HL7Message): Promise<void> {
  const fullType = `${message.messageType}^${message.messageEvent}`;

  switch (fullType) {
    case 'ORM^O01':
      logger.info('Processing ORM^O01 (Order)', {
        controlId: message.messageControlId,
        patient: message.patient?.mrn,
        order: message.order?.universalServiceId,
      });
      // In production: create or update order in the radiology system
      break;

    case 'ORU^R01':
      logger.info('Processing ORU^R01 (Result)', {
        controlId: message.messageControlId,
        resultCount: message.results?.length,
      });
      // In production: process results and update study
      break;

    case 'ADT^A01':
      logger.info('Processing ADT^A01 (Admit)', {
        controlId: message.messageControlId,
        patient: message.patient?.mrn,
      });
      // In production: register or update patient
      break;

    case 'ADT^A08':
      logger.info('Processing ADT^A08 (Update Patient)', {
        controlId: message.messageControlId,
        patient: message.patient?.mrn,
      });
      // In production: update patient demographics
      break;

    case 'SIU^S12':
      logger.info('Processing SIU^S12 (Schedule)', {
        controlId: message.messageControlId,
        schedule: message.schedule?.placerAppointmentId,
      });
      // In production: create or update appointment
      break;

    default:
      logger.warn('Unhandled HL7 message type', { type: fullType, controlId: message.messageControlId });
  }
}

export default router;
