import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { JwtPayload } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rate-limit';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// Demo users for development — replace with real user store in production
const DEMO_USERS: Record<string, { password: string; userId: string; role: string; name: string }> = {
  admin: { password: 'admin123', userId: uuidv4(), role: 'admin', name: 'System Admin' },
  reviewer: { password: 'reviewer123', userId: uuidv4(), role: 'reviewer', name: 'Dr. Sarah Chen' },
  technician: { password: 'tech123', userId: uuidv4(), role: 'technician', name: 'Mike Johnson' },
};

// In-memory refresh token store — replace with Redis or DB in production
const refreshTokens = new Map<string, { userId: string; username: string; role: string }>();

function generateTokens(payload: Omit<JwtPayload, 'iat' | 'exp'>) {
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as string | number,
  } as jwt.SignOptions);

  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn as string | number,
  } as jwt.SignOptions);

  refreshTokens.set(refreshToken, {
    userId: payload.userId,
    username: payload.username,
    role: payload.role,
  });

  return { accessToken, refreshToken };
}

router.post('/login', authRateLimiter, (req: Request, res: Response): void => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { username, password } = parsed.data;
  const user = DEMO_USERS[username];

  if (!user || user.password !== password) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const tokens = generateTokens({
    userId: user.userId,
    username,
    role: user.role,
  });

  res.json({
    ...tokens,
    user: {
      userId: user.userId,
      username,
      role: user.role,
      name: user.name,
    },
  });
});

router.post('/refresh', (req: Request, res: Response): void => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token is required' });
    return;
  }

  try {
    jwt.verify(refreshToken, config.jwt.secret);
  } catch {
    refreshTokens.delete(refreshToken);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  const stored = refreshTokens.get(refreshToken);
  if (!stored) {
    res.status(401).json({ error: 'Refresh token not recognized' });
    return;
  }

  // Rotate: remove old, issue new
  refreshTokens.delete(refreshToken);

  const tokens = generateTokens({
    userId: stored.userId,
    username: stored.username,
    role: stored.role,
  });

  res.json(tokens);
});

router.get('/me', (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = DEMO_USERS[req.user.username];
  res.json({
    userId: req.user.userId,
    username: req.user.username,
    role: req.user.role,
    name: user?.name || req.user.username,
  });
});

export default router;
