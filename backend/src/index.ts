import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config, isProduction } from './config';
import logger from './utils/logger';
import redisService from './services/redis.service';
import databaseService from './services/database.service';
import matchingService from './services/matching.service';
import { SocketController } from './controllers/socket.controller';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

// Create Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: config.allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, enable in production
}));
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply rate limiting to all routes
if (isProduction) {
  app.use(apiLimiter);
}

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const dbHealth = await databaseService.getSystemHealth();
    const redisHealth = await redisService.getActiveUsersCount(); // Simple check

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: dbHealth.healthy ? 'up' : 'down',
        redis: typeof redisHealth === 'number' ? 'up' : 'down',
      },
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
    });
  }
});

// Stats endpoint
app.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await matchingService.getMatchingStats();
    res.json({
      ...stats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Stats request failed', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// API info endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Omegle Clone API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      stats: '/stats',
      socket: 'ws://your-domain.com',
    },
  });
});

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Socket controller
new SocketController(io);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown...`);

  try {
    // Stop accepting new connections
    httpServer.close(() => {
      logger.info('HTTP server closed');
    });

    // Close Socket.io connections
    io.close(() => {
      logger.info('Socket.io server closed');
    });

    // Cleanup services
    matchingService.cleanup();
    await redisService.disconnect();
    await databaseService.disconnect();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

// Start server
const startServer = async () => {
  try {
    // Connect to services
    logger.info('Connecting to services...');
    await redisService.connect();
    await databaseService.connect();

    // Start cleanup interval
    setInterval(async () => {
      await redisService.cleanup();
    }, 300000); // 5 minutes

    // Start HTTP server
    httpServer.listen(config.port, config.host, () => {
      logger.info(`Server running on ${config.host}:${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`CORS origins: ${config.corsOrigin.join(', ')}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export { app, httpServer, io };
