import { pool } from '../db/pool';
import { logger } from '../utils/logger';

export interface SchedulingReadiness {
  ready: boolean;
  orderId: string;
  blockingIssues: BlockingIssue[];
  checkedAt: string;
}

export interface BlockingIssue {
  category: string;
  severity: 'blocker' | 'warning';
  message: string;
  details?: Record<string, unknown>;
}

export async function checkSchedulingReadiness(orderId: string): Promise<SchedulingReadiness> {
  logger.info('Checking scheduling readiness', { orderId });

  const orderResult = await pool.query(
    'SELECT * FROM orders WHERE id = $1',
    [orderId],
  );

  if (orderResult.rows.length === 0) {
    return {
      ready: false,
      orderId,
      blockingIssues: [
        {
          category: 'order',
          severity: 'blocker',
          message: 'Order not found',
        },
      ],
      checkedAt: new Date().toISOString(),
    };
  }

  const order = orderResult.rows[0] as Record<string, unknown>;
  const issues: BlockingIssue[] = [];

  // Check insurance
  if (!order.insurance_plan_id) {
    issues.push({
      category: 'insurance',
      severity: 'blocker',
      message: 'No insurance plan associated with this order',
    });
  } else {
    const planResult = await pool.query(
      'SELECT * FROM insurance_plans WHERE id = $1 AND active = true',
      [order.insurance_plan_id],
    );
    if (planResult.rows.length === 0) {
      issues.push({
        category: 'insurance',
        severity: 'blocker',
        message: 'Insurance plan is inactive or not found',
        details: { planId: order.insurance_plan_id },
      });
    }
  }

  // Check prior authorization if required
  const authReqResult = await pool.query(
    'SELECT requires_prior_auth FROM procedure_requirements WHERE procedure_code = $1',
    [order.procedure_code],
  );

  if (
    authReqResult.rows.length > 0 &&
    (authReqResult.rows[0] as Record<string, unknown>).requires_prior_auth === true
  ) {
    if (!order.authorization_number) {
      issues.push({
        category: 'authorization',
        severity: 'blocker',
        message: 'Prior authorization required but not provided',
      });
    } else {
      const authResult = await pool.query(
        `SELECT * FROM authorizations
         WHERE authorization_number = $1 AND status = 'APPROVED' AND expires_at > NOW()`,
        [order.authorization_number],
      );
      if (authResult.rows.length === 0) {
        issues.push({
          category: 'authorization',
          severity: 'blocker',
          message: 'Authorization is missing, not approved, or expired',
          details: { authorizationNumber: order.authorization_number },
        });
      }
    }
  }

  // Check clinical indication
  if (!order.clinical_indication || (order.clinical_indication as string).trim().length === 0) {
    issues.push({
      category: 'clinical',
      severity: 'blocker',
      message: 'Clinical indication is required for scheduling',
    });
  }

  const icd10Codes = order.icd10_codes as string[] | null;
  if (!icd10Codes || icd10Codes.length === 0) {
    issues.push({
      category: 'clinical',
      severity: 'blocker',
      message: 'At least one ICD-10 code is required',
    });
  }

  // Check patient demographics completeness
  const patientResult = await pool.query(
    'SELECT * FROM patients WHERE id = $1',
    [order.patient_id],
  );

  if (patientResult.rows.length === 0) {
    issues.push({
      category: 'patient',
      severity: 'blocker',
      message: 'Patient record not found',
    });
  } else {
    const patient = patientResult.rows[0] as Record<string, unknown>;
    const requiredPatientFields = ['first_name', 'last_name', 'date_of_birth', 'phone', 'address'];
    const missingFields = requiredPatientFields.filter((f) => !patient[f]);
    if (missingFields.length > 0) {
      issues.push({
        category: 'patient',
        severity: 'blocker',
        message: `Patient demographics incomplete: missing ${missingFields.join(', ')}`,
        details: { missingFields },
      });
    }
  }

  // Check for conflicting orders
  const conflictResult = await pool.query(
    `SELECT id, procedure_code, status FROM orders
     WHERE patient_id = $1 AND procedure_code = $2 AND id != $3
       AND status NOT IN ('COMPLETED', 'REJECTED', 'ERROR')
       AND created_at >= NOW() - INTERVAL '30 days'`,
    [order.patient_id, order.procedure_code, orderId],
  );

  if (conflictResult.rows.length > 0) {
    issues.push({
      category: 'conflict',
      severity: 'warning',
      message: `Found ${conflictResult.rows.length} potentially conflicting order(s) for the same procedure`,
      details: {
        conflictingOrders: conflictResult.rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          status: r.status,
        })),
      },
    });
  }

  const hasBlockers = issues.some((i) => i.severity === 'blocker');

  logger.info('Scheduling readiness check complete', {
    orderId,
    ready: !hasBlockers,
    blockingIssues: issues.length,
  });

  return {
    ready: !hasBlockers,
    orderId,
    blockingIssues: issues,
    checkedAt: new Date().toISOString(),
  };
}
