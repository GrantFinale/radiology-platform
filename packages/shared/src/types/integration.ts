// ============================================================
// HL7v2 Message Types
// ============================================================

export enum HL7MessageType {
  ORM_O01 = 'ORM^O01',  // Order Message
  ORU_R01 = 'ORU^R01',  // Observation Result
  ADT_A01 = 'ADT^A01',  // Admit/Visit Notification
  ADT_A04 = 'ADT^A04',  // Register a Patient
  ADT_A08 = 'ADT^A08',  // Update Patient Information
  ADT_A11 = 'ADT^A11',  // Cancel Admit
  SIU_S12 = 'SIU^S12',  // Schedule Information Unsolicited - New Appointment
  SIU_S13 = 'SIU^S13',  // Schedule Information Unsolicited - Reschedule
  SIU_S14 = 'SIU^S14',  // Schedule Information Unsolicited - Modification
  SIU_S15 = 'SIU^S15',  // Schedule Information Unsolicited - Cancellation
  ACK = 'ACK',           // General Acknowledgment
}

export enum HL7AckCode {
  AA = 'AA',  // Application Accept
  AE = 'AE',  // Application Error
  AR = 'AR',  // Application Reject
}

export interface HL7Segment {
  name: string;
  fields: string[];
}

export interface HL7Message {
  messageType: HL7MessageType;
  messageControlId: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  dateTimeOfMessage: string;
  version: string;
  segments: HL7Segment[];
  rawMessage: string;
}

export interface HL7ParseResult {
  success: boolean;
  message?: HL7Message;
  errors?: string[];
  warnings?: string[];
}

export interface HL7AckMessage {
  messageControlId: string;
  ackCode: HL7AckCode;
  textMessage?: string;
  errorCondition?: string;
  rawMessage: string;
}

// ============================================================
// FHIR Resource Interfaces
// ============================================================

export interface FHIRReference {
  reference: string;
  display?: string;
  type?: string;
}

export interface FHIRIdentifier {
  system: string;
  value: string;
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: FHIRCodeableConcept;
}

export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRCoding {
  system: string;
  code: string;
  display?: string;
  version?: string;
}

export interface FHIRPeriod {
  start?: string;
  end?: string;
}

export interface FHIRHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  family: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
}

export interface FHIRAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface FHIRContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
}

export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
}

export interface FHIRPatient extends FHIRResource {
  resourceType: 'Patient';
  identifier?: FHIRIdentifier[];
  active?: boolean;
  name?: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  deceasedBoolean?: boolean;
  address?: FHIRAddress[];
  maritalStatus?: FHIRCodeableConcept;
  communication?: Array<{
    language: FHIRCodeableConcept;
    preferred?: boolean;
  }>;
}

export interface FHIRPractitioner extends FHIRResource {
  resourceType: 'Practitioner';
  identifier?: FHIRIdentifier[];
  active?: boolean;
  name?: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  qualification?: Array<{
    identifier?: FHIRIdentifier[];
    code: FHIRCodeableConcept;
    period?: FHIRPeriod;
    issuer?: FHIRReference;
  }>;
}

export interface FHIROrganization extends FHIRResource {
  resourceType: 'Organization';
  identifier?: FHIRIdentifier[];
  active?: boolean;
  type?: FHIRCodeableConcept[];
  name?: string;
  alias?: string[];
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress[];
  partOf?: FHIRReference;
}

export interface FHIRServiceRequest extends FHIRResource {
  resourceType: 'ServiceRequest';
  identifier?: FHIRIdentifier[];
  status: 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
  intent: 'proposal' | 'plan' | 'directive' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  category?: FHIRCodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  code?: FHIRCodeableConcept;
  subject: FHIRReference;
  encounter?: FHIRReference;
  occurrenceDateTime?: string;
  occurrencePeriod?: FHIRPeriod;
  authoredOn?: string;
  requester?: FHIRReference;
  performer?: FHIRReference[];
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  insurance?: FHIRReference[];
  supportingInfo?: FHIRReference[];
  bodySite?: FHIRCodeableConcept[];
  note?: Array<{ text: string }>;
  patientInstruction?: string;
  orderDetail?: FHIRCodeableConcept[];
}

