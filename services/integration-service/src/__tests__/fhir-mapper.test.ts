import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  orderToServiceRequest,
  serviceRequestToOrder,
  patientToFHIR,
  fhirToPatient,
  providerToPractitioner,
  documentToDocumentReference,
} from '../services/fhir-mapper';
import type {
  InternalOrder,
  InternalPatient,
  InternalProvider,
  InternalDocument,
  FHIRServiceRequest,
  FHIRPatient,
} from '../services/fhir-mapper';

function makeSampleOrder(overrides?: Partial<InternalOrder>): InternalOrder {
  return {
    id: 'order-001',
    accessionNumber: 'ACC-2024-0001',
    patientId: 'patient-001',
    orderingProviderId: 'provider-001',
    orderingProviderName: 'Dr. Jane Smith',
    procedureCode: '73721',
    procedureDescription: 'MRI Lower Extremity without Contrast',
    procedureCodingSystem: 'CPT',
    priority: 'ROUTINE',
    status: 'PENDING',
    clinicalHistory: 'Patient reports chronic lower back pain',
    reasonForExam: 'Lower back pain radiating to left leg',
    modality: 'MR',
    bodyPart: 'LOWER_EXTREMITY',
    scheduledDate: '2024-01-20T10:00:00Z',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    ...overrides,
  };
}

function makeSamplePatient(overrides?: Partial<InternalPatient>): InternalPatient {
  return {
    id: 'patient-001',
    mrn: 'MRN12345',
    firstName: 'John',
    lastName: 'Doe',
    middleName: 'Michael',
    dateOfBirth: '1980-01-15',
    gender: 'M',
    ssn: '123-45-6789',
    address: {
      line1: '123 Main St',
      line2: 'Apt 4B',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
      country: 'US',
    },
    phone: '555-123-4567',
    email: 'john.doe@example.com',
    ...overrides,
  };
}

