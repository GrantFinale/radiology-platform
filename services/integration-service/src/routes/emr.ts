import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { EMRAdapterFactory, EMRConnectionConfig } from '../services/emr-adapter';
import {
  registerEMRConnection,
  getEMRConnection,
  listEMRConnections,
  sendOrderToEMR,
} from '../services/outbound-service';
import logger from '../utils/logger';

const router = Router();

// Validation schemas
const connectSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['epic', 'cerner', 'generic']),
  name: z.string().optional(),
  baseUrl: z.string().url(),
  auth: z.object({
    type: z.enum(['oauth2', 'basic', 'apikey']),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    privateKeyPath: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    apiKey: z.string().optional(),
    tokenEndpoint: z.string().optional(),
    scope: z.string().optional(),
  }),
  fhirEndpoint: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
  endpointMapping: z.record(z.string()).optional(),
});

const syncSchema = z.object({
  syncType: z.enum(['full', 'incremental', 'orders', 'patients', 'schedule']).default('incremental'),
  since: z.string().optional(),
  patientId: z.string().optional(),
  orderId: z.string().optional(),
});

/**
 * POST /emr/connect — Register a new EMR connection
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const body = connectSchema.parse(req.body);
    const connectionId = body.id || uuidv4();

    const connectionConfig: EMRConnectionConfig = {
      type: body.type,
      baseUrl: body.baseUrl,
      auth: body.auth,
      fhirEndpoint: body.fhirEndpoint,
      customHeaders: body.customHeaders,
      endpointMapping: body.endpointMapping,
    };

    // Test connection
    let connectionStatus = 'active';
    let connectionError: string | undefined;

    try {
      const adapter = EMRAdapterFactory.create(body.type);
      await adapter.connect(connectionConfig);
      await adapter.disconnect();
    } catch (error: any) {
      connectionStatus = 'error';
      connectionError = error.message;
      logger.warn('EMR connection test failed, registering with error status', {
        connectionId,
        type: body.type,
        error: error.message,
      });
    }

    registerEMRConnection(connectionId, connectionConfig);

    logger.info('EMR connection registered', {
      connectionId,
      type: body.type,
      baseUrl: body.baseUrl,
      status: connectionStatus,
    });

    res.status(201).json({
      id: connectionId,
      type: body.type,
      name: body.name || `${body.type}-${connectionId.substring(0, 8)}`,
      baseUrl: body.baseUrl,
      status: connectionStatus,
      error: connectionError,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    logger.error('Failed to register EMR connection', { error: error.message });
    res.status(500).json({ error: 'Failed to register EMR connection', details: error.message });
  }
});

/**
 * GET /emr/connections — List active EMR connections
 */
router.get('/connections', (_req: Request, res: Response) => {
  const connections = listEMRConnections();
  res.json({
    total: connections.length,
    connections,
  });
});

/**
 * POST /emr/:connectionId/sync — Trigger sync with EMR
 */
router.post('/:connectionId/sync', async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.params;
    const body = syncSchema.parse(req.body);

    const connection = getEMRConnection(connectionId);
    if (!connection) {
      res.status(404).json({ error: `EMR connection not found: ${connectionId}` });
      return;
    }

    const syncId = uuidv4();
    const syncStarted = new Date().toISOString();

    // Perform sync based on type
    const adapter = EMRAdapterFactory.create(connection.config.type);
    let syncResult: Record<string, unknown> = { syncId, type: body.syncType, status: 'started' };

    try {
      await adapter.connect(connection.config);

      switch (body.syncType) {
        case 'patients':
          if (body.patientId) {
            const patient = await adapter.getPatient(body.patientId);
            syncResult = {
              syncId,
              type: 'patients',
              status: 'completed',
              results: { patientsFound: patient ? 1 : 0, patient },
            };
          } else {
            syncResult = {
              syncId,
              type: 'patients',
              status: 'completed',
              results: { message: 'Provide patientId for specific patient sync' },
            };
          }
          break;

        case 'orders':
          if (body.orderId) {
            const order = await adapter.getOrder(body.orderId);
            syncResult = {
              syncId,
              type: 'orders',
              status: 'completed',
              results: { ordersFound: order ? 1 : 0, order },
            };
          } else {
            syncResult = {
              syncId,
              type: 'orders',
              status: 'completed',
              results: { message: 'Provide orderId for specific order sync' },
            };
          }
          break;

        case 'schedule': {
          const date = body.since || new Date().toISOString().split('T')[0];
          const slots = await adapter.getSchedule({ date });
          syncResult = {
            syncId,
            type: 'schedule',
            status: 'completed',
            results: { slotsFound: slots.length, slots },
          };
          break;
        }

        case 'full':
        case 'incremental':
        default:
          syncResult = {
            syncId,
            type: body.syncType,
            status: 'queued',
            message: `${body.syncType} sync has been queued for processing`,
          };
          break;
      }

      await adapter.disconnect();
    } catch (syncError: any) {
      syncResult = {
        syncId,
        type: body.syncType,
        status: 'error',
        error: syncError.message,
      };
      logger.error('EMR sync error', { connectionId, syncId, error: syncError.message });
    }

    logger.info('EMR sync triggered', { connectionId, syncId, type: body.syncType });

    res.json({
      ...syncResult,
      connectionId,
      startedAt: syncStarted,
      completedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }
    logger.error('Failed to trigger EMR sync', { error: error.message });
    res.status(500).json({ error: 'Failed to trigger sync', details: error.message });
  }
});

/**
 * POST /emr/webhook — Receive EMR webhook notifications
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const webhookData = req.body;
    const source = req.headers['x-emr-source'] || req.headers['x-webhook-source'] || 'unknown';
    const eventType = req.headers['x-emr-event'] || req.headers['x-webhook-event'] || webhookData.event || webhookData.type || 'unknown';
    const webhookId = uuidv4();

    logger.info('EMR webhook received', {
      webhookId,
      source,
      eventType,
      resourceType: webhookData.resourceType,
    });

    // Process webhook based on event type
    let processingResult: Record<string, unknown> = { status: 'acknowledged' };

    if (webhookData.resourceType === 'ServiceRequest' || eventType === 'order.created' || eventType === 'order.updated') {
      processingResult = {
        status: 'processed',
        action: 'order_sync',
        resourceType: 'ServiceRequest',
        resourceId: webhookData.id || webhookData.resourceId,
      };
    } else if (webhookData.resourceType === 'Patient' || eventType === 'patient.updated') {
      processingResult = {
        status: 'processed',
        action: 'patient_sync',
        resourceType: 'Patient',
        resourceId: webhookData.id || webhookData.resourceId,
      };
    } else if (webhookData.resourceType === 'DiagnosticReport' || eventType === 'result.available') {
      processingResult = {
        status: 'processed',
        action: 'result_import',
        resourceType: 'DiagnosticReport',
        resourceId: webhookData.id || webhookData.resourceId,
      };
    }

    res.status(200).json({
      webhookId,
      receivedAt: new Date().toISOString(),
      ...processingResult,
    });
  } catch (error: any) {
    logger.error('Failed to process EMR webhook', { error: error.message });
    res.status(500).json({ error: 'Failed to process webhook', details: error.message });
  }
});

export default router;
