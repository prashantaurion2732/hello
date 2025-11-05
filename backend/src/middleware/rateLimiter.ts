import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config';
import logger from '../utils/logger';

let redisClient: any;

if (config.redis.host) {
  redisClient = createClient({
    socket: {
      host: config.redis.host,
      port: config.redis.port,
    },
    password: config.redis.password,
  });

  redisClient.connect().catch((err: any) => {
    logger.error('Rate limiter Redis connection error', err);
  });
}

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis store if available, otherwise use memory store
  store: redisClient
    ? new RedisStore({
        // @ts-ignore - RedisStore expects redis v3 client, but we use v4
        client: redisClient,
        prefix: 'rl:',
      })
    : undefined,
});

export const strictLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    error: 'Too many requests, please slow down.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient
    ? new RedisStore({
        // @ts-ignore
        client: redisClient,
        prefix: 'sl:',
      })
    : undefined,
});