describe('FHIR Mapper', () => {
  describe('orderToServiceRequest', () => {
    it('maps order ID to ServiceRequest id', () => {
      const order = makeSampleOrder();
      const sr = orderToServiceRequest(order);
      assert.equal(sr.id, 'order-001');
      assert.equal(sr.resourceType, 'ServiceRequest');
    });

    it('maps accession number to identifier', () => {
      const order = makeSampleOrder();
      const sr = orderToServiceRequest(order);
      assert.ok(sr.identifier);
      assert.equal(sr.identifier![0].value, 'ACC-2024-0001');
      assert.ok(sr.identifier![0].system.includes('accession'));
    });

    it('maps status to FHIR status', () => {
      const order = makeSampleOrder({ status: 'PENDING' });
      const sr = orderToServiceRequest(order);
      assert.equal(sr.status, 'active');
    });

    it('maps completed status', () => {
      const order = makeSampleOrder({ status: 'COMPLETED' });
      const sr = orderToServiceRequest(order);
      assert.equal(sr.status, 'completed');
    });

    it('maps cancelled status', () => {
      const order = makeSampleOrder({ status: 'CANCELLED' });
      const sr = orderToServiceRequest(order);
      assert.equal(sr.status, 'revoked');
    });

    it('sets intent to order', () => {
      const order = makeSampleOrder();
      const sr = orderToServiceRequest(order);
      assert.equal(sr.intent, 'order');
    });

    it('maps priority', () => {
      const order = makeSampleOrder({ priority: 'STAT' });
      const sr = orderToServiceRequest(order);
      assert.equal(sr.priority, 'stat');
    });

    it('maps routine priority', () => {
      const order = makeSampleOrder({ priority: 'ROUTINE' });
      const sr = orderToServiceRequest(order);
      assert.equal(sr.priority, 'routine');
    });

    it('maps procedure code to code.coding', () => {
      const order = makeSampleOrder();
      const sr = orderToServiceRequest(order);
      assert.ok(sr.code);
      assert.equal(sr.code!.coding[0].code, '73721');
      assert.equal(sr.code!.coding[0].display, 'MRI Lower Extremity without Contrast');
      assert.ok(sr.code!.coding[0].system.includes('cpt'));
    });

    it('maps patient reference', () => {
      const order = makeSampleOrder();
      const sr = orderToServiceRequest(order);
      assert.equal(sr.subject.reference, 'Patient/patient-001');
    });

    it('maps provider reference', () => {
      const order = makeSampleOrder();
      const sr = orderToServiceRequest(order);
      assert.ok(sr.requester);
      assert.equal(sr.requester!.reference, 'Practitioner/provider-001');
      assert.equal(sr.requester!.display, 'Dr. Jane Smith');
    });

    it('maps reason for exam to reasonCode', () => {
      const order = makeSampleOrder();
      const sr = orderToServiceRequest(order);
      assert.ok(sr.reasonCode);
      assert.ok(sr.reasonCode!.length > 0);
      assert.equal(sr.reasonCode![0].text, 'Lower back pain radiating to left leg');
    });

    it('maps clinical history to note', () => {
      const order = makeSampleOrder();
      const sr = orderToServiceRequest(order);
      assert.ok(sr.note);
      assert.ok(sr.note!.some((n) => n.text.includes('chronic lower back pain')));
    });

    it('maps body part to bodySite', () => {
      const order = makeSampleOrder();
      const sr = orderToServiceRequest(order);
      assert.ok(sr.bodySite);
      assert.equal(sr.bodySite![0].coding[0].code, 'LOWER_EXTREMITY');
    });

    it('maps modality to orderDetail', () => {
      const order = makeSampleOrder();
      const sr = orderToServiceRequest(order);
      assert.ok(sr.orderDetail);
      assert.equal(sr.orderDetail![0].coding[0].code, 'MR');
    });

    it('maps scheduled date to occurrence', () => {
      const order = makeSampleOrder();
      const sr = orderToServiceRequest(order);
      assert.equal(sr.occurrence, '2024-01-20T10:00:00Z');
    });

    it('omits reasonCode when no reason for exam', () => {
      const order = makeSampleOrder({ reasonForExam: '' });
      const sr = orderToServiceRequest(order);
      assert.equal(sr.reasonCode, undefined);
    });

    it('omits note when no clinical history', () => {
      const order = makeSampleOrder({ clinicalHistory: '', notes: undefined });
      const sr = orderToServiceRequest(order);
      assert.equal(sr.note, undefined);
    });

    it('includes US Core profile', () => {
      const order = makeSampleOrder();
      const sr = orderToServiceRequest(order);
      assert.ok(sr.meta?.profile);
      assert.ok(sr.meta!.profile!.some((p) => p.includes('us-core')));
    });
  });

  describe('serviceRequestToOrder', () => {
    it('maps ServiceRequest back to internal order', () => {
      const sr: FHIRServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-001',
        identifier: [{ system: 'urn:oid:radiology-platform:accession', value: 'ACC-001' }],
        status: 'active',
        intent: 'order',
        priority: 'urgent',
        code: {
          coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '73721', display: 'MRI Lower Extremity' }],
          text: 'MRI Lower Extremity',
        },
        subject: { reference: 'Patient/pat-001' },
        requester: { reference: 'Practitioner/prov-001', display: 'Dr. Smith' },
        reasonCode: [{ text: 'Back pain' }],
        note: [{ text: 'History of injury' }],
        bodySite: [{ coding: [{ system: 'http://snomed.info/sct', code: 'KNEE', display: 'Knee' }] }],
        orderDetail: [{ coding: [{ system: 'http://dicom.nema.org/resources/ontology/DCM', code: 'MR', display: 'MR' }] }],
        occurrence: '2024-02-01T09:00:00Z',
      };

      const order = serviceRequestToOrder(sr);
      assert.equal(order.id, 'sr-001');
      assert.equal(order.accessionNumber, 'ACC-001');
      assert.equal(order.patientId, 'pat-001');
      assert.equal(order.orderingProviderId, 'prov-001');
      assert.equal(order.orderingProviderName, 'Dr. Smith');
      assert.equal(order.procedureCode, '73721');
      assert.equal(order.priority, 'URGENT');
      assert.equal(order.status, 'PENDING');
      assert.equal(order.modality, 'MR');
      assert.equal(order.bodyPart, 'KNEE');
      assert.equal(order.scheduledDate, '2024-02-01T09:00:00Z');
    });

    it('maps completed status correctly', () => {
      const sr: FHIRServiceRequest = {
        resourceType: 'ServiceRequest',
        status: 'completed',
        intent: 'order',
        subject: { reference: 'Patient/pat-001' },
      };
      const order = serviceRequestToOrder(sr);
      assert.equal(order.status, 'COMPLETED');
    });

    it('maps revoked status to CANCELLED', () => {
      const sr: FHIRServiceRequest = {
        resourceType: 'ServiceRequest',
        status: 'revoked',
        intent: 'order',
        subject: { reference: 'Patient/pat-001' },
      };
      const order = serviceRequestToOrder(sr);
      assert.equal(order.status, 'CANCELLED');
    });

    it('defaults priority to ROUTINE when not specified', () => {
      const sr: FHIRServiceRequest = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/pat-001' },
      };
      const order = serviceRequestToOrder(sr);
      assert.equal(order.priority, 'ROUTINE');
    });

    it('generates UUID for id when not present', () => {
      const sr: FHIRServiceRequest = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/pat-001' },
      };
      const order = serviceRequestToOrder(sr);
      assert.ok(order.id);
      assert.ok(order.id.length > 0);
    });

    it('concatenates multiple notes', () => {
      const sr: FHIRServiceRequest = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/pat-001' },
        note: [{ text: 'Note 1' }, { text: 'Note 2' }],
      };
      const order = serviceRequestToOrder(sr);
      assert.ok(order.clinicalHistory.includes('Note 1'));
      assert.ok(order.clinicalHistory.includes('Note 2'));
    });
  });

  describe('patientToFHIR', () => {
    it('maps internal patient to FHIR Patient', () => {
      const patient = makeSamplePatient();
      const fhir = patientToFHIR(patient);
      assert.equal(fhir.resourceType, 'Patient');
      assert.equal(fhir.id, 'patient-001');
    });

    it('maps MRN to identifier', () => {
      const patient = makeSamplePatient();
      const fhir = patientToFHIR(patient);
      assert.ok(fhir.identifier);
      const mrnId = fhir.identifier!.find((id) => id.value === 'MRN12345');
      assert.ok(mrnId);
    });

    it('maps SSN to identifier when present', () => {
      const patient = makeSamplePatient();
      const fhir = patientToFHIR(patient);
      const ssnId = fhir.identifier!.find((id) => id.system.includes('ssn'));
      assert.ok(ssnId);
      assert.equal(ssnId!.value, '123-45-6789');
    });

    it('does not include SSN identifier when not present', () => {
      const patient = makeSamplePatient({ ssn: undefined });
      const fhir = patientToFHIR(patient);
      const ssnId = fhir.identifier!.find((id) => id.system.includes('ssn'));
      assert.equal(ssnId, undefined);
    });

    it('maps name correctly', () => {
      const patient = makeSamplePatient();
      const fhir = patientToFHIR(patient);
      assert.ok(fhir.name);
      assert.equal(fhir.name![0].family, 'Doe');
      assert.ok(fhir.name![0].given.includes('John'));
      assert.ok(fhir.name![0].given.includes('Michael'));
    });

    it('maps gender M to male', () => {
      const patient = makeSamplePatient({ gender: 'M' });
      const fhir = patientToFHIR(patient);
      assert.equal(fhir.gender, 'male');
    });

    it('maps gender F to female', () => {
      const patient = makeSamplePatient({ gender: 'F' });
      const fhir = patientToFHIR(patient);
      assert.equal(fhir.gender, 'female');
    });

    it('maps birth date', () => {
      const patient = makeSamplePatient();
      const fhir = patientToFHIR(patient);
      assert.equal(fhir.birthDate, '1980-01-15');
    });

    it('maps address', () => {
      const patient = makeSamplePatient();
      const fhir = patientToFHIR(patient);
      assert.ok(fhir.address);
      assert.equal(fhir.address![0].city, 'Springfield');
      assert.equal(fhir.address![0].state, 'IL');
      assert.equal(fhir.address![0].postalCode, '62704');
      assert.ok(fhir.address![0].line!.includes('123 Main St'));
      assert.ok(fhir.address![0].line!.includes('Apt 4B'));
    });

    it('maps phone and email to telecom', () => {
      const patient = makeSamplePatient();
      const fhir = patientToFHIR(patient);
      assert.ok(fhir.telecom);
      const phone = fhir.telecom!.find((t) => t.system === 'phone');
      assert.ok(phone);
      assert.equal(phone!.value, '555-123-4567');
      const email = fhir.telecom!.find((t) => t.system === 'email');
      assert.ok(email);
      assert.equal(email!.value, 'john.doe@example.com');
    });

    it('omits telecom when no phone or email', () => {
      const patient = makeSamplePatient({ phone: undefined, email: undefined });
      const fhir = patientToFHIR(patient);
      assert.equal(fhir.telecom, undefined);
    });

    it('includes US Core profile', () => {
      const patient = makeSamplePatient();
      const fhir = patientToFHIR(patient);
      assert.ok(fhir.meta?.profile);
      assert.ok(fhir.meta!.profile!.some((p) => p.includes('us-core')));
    });
  });

  describe('fhirToPatient', () => {
    it('maps FHIR Patient to internal patient', () => {
      const fhirPatient: FHIRPatient = {
        resourceType: 'Patient',
        id: 'fhir-pat-001',
        identifier: [
          {
            system: 'urn:oid:radiology-platform:mrn',
            value: 'MRN99999',
            type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MR' }] },
          },
        ],
        name: [{ use: 'official', family: 'Smith', given: ['Jane', 'Marie'] }],
        gender: 'female',
        birthDate: '1990-06-15',
        address: [{
          use: 'home',
          line: ['456 Oak Ave'],
          city: 'Chicago',
          state: 'IL',
          postalCode: '60601',
          country: 'US',
        }],
        telecom: [
          { system: 'phone', value: '555-987-6543', use: 'home' },
          { system: 'email', value: 'jane@example.com' },
        ],
      };

      const patient = fhirToPatient(fhirPatient);
      assert.equal(patient.id, 'fhir-pat-001');
      assert.equal(patient.mrn, 'MRN99999');
      assert.equal(patient.firstName, 'Jane');
      assert.equal(patient.lastName, 'Smith');
      assert.equal(patient.middleName, 'Marie');
      assert.equal(patient.gender, 'F');
      assert.equal(patient.dateOfBirth, '1990-06-15');
      assert.ok(patient.address);
      assert.equal(patient.address!.city, 'Chicago');
      assert.equal(patient.phone, '555-987-6543');
      assert.equal(patient.email, 'jane@example.com');
    });

    it('maps male gender correctly', () => {
      const fhir: FHIRPatient = {
        resourceType: 'Patient',
        gender: 'male',
        identifier: [{ system: 'mrn', value: '123' }],
      };
      const patient = fhirToPatient(fhir);
      assert.equal(patient.gender, 'M');
    });

    it('defaults to unknown gender', () => {
      const fhir: FHIRPatient = {
        resourceType: 'Patient',
        identifier: [{ system: 'mrn', value: '123' }],
      };
      const patient = fhirToPatient(fhir);
      assert.equal(patient.gender, 'U');
    });

    it('generates UUID when id is missing', () => {
      const fhir: FHIRPatient = {
        resourceType: 'Patient',
        identifier: [{ system: 'mrn', value: '123' }],
      };
      const patient = fhirToPatient(fhir);
      assert.ok(patient.id);
      assert.ok(patient.id.length > 0);
    });

    it('handles patient with no address', () => {
      const fhir: FHIRPatient = {
        resourceType: 'Patient',
        identifier: [{ system: 'mrn', value: '123' }],
        name: [{ family: 'Test', given: ['User'] }],
      };
      const patient = fhirToPatient(fhir);
      assert.equal(patient.address, undefined);
    });

    it('round-trips patient through FHIR and back', () => {
      const original = makeSamplePatient();
      const fhir = patientToFHIR(original);
      const roundTripped = fhirToPatient(fhir);

      assert.equal(roundTripped.id, original.id);
      assert.equal(roundTripped.mrn, original.mrn);
      assert.equal(roundTripped.firstName, original.firstName);
      assert.equal(roundTripped.lastName, original.lastName);
      assert.equal(roundTripped.gender, original.gender);
      assert.equal(roundTripped.dateOfBirth, original.dateOfBirth);
    });
  });

  describe('providerToPractitioner', () => {
    it('maps provider to FHIR Practitioner', () => {
      const provider: InternalProvider = {
        id: 'prov-001',
        npi: '1234567893',
        firstName: 'Jane',
        lastName: 'Smith',
        specialty: 'Radiology',
        phone: '555-111-2222',
        fax: '555-111-3333',
        email: 'jane.smith@hospital.org',
      };

      const practitioner = providerToPractitioner(provider);
      assert.equal(practitioner.resourceType, 'Practitioner');
      assert.equal(practitioner.id, 'prov-001');
      assert.ok(practitioner.identifier);
      assert.equal(practitioner.identifier![0].value, '1234567893');
      assert.ok(practitioner.name);
      assert.equal(practitioner.name![0].family, 'Smith');
      assert.ok(practitioner.name![0].given.includes('Jane'));
      assert.ok(practitioner.telecom);
      assert.ok(practitioner.telecom!.some((t) => t.system === 'phone'));
      assert.ok(practitioner.telecom!.some((t) => t.system === 'fax'));
      assert.ok(practitioner.telecom!.some((t) => t.system === 'email'));
    });

    it('omits telecom when no contact info', () => {
      const provider: InternalProvider = {
        id: 'prov-002',
        npi: '1234567893',
        firstName: 'Bob',
        lastName: 'Jones',
        specialty: 'Oncology',
      };

      const practitioner = providerToPractitioner(provider);
      assert.equal(practitioner.telecom, undefined);
    });

    it('maps specialty to qualification', () => {
      const provider: InternalProvider = {
        id: 'prov-003',
        npi: '1234567893',
        firstName: 'Alice',
        lastName: 'Brown',
        specialty: 'Radiology',
      };

      const practitioner = providerToPractitioner(provider);
      assert.ok(practitioner.qualification);
      assert.equal(practitioner.qualification![0].code.coding[0].display, 'Radiology');
    });
  });

  describe('documentToDocumentReference', () => {
    it('maps internal document to FHIR DocumentReference', () => {
      const doc: InternalDocument = {
        id: 'doc-001',
        patientId: 'patient-001',
        type: 'Radiology Order',
        typeCode: '18748-4',
        typeCodingSystem: 'LOINC',
        status: 'FINAL',
        dateCreated: '2024-01-15T10:00:00Z',
        author: 'Dr. Smith',
        description: 'MRI Order Form',
        contentType: 'application/pdf',
        url: 'https://storage.example.com/doc-001.pdf',
      };

      const docRef = documentToDocumentReference(doc);
      assert.equal(docRef.resourceType, 'DocumentReference');
      assert.equal(docRef.id, 'doc-001');
      assert.equal(docRef.status, 'current');
      assert.ok(docRef.subject);
      assert.equal(docRef.subject!.reference, 'Patient/patient-001');
      assert.ok(docRef.content);
      assert.equal(docRef.content[0].attachment.contentType, 'application/pdf');
      assert.equal(docRef.content[0].attachment.url, 'https://storage.example.com/doc-001.pdf');
      assert.ok(docRef.author);
      assert.equal(docRef.author![0].display, 'Dr. Smith');
    });

    it('maps CANCELLED status to entered-in-error', () => {
      const doc: InternalDocument = {
        id: 'doc-002',
        patientId: 'patient-001',
        type: 'Order',
        typeCode: '18748-4',
        typeCodingSystem: 'LOINC',
        status: 'CANCELLED',
        dateCreated: '2024-01-15T10:00:00Z',
        contentType: 'application/pdf',
      };

      const docRef = documentToDocumentReference(doc);
      assert.equal(docRef.status, 'entered-in-error');
    });
  });
});
