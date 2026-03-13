import Bull from 'bull';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { EMRAdapterFactory, EMRConnectionConfig } from './emr-adapter';
import { buildHL7Message } from './hl7-parser';
import logger from '../utils/logger';

// In-memory stores (in production, use database)
const emrConnections = new Map<string, { config: EMRConnectionConfig; status: string }>();
const subscriptions = new Map<string, { endpoint: string; resourceType: string; criteria: string }>();

interface OutboundJobData {
  type: 'emr_order' | 'hl7_result' | 'fhir_notification';
  orderId: string;
  connectionId?: string;
  destination?: string;
  subscriptionId?: string;
  payload?: Record<string, unknown>;
}

let outboundQueue: Bull.Queue<OutboundJobData> | null = null;

export function getOutboundQueue(): Bull.Queue<OutboundJobData> {
  if (!outboundQueue) {
    outboundQueue = new Bull<OutboundJobData>('outbound-integration', {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      defaultJobOptions: {
        attempts: config.queue.maxRetries,
        backoff: {
          type: 'exponential',
          delay: config.queue.retryDelay,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return outboundQueue;
}

/**
 * Queue sending an order result back to an EMR system.
 */
export async function sendOrderToEMR(
  orderId: string,
  connectionId: string,
  orderData?: Record<string, unknown>,
): Promise<{ jobId: string }> {
  const queue = getOutboundQueue();
  const job = await queue.add(
    'emr_order',
    {
      type: 'emr_order',
      orderId,
      connectionId,
      payload: orderData,
    },
    { priority: 2 },
  );
  logger.info('Queued EMR order send', { jobId: job.id, orderId, connectionId });
  return { jobId: String(job.id) };
}

/**
 * Queue sending an HL7 ORU (result) message to a destination.
 */
export async function sendHL7Result(
  orderId: string,
  destination: string,
  resultData?: Record<string, unknown>,
): Promise<{ jobId: string }> {
  const queue = getOutboundQueue();
  const job = await queue.add(
    'hl7_result',
    {
      type: 'hl7_result',
      orderId,
      destination,
      payload: resultData,
    },
    { priority: 1 },
  );
  logger.info('Queued HL7 result send', { jobId: job.id, orderId, destination });
  return { jobId: String(job.id) };
}

/**
 * Queue sending a FHIR notification to a subscription endpoint.
 */
export async function sendFHIRNotification(
  orderId: string,
  subscriptionId: string,
  resourceData?: Record<string, unknown>,
): Promise<{ jobId: string }> {
  const queue = getOutboundQueue();
  const job = await queue.add(
    'fhir_notification',
    {
      type: 'fhir_notification',
      orderId,
      subscriptionId,
      payload: resourceData,
    },
    { priority: 2 },
  );
  logger.info('Queued FHIR notification', { jobId: job.id, orderId, subscriptionId });
  return { jobId: String(job.id) };
}

/**
 * Process an EMR order job — sends the order data to the connected EMR.
 */
export async function processEMROrderJob(job: Bull.Job<OutboundJobData>): Promise<void> {
  const { orderId, connectionId, payload } = job.data;
  logger.info('Processing EMR order job', { jobId: job.id, orderId, connectionId });

  if (!connectionId) throw new Error('Missing connectionId');

  const connection = emrConnections.get(connectionId);
  if (!connection) throw new Error(`EMR connection not found: ${connectionId}`);

  const adapter = EMRAdapterFactory.create(connection.config.type);
  try {
    await adapter.connect(connection.config);

    if (payload) {
      const result = await adapter.createOrder(payload as any);
      logger.info('EMR order sent successfully', { jobId: job.id, emrOrderId: result.id });
    }
  } finally {
    await adapter.disconnect();
  }
}

/**
 * Process an HL7 result job — builds and sends an ORU^R01 message.
 */
export async function processHL7ResultJob(job: Bull.Job<OutboundJobData>): Promise<void> {
  const { orderId, destination, payload } = job.data;
  logger.info('Processing HL7 result job', { jobId: job.id, orderId, destination });

  if (!destination) throw new Error('Missing destination URL');

  // Build ORU^R01 message
  const hl7Message = buildHL7Message({
    sendingApplication: config.hl7.defaultSendingApp,
    sendingFacility: config.hl7.defaultSendingFacility,
    receivingApplication: config.hl7.defaultReceivingApp,
    receivingFacility: config.hl7.defaultReceivingFacility,
    messageType: 'ORU',
    messageEvent: 'R01',
    segments: [
      {
        name: 'PID',
        fields: [
          '1',
          '',
          (payload?.patientId as string) || '',
          '',
          `${(payload?.patientLastName as string) || ''}^${(payload?.patientFirstName as string) || ''}`,
        ],
      },
      {
        name: 'ORC',
        fields: [
          'RE',
          (payload?.placerOrderNumber as string) || orderId,
          (payload?.fillerOrderNumber as string) || '',
        ],
      },
      {
        name: 'OBR',
        fields: [
          '1',
          (payload?.placerOrderNumber as string) || orderId,
          (payload?.fillerOrderNumber as string) || '',
          `${(payload?.procedureCode as string) || ''}^${(payload?.procedureDescription as string) || ''}`,
        ],
      },
      {
        name: 'OBX',
        fields: [
          '1',
          'TX',
          `${(payload?.observationCode as string) || 'RAD'}^${(payload?.observationText as string) || 'Radiology Report'}`,
          '',
          (payload?.reportText as string) || '',
          '',
          '',
          '',
          '',
          '',
          'F',
        ],
      },
    ],
  });

  // Send via HTTP (MLLP-over-HTTP)
  const wrappedMessage = `\x0b${hl7Message}\x1c\x0d`;

  try {
    const response = await axios.post(destination, wrappedMessage, {
      headers: {
        'Content-Type': 'application/hl7-v2',
      },
      timeout: 30000,
    });
    logger.info('HL7 result sent successfully', { jobId: job.id, status: response.status });
  } catch (error: any) {
    logger.error('Failed to send HL7 result', { jobId: job.id, error: error.message });
    throw error;
  }
}

/**
 * Process a FHIR notification job — sends a notification to the subscription endpoint.
 */
export async function processFHIRNotificationJob(job: Bull.Job<OutboundJobData>): Promise<void> {
  const { orderId, subscriptionId, payload } = job.data;
  logger.info('Processing FHIR notification job', { jobId: job.id, orderId, subscriptionId });

  if (!subscriptionId) throw new Error('Missing subscriptionId');

  const subscription = subscriptions.get(subscriptionId);
  if (!subscription) throw new Error(`Subscription not found: ${subscriptionId}`);

  const notification = {
    resourceType: 'Bundle',
    id: uuidv4(),
    type: 'history',
    timestamp: new Date().toISOString(),
    entry: [
      {
        fullUrl: `urn:uuid:${uuidv4()}`,
        resource: {
          resourceType: 'SubscriptionStatus',
          id: uuidv4(),
          status: 'active',
          type: 'event-notification',
          subscription: { reference: `Subscription/${subscriptionId}` },
          notificationEvent: [
            {
              eventNumber: '1',
              focus: { reference: `ServiceRequest/${orderId}` },
            },
          ],
        },
        request: {
          method: 'GET',
          url: `SubscriptionStatus/${subscriptionId}`,
        },
      },
    ],
  };

  if (payload) {
    notification.entry.push({
      fullUrl: `urn:uuid:${uuidv4()}`,
      resource: payload as any,
      request: {
        method: 'PUT',
        url: `ServiceRequest/${orderId}`,
      },
    });
  }

  try {
    await axios.post(subscription.endpoint, notification, {
      headers: { 'Content-Type': 'application/fhir+json' },
      timeout: 30000,
    });
    logger.info('FHIR notification sent', { jobId: job.id, endpoint: subscription.endpoint });
  } catch (error: any) {
    logger.error('Failed to send FHIR notification', { jobId: job.id, error: error.message });
    throw error;
  }
}

// --- Connection and subscription management (used by routes) ---

export function registerEMRConnection(id: string, connectionConfig: EMRConnectionConfig): void {
  emrConnections.set(id, { config: connectionConfig, status: 'active' });
}

export function getEMRConnection(id: string) {
  return emrConnections.get(id);
}

export function listEMRConnections() {
  return Array.from(emrConnections.entries()).map(([id, conn]) => ({
    id,
    type: conn.config.type,
    baseUrl: conn.config.baseUrl,
    status: conn.status,
  }));
}

export function registerSubscription(
  id: string,
  endpoint: string,
  resourceType: string,
  criteria: string,
): void {
  subscriptions.set(id, { endpoint, resourceType, criteria });
}

export function getSubscription(id: string) {
  return subscriptions.get(id);
}
