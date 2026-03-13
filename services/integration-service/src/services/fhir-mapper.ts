import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// ---- Internal Types ----

export interface InternalOrder {
  id: string;
  accessionNumber: string;
  patientId: string;
  orderingProviderId: string;
  orderingProviderName: string;
  procedureCode: string;
  procedureDescription: string;
  procedureCodingSystem: string;
  priority: 'STAT' | 'URGENT' | 'ROUTINE' | 'ASAP';
  status: string;
  clinicalHistory: string;
  reasonForExam: string;
  scheduledDate?: string;
  modality: string;
  bodyPart: string;
  laterality?: string;
  transportMode?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InternalPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: string;
  ssn?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  phone?: string;
  email?: string;
  insuranceInfo?: {
    payerId: string;
    payerName: string;
    memberId: string;
    groupNumber: string;
  };
}

export interface InternalProvider {
  id: string;
  npi: string;
  firstName: string;
  lastName: string;
  specialty: string;
  phone?: string;
  fax?: string;
  email?: string;
  organizationName?: string;
}

export interface InternalDocument {
  id: string;
  patientId: string;
  type: string;
  typeCode: string;
  typeCodingSystem: string;
  status: string;
  dateCreated: string;
  author?: string;
  description?: string;
  contentType: string;
  contentBase64?: string;
  url?: string;
}

// ---- FHIR Resource Types (minimal but accurate R4) ----

export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: unknown;
}

export interface FHIRServiceRequest extends FHIRResource {
  resourceType: 'ServiceRequest';
  identifier?: Array<{ system: string; value: string }>;
  status: string;
  intent: string;
  priority?: string;
  category?: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  code?: { coding: Array<{ system: string; code: string; display: string }>; text?: string };
  subject: { reference: string; display?: string };
  requester?: { reference: string; display?: string };
  reasonCode?: Array<{ coding?: Array<{ system: string; code: string; display: string }>; text?: string }>;
  note?: Array<{ text: string }>;
  bodySite?: Array<{ coding: Array<{ system: string; code: string; display: string }> }>;
  occurrence?: { dateTime?: string } | string;
  orderDetail?: Array<{ coding: Array<{ system: string; code: string; display: string }>; text?: string }>;
}

