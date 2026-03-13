import axios, { AxiosInstance } from 'axios';
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
 * Cerner (Oracle Health) EMR Adapter — integrates with Cerner's FHIR R4 APIs.
 */
export class CernerAdapter implements EMRAdapter {
  readonly type = 'cerner';

  private config: EMRConnectionConfig | null = null;
  private httpClient: AxiosInstance | null = null;
  private token: OAuthToken | null = null;
  private connected = false;

  async connect(config: EMRConnectionConfig): Promise<void> {
    this.config = config;
    const fhirBase = `${config.baseUrl}${config.fhirEndpoint || '/fhir/r4'}`;

    this.httpClient = axios.create({
      baseURL: fhirBase,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/fhir+json',
        Accept: 'application/fhir+json',
        ...config.customHeaders,
      },
    });

    this.httpClient.interceptors.request.use(async (reqConfig) => {
      const accessToken = await this.getAccessToken();
      reqConfig.headers.Authorization = `Bearer ${accessToken}`;
      return reqConfig;
    });

    try {
      await this.httpClient.get('/metadata');
      this.connected = true;
      logger.info('Connected to Cerner FHIR server', { baseUrl: fhirBase });
    } catch (error: any) {
      logger.error('Failed to connect to Cerner FHIR server', {
        baseUrl: fhirBase,
        error: error.message,
      });
      throw new Error(`Failed to connect to Cerner: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    this.token = null;
    this.httpClient = null;
    this.connected = false;
    logger.info('Disconnected from Cerner FHIR server');
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
      logger.error('Cerner: Failed to get patient', { patientId, error: error.message });
      throw error;
    }
  }

  async searchPatients(query: Record<string, string>): Promise<InternalPatient[]> {
    this.ensureConnected();
    try {
      const searchParams = new URLSearchParams();
      if (query.mrn) {
        searchParams.set('identifier', query.mrn);
      }
      if (query.lastName) searchParams.set('family', query.lastName);
      if (query.firstName) searchParams.set('given', query.firstName);
      if (query.dateOfBirth) searchParams.set('birthdate', query.dateOfBirth);

      const response = await this.httpClient!.get(`/Patient?${searchParams.toString()}`);
      const bundle = response.data;

      if (!bundle.entry || bundle.entry.length === 0) return [];
      return bundle.entry.map((entry: any) => fhirToPatient(entry.resource));
    } catch (error: any) {
      logger.error('Cerner: Failed to search patients', { query, error: error.message });
      throw error;
    }
  }

  async createOrder(order: InternalOrder): Promise<{ id: string; status: string }> {
    this.ensureConnected();
    try {
      const serviceRequest = {
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
        reasonCode: order.reasonForExam ? [{ text: order.reasonForExam }] : undefined,
        note: order.clinicalHistory ? [{ text: order.clinicalHistory }] : undefined,
      };

      const response = await this.httpClient!.post('/ServiceRequest', serviceRequest);
      const createdId = response.data.id || response.headers['location']?.split('/').pop();

      logger.info('Cerner: Created order', { orderId: createdId, accession: order.accessionNumber });
      return { id: createdId, status: 'created' };
    } catch (error: any) {
      logger.error('Cerner: Failed to create order', {
        accession: order.accessionNumber,
        error: error.message,
      });
      throw error;
    }
  }

  async updateOrder(orderId: string, updates: Partial<InternalOrder>): Promise<{ id: string; status: string }> {
    this.ensureConnected();
    try {
      const existing = await this.httpClient!.get(`/ServiceRequest/${orderId}`);
      const resource = existing.data;

      if (updates.status) {
        const statusMap: Record<string, string> = {
          COMPLETED: 'completed',
          CANCELLED: 'revoked',
          ON_HOLD: 'on-hold',
          PENDING: 'active',
        };
        resource.status = statusMap[updates.status] || resource.status;
      }
      if (updates.priority) {
        resource.priority = updates.priority.toLowerCase();
      }

      const response = await this.httpClient!.put(`/ServiceRequest/${orderId}`, resource);
      logger.info('Cerner: Updated order', { orderId });
      return { id: orderId, status: response.data.status || 'updated' };
    } catch (error: any) {
      logger.error('Cerner: Failed to update order', { orderId, error: error.message });
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
      logger.error('Cerner: Failed to get order', { orderId, error: error.message });
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
      searchParams.set('_count', '100');
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
      logger.error('Cerner: Failed to get schedule', { params, error: error.message });
      throw error;
    }
  }

  // ---- Private helpers ----

  private ensureConnected(): void {
    if (!this.connected || !this.httpClient) {
      throw new Error('Cerner adapter is not connected. Call connect() first.');
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.token && !this.isTokenExpired()) {
      return this.token.access_token;
    }

    if (!this.config) throw new Error('No configuration available');

    const auth = this.config.auth;
    const tokenEndpoint = auth.tokenEndpoint || `${this.config.baseUrl}/oauth2/token`;

    try {
      const params = new URLSearchParams();
      params.set('grant_type', 'client_credentials');
      params.set('client_id', auth.clientId || '');
      if (auth.clientSecret) {
        params.set('client_secret', auth.clientSecret);
      }
      if (auth.scope) {
        params.set('scope', auth.scope);
      } else {
        params.set('scope', 'system/Patient.read system/ServiceRequest.* system/Slot.read');
      }

      const response = await axios.post(tokenEndpoint, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      this.token = {
        ...response.data,
        obtainedAt: Date.now(),
      };

      logger.debug('Cerner: Obtained access token', { expiresIn: this.token!.expires_in });
      return this.token!.access_token;
    } catch (error: any) {
      logger.error('Cerner: Failed to obtain access token', { error: error.message });
      throw new Error(`Cerner authentication failed: ${error.message}`);
    }
  }

  private isTokenExpired(): boolean {
    if (!this.token) return true;
    const elapsed = (Date.now() - this.token.obtainedAt) / 1000;
    return elapsed >= (this.token.expires_in - 60);
  }
}
