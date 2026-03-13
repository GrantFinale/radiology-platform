import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { OrderStatus, isValidTransition, getAllowedTransitions } from '../utils/state-machine';
import { AppError, NotFoundError, ConflictError } from '../middleware/error-handler';

export interface CreateOrderInput {
  patientId: string;
  providerId: string;
  procedureCode: string;
  procedureDescription: string;
  icd10Codes: string[];
  clinicalIndication: string;
  priority: 'STAT' | 'URGENT' | 'ROUTINE';
  source: string;
  sourceReferenceId?: string;
  insurancePlanId?: string;
  authorizationNumber?: string;
  notes?: string;
  documentId?: string;
}

export interface OrderFilters {
  status?: OrderStatus;
  patientId?: string;
  providerId?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  priority?: string;
  page?: number;
  limit?: number;
}

export interface OrderRecord {
  id: string;
  patient_id: string;
  provider_id: string;
  procedure_code: string;
  procedure_description: string;
  icd10_codes: string[];
  clinical_indication: string;
  priority: string;
  status: OrderStatus;
  source: string;
  source_reference_id: string | null;
  insurance_plan_id: string | null;
  authorization_number: string | null;
  notes: string | null;
  document_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function createOrder(input: CreateOrderInput): Promise<OrderRecord> {
  const id = uuidv4();
  const now = new Date();

  const result = await pool.query<OrderRecord>(
    `INSERT INTO orders (
      id, patient_id, provider_id, procedure_code, procedure_description,
      icd10_codes, clinical_indication, priority, status, source,
      source_reference_id, insurance_plan_id, authorization_number, notes,
      document_id, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
    RETURNING *`,
    [
      id,
      input.patientId,
      input.providerId,
      input.procedureCode,
      input.procedureDescription,
      input.icd10Codes,
      input.clinicalIndication,
      input.priority,
      input.documentId ? OrderStatus.DOCUMENT_PROCESSING : OrderStatus.RECEIVED,
      input.source,
      input.sourceReferenceId ?? null,
      input.insurancePlanId ?? null,
      input.authorizationNumber ?? null,
      input.notes ?? null,
      input.documentId ?? null,
      now,
      now,
    ],
  );

  const order = result.rows[0];

  await recordStatusHistory(id, null, order.status, 'Order created');

  logger.info('Order created', { orderId: id, source: input.source, status: order.status });

  return order;
}

export async function transitionOrder(
  id: string,
  newStatus: OrderStatus,
  reason: string,
): Promise<OrderRecord> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query<OrderRecord>(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [id],
    );

    if (current.rows.length === 0) {
      throw new NotFoundError('Order', id);
    }

    const order = current.rows[0];
    const currentStatus = order.status as OrderStatus;

    if (!isValidTransition(currentStatus, newStatus)) {
      const allowed = getAllowedTransitions(currentStatus);
      throw new ConflictError(
        `Cannot transition order from '${currentStatus}' to '${newStatus}'. ` +
          `Allowed transitions: ${allowed.join(', ') || 'none (terminal state)'}`,
      );
    }

