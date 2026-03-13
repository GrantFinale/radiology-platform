import { pool } from '../db/pool';
import { logger } from '../utils/logger';

export interface ValidationResult {
  rule: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: Record<string, unknown>;
}

export interface OrderForValidation {
  id: string;
  patient_id: string;
  provider_id: string;
  procedure_code: string;
  procedure_description: string;
  icd10_codes: string[];
  clinical_indication: string;
  priority: string;
  insurance_plan_id: string | null;
  authorization_number: string | null;
}

export async function validateInsurance(order: OrderForValidation): Promise<ValidationResult> {
  if (!order.insurance_plan_id) {
    return {
      rule: 'insurance_coverage',
      passed: false,
      severity: 'error',
      message: 'No insurance plan associated with order',
    };
  }

  const planResult = await pool.query(
    'SELECT * FROM insurance_plans WHERE id = $1 AND active = true',
    [order.insurance_plan_id],
  );

  if (planResult.rows.length === 0) {
    return {
      rule: 'insurance_coverage',
      passed: false,
      severity: 'error',
      message: 'Insurance plan not found or inactive',
      details: { planId: order.insurance_plan_id },
    };
  }

  const plan = planResult.rows[0] as Record<string, unknown>;

  const coverageResult = await pool.query(
    `SELECT * FROM insurance_coverage
     WHERE plan_id = $1 AND procedure_code = $2 AND active = true`,
    [order.insurance_plan_id, order.procedure_code],
  );

  if (coverageResult.rows.length === 0) {
    return {
      rule: 'insurance_coverage',
      passed: false,
      severity: 'error',
      message: `Procedure code '${order.procedure_code}' not covered under plan '${plan.name}'`,
      details: {
        procedureCode: order.procedure_code,
        planName: plan.name,
      },
    };
  }

  return {
    rule: 'insurance_coverage',
    passed: true,
    severity: 'info',
    message: 'Insurance coverage verified',
    details: {
      planName: plan.name,
      procedureCode: order.procedure_code,
    },
  };
}

export async function validateAuthorization(order: OrderForValidation): Promise<ValidationResult> {
  const authRequiredResult = await pool.query(
    `SELECT requires_prior_auth FROM procedure_requirements WHERE procedure_code = $1`,
    [order.procedure_code],
  );

  const requiresAuth = authRequiredResult.rows.length > 0
    && (authRequiredResult.rows[0] as Record<string, unknown>).requires_prior_auth === true;

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

  const authResult = await pool.query(
    `SELECT * FROM authorizations
     WHERE authorization_number = $1 AND status = 'APPROVED' AND expires_at > NOW()`,
    [order.authorization_number],
  );

  if (authResult.rows.length === 0) {
    return {
      rule: 'prior_authorization',
      passed: false,
      severity: 'error',
      message: 'Authorization not found, not approved, or expired',
      details: { authorizationNumber: order.authorization_number },
    };
  }

  return {
    rule: 'prior_authorization',
    passed: true,
    severity: 'info',
    message: 'Prior authorization verified',
    details: { authorizationNumber: order.authorization_number },
  };
}

export async function validateClinicalIndication(order: OrderForValidation): Promise<ValidationResult> {
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

  const mappingResult = await pool.query(
    `SELECT icd10_code FROM cpt_icd10_mappings
     WHERE cpt_code = $1 AND icd10_code = ANY($2)`,
    [order.procedure_code, order.icd10_codes],
  );

  if (mappingResult.rows.length === 0) {
    return {
      rule: 'clinical_indication',
      passed: false,
      severity: 'warning',
      message: `None of the provided ICD-10 codes are mapped to procedure code '${order.procedure_code}'`,
      details: {
        procedureCode: order.procedure_code,
        icd10Codes: order.icd10_codes,
      },
    };
  }

  return {
    rule: 'clinical_indication',
    passed: true,
    severity: 'info',
    message: 'Clinical indication validated against procedure code',
    details: {
      matchedCodes: mappingResult.rows.map((r: Record<string, unknown>) => r.icd10_code),
    },
  };
}

export async function validateCompleteness(order: OrderForValidation): Promise<ValidationResult> {
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

export async function runFullValidation(order: OrderForValidation): Promise<ValidationResult[]> {
  logger.info('Running full validation', { orderId: order.id });

  const results = await Promise.all([
    validateCompleteness(order),
    validateInsurance(order),
    validateAuthorization(order),
    validateClinicalIndication(order),
  ]);

  const failedCount = results.filter((r) => !r.passed).length;
  logger.info('Validation complete', {
    orderId: order.id,
    totalRules: results.length,
    passed: results.length - failedCount,
    failed: failedCount,
  });

  return results;
}
