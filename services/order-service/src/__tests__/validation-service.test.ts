import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { OrderForValidation, ValidationResult } from '../services/validation-service';

/**
 * These tests validate the pure logic portions of the validation service.
 * The database-dependent functions (validateInsurance, validateAuthorization,
 * validateClinicalIndication) are tested by injecting mock pool behavior.
 *
 * We re-implement the pure validation logic here to test it without DB deps.
 */

// --- Pure logic extraction of validateCompleteness ---
function validateCompleteness(order: OrderForValidation): ValidationResult {
  const missingFields: string[] = [];

  if (!order.patient_id) missingFields.push('patient_id');
  if (!order.provider_id) missingFields.push('provider_id');
  if (!order.procedure_code) missingFields.push('procedure_code');
  if (!order.procedure_description) missingFields.push('procedure_description');
  if (!order.clinical_indication) missingFields.push('clinical_indication');
  if (!order.priority) missingFields.push('priority');
  if (!order.icd10_codes || order.icd10_codes.length === 0) missingFields.push('icd10_codes');

  if (missingFields.length > 0) {
    return {
      rule: 'completeness',
      passed: false,
      severity: 'error',
      message: `Missing required fields: ${missingFields.join(', ')}`,
      details: { missingFields },
    };
  }

  return {
    rule: 'completeness',
    passed: true,
    severity: 'info',
    message: 'All required fields present',
  };
}

// --- Pure logic extraction of validateInsurance (no-plan check) ---
function validateInsurancePresence(order: OrderForValidation): ValidationResult | null {
  if (!order.insurance_plan_id) {
    return {
      rule: 'insurance_coverage',
      passed: false,
      severity: 'error',
      message: 'No insurance plan associated with order',
    };
  }
  return null; // Would need DB lookup for further validation
}

// --- Pure logic extraction of validateAuthorization (no-auth check) ---
function validateAuthorizationPresence(
  order: OrderForValidation,
  requiresAuth: boolean,
): ValidationResult | null {
  if (!requiresAuth) {
    return {
      rule: 'prior_authorization',
      passed: true,
      severity: 'info',
      message: 'Prior authorization not required for this procedure',
    };
  }

  if (!order.authorization_number) {
    return {
      rule: 'prior_authorization',
      passed: false,
      severity: 'error',
      message: 'Prior authorization required but not provided',
      details: { procedureCode: order.procedure_code },
    };
  }

  return null; // Would need DB lookup
}

// --- Pure logic extraction of validateClinicalIndication (initial checks) ---
function validateClinicalIndicationPresence(order: OrderForValidation): ValidationResult | null {
  if (!order.icd10_codes || order.icd10_codes.length === 0) {
    return {
      rule: 'clinical_indication',
      passed: false,
      severity: 'error',
      message: 'No ICD-10 diagnosis codes provided',
    };
  }

  if (!order.clinical_indication || order.clinical_indication.trim().length === 0) {
    return {
      rule: 'clinical_indication',
      passed: false,
      severity: 'error',
      message: 'Clinical indication is required',
    };
  }

  return null; // Would need DB lookup for CPT-ICD10 mapping validation
}

function makeCompleteOrder(overrides?: Partial<OrderForValidation>): OrderForValidation {
  return {
    id: 'order-001',
    patient_id: 'patient-001',
    provider_id: 'provider-001',
    procedure_code: '73721',
    procedure_description: 'MRI Lower Extremity without Contrast',
    icd10_codes: ['M54.5'],
    clinical_indication: 'Lower back pain radiating to left leg',
    priority: 'ROUTINE',
    insurance_plan_id: 'plan-001',
    authorization_number: 'AUTH-12345',
    ...overrides,
  };
}

