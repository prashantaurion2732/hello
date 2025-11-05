import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // PostgreSQL
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'omegle_clone',
    user: process.env.POSTGRES_USER || 'omegle_user',
    password: process.env.POSTGRES_PASSWORD || 'password',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Session
  session: {
    timeoutMs: parseInt(process.env.SESSION_TIMEOUT_MS || '1800000', 10), // 30 minutes
    matchingTimeoutMs: parseInt(process.env.MATCHING_TIMEOUT_MS || '60000', 10), // 1 minute
    inactiveTimeoutMs: parseInt(process.env.INACTIVE_TIMEOUT_MS || '300000', 10), // 5 minutes
  },

  // Security
  security: {
    maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '1000', 10),
    maxInterests: parseInt(process.env.MAX_INTERESTS || '10', 10),
    maxInterestLength: parseInt(process.env.MAX_INTEREST_LENGTH || '20', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
  },

  // TURN Server (for WebRTC)
  turn: {
    url: process.env.TURN_SERVER_URL || '',
    username: process.env.TURN_USERNAME || '',
    credential: process.env.TURN_CREDENTIAL || '',
  },

  // STUN Servers (free public servers)
  stunServers: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302',
    'stun:stun.services.mozilla.com:3478',
  ],
};

export const isProduction = config.nodeEnv === 'production';
export const isDevelopment = config.nodeEnv === 'development';
