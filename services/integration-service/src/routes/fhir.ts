import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  orderToServiceRequest,
  serviceRequestToOrder,
  patientToFHIR,
  InternalOrder,
  InternalPatient,
  FHIRServiceRequest,
} from '../services/fhir-mapper';
import { registerSubscription, sendFHIRNotification } from '../services/outbound-service';
import logger from '../utils/logger';

const router = Router();

// In-memory stores (use database in production)
const ordersStore = new Map<string, InternalOrder>();
const patientsStore = new Map<string, InternalPatient>();

/**
 * POST /fhir/ServiceRequest — Create order from FHIR ServiceRequest
 */
router.post('/ServiceRequest', async (req: Request, res: Response) => {
  try {
    const resource = req.body as FHIRServiceRequest;

    if (resource.resourceType !== 'ServiceRequest') {
      res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: `Expected resourceType ServiceRequest, got ${resource.resourceType}`,
          },
        ],
      });
      return;
    }

    const order = serviceRequestToOrder(resource);
    if (!order.id) order.id = uuidv4();
    order.createdAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();

    ordersStore.set(order.id, order);

    const responseResource = orderToServiceRequest(order);

    logger.info('FHIR ServiceRequest created', {
      orderId: order.id,
      accession: order.accessionNumber,
    });

    res.status(201)
      .set('Location', `/fhir/ServiceRequest/${order.id}`)
      .set('Content-Type', 'application/fhir+json')
      .json(responseResource);
  } catch (error: any) {
    logger.error('Failed to create FHIR ServiceRequest', { error: error.message });
    res.status(400).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'processing',
          diagnostics: error.message,
        },
      ],
    });
  }
});

/**
 * GET /fhir/ServiceRequest/:id — Get order as FHIR ServiceRequest
 */
router.get('/ServiceRequest/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const order = ordersStore.get(id);

  if (!order) {
    res.status(404).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'not-found',
          diagnostics: `ServiceRequest/${id} not found`,
        },
      ],
    });
    return;
  }

  const resource = orderToServiceRequest(order);
  res.set('Content-Type', 'application/fhir+json').json(resource);
});

/**
 * POST /fhir/Bundle — Process FHIR Bundle (batch orders)
 */
router.post('/Bundle', async (req: Request, res: Response) => {
  try {
    const bundle = req.body;

    if (bundle.resourceType !== 'Bundle') {
      res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: `Expected resourceType Bundle, got ${bundle.resourceType}`,
          },
        ],
      });
      return;
    }

    if (!bundle.entry || !Array.isArray(bundle.entry)) {
      res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: 'Bundle must contain an entry array',
          },
        ],
      });
      return;
    }

    const responseEntries: Array<{
      fullUrl: string;
      resource: any;
      response: { status: string; location?: string };
    }> = [];

    for (const entry of bundle.entry) {
      const resource = entry.resource;
      if (!resource) {
        responseEntries.push({
          fullUrl: entry.fullUrl || '',
          resource: {
            resourceType: 'OperationOutcome',
            issue: [{ severity: 'error', code: 'invalid', diagnostics: 'Entry missing resource' }],
          },
          response: { status: '400 Bad Request' },
        });
        continue;
      }

      try {
        if (resource.resourceType === 'ServiceRequest') {
          const order = serviceRequestToOrder(resource);
          if (!order.id) order.id = uuidv4();
          order.createdAt = new Date().toISOString();
          order.updatedAt = new Date().toISOString();
          ordersStore.set(order.id, order);

          responseEntries.push({
            fullUrl: `ServiceRequest/${order.id}`,
            resource: orderToServiceRequest(order),
            response: {
              status: '201 Created',
              location: `ServiceRequest/${order.id}`,
            },
          });
        } else if (resource.resourceType === 'Patient') {
          const patient: InternalPatient = {
            id: resource.id || uuidv4(),
            mrn: resource.identifier?.[0]?.value || '',
            firstName: resource.name?.[0]?.given?.[0] || '',
            lastName: resource.name?.[0]?.family || '',
            dateOfBirth: resource.birthDate || '',
            gender: resource.gender || 'unknown',
          };
          patientsStore.set(patient.id, patient);

          responseEntries.push({
            fullUrl: `Patient/${patient.id}`,
            resource: patientToFHIR(patient),
            response: {
              status: '201 Created',
              location: `Patient/${patient.id}`,
            },
          });
        } else {
          responseEntries.push({
            fullUrl: entry.fullUrl || '',
            resource: {
              resourceType: 'OperationOutcome',
              issue: [{
                severity: 'warning',
                code: 'not-supported',
                diagnostics: `Unsupported resource type: ${resource.resourceType}`,
              }],
            },
            response: { status: '422 Unprocessable Entity' },
          });
        }
      } catch (entryError: any) {
        responseEntries.push({
          fullUrl: entry.fullUrl || '',
          resource: {
            resourceType: 'OperationOutcome',
            issue: [{ severity: 'error', code: 'processing', diagnostics: entryError.message }],
          },
          response: { status: '400 Bad Request' },
        });
      }
    }

    const responseBundle = {
      resourceType: 'Bundle',
      id: uuidv4(),
      type: 'batch-response',
      entry: responseEntries,
    };

    logger.info('FHIR Bundle processed', {
      entryCount: bundle.entry.length,
      successCount: responseEntries.filter((e) => e.response.status.startsWith('201')).length,
    });

    res.status(200).set('Content-Type', 'application/fhir+json').json(responseBundle);
  } catch (error: any) {
    logger.error('Failed to process FHIR Bundle', { error: error.message });
    res.status(400).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'processing', diagnostics: error.message }],
    });
  }
});