    const updated = await client.query<OrderRecord>(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newStatus, id],
    );

    await client.query(
      `INSERT INTO order_status_history (id, order_id, from_status, to_status, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), id, currentStatus, newStatus, reason],
    );

    await client.query('COMMIT');

    logger.info('Order transitioned', {
      orderId: id,
      from: currentStatus,
      to: newStatus,
      reason,
    });

    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function validateStateTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
): { valid: boolean; allowedTransitions: OrderStatus[] } {
  return {
    valid: isValidTransition(currentStatus, newStatus),
    allowedTransitions: getAllowedTransitions(currentStatus),
  };
}

export async function getOrderWithDetails(id: string): Promise<Record<string, unknown>> {
  const orderResult = await pool.query<OrderRecord>(
    'SELECT * FROM orders WHERE id = $1',
    [id],
  );

  if (orderResult.rows.length === 0) {
    throw new NotFoundError('Order', id);
  }

  const order = orderResult.rows[0];

  const [patientResult, providerResult, documentsResult, reviewsResult] = await Promise.all([
    pool.query('SELECT * FROM patients WHERE id = $1', [order.patient_id]),
    pool.query('SELECT * FROM providers WHERE id = $1', [order.provider_id]),
    pool.query('SELECT * FROM documents WHERE order_id = $1 ORDER BY created_at DESC', [id]),
    pool.query('SELECT * FROM review_tasks WHERE order_id = $1 ORDER BY created_at DESC', [id]),
  ]);

  return {
    ...order,
    patient: patientResult.rows[0] ?? null,
    provider: providerResult.rows[0] ?? null,
    documents: documentsResult.rows,
    reviews: reviewsResult.rows,
  };
}

export async function searchOrders(
  filters: OrderFilters,
): Promise<{ orders: OrderRecord[]; total: number; page: number; limit: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }
  if (filters.patientId) {
    conditions.push(`patient_id = $${paramIndex++}`);
    params.push(filters.patientId);
  }
  if (filters.providerId) {
    conditions.push(`provider_id = $${paramIndex++}`);
    params.push(filters.providerId);
  }
  if (filters.source) {
    conditions.push(`source = $${paramIndex++}`);
    params.push(filters.source);
  }
  if (filters.priority) {
    conditions.push(`priority = $${paramIndex++}`);
    params.push(filters.priority);
  }
  if (filters.dateFrom) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.dateTo);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 25, 100);
  const offset = (page - 1) * limit;

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM orders ${whereClause}`,
    params,
  );

  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await pool.query<OrderRecord>(
    `SELECT * FROM orders ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset],
  );

  return {
    orders: dataResult.rows,
    total,
    page,
    limit,
  };
}

export async function updateOrder(
  id: string,
  updates: Partial<Pick<CreateOrderInput, 'procedureCode' | 'procedureDescription' | 'icd10Codes' | 'clinicalIndication' | 'priority' | 'insurancePlanId' | 'authorizationNumber' | 'notes'>>,
): Promise<OrderRecord> {
  const existing = await pool.query<OrderRecord>('SELECT * FROM orders WHERE id = $1', [id]);
  if (existing.rows.length === 0) {
    throw new NotFoundError('Order', id);
  }

  const fields: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  const fieldMap: Record<string, string> = {
    procedureCode: 'procedure_code',
    procedureDescription: 'procedure_description',
    icd10Codes: 'icd10_codes',
    clinicalIndication: 'clinical_indication',
    priority: 'priority',
    insurancePlanId: 'insurance_plan_id',
    authorizationNumber: 'authorization_number',
    notes: 'notes',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    const value = (updates as Record<string, unknown>)[key];
    if (value !== undefined) {
      fields.push(`${column} = $${paramIndex++}`);
      params.push(value);
    }
  }

  if (fields.length === 0) {
    throw new AppError(400, 'No valid fields to update');
  }

  fields.push(`updated_at = NOW()`);
  params.push(id);

  const result = await pool.query<OrderRecord>(
    `UPDATE orders SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params,
  );

  return result.rows[0];
}

export async function getOrderHistory(
  id: string,
): Promise<Array<{ id: string; from_status: string | null; to_status: string; reason: string; created_at: string }>> {
  const orderCheck = await pool.query('SELECT id FROM orders WHERE id = $1', [id]);
  if (orderCheck.rows.length === 0) {
    throw new NotFoundError('Order', id);
  }

  const result = await pool.query(
    'SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC',
    [id],
  );

  return result.rows;
}

export async function getOrderStats(): Promise<Record<string, unknown>> {
  const [statusCounts, priorityCounts, sourceCounts, recentCount] = await Promise.all([
    pool.query('SELECT status, COUNT(*) as count FROM orders GROUP BY status'),
    pool.query('SELECT priority, COUNT(*) as count FROM orders GROUP BY priority'),
    pool.query('SELECT source, COUNT(*) as count FROM orders GROUP BY source'),
    pool.query("SELECT COUNT(*) as count FROM orders WHERE created_at >= NOW() - INTERVAL '24 hours'"),
  ]);

  return {
    byStatus: Object.fromEntries(statusCounts.rows.map((r: Record<string, unknown>) => [r.status, parseInt(r.count as string, 10)])),
    byPriority: Object.fromEntries(priorityCounts.rows.map((r: Record<string, unknown>) => [r.priority, parseInt(r.count as string, 10)])),
    bySource: Object.fromEntries(sourceCounts.rows.map((r: Record<string, unknown>) => [r.source, parseInt(r.count as string, 10)])),
    last24Hours: parseInt(recentCount.rows[0].count as string, 10),
    total: statusCounts.rows.reduce((sum: number, r: Record<string, unknown>) => sum + parseInt(r.count as string, 10), 0),
  };
}

async function recordStatusHistory(
  orderId: string,
  fromStatus: OrderStatus | null,
  toStatus: OrderStatus,
  reason: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO order_status_history (id, order_id, from_status, to_status, reason, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [uuidv4(), orderId, fromStatus, toStatus, reason],
  );
}
