import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';
import { NotFoundError } from '../middleware/error-handler';

const router = Router();

const CreateProviderSchema = z.object({
  npi: z.string().regex(/^\d{10}$/, 'NPI must be a 10-digit number'),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  specialty: z.string().min(1).max(200),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional(),
  facilityName: z.string().max(300).optional(),
  facilityAddress: z.string().max(500).optional(),
  active: z.boolean().optional().default(true),
});

const UpdateProviderSchema = CreateProviderSchema.partial();

const ListProvidersSchema = z.object({
  search: z.string().optional(),
  specialty: z.string().optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// POST /providers
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateProviderSchema.parse(req.body);
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO providers (
        id, npi, first_name, last_name, specialty,
        phone, email, facility_name, facility_address, active,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
      RETURNING *`,
      [
        id,
        data.npi,
        data.firstName,
        data.lastName,
        data.specialty,
        data.phone ?? null,
        data.email ?? null,
        data.facilityName ?? null,
        data.facilityAddress ?? null,
        data.active,
      ],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /providers
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = ListProvidersSchema.parse(req.query);
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 25, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.search) {
      conditions.push(
        `(first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR npi ILIKE $${paramIndex})`,
      );
      params.push(`%${filters.search}%`);
      paramIndex++;
    }
    if (filters.specialty) {
      conditions.push(`specialty = $${paramIndex++}`);
      params.push(filters.specialty);
    }
    if (filters.active !== undefined) {
      conditions.push(`active = $${paramIndex++}`);
      params.push(filters.active);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM providers ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count as string, 10);

    const dataResult = await pool.query(
      `SELECT * FROM providers ${whereClause} ORDER BY last_name, first_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
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

// GET /providers/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query('SELECT * FROM providers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      throw new NotFoundError('Provider', req.params.id);
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /providers/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = UpdateProviderSchema.parse(req.body);

    const existing = await pool.query('SELECT id FROM providers WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      throw new NotFoundError('Provider', req.params.id);
    }

    const fieldMap: Record<string, string> = {
      npi: 'npi',
      firstName: 'first_name',
      lastName: 'last_name',
      specialty: 'specialty',
      phone: 'phone',
      email: 'email',
      facilityName: 'facility_name',
      facilityAddress: 'facility_address',
      active: 'active',
    };

    const fields: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    for (const [key, column] of Object.entries(fieldMap)) {
      const value = (updates as Record<string, unknown>)[key];
      if (value !== undefined) {
        fields.push(`${column} = $${paramIndex++}`);
        params.push(value);
      }
    }

    if (fields.length === 0) {
      const current = await pool.query('SELECT * FROM providers WHERE id = $1', [req.params.id]);
      res.json({ data: current.rows[0] });
      return;
    }

    fields.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE providers SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /providers/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(
      'UPDATE providers SET active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id],
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('Provider', req.params.id);
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