/**
 * GET /fhir/Patient/:id — Get patient as FHIR resource
 */
router.get('/Patient/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const patient = patientsStore.get(id);

  if (!patient) {
    res.status(404).json({
      resourceType: 'OperationOutcome',
      issue: [
        {
          severity: 'error',
          code: 'not-found',
          diagnostics: `Patient/${id} not found`,
        },
      ],
    });
    return;
  }

  const resource = patientToFHIR(patient);
  res.set('Content-Type', 'application/fhir+json').json(resource);
});

/**
 * POST /fhir/Subscription — Register for FHIR subscriptions
 */
router.post('/Subscription', async (req: Request, res: Response) => {
  try {
    const subscription = req.body;

    if (subscription.resourceType !== 'Subscription') {
      res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'invalid',
            diagnostics: `Expected resourceType Subscription, got ${subscription.resourceType}`,
          },
        ],
      });
      return;
    }

    const id = subscription.id || uuidv4();
    const channel = subscription.channel;

    if (!channel || !channel.endpoint) {
      res.status(400).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'required',
            diagnostics: 'Subscription must include channel with endpoint',
          },
        ],
      });
      return;
    }

    const resourceType = subscription.criteria?.split('?')[0] || 'ServiceRequest';
    const criteria = subscription.criteria || '';

    registerSubscription(id, channel.endpoint, resourceType, criteria);

    const responseResource = {
      resourceType: 'Subscription',
      id,
      status: 'active',
      reason: subscription.reason || 'Radiology order notifications',
      criteria: subscription.criteria || 'ServiceRequest?category=imaging',
      channel: {
        type: channel.type || 'rest-hook',
        endpoint: channel.endpoint,
        payload: channel.payload || 'application/fhir+json',
        header: channel.header,
      },
    };

    logger.info('FHIR Subscription created', {
      subscriptionId: id,
      endpoint: channel.endpoint,
      criteria,
    });

    res.status(201)
      .set('Location', `/fhir/Subscription/${id}`)
      .set('Content-Type', 'application/fhir+json')
      .json(responseResource);
  } catch (error: any) {
    logger.error('Failed to create FHIR Subscription', { error: error.message });
    res.status(400).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'processing', diagnostics: error.message }],
    });
  }
});

export default router;

// Export stores for use by other modules
export { ordersStore, patientsStore };