export interface FHIRDiagnosticReport extends FHIRResource {
  resourceType: 'DiagnosticReport';
  identifier?: FHIRIdentifier[];
  basedOn?: FHIRReference[];
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject?: FHIRReference;
  encounter?: FHIRReference;
  effectiveDateTime?: string;
  effectivePeriod?: FHIRPeriod;
  issued?: string;
  performer?: FHIRReference[];
  resultsInterpreter?: FHIRReference[];
  imagingStudy?: FHIRReference[];
  conclusion?: string;
  conclusionCode?: FHIRCodeableConcept[];
  presentedForm?: Array<{
    contentType: string;
    data?: string;
    url?: string;
    title?: string;
  }>;
}

export interface FHIRBundle extends FHIRResource {
  resourceType: 'Bundle';
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  total?: number;
  entry?: Array<{
    fullUrl?: string;
    resource: FHIRResource;
    request?: {
      method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      url: string;
    };
    response?: {
      status: string;
      location?: string;
    };
  }>;
}

// ============================================================
// EMR Adapter Interface
// ============================================================

export interface EMRAdapterConfig {
  systemName: string;
  version: string;
  baseUrl: string;
  authType: 'oauth2' | 'api_key' | 'basic' | 'certificate';
  credentials: Record<string, string>;
  timeout: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface EMRAdapter {
  readonly systemName: string;
  readonly version: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  getPatient(patientId: string): Promise<FHIRPatient | null>;
  searchPatients(query: Record<string, string>): Promise<FHIRPatient[]>;

  getOrder(orderId: string): Promise<FHIRServiceRequest | null>;
  createOrder(order: FHIRServiceRequest): Promise<FHIRServiceRequest>;
  updateOrder(orderId: string, order: Partial<FHIRServiceRequest>): Promise<FHIRServiceRequest>;

  getProvider(providerId: string): Promise<FHIRPractitioner | null>;
  searchProviders(query: Record<string, string>): Promise<FHIRPractitioner[]>;

  submitResult(report: FHIRDiagnosticReport): Promise<FHIRDiagnosticReport>;

  sendMessage(message: HL7Message): Promise<HL7AckMessage>;
}

// ============================================================
// Webhook / Event Types
// ============================================================

export enum WebhookEventType {
  ORDER_RECEIVED = 'order.received',
  ORDER_UPDATED = 'order.updated',
  ORDER_STATUS_CHANGED = 'order.status_changed',
  ORDER_SCHEDULED = 'order.scheduled',
  ORDER_COMPLETED = 'order.completed',
  ORDER_REJECTED = 'order.rejected',
  ORDER_ERROR = 'order.error',

  DOCUMENT_RECEIVED = 'document.received',
  DOCUMENT_PROCESSED = 'document.processed',
  DOCUMENT_OCR_COMPLETE = 'document.ocr_complete',
  DOCUMENT_ERROR = 'document.error',

  REVIEW_CREATED = 'review.created',
  REVIEW_ASSIGNED = 'review.assigned',
  REVIEW_COMPLETED = 'review.completed',
  REVIEW_ESCALATED = 'review.escalated',

  INTEGRATION_CONNECTED = 'integration.connected',
  INTEGRATION_DISCONNECTED = 'integration.disconnected',
  INTEGRATION_ERROR = 'integration.error',
  INTEGRATION_SYNC_COMPLETE = 'integration.sync_complete',

  SCHEDULE_SLOT_AVAILABLE = 'schedule.slot_available',
  SCHEDULE_CONFLICT = 'schedule.conflict',
}

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  timestamp: string;
  source: string;
  correlationId?: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  active: boolean;
  headers?: Record<string, string>;
  retryPolicy?: {
    maxRetries: number;
    retryDelayMs: number;
    backoffMultiplier: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventId: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  responseStatus?: number;
  responseBody?: string;
  deliveredAt?: string;
  attempts: number;
  success: boolean;
  error?: string;
  nextRetryAt?: string;
}
