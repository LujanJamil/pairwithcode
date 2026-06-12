import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'redis';
import helmet from 'helmet';
import cors from 'cors';
import 'express-async-errors';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger';
import { config } from './config/environment';
import { initializeDatabase, getPool } from './config/db';
import { setupRoutes } from './routes';
import { setupSocketHandlers } from './socket/handlers';
import { errorHandler } from './middleware/errorHandler';

const app: Express = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  adapter: undefined // Will be set after Redis connection
});

let redisClient: any = null;
let pubClient: any = null;

const initializeRedis = async () => {
  try {
    pubClient = Redis.createClient({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db
    } as any) as any;

    redisClient = (pubClient as any).duplicate();

    await Promise.all([
      (pubClient as any).connect?.(),
      (redisClient as any).connect?.()
    ]);

    io.adapter(createAdapter(pubClient, redisClient));
    logger.info('Redis connected and Socket.io adapter configured');
  } catch (error) {
    logger.error('Redis connection failed:', error);
    if (config.nodeEnv === 'production') throw error;
    logger.warn('Continuing without Redis (single-server mode)');
  }
};

const startServer = async () => {
  try {
    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ limit: '10mb', extended: true }));
    app.use(pinoHttp({ logger }));

    // Initialize database
    logger.info('Initializing database...');
    try {
      await initializeDatabase();
      logger.info('Database initialized');
    } catch (dbError) {
      logger.warn('Database init failed, continuing in mock mode', dbError);
    }

    // Initialize Redis
    logger.info('Initializing Redis...');
    try {
      await initializeRedis();
    } catch (redisError) {
      logger.warn('Redis init failed, continuing in single-server mode', redisError);
    }

    // Setup Socket.io handlers
    setupSocketHandlers(io);
    logger.info('Socket.io handlers configured');

    // Setup routes
    try {
      setupRoutes(app, getPool());
      logger.info('Routes configured');
    } catch (routeError) {
      logger.warn('Route setup encountered issues:', routeError);
    }

    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        nodeEnv: config.nodeEnv,
        uptime: process.uptime()
      });
    });

    // 404 handler
    app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
        method: req.method
      });
    });

    // Error handler (must be last)
    app.use(errorHandler);

    // Start server
    httpServer.listen(config.port, () => {
      logger.info(`Server running on http://localhost:${config.port}`);
      logger.info(`Socket.io endpoint available at ws://localhost:${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Shutting down gracefully...');

  try {
    if (redisClient) {
      await (redisClient as any).quit?.();
    }
    if (pubClient) {
      await (pubClient as any).quit?.();
    }
    io.close();
    httpServer.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after 30 seconds');
      process.exit(1);
    }, 30000);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();

export { app, io, httpServer };
