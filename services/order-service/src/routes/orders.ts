import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OrderStatus } from '../utils/state-machine';
import * as orderService from '../services/order-service';
import { runFullValidation } from '../services/validation-service';
import { checkSchedulingReadiness } from '../services/scheduling-service';

const router = Router();

const CreateOrderSchema = z.object({
  patientId: z.string().uuid(),
  providerId: z.string().uuid(),
  procedureCode: z.string().min(1).max(20),
  procedureDescription: z.string().min(1).max(500),
  icd10Codes: z.array(z.string().min(1).max(10)).min(1),
  clinicalIndication: z.string().min(1).max(2000),
  priority: z.enum(['STAT', 'URGENT', 'ROUTINE']),
  source: z.string().min(1).max(100),
  sourceReferenceId: z.string().max(255).optional(),
  insurancePlanId: z.string().uuid().optional(),
  authorizationNumber: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
  documentId: z.string().uuid().optional(),
});

const UpdateOrderSchema = z.object({
  procedureCode: z.string().min(1).max(20).optional(),
  procedureDescription: z.string().min(1).max(500).optional(),
  icd10Codes: z.array(z.string().min(1).max(10)).min(1).optional(),
  clinicalIndication: z.string().min(1).max(2000).optional(),
  priority: z.enum(['STAT', 'URGENT', 'ROUTINE']).optional(),
  insurancePlanId: z.string().uuid().optional(),
  authorizationNumber: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
});

const TransitionSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  reason: z.string().min(1).max(1000),
});

const ListOrdersSchema = z.object({
  status: z.string().optional(),
  patientId: z.string().uuid().optional(),
  providerId: z.string().uuid().optional(),
  source: z.string().optional(),
  priority: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// GET /orders/stats — must be before /:id
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await orderService.getOrderStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// POST /orders
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = CreateOrderSchema.parse(req.body);
    const order = await orderService.createOrder(data);
    res.status(201).json({ data: order });
  } catch (err) {
    next(err);
  }
});

// GET /orders
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = ListOrdersSchema.parse(req.query);
    const result = await orderService.searchOrders(filters);
    res.json({
      data: result.orders,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    });
  } catch (err) {
    next(err);
  }
});

// GET /orders/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await orderService.getOrderWithDetails(req.params.id);
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

// PATCH /orders/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = UpdateOrderSchema.parse(req.body);
    const order = await orderService.updateOrder(req.params.id, updates);
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/transition
router.post('/:id/transition', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reason } = TransitionSchema.parse(req.body);
    const order = await orderService.transitionOrder(req.params.id, status, reason);
    res.json({ data: order });
  } catch (err) {
    next(err);
  }
});

// GET /orders/:id/history
router.get('/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const history = await orderService.getOrderHistory(req.params.id);
    res.json({ data: history });
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/validate
router.post('/:id/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await orderService.getOrderWithDetails(req.params.id);
    const results = await runFullValidation(order as unknown as Parameters<typeof runFullValidation>[0]);
    res.json({ data: results });
  } catch (err) {
    next(err);
  }
});

// GET /orders/:id/scheduling-readiness
router.get('/:id/scheduling-readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const readiness = await checkSchedulingReadiness(req.params.id);
    res.json({ data: readiness });
  } catch (err) {
    next(err);
  }
});

export default router;
