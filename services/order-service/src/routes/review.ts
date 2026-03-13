import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';
import { NotFoundError, ConflictError } from '../middleware/error-handler';
import { logger } from '../utils/logger';

const router = Router();

const ListReviewsSchema = z.object({
  status: z.enum(['PENDING', 'CLAIMED', 'COMPLETED', 'ESCALATED']).optional(),
  assignedTo: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const CompleteReviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  notes: z.string().min(1).max(5000),
  correctedData: z.record(z.unknown()).optional(),
});

const EscalateReviewSchema = z.object({
  reason: z.string().min(1).max(2000),
  escalateTo: z.string().uuid().optional(),
});

// GET /reviews
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = ListReviewsSchema.parse(req.query);
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 25, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.status) {
      conditions.push(`rt.status = $${paramIndex++}`);
      params.push(filters.status);
    }
    if (filters.assignedTo) {
      conditions.push(`rt.assigned_to = $${paramIndex++}`);
      params.push(filters.assignedTo);
    }
    if (filters.orderId) {
      conditions.push(`rt.order_id = $${paramIndex++}`);
      params.push(filters.orderId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM review_tasks rt ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count as string, 10);

    const dataResult = await pool.query(
      `SELECT rt.*, o.procedure_code, o.procedure_description, o.priority, o.source
       FROM review_tasks rt
       JOIN orders o ON o.id = rt.order_id
       ${whereClause}
       ORDER BY
         CASE o.priority WHEN 'STAT' THEN 0 WHEN 'URGENT' THEN 1 ELSE 2 END,
         rt.created_at ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset],
    );

    res.json({
      data: dataResult.rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /reviews/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      `SELECT rt.*, o.*, p.first_name as patient_first_name, p.last_name as patient_last_name
       FROM review_tasks rt
       JOIN orders o ON o.id = rt.order_id
       LEFT JOIN patients p ON p.id = o.patient_id
       WHERE rt.id = $1`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Review', req.params.id);
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /reviews/:id/claim
router.post('/:id/claim', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as unknown as Record<string, unknown>).userId as string ?? req.get('x-user-id');
    if (!userId) {
      res.status(400).json({
        error: { code: 'MISSING_USER', message: 'User identification required (x-user-id header)' },
      });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query(
        'SELECT * FROM review_tasks WHERE id = $1 FOR UPDATE',
        [req.params.id],
      );

      if (current.rows.length === 0) {
        throw new NotFoundError('Review', req.params.id);
      }

      const review = current.rows[0] as Record<string, unknown>;

      if (review.status !== 'PENDING') {
        throw new ConflictError(
          `Review is currently '${review.status}' and cannot be claimed`,
        );
      }

      const result = await client.query(
        `UPDATE review_tasks
         SET status = 'CLAIMED', assigned_to = $1, claimed_at = NOW(), updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [userId, req.params.id],
      );

      await client.query('COMMIT');

      logger.info('Review claimed', { reviewId: req.params.id, userId });

      res.json({ data: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// POST /reviews/:id/complete
router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CompleteReviewSchema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query(
        'SELECT * FROM review_tasks WHERE id = $1 FOR UPDATE',
        [req.params.id],
      );

      if (current.rows.length === 0) {
        throw new NotFoundError('Review', req.params.id);
      }

      const review = current.rows[0] as Record<string, unknown>;

      if (review.status !== 'CLAIMED') {
        throw new ConflictError(
          `Review must be in 'CLAIMED' status to complete (current: '${review.status}')`,
        );
      }

      const result = await client.query(
        `UPDATE review_tasks
         SET status = 'COMPLETED', decision = $1, notes = $2, corrected_data = $3,
             completed_at = NOW(), updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [body.decision, body.notes, body.correctedData ? JSON.stringify(body.correctedData) : null, req.params.id],
      );

      // Transition the order based on decision
      const orderId = review.order_id as string;
      if (body.decision === 'APPROVE') {
        await client.query(
          `UPDATE orders SET status = 'NORMALIZED', updated_at = NOW() WHERE id = $1`,
          [orderId],
        );
        await client.query(
          `INSERT INTO order_status_history (id, order_id, from_status, to_status, reason, created_at)
           VALUES ($1, $2, 'REVIEW_REQUIRED', 'NORMALIZED', $3, NOW())`,
          [uuidv4(), orderId, `Review approved: ${body.notes}`],
        );
      } else {
        await client.query(
          `UPDATE orders SET status = 'REJECTED', updated_at = NOW() WHERE id = $1`,
          [orderId],
        );
        await client.query(
          `INSERT INTO order_status_history (id, order_id, from_status, to_status, reason, created_at)
           VALUES ($1, $2, 'REVIEW_REQUIRED', 'REJECTED', $3, NOW())`,
          [uuidv4(), orderId, `Review rejected: ${body.notes}`],
        );
      }

      await client.query('COMMIT');

      logger.info('Review completed', {
        reviewId: req.params.id,
        decision: body.decision,
        orderId,
      });

      res.json({ data: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

// POST /reviews/:id/escalate
router.post('/:id/escalate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = EscalateReviewSchema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const current = await client.query(
        'SELECT * FROM review_tasks WHERE id = $1 FOR UPDATE',
        [req.params.id],
      );

      if (current.rows.length === 0) {
        throw new NotFoundError('Review', req.params.id);
      }

      const review = current.rows[0] as Record<string, unknown>;

      if (review.status !== 'PENDING' && review.status !== 'CLAIMED') {
        throw new ConflictError(
          `Review must be in 'PENDING' or 'CLAIMED' status to escalate (current: '${review.status}')`,
        );
      }

      const result = await client.query(
        `UPDATE review_tasks
         SET status = 'ESCALATED', escalation_reason = $1, escalated_to = $2,
             escalated_at = NOW(), updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [body.reason, body.escalateTo ?? null, req.params.id],
      );

      await client.query('COMMIT');

      logger.info('Review escalated', {
        reviewId: req.params.id,
        reason: body.reason,
        orderId: review.order_id,
      });

      res.json({ data: result.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

export default router;
