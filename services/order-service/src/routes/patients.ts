import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';
import { NotFoundError } from '../middleware/error-handler';

const router = Router();

const CreatePatientSchema = z.object({
  mrn: z.string().min(1).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  gender: z.enum(['M', 'F', 'O', 'U']),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(255).optional(),
  address: z.string().max(500).optional(),
  insurancePlanId: z.string().uuid().optional(),
  insuranceMemberId: z.string().max(100).optional(),
});

const UpdatePatientSchema = CreatePatientSchema.partial();

const ListPatientsSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// POST /patients
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreatePatientSchema.parse(req.body);
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO patients (
        id, mrn, first_name, last_name, date_of_birth, gender,
        phone, email, address, insurance_plan_id, insurance_member_id,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
      RETURNING *`,
      [
        id,
        data.mrn,
        data.firstName,
        data.lastName,
        data.dateOfBirth,
        data.gender,
        data.phone ?? null,
        data.email ?? null,
        data.address ?? null,
        data.insurancePlanId ?? null,
        data.insuranceMemberId ?? null,
      ],
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /patients
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = ListPatientsSchema.parse(req.query);
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 25, 100);
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.search) {
      whereClause = `WHERE first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR mrn ILIKE $${paramIndex}`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM patients ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count as string, 10);

    const dataResult = await pool.query(
      `SELECT * FROM patients ${whereClause} ORDER BY last_name, first_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
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

// GET /patients/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      throw new NotFoundError('Patient', req.params.id);
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /patients/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = UpdatePatientSchema.parse(req.body);

    const existing = await pool.query('SELECT id FROM patients WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      throw new NotFoundError('Patient', req.params.id);
    }

    const fieldMap: Record<string, string> = {
      mrn: 'mrn',
      firstName: 'first_name',
      lastName: 'last_name',
      dateOfBirth: 'date_of_birth',
      gender: 'gender',
      phone: 'phone',
      email: 'email',
      address: 'address',
      insurancePlanId: 'insurance_plan_id',
      insuranceMemberId: 'insurance_member_id',
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
      const current = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
      res.json({ data: current.rows[0] });
      return;
    }

    fields.push('updated_at = NOW()');
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE patients SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params,
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /patients/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query('DELETE FROM patients WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      throw new NotFoundError('Patient', req.params.id);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
