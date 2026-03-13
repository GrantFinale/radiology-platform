import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { EMRAdapter, EMRConnectionConfig, EMRScheduleSlot } from '../services/emr-adapter';
import { InternalOrder, InternalPatient, fhirToPatient, serviceRequestToOrder } from '../services/fhir-mapper';
import logger from '../utils/logger';

interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  obtainedAt: number;
}

/**
 * Epic EMR Adapter — integrates with Epic's FHIR R4 APIs using SMART on FHIR (Backend Services) auth.
 */
export class EpicAdapter implements EMRAdapter {
  readonly type = 'epic';

  private config: EMRConnectionConfig | null = null;
  private httpClient: AxiosInstance | null = null;
  private token: OAuthToken | null = null;
  private connected = false;

  async connect(config: EMRConnectionConfig): Promise<void> {
    this.config = config;
    const fhirBase = `${config.baseUrl}${config.fhirEndpoint || '/api/FHIR/R4'}`;

    this.httpClient = axios.create({
      baseURL: fhirBase,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
        ...config.customHeaders,
      },
    });

    // Intercept requests to add auth token
    this.httpClient.interceptors.request.use(async (reqConfig) => {
      const accessToken = await this.getAccessToken();
      reqConfig.headers.Authorization = `Bearer ${accessToken}`;
      return reqConfig;
    });

