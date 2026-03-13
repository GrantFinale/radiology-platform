import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5_000);
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (err) {
    logger.warn('Redis connection failed, continuing without cache', {
      error: (err as Error).message,
    });
  }
}

export async function shutdownRedis(): Promise<void> {
  logger.info('Closing Redis connection');
  await redis.quit();
}
