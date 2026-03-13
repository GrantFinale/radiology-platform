import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { EMRAdapter, EMRConnectionConfig, EMRScheduleSlot } from '../services/emr-adapter';
import { InternalOrder, InternalPatient } from '../services/fhir-mapper';
import logger from '../utils/logger';

/**
 * Default endpoint mapping for generic REST-based EMR systems.
 */
const DEFAULT_ENDPOINT_MAP: Record<string, string> = {
  getPatient: '/api/patients/:id',
  searchPatients: '/api/patients',
  createOrder: '/api/orders',
  updateOrder: '/api/orders/:id',
  getOrder: '/api/orders/:id',
  getSchedule: '/api/schedule',
};

/**
 * Generic EMR Adapter — connects to any REST API-based EMR system
 * with configurable endpoint mapping and flexible authentication.
 */
export class GenericAdapter implements EMRAdapter {
  readonly type = 'generic';

  private config: EMRConnectionConfig | null = null;
  private httpClient: AxiosInstance | null = null;
  private connected = false;
  private endpointMap: Record<string, string> = {};
  private oauthToken: { access_token: string; expires_in: number; obtainedAt: number } | null = null;

  async connect(config: EMRConnectionConfig): Promise<void> {
    this.config = config;
    this.endpointMap = { ...DEFAULT_ENDPOINT_MAP, ...config.endpointMapping };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...config.customHeaders,
    };

