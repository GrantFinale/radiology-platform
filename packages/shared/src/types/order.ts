export enum OrderStatus {
  RECEIVED = 'RECEIVED',
  DOCUMENT_PROCESSING = 'DOCUMENT_PROCESSING',
  INTERPRETED = 'INTERPRETED',
  NORMALIZED = 'NORMALIZED',
  VALIDATED = 'VALIDATED',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  ERROR = 'ERROR',
}

export enum OrderSource {
  FAX = 'FAX',
  SCANNED_PDF = 'SCANNED_PDF',
  HANDWRITTEN = 'HANDWRITTEN',
  EMR = 'EMR',
  HL7 = 'HL7',
  FHIR = 'FHIR',
  EMAIL = 'EMAIL',
  MANUAL = 'MANUAL',
}

export enum DocumentType {
  FAX = 'FAX',
  PDF = 'PDF',
  IMAGE = 'IMAGE',
  HL7_MESSAGE = 'HL7_MESSAGE',
  FHIR_BUNDLE = 'FHIR_BUNDLE',
  EMAIL = 'EMAIL',
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED',
}

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: 'M' | 'F' | 'O' | 'U';
  ssn?: string;
  phone?: string;
  phoneSecondary?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  insurancePlanId?: string;
  preferredLanguage?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  allergies?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Provider {
  id: string;
  npi: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  specialty: string;
  facilityId: string;
  phone?: string;
  fax?: string;
  email?: string;
  emrId?: string;
  deaNumber?: string;
  stateLicenseNumber?: string;
  taxonomyCode?: string;
  createdAt: string;
}

export interface Facility {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  fax?: string;
  email?: string;
  emrSystem?: string;
  emrVersion?: string;
  npi?: string;
  taxId?: string;
  accreditationNumber?: string;
  schedulingEndpoint?: string;
  createdAt: string;
}

export interface Procedure {
  cptCode: string;
  cptDescription: string;
  modality: string;
  bodyPart: string;
  laterality?: string;
  contrast?: boolean;
  sedationRequired?: boolean;
  estimatedDurationMinutes?: number;
  preparationInstructions?: string;
}

export interface InsurancePlan {
  id: string;
  payerName: string;
  payerId?: string;
  planName: string;
  planType: 'HMO' | 'PPO' | 'EPO' | 'POS' | 'MEDICARE' | 'MEDICAID' | 'TRICARE' | 'WORKERS_COMP' | 'SELF_PAY' | 'OTHER';
  memberId: string;
  groupNumber?: string;
  subscriberName?: string;
  subscriberRelationship?: 'SELF' | 'SPOUSE' | 'CHILD' | 'OTHER';
  effectiveDate?: string;
  terminationDate?: string;
  copayAmount?: number;
  authorizationRequired?: boolean;
  authorizationNumber?: string;
  authorizationExpiration?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  orderId: string;
  type: DocumentType;
  sourcePath?: string;
  storageKey: string;
  mimeType: string;
  fileName?: string;
  fileSizeBytes?: number;
  pageCount?: number;
  ocrText?: string;
  ocrConfidence?: number;
  ocrEngine?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ReviewTask {
  id: string;
  orderId: string;
  documentId?: string;
  status: ReviewStatus;
  assignedTo?: string;
  assignedAt?: string;
  reason?: string;
  notes?: string;
  resolution?: string;
  fieldsToReview?: string[];
  originalValues?: Record<string, unknown>;
  correctedValues?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Order {
  id: string;
  externalId?: string;
  accessionNumber?: string;
  patientId: string;
  patient?: Patient;
  orderingProviderId: string;
  orderingProvider?: Provider;
  referringProviderId?: string;
  referringProvider?: Provider;
  facilityId: string;
  facility?: Facility;
  insurancePlanId?: string;
  insurancePlan?: InsurancePlan;
  source: OrderSource;
  status: OrderStatus;
  priority: 'STAT' | 'URGENT' | 'ROUTINE' | 'ASAP';
  cptCode: string;
  cptDescription: string;
  icd10Codes: string[];
  icd10Descriptions?: string[];
  modality: string;
  bodyPart: string;
  laterality?: string;
  contrast?: boolean;
  clinicalIndication: string;
  clinicalHistory?: string;
  specialInstructions?: string;
  patientPrep?: string;
  scheduledDatetime?: string;
  scheduledLocation?: string;
  scheduledDurationMinutes?: number;
  confidenceScore?: number;
  requiresReview: boolean;
  documents?: Document[];
  reviewTasks?: ReviewTask[];
  reasonForExam?: string;
  transportMode?: 'AMBULATORY' | 'WHEELCHAIR' | 'STRETCHER' | 'OTHER';
  isolationPrecautions?: string;
  pregnancyStatus?: 'YES' | 'NO' | 'UNKNOWN' | 'N/A';
  weight?: number;
  weightUnit?: 'KG' | 'LB';
  creatinineLevel?: number;
  gfr?: number;
  diabeticStatus?: boolean;
  previousExams?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  entityType: 'ORDER' | 'PATIENT' | 'DOCUMENT' | 'REVIEW_TASK' | 'PROVIDER' | 'FACILITY';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'ASSIGN' | 'VIEW' | 'EXPORT' | 'IMPORT';
  actor: string;
  actorType?: 'USER' | 'SYSTEM' | 'INTEGRATION';
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason?: string;
  actor: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface OrderSearchCriteria {
  status?: OrderStatus[];
  source?: OrderSource[];
  priority?: string[];
  modality?: string[];
  facilityId?: string;
  providerId?: string;
  patientMrn?: string;
  patientName?: string;
  dateFrom?: string;
  dateTo?: string;
  requiresReview?: boolean;
  cptCode?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface OrderCreateRequest {
  externalId?: string;
  patientId: string;
  orderingProviderId: string;
  referringProviderId?: string;
  facilityId: string;
  insurancePlanId?: string;
  source: OrderSource;
  priority: 'STAT' | 'URGENT' | 'ROUTINE' | 'ASAP';
  cptCode: string;
  icd10Codes: string[];
  modality: string;
  bodyPart: string;
  laterality?: string;
  contrast?: boolean;
  clinicalIndication: string;
  clinicalHistory?: string;
  specialInstructions?: string;
  scheduledDatetime?: string;
  scheduledLocation?: string;
}

export interface OrderUpdateRequest {
  status?: OrderStatus;
  priority?: 'STAT' | 'URGENT' | 'ROUTINE' | 'ASAP';
  cptCode?: string;
  icd10Codes?: string[];
  modality?: string;
  bodyPart?: string;
  laterality?: string;
  clinicalIndication?: string;
  specialInstructions?: string;
  scheduledDatetime?: string;
  scheduledLocation?: string;
  confidenceScore?: number;
  requiresReview?: boolean;
}