    // Verify connection with a metadata request
    try {
      await this.httpClient.get('/metadata');
      this.connected = true;
      logger.info('Connected to Epic FHIR server', { baseUrl: fhirBase });
    } catch (error: any) {
      logger.error('Failed to connect to Epic FHIR server', {
        baseUrl: fhirBase,
        error: error.message,
      });
      throw new Error(`Failed to connect to Epic: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    this.token = null;
    this.httpClient = null;
    this.connected = false;
    logger.info('Disconnected from Epic FHIR server');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getPatient(patientId: string): Promise<InternalPatient | null> {
    this.ensureConnected();
    try {
      const response = await this.httpClient!.get(`/Patient/${patientId}`);
      return fhirToPatient(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      logger.error('Epic: Failed to get patient', { patientId, error: error.message });
      throw error;
    }
  }

  async searchPatients(query: Record<string, string>): Promise<InternalPatient[]> {
    this.ensureConnected();
    try {
      // Map common search params to Epic-supported FHIR search params
      const searchParams = new URLSearchParams();
      if (query.mrn) {
        searchParams.set('identifier', `urn:oid:1.2.840.114350.1.13.0.1.7.5.737384.14|${query.mrn}`);
      }
      if (query.lastName) searchParams.set('family', query.lastName);
      if (query.firstName) searchParams.set('given', query.firstName);
      if (query.dateOfBirth) searchParams.set('birthdate', query.dateOfBirth);

      const response = await this.httpClient!.get(`/Patient?${searchParams.toString()}`);
      const bundle = response.data;

      if (!bundle.entry || bundle.entry.length === 0) return [];
      return bundle.entry.map((entry: any) => fhirToPatient(entry.resource));
    } catch (error: any) {
      logger.error('Epic: Failed to search patients', { query, error: error.message });
      throw error;
    }
  }

  async createOrder(order: InternalOrder): Promise<{ id: string; status: string }> {
    this.ensureConnected();
    try {
      const serviceRequest = this.buildEpicServiceRequest(order);
      const response = await this.httpClient!.post('/ServiceRequest', serviceRequest);
      const createdId = response.data.id || response.headers['location']?.split('/').pop();

      logger.info('Epic: Created order', { orderId: createdId, accession: order.accessionNumber });
      return { id: createdId, status: 'created' };
    } catch (error: any) {
      logger.error('Epic: Failed to create order', {
        accession: order.accessionNumber,
        error: error.message,
        responseData: error.response?.data,
      });
      throw error;
    }
  }

  async updateOrder(orderId: string, updates: Partial<InternalOrder>): Promise<{ id: string; status: string }> {
    this.ensureConnected();
    try {
      // First get the existing resource for the current version
      const existing = await this.httpClient!.get(`/ServiceRequest/${orderId}`);
      const resource = existing.data;

      // Apply updates
      if (updates.status) {
        const statusMap: Record<string, string> = {
          COMPLETED: 'completed',
          CANCELLED: 'revoked',
          ON_HOLD: 'on-hold',
          PENDING: 'active',
          NEW: 'active',
        };
        resource.status = statusMap[updates.status] || resource.status;
      }
      if (updates.priority) {
        const priorityMap: Record<string, string> = {
          STAT: 'stat',
          URGENT: 'urgent',
          ASAP: 'asap',
          ROUTINE: 'routine',
        };
        resource.priority = priorityMap[updates.priority] || resource.priority;
      }
      if (updates.notes) {
        resource.note = resource.note || [];
        resource.note.push({ text: updates.notes });
      }

      const response = await this.httpClient!.put(`/ServiceRequest/${orderId}`, resource);
      logger.info('Epic: Updated order', { orderId });
      return { id: orderId, status: response.data.status || 'updated' };
    } catch (error: any) {
      logger.error('Epic: Failed to update order', { orderId, error: error.message });
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<InternalOrder | null> {
    this.ensureConnected();
    try {
      const response = await this.httpClient!.get(`/ServiceRequest/${orderId}`);
      return serviceRequestToOrder(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      logger.error('Epic: Failed to get order', { orderId, error: error.message });
      throw error;
    }
  }

  async getSchedule(params: {
    date: string;
    practitionerId?: string;
    locationId?: string;
  }): Promise<EMRScheduleSlot[]> {
    this.ensureConnected();
    try {
      const searchParams = new URLSearchParams();
      searchParams.set('start', params.date);
      if (params.practitionerId) {
        searchParams.set('schedule.actor', `Practitioner/${params.practitionerId}`);
      }
      if (params.locationId) {
        searchParams.set('schedule.actor', `Location/${params.locationId}`);
      }

      const response = await this.httpClient!.get(`/Slot?${searchParams.toString()}`);
      const bundle = response.data;

      if (!bundle.entry || bundle.entry.length === 0) return [];

      return bundle.entry.map((entry: any) => {
        const slot = entry.resource;
        return {
          id: slot.id,
          startTime: slot.start,
          endTime: slot.end,
          status: slot.status === 'free' ? 'free' : slot.status === 'busy-tentative' ? 'tentative' : 'busy',
          location: slot.schedule?.reference,
          serviceType: slot.serviceType?.[0]?.coding?.[0]?.display,
        } as EMRScheduleSlot;
      });
    } catch (error: any) {
      logger.error('Epic: Failed to get schedule', { params, error: error.message });
      throw error;
    }
  }

  // ---- Private helpers ----

  private ensureConnected(): void {
    if (!this.connected || !this.httpClient) {
      throw new Error('Epic adapter is not connected. Call connect() first.');
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && !this.isTokenExpired()) {
      return this.token.access_token;
    }

    if (!this.config) throw new Error('No configuration available');

    const auth = this.config.auth;
    if (auth.type !== 'oauth2') {
      throw new Error('Epic adapter requires OAuth2 authentication (SMART Backend Services)');
    }

    try {
      // SMART Backend Services: create a signed JWT assertion
      // In production, this would use the private key to create a JWT
      // For now, we use client credentials flow as a simplified model
      const tokenEndpoint = auth.tokenEndpoint || `${this.config.baseUrl}/oauth2/token`;

      const params = new URLSearchParams();
      params.set('grant_type', 'client_credentials');
      params.set('client_id', auth.clientId || '');
      if (auth.scope) {
        params.set('scope', auth.scope);
      } else {
        params.set('scope', 'system/*.read system/ServiceRequest.write system/Patient.read');
      }

      // In production, this would include a JWT assertion:
      // params.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
      // params.set('client_assertion', signedJwt);

      const response = await axios.post(tokenEndpoint, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      this.token = {
        ...response.data,
        obtainedAt: Date.now(),
      };

      logger.debug('Epic: Obtained access token', { expiresIn: this.token!.expires_in });
      return this.token!.access_token;
    } catch (error: any) {
      logger.error('Epic: Failed to obtain access token', { error: error.message });
      throw new Error(`Epic authentication failed: ${error.message}`);
    }
  }

  private isTokenExpired(): boolean {
    if (!this.token) return true;
    const elapsed = (Date.now() - this.token.obtainedAt) / 1000;
    // Refresh 60 seconds before expiry
    return elapsed >= (this.token.expires_in - 60);
  }

  private buildEpicServiceRequest(order: InternalOrder): Record<string, unknown> {
    return {
      resourceType: 'ServiceRequest',
      identifier: [
        {
          system: 'urn:oid:radiology-platform:accession',
          value: order.accessionNumber,
        },
      ],
      status: 'active',
      intent: 'order',
      priority: order.priority.toLowerCase(),
      category: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '363679005',
              display: 'Imaging',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: 'http://www.ama-assn.org/go/cpt',
            code: order.procedureCode,
            display: order.procedureDescription,
          },
        ],
        text: order.procedureDescription,
      },
      subject: { reference: `Patient/${order.patientId}` },
      requester: {
        reference: `Practitioner/${order.orderingProviderId}`,
        display: order.orderingProviderName,
      },
      reasonCode: order.reasonForExam
        ? [{ text: order.reasonForExam }]
        : undefined,
      note: order.clinicalHistory
        ? [{ text: order.clinicalHistory }]
        : undefined,
      // Epic-specific extension for modality
      extension: order.modality
        ? [
            {
              url: 'http://open.epic.com/FHIR/StructureDefinition/extension/imaging-modality',
              valueCodeableConcept: {
                coding: [
                  {
                    system: 'http://dicom.nema.org/resources/ontology/DCM',
                    code: order.modality,
                  },
                ],
              },
            },
          ]
        : undefined,
    };
  }
}