    // Set up static auth headers
    if (config.auth.type === 'basic' && config.auth.username && config.auth.password) {
      const encoded = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
      headers.Authorization = `Basic ${encoded}`;
    } else if (config.auth.type === 'apikey' && config.auth.apiKey) {
      headers['X-API-Key'] = config.auth.apiKey;
    }

    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers,
    });

    if (config.auth.type === 'oauth2') {
      this.httpClient.interceptors.request.use(async (reqConfig) => {
        const token = await this.getOAuthToken();
        reqConfig.headers.Authorization = `Bearer ${token}`;
        return reqConfig;
      });
    }

    // Verify connectivity with a simple request
    try {
      await this.httpClient.get('/api/health');
      this.connected = true;
      logger.info('Connected to generic EMR', { baseUrl: config.baseUrl });
    } catch (error: any) {
      // Health endpoint may not exist; treat non-network errors as connected
      if (error.response) {
        this.connected = true;
        logger.info('Connected to generic EMR (health check returned non-200)', {
          baseUrl: config.baseUrl,
          status: error.response.status,
        });
      } else {
        logger.error('Failed to connect to generic EMR', { error: error.message });
        throw new Error(`Failed to connect to EMR: ${error.message}`);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.httpClient = null;
    this.connected = false;
    this.oauthToken = null;
    logger.info('Disconnected from generic EMR');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getPatient(patientId: string): Promise<InternalPatient | null> {
    this.ensureConnected();
    try {
      const endpoint = this.resolveEndpoint('getPatient', { id: patientId });
      const response = await this.httpClient!.get(endpoint);
      return this.mapResponseToPatient(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      logger.error('Generic: Failed to get patient', { patientId, error: error.message });
      throw error;
    }
  }

  async searchPatients(query: Record<string, string>): Promise<InternalPatient[]> {
    this.ensureConnected();
    try {
      const endpoint = this.resolveEndpoint('searchPatients', {});
      const response = await this.httpClient!.get(endpoint, { params: query });
      const data = response.data;
      const items = Array.isArray(data) ? data : data.results || data.data || data.patients || [];
      return items.map((item: any) => this.mapResponseToPatient(item));
    } catch (error: any) {
      logger.error('Generic: Failed to search patients', { error: error.message });
      throw error;
    }
  }

  async createOrder(order: InternalOrder): Promise<{ id: string; status: string }> {
    this.ensureConnected();
    try {
      const endpoint = this.resolveEndpoint('createOrder', {});
      const payload = this.mapOrderToRequest(order);
      const response = await this.httpClient!.post(endpoint, payload);
      const createdId = response.data.id || response.data.orderId || uuidv4();

      logger.info('Generic: Created order', { orderId: createdId });
      return { id: createdId, status: response.data.status || 'created' };
    } catch (error: any) {
      logger.error('Generic: Failed to create order', { error: error.message });
      throw error;
    }
  }

  async updateOrder(orderId: string, updates: Partial<InternalOrder>): Promise<{ id: string; status: string }> {
    this.ensureConnected();
    try {
      const endpoint = this.resolveEndpoint('updateOrder', { id: orderId });
      const response = await this.httpClient!.patch(endpoint, updates);

      logger.info('Generic: Updated order', { orderId });
      return { id: orderId, status: response.data.status || 'updated' };
    } catch (error: any) {
      logger.error('Generic: Failed to update order', { orderId, error: error.message });
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<InternalOrder | null> {
    this.ensureConnected();
    try {
      const endpoint = this.resolveEndpoint('getOrder', { id: orderId });
      const response = await this.httpClient!.get(endpoint);
      return this.mapResponseToOrder(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      logger.error('Generic: Failed to get order', { orderId, error: error.message });
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
      const endpoint = this.resolveEndpoint('getSchedule', {});
      const response = await this.httpClient!.get(endpoint, { params });
      const data = response.data;
      const items = Array.isArray(data) ? data : data.slots || data.schedule || data.data || [];

      return items.map((item: any) => ({
        id: item.id || item.slotId || uuidv4(),
        startTime: item.startTime || item.start || item.startDateTime,
        endTime: item.endTime || item.end || item.endDateTime,
        status: item.status === 'available' || item.status === 'free' ? 'free' : 'busy',
        location: item.location || item.locationName,
        practitioner: item.practitioner || item.providerName,
        serviceType: item.serviceType || item.appointmentType,
      } as EMRScheduleSlot));
    } catch (error: any) {
      logger.error('Generic: Failed to get schedule', { error: error.message });
      throw error;
    }
  }

  // ---- Private helpers ----

  private ensureConnected(): void {
    if (!this.connected || !this.httpClient) {
      throw new Error('Generic adapter is not connected. Call connect() first.');
    }
  }

  private resolveEndpoint(operation: string, params: Record<string, string>): string {
    let endpoint = this.endpointMap[operation] || DEFAULT_ENDPOINT_MAP[operation] || `/${operation}`;
    for (const [key, value] of Object.entries(params)) {
      endpoint = endpoint.replace(`:${key}`, encodeURIComponent(value));
    }
    return endpoint;
  }

  private async getOAuthToken(): Promise<string> {
    if (this.oauthToken && !this.isTokenExpired()) {
      return this.oauthToken.access_token;
    }

    const auth = this.config!.auth;
    const tokenEndpoint = auth.tokenEndpoint || `${this.config!.baseUrl}/oauth/token`;

    const params = new URLSearchParams();
    params.set('grant_type', 'client_credentials');
    if (auth.clientId) params.set('client_id', auth.clientId);
    if (auth.clientSecret) params.set('client_secret', auth.clientSecret);
    if (auth.scope) params.set('scope', auth.scope);

    const response = await axios.post(tokenEndpoint, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    this.oauthToken = {
      ...response.data,
      obtainedAt: Date.now(),
    };

    return this.oauthToken!.access_token;
  }

  private isTokenExpired(): boolean {
    if (!this.oauthToken) return true;
    const elapsed = (Date.now() - this.oauthToken.obtainedAt) / 1000;
    return elapsed >= (this.oauthToken.expires_in - 60);
  }

  private mapResponseToPatient(data: any): InternalPatient {
    return {
      id: data.id || data.patientId || uuidv4(),
      mrn: data.mrn || data.medicalRecordNumber || data.identifier || '',
      firstName: data.firstName || data.given_name || data.name?.first || '',
      lastName: data.lastName || data.family_name || data.name?.last || '',
      middleName: data.middleName || data.middle_name || data.name?.middle,
      dateOfBirth: data.dateOfBirth || data.birthDate || data.dob || '',
      gender: data.gender || data.sex || 'U',
      ssn: data.ssn || data.socialSecurityNumber,
      phone: data.phone || data.phoneNumber || data.telecom?.phone,
      email: data.email || data.telecom?.email,
      address: data.address
        ? {
            line1: data.address.line1 || data.address.street || '',
            line2: data.address.line2,
            city: data.address.city || '',
            state: data.address.state || '',
            postalCode: data.address.postalCode || data.address.zip || '',
            country: data.address.country || 'US',
          }
        : undefined,
    };
  }

  private mapOrderToRequest(order: InternalOrder): Record<string, unknown> {
    return {
      accessionNumber: order.accessionNumber,
      patientId: order.patientId,
      orderingProviderId: order.orderingProviderId,
      orderingProviderName: order.orderingProviderName,
      procedureCode: order.procedureCode,
      procedureDescription: order.procedureDescription,
      priority: order.priority,
      status: order.status,
      clinicalHistory: order.clinicalHistory,
      reasonForExam: order.reasonForExam,
      modality: order.modality,
      bodyPart: order.bodyPart,
      scheduledDate: order.scheduledDate,
      notes: order.notes,
    };
  }

  private mapResponseToOrder(data: any): InternalOrder {
    return {
      id: data.id || data.orderId || uuidv4(),
      accessionNumber: data.accessionNumber || data.accession || '',
      patientId: data.patientId || '',
      orderingProviderId: data.orderingProviderId || data.providerId || '',
      orderingProviderName: data.orderingProviderName || data.providerName || '',
      procedureCode: data.procedureCode || '',
      procedureDescription: data.procedureDescription || data.description || '',
      procedureCodingSystem: data.procedureCodingSystem || 'CPT',
      priority: data.priority || 'ROUTINE',
      status: data.status || 'PENDING',
      clinicalHistory: data.clinicalHistory || '',
      reasonForExam: data.reasonForExam || '',
      modality: data.modality || '',
      bodyPart: data.bodyPart || '',
      laterality: data.laterality,
      scheduledDate: data.scheduledDate,
      notes: data.notes,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  }
}
