import { InternalOrder, InternalPatient } from './fhir-mapper';

export interface EMRConnectionConfig {
  type: 'epic' | 'cerner' | 'generic';
  baseUrl: string;
  auth: {
    type: 'oauth2' | 'basic' | 'apikey';
    clientId?: string;
    clientSecret?: string;
    privateKeyPath?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    tokenEndpoint?: string;
    scope?: string;
  };
  fhirEndpoint?: string;
  customHeaders?: Record<string, string>;
  endpointMapping?: Record<string, string>;
}

export interface EMRScheduleSlot {
  id: string;
  startTime: string;
  endTime: string;
  status: 'free' | 'busy' | 'tentative';
  location?: string;
  practitioner?: string;
  serviceType?: string;
}

export interface EMRAdapter {
  readonly type: string;

  connect(config: EMRConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  getPatient(patientId: string): Promise<InternalPatient | null>;
  searchPatients(query: Record<string, string>): Promise<InternalPatient[]>;

  createOrder(order: InternalOrder): Promise<{ id: string; status: string }>;
  updateOrder(orderId: string, updates: Partial<InternalOrder>): Promise<{ id: string; status: string }>;
  getOrder(orderId: string): Promise<InternalOrder | null>;

  getSchedule(params: {
    date: string;
    practitionerId?: string;
    locationId?: string;
  }): Promise<EMRScheduleSlot[]>;
}

export class EMRAdapterFactory {
  private static registry = new Map<string, new () => EMRAdapter>();

  static register(type: string, adapterClass: new () => EMRAdapter): void {
    EMRAdapterFactory.registry.set(type.toLowerCase(), adapterClass);
  }

  static create(type: string): EMRAdapter {
    const AdapterClass = EMRAdapterFactory.registry.get(type.toLowerCase());
    if (!AdapterClass) {
      throw new Error(`Unknown EMR adapter type: ${type}. Registered types: ${Array.from(EMRAdapterFactory.registry.keys()).join(', ')}`);
    }
    return new AdapterClass();
  }

  static getRegisteredTypes(): string[] {
    return Array.from(EMRAdapterFactory.registry.keys());
  }
}
