import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  retryStrategy(times: number) {
    if (times > 3) {
      logger.warn('Redis: max reconnection attempts reached, stopping retries');
      return null; // stop retrying
    }
    return Math.min(times * 500, 3_000);
  },
  lazyConnect: true,
  enableOfflineQueue: false,
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

let redisErrorLogged = false;
redis.on('error', (err) => {
  if (!redisErrorLogged) {
    logger.warn('Redis unavailable, cache disabled', { error: err.message });
    redisErrorLogged = true;
  }
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