export interface FHIRPatient extends FHIRResource {
  resourceType: 'Patient';
  identifier?: Array<{ system: string; value: string; type?: { coding: Array<{ system: string; code: string }> } }>;
  name?: Array<{ use?: string; family: string; given: string[]; prefix?: string[] }>;
  gender?: string;
  birthDate?: string;
  address?: Array<{
    use?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  telecom?: Array<{ system: string; value: string; use?: string }>;
}

export interface FHIRPractitioner extends FHIRResource {
  resourceType: 'Practitioner';
  identifier?: Array<{ system: string; value: string }>;
  name?: Array<{ use?: string; family: string; given: string[] }>;
  telecom?: Array<{ system: string; value: string; use?: string }>;
  qualification?: Array<{
    code: { coding: Array<{ system: string; code: string; display: string }> };
  }>;
}

export interface FHIRDocumentReference extends FHIRResource {
  resourceType: 'DocumentReference';
  identifier?: Array<{ system: string; value: string }>;
  status: string;
  type?: { coding: Array<{ system: string; code: string; display: string }> };
  subject?: { reference: string };
  date?: string;
  author?: Array<{ reference?: string; display?: string }>;
  description?: string;
  content: Array<{
    attachment: {
      contentType: string;
      url?: string;
      data?: string;
      title?: string;
    };
  }>;
}

// ---- Coding Systems ----

const CODING_SYSTEMS = {
  SNOMED: 'http://snomed.info/sct',
  LOINC: 'http://loinc.org',
  CPT: 'http://www.ama-assn.org/go/cpt',
  ICD10: 'http://hl7.org/fhir/sid/icd-10-cm',
  NPI: 'http://hl7.org/fhir/sid/us-npi',
  MRN: 'http://terminology.hl7.org/CodeSystem/v2-0203',
  SSN: 'http://hl7.org/fhir/sid/us-ssn',
  RADLEX: 'http://radlex.org',
  DICOM_MODALITY: 'http://dicom.nema.org/resources/ontology/DCM',
  SERVICE_REQUEST_CATEGORY: 'http://snomed.info/sct',
} as const;

// Priority mapping
const PRIORITY_TO_FHIR: Record<string, string> = {
  STAT: 'stat',
  URGENT: 'urgent',
  ASAP: 'asap',
  ROUTINE: 'routine',
};

const FHIR_TO_PRIORITY: Record<string, 'STAT' | 'URGENT' | 'ROUTINE' | 'ASAP'> = {
  stat: 'STAT',
  urgent: 'URGENT',
  asap: 'ASAP',
  routine: 'ROUTINE',
};

// Status mapping
const ORDER_STATUS_TO_FHIR: Record<string, string> = {
  NEW: 'active',
  PENDING: 'active',
  SCHEDULED: 'active',
  IN_PROGRESS: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'revoked',
  ON_HOLD: 'on-hold',
};

const FHIR_STATUS_TO_ORDER: Record<string, string> = {
  draft: 'NEW',
  active: 'PENDING',
  completed: 'COMPLETED',
  revoked: 'CANCELLED',
  'on-hold': 'ON_HOLD',
  'entered-in-error': 'CANCELLED',
};

// Gender mapping
const GENDER_TO_FHIR: Record<string, string> = {
  M: 'male',
  F: 'female',
  O: 'other',
  U: 'unknown',
};

const FHIR_TO_GENDER: Record<string, string> = {
  male: 'M',
  female: 'F',
  other: 'O',
  unknown: 'U',
};

function resolveCodingSystem(systemCode: string): string {
  const lookup: Record<string, string> = {
    CPT: CODING_SYSTEMS.CPT,
    LOINC: CODING_SYSTEMS.LOINC,
    SNOMED: CODING_SYSTEMS.SNOMED,
    'SNOMED-CT': CODING_SYSTEMS.SNOMED,
    SCT: CODING_SYSTEMS.SNOMED,
    ICD10: CODING_SYSTEMS.ICD10,
    RADLEX: CODING_SYSTEMS.RADLEX,
  };
  return lookup[systemCode.toUpperCase()] || systemCode;
}

// ---- Mappers ----

export function orderToServiceRequest(order: InternalOrder): FHIRServiceRequest {
  const resource: FHIRServiceRequest = {
    resourceType: 'ServiceRequest',
    id: order.id,
    meta: {
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-servicerequest'],
    },
    identifier: [
      {
        system: 'urn:oid:radiology-platform:accession',
        value: order.accessionNumber,
      },
    ],
    status: ORDER_STATUS_TO_FHIR[order.status] || 'active',
    intent: 'order',
    priority: PRIORITY_TO_FHIR[order.priority] || 'routine',
    category: [
      {
        coding: [
          {
            system: CODING_SYSTEMS.SNOMED,
            code: '363679005',
            display: 'Imaging',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: resolveCodingSystem(order.procedureCodingSystem),
          code: order.procedureCode,
          display: order.procedureDescription,
        },
      ],
      text: order.procedureDescription,
    },
    subject: {
      reference: `Patient/${order.patientId}`,
    },
    requester: {
      reference: `Practitioner/${order.orderingProviderId}`,
      display: order.orderingProviderName,
    },
    reasonCode: [],
    note: [],
  };

  if (order.reasonForExam) {
    resource.reasonCode!.push({ text: order.reasonForExam });
  }

  if (order.clinicalHistory) {
    resource.note!.push({ text: order.clinicalHistory });
  }

  if (order.notes) {
    resource.note!.push({ text: order.notes });
  }

  if (order.bodyPart) {
    resource.bodySite = [
      {
        coding: [
          {
            system: CODING_SYSTEMS.SNOMED,
            code: order.bodyPart,
            display: order.bodyPart,
          },
        ],
      },
    ];
  }

  if (order.scheduledDate) {
    resource.occurrence = order.scheduledDate;
  }

  if (order.modality) {
    resource.orderDetail = [
      {
        coding: [
          {
            system: CODING_SYSTEMS.DICOM_MODALITY,
            code: order.modality,
            display: order.modality,
          },
        ],
        text: `Modality: ${order.modality}`,
      },
    ];
  }

  // Clean up empty arrays
  if (resource.reasonCode!.length === 0) delete resource.reasonCode;
  if (resource.note!.length === 0) delete resource.note;

  logger.debug('Mapped order to ServiceRequest', { orderId: order.id });
  return resource;
}

export function serviceRequestToOrder(resource: FHIRServiceRequest): InternalOrder {
  const coding = resource.code?.coding?.[0];
  const identifier = resource.identifier?.[0];

  const order: InternalOrder = {
    id: resource.id || uuidv4(),
    accessionNumber: identifier?.value || '',
    patientId: resource.subject?.reference?.replace('Patient/', '') || '',
    orderingProviderId: resource.requester?.reference?.replace('Practitioner/', '') || '',
    orderingProviderName: resource.requester?.display || '',
    procedureCode: coding?.code || '',
    procedureDescription: coding?.display || resource.code?.text || '',
    procedureCodingSystem: coding?.system || '',
    priority: FHIR_TO_PRIORITY[resource.priority || 'routine'] || 'ROUTINE',
    status: FHIR_STATUS_TO_ORDER[resource.status] || 'NEW',
    clinicalHistory: resource.note?.map((n) => n.text).join('; ') || '',
    reasonForExam: resource.reasonCode?.map((r) => r.text || r.coding?.[0]?.display).join('; ') || '',
    modality: resource.orderDetail?.[0]?.coding?.[0]?.code || '',
    bodyPart: resource.bodySite?.[0]?.coding?.[0]?.code || '',
    laterality: undefined,
    scheduledDate: typeof resource.occurrence === 'string' ? resource.occurrence : undefined,
    createdAt: resource.meta?.lastUpdated || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  logger.debug('Mapped ServiceRequest to order', { orderId: order.id });
  return order;
}

export function patientToFHIR(patient: InternalPatient): FHIRPatient {
  const resource: FHIRPatient = {
    resourceType: 'Patient',
    id: patient.id,
    meta: {
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
    },
    identifier: [
      {
        system: 'urn:oid:radiology-platform:mrn',
        value: patient.mrn,
        type: {
          coding: [
            {
              system: CODING_SYSTEMS.MRN,
              code: 'MR',
            },
          ],
        },
      },
    ],
    name: [
      {
        use: 'official',
        family: patient.lastName,
        given: [patient.firstName, ...(patient.middleName ? [patient.middleName] : [])],
      },
    ],
    gender: GENDER_TO_FHIR[patient.gender] || 'unknown',
    birthDate: patient.dateOfBirth,
  };

  if (patient.ssn) {
    resource.identifier!.push({
      system: CODING_SYSTEMS.SSN,
      value: patient.ssn,
    });
  }

  if (patient.address) {
    resource.address = [
      {
        use: 'home',
        line: [patient.address.line1, ...(patient.address.line2 ? [patient.address.line2] : [])],
        city: patient.address.city,
        state: patient.address.state,
        postalCode: patient.address.postalCode,
        country: patient.address.country,
      },
    ];
  }

  const telecom: FHIRPatient['telecom'] = [];
  if (patient.phone) {
    telecom.push({ system: 'phone', value: patient.phone, use: 'home' });
  }
  if (patient.email) {
    telecom.push({ system: 'email', value: patient.email });
  }
  if (telecom.length > 0) {
    resource.telecom = telecom;
  }

  logger.debug('Mapped patient to FHIR Patient', { patientId: patient.id });
  return resource;
}

export function fhirToPatient(resource: FHIRPatient): InternalPatient {
  const name = resource.name?.[0];
  const mrnIdentifier = resource.identifier?.find(
    (id) => id.type?.coding?.some((c) => c.code === 'MR') || id.system?.includes('mrn'),
  );
  const ssnIdentifier = resource.identifier?.find((id) => id.system === CODING_SYSTEMS.SSN);
  const address = resource.address?.[0];
  const phone = resource.telecom?.find((t) => t.system === 'phone');
  const email = resource.telecom?.find((t) => t.system === 'email');

  const patient: InternalPatient = {
    id: resource.id || uuidv4(),
    mrn: mrnIdentifier?.value || resource.identifier?.[0]?.value || '',
    firstName: name?.given?.[0] || '',
    lastName: name?.family || '',
    middleName: name?.given?.[1],
    dateOfBirth: resource.birthDate || '',
    gender: FHIR_TO_GENDER[resource.gender || 'unknown'] || 'U',
    ssn: ssnIdentifier?.value,
    phone: phone?.value,
    email: email?.value,
  };

  if (address) {
    patient.address = {
      line1: address.line?.[0] || '',
      line2: address.line?.[1],
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postalCode || '',
      country: address.country || 'US',
    };
  }

  logger.debug('Mapped FHIR Patient to internal patient', { patientId: patient.id });
  return patient;
}

export function providerToPractitioner(provider: InternalProvider): FHIRPractitioner {
  const resource: FHIRPractitioner = {
    resourceType: 'Practitioner',
    id: provider.id,
    identifier: [
      {
        system: CODING_SYSTEMS.NPI,
        value: provider.npi,
      },
    ],
    name: [
      {
        use: 'official',
        family: provider.lastName,
        given: [provider.firstName],
      },
    ],
  };

  const telecom: Array<{ system: string; value: string; use?: string }> = [];
  if (provider.phone) {
    telecom.push({ system: 'phone', value: provider.phone, use: 'work' });
  }
  if (provider.fax) {
    telecom.push({ system: 'fax', value: provider.fax, use: 'work' });
  }
  if (provider.email) {
    telecom.push({ system: 'email', value: provider.email, use: 'work' });
  }
  if (telecom.length > 0) {
    resource.telecom = telecom;
  }

  if (provider.specialty) {
    resource.qualification = [
      {
        code: {
          coding: [
            {
              system: CODING_SYSTEMS.SNOMED,
              code: provider.specialty,
              display: provider.specialty,
            },
          ],
        },
      },
    ];
  }

  logger.debug('Mapped provider to FHIR Practitioner', { providerId: provider.id });
  return resource;
}

export function documentToDocumentReference(doc: InternalDocument): FHIRDocumentReference {
  const resource: FHIRDocumentReference = {
    resourceType: 'DocumentReference',
    id: doc.id,
    identifier: [
      {
        system: 'urn:oid:radiology-platform:document',
        value: doc.id,
      },
    ],
    status: doc.status === 'FINAL' ? 'current' : doc.status === 'CANCELLED' ? 'entered-in-error' : 'current',
    type: {
      coding: [
        {
          system: resolveCodingSystem(doc.typeCodingSystem),
          code: doc.typeCode,
          display: doc.type,
        },
      ],
    },
    subject: {
      reference: `Patient/${doc.patientId}`,
    },
    date: doc.dateCreated,
    content: [
      {
        attachment: {
          contentType: doc.contentType,
          ...(doc.url ? { url: doc.url } : {}),
          ...(doc.contentBase64 ? { data: doc.contentBase64 } : {}),
          title: doc.description || doc.type,
        },
      },
    ],
  };

  if (doc.author) {
    resource.author = [{ display: doc.author }];
  }

  if (doc.description) {
    resource.description = doc.description;
  }

  logger.debug('Mapped document to FHIR DocumentReference', { documentId: doc.id });
  return resource;
}
