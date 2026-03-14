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

// Maps backend DB status values to frontend lowercase status values
const STATUS_TO_FRONTEND: Record<string, string> = {
  'RECEIVED': 'received',
  'DOCUMENT_PROCESSING': 'processing',
  'INTERPRETED': 'ocr_complete',
  'NORMALIZED': 'nlp_complete',
  'VALIDATED': 'validated',
  'REVIEW_REQUIRED': 'pending_review',
  'SCHEDULED': 'approved',
  'COMPLETED': 'approved',
  'REJECTED': 'rejected',
  'ERROR': 'error',
};

// Maps frontend lowercase status values back to DB enum values
const STATUS_FROM_FRONTEND: Record<string, string> = {
  'received': 'RECEIVED',
  'processing': 'DOCUMENT_PROCESSING',
  'ocr_complete': 'INTERPRETED',
  'nlp_complete': 'NORMALIZED',
  'validated': 'VALIDATED',
  'pending_review': 'REVIEW_REQUIRED',
  'approved': 'SCHEDULED',
  'rejected': 'REJECTED',
  'error': 'ERROR',
};

// Maps backend DB source values to frontend lowercase source values
const SOURCE_TO_FRONTEND: Record<string, string> = {
  'FAX': 'fax',
  'SCANNED_PDF': 'fax',
  'HANDWRITTEN': 'fax',
  'HL7': 'hl7',
  'FHIR': 'hl7',
  'EMR': 'ehr',
  'EMAIL': 'portal',
  'MANUAL': 'portal',
};

// Maps frontend lowercase source values back to DB enum values
const SOURCE_FROM_FRONTEND: Record<string, string> = {
  'fax': 'FAX',
  'hl7': 'HL7',
  'portal': 'MANUAL',
  'ehr': 'EMR',
};

export interface FrontendOrder {
  id: string;
  patientName: string;
  patientMrn: string;
  dateOfBirth: string;
  provider: string;
  orderDate: string;
  examType: string;
  source: string;
  status: string;
  priority: string;
  confidenceScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchOrdersFilters extends OrderFilters {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function searchOrders(
  filters: SearchOrdersFilters,
): Promise<{ orders: FrontendOrder[]; total: number; page: number; limit: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.status) {
    // Convert frontend lowercase status to DB enum value
    const dbStatus = STATUS_FROM_FRONTEND[filters.status as string] ?? (filters.status as string);
    conditions.push(`o.status = $${paramIndex++}`);
    params.push(dbStatus);
  }
  if (filters.patientId) {
    conditions.push(`o.patient_id = $${paramIndex++}`);
    params.push(filters.patientId);
  }
  if (filters.providerId) {
    conditions.push(`o.ordering_provider_id = $${paramIndex++}`);
    params.push(filters.providerId);
  }
  if (filters.source) {
    // Convert frontend lowercase source to DB enum value
    const dbSource = SOURCE_FROM_FRONTEND[filters.source as string] ?? (filters.source as string);
    conditions.push(`o.source = $${paramIndex++}`);
    params.push(dbSource);
  }
  if (filters.priority) {
    conditions.push(`o.priority = $${paramIndex++}`);
    params.push((filters.priority as string).toUpperCase());
  }
  if (filters.dateFrom) {
    conditions.push(`o.created_at >= $${paramIndex++}`);
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push(`o.created_at <= $${paramIndex++}`);
    params.push(filters.dateTo);
  }
  if (filters.search) {
    conditions.push(`(
      p.first_name ILIKE $${paramIndex} OR
      p.last_name ILIKE $${paramIndex} OR
      p.mrn ILIKE $${paramIndex} OR
      o.cpt_description ILIKE $${paramIndex} OR
      CONCAT(p.first_name, ' ', p.last_name) ILIKE $${paramIndex} OR
      CONCAT(prov.first_name, ' ', prov.last_name) ILIKE $${paramIndex}
    )`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 25, 100);
  const offset = (page - 1) * limit;

  // Map frontend sortBy field names to DB columns
  const sortByMap: Record<string, string> = {
    patientName: 'p.last_name',
    orderDate: 'o.created_at',
    examType: 'o.cpt_description',
    status: 'o.status',
    priority: 'o.priority',
    source: 'o.source',
    provider: 'prov.last_name',
    createdAt: 'o.created_at',
    updatedAt: 'o.updated_at',
    confidenceScore: 'o.confidence_score',
  };
  const sortColumn = (filters.sortBy && sortByMap[filters.sortBy]) || 'o.created_at';
  const sortDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const fromClause = `
    FROM orders o
    JOIN patients p ON o.patient_id = p.id
    JOIN providers prov ON o.ordering_provider_id = prov.id
  `;

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) as count ${fromClause} ${whereClause}`,
    params,
  );

  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await pool.query(
    `SELECT
      o.id,
      CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
      p.mrn AS patient_mrn,
      p.date_of_birth,
      CONCAT(prov.first_name, ' ', prov.last_name) AS provider_name,
      o.created_at AS order_date,
      COALESCE(o.cpt_description, o.cpt_code) AS exam_type,
      o.source,
      o.status,
      o.priority,
      o.confidence_score,
      o.created_at,
      o.updated_at
    ${fromClause}
    ${whereClause}
    ORDER BY ${sortColumn} ${sortDirection}
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset],
  );

  const orders: FrontendOrder[] = dataResult.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    patientName: row.patient_name as string,
    patientMrn: row.patient_mrn as string,
    dateOfBirth: row.date_of_birth as string,
    provider: row.provider_name as string,
    orderDate: row.order_date as string,
    examType: row.exam_type as string,
    source: SOURCE_TO_FRONTEND[row.source as string] ?? (row.source as string).toLowerCase(),
    status: STATUS_TO_FRONTEND[row.status as string] ?? (row.status as string).toLowerCase(),
    priority: (row.priority as string).toLowerCase(),
    confidenceScore: row.confidence_score as number | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));

  return {
    orders,
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
  const [statusCounts, sourceCounts] = await Promise.all([
    pool.query('SELECT status, COUNT(*) as count FROM orders GROUP BY status'),
    pool.query('SELECT source, COUNT(*) as count FROM orders GROUP BY source'),
  ]);

  const statusMap = new Map<string, number>();
  for (const r of statusCounts.rows) {
    statusMap.set((r.status as string).toLowerCase(), parseInt(r.count as string, 10));
  }

  const total = [...statusMap.values()].reduce((sum, c) => sum + c, 0);
  const pendingReview = (statusMap.get('review_required') ?? 0) + (statusMap.get('pending_review') ?? 0);
  const validated = statusMap.get('validated') ?? 0;
  const errors = statusMap.get('error') ?? 0;

  const byStatus = [...statusMap.entries()].map(([status, count]) => ({ status, count }));
  const bySource = sourceCounts.rows.map((r: Record<string, unknown>) => ({
    source: (r.source as string).toLowerCase(),
    count: parseInt(r.count as string, 10),
  }));

  return { total, pendingReview, validated, errors, bySource, byStatus };
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
