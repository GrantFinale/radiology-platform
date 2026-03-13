import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCPTCode,
  validateICD10Code,
  validateNPI,
  validateMRN,
  validateHL7Message,
  validateFHIRResource,
} from '../utils/validators';

describe('Validators', () => {
  describe('validateCPTCode', () => {
    it('accepts a valid 5-digit CPT code', () => {
      const result = validateCPTCode('73721');
      assert.equal(result.valid, true);
      assert.equal(result.error, undefined);
    });

    it('accepts a CPT code with 2-digit modifier', () => {
      const result = validateCPTCode('73721-26');
      assert.equal(result.valid, true);
    });

    it('accepts a CPT code with leading zeros', () => {
      const result = validateCPTCode('00100');
      assert.equal(result.valid, true);
    });

    it('accepts a CPT code with whitespace (trimmed)', () => {
      const result = validateCPTCode('  73721  ');
      assert.equal(result.valid, true);
    });

    it('rejects empty string', () => {
      const result = validateCPTCode('');
      assert.equal(result.valid, false);
      assert.ok(result.error);
    });

    it('rejects null-like input', () => {
      const result = validateCPTCode(null as unknown as string);
      assert.equal(result.valid, false);
    });

    it('rejects a 4-digit code', () => {
      const result = validateCPTCode('7372');
      assert.equal(result.valid, false);
    });

    it('rejects a 6-digit code', () => {
      const result = validateCPTCode('737210');
      assert.equal(result.valid, false);
    });

    it('rejects alphabetic characters', () => {
      const result = validateCPTCode('7372A');
      assert.equal(result.valid, false);
    });

    it('rejects a code with 1-digit modifier', () => {
      const result = validateCPTCode('73721-2');
      assert.equal(result.valid, false);
    });

    it('rejects a code with 3-digit modifier', () => {
      const result = validateCPTCode('73721-261');
      assert.equal(result.valid, false);
    });
  });

  describe('validateICD10Code', () => {
    it('accepts M54.5 (dorsalgia)', () => {
      const result = validateICD10Code('M54.5');
      assert.equal(result.valid, true);
    });

    it('accepts S72.001A (fracture code with extension)', () => {
      const result = validateICD10Code('S72.001A');
      assert.equal(result.valid, true);
    });

    it('accepts R10.9 (unspecified abdominal pain)', () => {
      const result = validateICD10Code('R10.9');
      assert.equal(result.valid, true);
    });

    it('accepts a code without decimal part (e.g., A00)', () => {
      const result = validateICD10Code('A00');
      assert.equal(result.valid, true);
    });

    it('accepts lowercase input (normalizes to uppercase)', () => {
      const result = validateICD10Code('m54.5');
      assert.equal(result.valid, true);
    });

    it('rejects empty string', () => {
      const result = validateICD10Code('');
      assert.equal(result.valid, false);
    });

    it('rejects numeric-only input', () => {
      const result = validateICD10Code('12345');
      assert.equal(result.valid, false);
    });

    it('rejects code starting with a number', () => {
      const result = validateICD10Code('1M5.4');
      assert.equal(result.valid, false);
    });

    it('rejects code with too many decimal digits', () => {
      const result = validateICD10Code('M54.12345');
      assert.equal(result.valid, false);
    });

    it('rejects null input', () => {
      const result = validateICD10Code(null as unknown as string);
      assert.equal(result.valid, false);
    });
  });

  describe('validateNPI', () => {
    it('accepts a valid NPI (1234567893)', () => {
      // 1234567893 passes the Luhn check with 80840 prefix
      const result = validateNPI('1234567893');
      assert.equal(result.valid, true);
    });

    it('accepts NPI with whitespace (trimmed)', () => {
      const result = validateNPI(' 1234567893 ');
      assert.equal(result.valid, true);
    });

    it('rejects empty string', () => {
      const result = validateNPI('');
      assert.equal(result.valid, false);
    });

    it('rejects null input', () => {
      const result = validateNPI(null as unknown as string);
      assert.equal(result.valid, false);
    });

    it('rejects 9-digit number', () => {
      const result = validateNPI('123456789');
      assert.equal(result.valid, false);
      assert.ok(result.error?.includes('10 digits'));
    });

    it('rejects 11-digit number', () => {
      const result = validateNPI('12345678901');
      assert.equal(result.valid, false);
    });

    it('rejects non-numeric characters', () => {
      const result = validateNPI('123456789A');
      assert.equal(result.valid, false);
    });

    it('rejects NPI failing Luhn check', () => {
      // 1234567890 should fail the Luhn check
      const result = validateNPI('1234567890');
      assert.equal(result.valid, false);
      assert.ok(result.error?.includes('Luhn'));
    });

    it('validates another known valid NPI (1245319599)', () => {
      const result = validateNPI('1245319599');
      assert.equal(result.valid, true);
    });
  });

  describe('validateMRN', () => {
    it('accepts a simple numeric MRN', () => {
      const result = validateMRN('12345678');
      assert.equal(result.valid, true);
    });

    it('accepts an alphanumeric MRN', () => {
      const result = validateMRN('MRN-12345');
      assert.equal(result.valid, true);
    });

    it('accepts a 4-character MRN (minimum)', () => {
      const result = validateMRN('1234');
      assert.equal(result.valid, true);
    });

    it('accepts a 20-character MRN (maximum)', () => {
      const result = validateMRN('12345678901234567890');
      assert.equal(result.valid, true);
    });

    it('accepts MRN with whitespace (trimmed)', () => {
      const result = validateMRN('  12345678  ');
      assert.equal(result.valid, true);
    });

    it('rejects empty string', () => {
      const result = validateMRN('');
      assert.equal(result.valid, false);
    });

    it('rejects null input', () => {
      const result = validateMRN(null as unknown as string);
      assert.equal(result.valid, false);
    });

    it('rejects a 3-character MRN (too short)', () => {
      const result = validateMRN('123');
      assert.equal(result.valid, false);
      assert.ok(result.error?.includes('between 4 and 20'));
    });

    it('rejects a 21-character MRN (too long)', () => {
      const result = validateMRN('123456789012345678901');
      assert.equal(result.valid, false);
    });

    it('rejects MRN with special characters', () => {
      const result = validateMRN('MRN@123');
      assert.equal(result.valid, false);
      assert.ok(result.error?.includes('alphanumeric'));
    });

    it('rejects MRN with spaces inside', () => {
      const result = validateMRN('MRN 123');
      assert.equal(result.valid, false);
    });
  });

  describe('validateHL7Message', () => {
    const validHL7 = [
      'MSH|^~\\&|SendingApp|SendFac|RecvApp|RecvFac|20240101120000||ORM^O01|MSG001|P|2.5.1',
      'PID|||12345^^^MRN||Doe^John^M||19800115|M',
      'ORC|NW|ORD001',
      'OBR|1||ORD001|73721^MRI Lower Extremity^CPT',
    ].join('\n');

    it('validates a well-formed HL7 message', () => {
      const result = validateHL7Message(validHL7);
      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('rejects empty input', () => {
      const result = validateHL7Message('');
      assert.equal(result.valid, false);
    });

    it('rejects message not starting with MSH', () => {
      const result = validateHL7Message('PID|||12345');
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('MSH')));
    });

    it('rejects message that is too short', () => {
      const result = validateHL7Message('MSH');
      assert.equal(result.valid, false);
    });

    it('validates segment names are 3 uppercase alphanumeric characters', () => {
      const msg = [
        'MSH|^~\\&|App|Fac|App|Fac|20240101||ORM^O01|MSG1|P|2.5.1',
        '123|bad segment',
      ].join('\n');
      const result = validateHL7Message(msg);
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('invalid segment name')));
    });

    it('rejects null input', () => {
      const result = validateHL7Message(null as unknown as string);
      assert.equal(result.valid, false);
    });
  });

  describe('validateFHIRResource', () => {
    it('validates a valid Patient resource', () => {
      const result = validateFHIRResource({
        resourceType: 'Patient',
        name: [{ family: 'Doe', given: ['John'] }],
      });
      assert.equal(result.valid, true);
    });

    it('validates a valid ServiceRequest resource', () => {
      const result = validateFHIRResource({
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        subject: { reference: 'Patient/123' },
      });
      assert.equal(result.valid, true);
    });

    it('rejects null input', () => {
      const result = validateFHIRResource(null as unknown as Record<string, unknown>);
      assert.equal(result.valid, false);
    });

    it('rejects object without resourceType', () => {
      const result = validateFHIRResource({ id: '123' });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('resourceType')));
    });

    it('rejects ServiceRequest without status', () => {
      const result = validateFHIRResource({
        resourceType: 'ServiceRequest',
        intent: 'order',
        subject: { reference: 'Patient/123' },
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('status')));
    });

    it('rejects ServiceRequest without intent', () => {
      const result = validateFHIRResource({
        resourceType: 'ServiceRequest',
        status: 'active',
        subject: { reference: 'Patient/123' },
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('intent')));
    });

    it('rejects ServiceRequest without subject', () => {
      const result = validateFHIRResource({
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('subject')));
    });

    it('rejects Patient without name or identifier', () => {
      const result = validateFHIRResource({ resourceType: 'Patient' });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('name or identifier')));
    });

    it('accepts Patient with identifier but no name', () => {
      const result = validateFHIRResource({
        resourceType: 'Patient',
        identifier: [{ system: 'urn:mrn', value: '12345' }],
      });
      assert.equal(result.valid, true);
    });

    it('accepts unknown resource types (passes basic validation)', () => {
      const result = validateFHIRResource({
        resourceType: 'CustomResource',
        someField: 'value',
      });
      assert.equal(result.valid, true);
    });

    it('validates meta.lastUpdated format when present', () => {
      const result = validateFHIRResource({
        resourceType: 'Patient',
        name: [{ family: 'Doe', given: ['John'] }],
        meta: { lastUpdated: 'not-a-date' },
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('lastUpdated')));
    });

    it('accepts valid meta.lastUpdated ISO date', () => {
      const result = validateFHIRResource({
        resourceType: 'Patient',
        name: [{ family: 'Doe', given: ['John'] }],
        meta: { lastUpdated: '2024-01-15T10:30:00Z' },
      });
      assert.equal(result.valid, true);
    });
  });
});