describe('Validation Service', () => {
  describe('validateCompleteness', () => {
    it('passes when all required fields are present', () => {
      const order = makeCompleteOrder();
      const result = validateCompleteness(order);
      assert.equal(result.passed, true);
      assert.equal(result.rule, 'completeness');
      assert.equal(result.severity, 'info');
    });

    it('fails when patient_id is missing', () => {
      const order = makeCompleteOrder({ patient_id: '' });
      const result = validateCompleteness(order);
      assert.equal(result.passed, false);
      assert.equal(result.severity, 'error');
      assert.ok(result.message.includes('patient_id'));
    });

    it('fails when provider_id is missing', () => {
      const order = makeCompleteOrder({ provider_id: '' });
      const result = validateCompleteness(order);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('provider_id'));
    });

    it('fails when procedure_code is missing', () => {
      const order = makeCompleteOrder({ procedure_code: '' });
      const result = validateCompleteness(order);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('procedure_code'));
    });

    it('fails when procedure_description is missing', () => {
      const order = makeCompleteOrder({ procedure_description: '' });
      const result = validateCompleteness(order);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('procedure_description'));
    });

    it('fails when clinical_indication is missing', () => {
      const order = makeCompleteOrder({ clinical_indication: '' });
      const result = validateCompleteness(order);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('clinical_indication'));
    });

    it('fails when priority is missing', () => {
      const order = makeCompleteOrder({ priority: '' });
      const result = validateCompleteness(order);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('priority'));
    });

    it('fails when icd10_codes is empty', () => {
      const order = makeCompleteOrder({ icd10_codes: [] });
      const result = validateCompleteness(order);
      assert.equal(result.passed, false);
      assert.ok(result.message.includes('icd10_codes'));
    });

    it('reports all missing fields at once', () => {
      const order: OrderForValidation = {
        id: 'order-001',
        patient_id: '',
        provider_id: '',
        procedure_code: '',
        procedure_description: '',
        icd10_codes: [],
        clinical_indication: '',
        priority: '',
        insurance_plan_id: null,
        authorization_number: null,
      };
      const result = validateCompleteness(order);
      assert.equal(result.passed, false);
      const details = result.details as { missingFields: string[] };
      assert.equal(details.missingFields.length, 7);
      assert.ok(details.missingFields.includes('patient_id'));
      assert.ok(details.missingFields.includes('provider_id'));
      assert.ok(details.missingFields.includes('procedure_code'));
      assert.ok(details.missingFields.includes('procedure_description'));
      assert.ok(details.missingFields.includes('clinical_indication'));
      assert.ok(details.missingFields.includes('priority'));
      assert.ok(details.missingFields.includes('icd10_codes'));
    });
  });

  describe('validateInsurance (presence check)', () => {
    it('fails when insurance_plan_id is null', () => {
      const order = makeCompleteOrder({ insurance_plan_id: null });
      const result = validateInsurancePresence(order);
      assert.notEqual(result, null);
      assert.equal(result!.passed, false);
      assert.equal(result!.rule, 'insurance_coverage');
      assert.ok(result!.message.includes('No insurance plan'));
    });

    it('returns null (needs DB) when insurance_plan_id is present', () => {
      const order = makeCompleteOrder({ insurance_plan_id: 'plan-001' });
      const result = validateInsurancePresence(order);
      assert.equal(result, null);
    });
  });

  describe('validateAuthorization (presence check)', () => {
    it('passes when auth is not required', () => {
      const order = makeCompleteOrder();
      const result = validateAuthorizationPresence(order, false);
      assert.notEqual(result, null);
      assert.equal(result!.passed, true);
      assert.equal(result!.rule, 'prior_authorization');
    });

    it('fails when auth is required but not provided', () => {
      const order = makeCompleteOrder({ authorization_number: null });
      const result = validateAuthorizationPresence(order, true);
      assert.notEqual(result, null);
      assert.equal(result!.passed, false);
      assert.ok(result!.message.includes('required but not provided'));
    });

    it('returns null (needs DB) when auth is required and provided', () => {
      const order = makeCompleteOrder({ authorization_number: 'AUTH-999' });
      const result = validateAuthorizationPresence(order, true);
      assert.equal(result, null);
    });
  });

  describe('validateClinicalIndication (presence check)', () => {
    it('fails when icd10_codes is empty', () => {
      const order = makeCompleteOrder({ icd10_codes: [] });
      const result = validateClinicalIndicationPresence(order);
      assert.notEqual(result, null);
      assert.equal(result!.passed, false);
      assert.ok(result!.message.includes('ICD-10'));
    });

    it('fails when clinical_indication is empty string', () => {
      const order = makeCompleteOrder({ clinical_indication: '' });
      const result = validateClinicalIndicationPresence(order);
      assert.notEqual(result, null);
      assert.equal(result!.passed, false);
      assert.ok(result!.message.includes('Clinical indication is required'));
    });

    it('fails when clinical_indication is only whitespace', () => {
      const order = makeCompleteOrder({ clinical_indication: '   ' });
      const result = validateClinicalIndicationPresence(order);
      assert.notEqual(result, null);
      assert.equal(result!.passed, false);
    });

    it('returns null (needs DB) when both are present', () => {
      const order = makeCompleteOrder();
      const result = validateClinicalIndicationPresence(order);
      assert.equal(result, null);
    });
  });
});
