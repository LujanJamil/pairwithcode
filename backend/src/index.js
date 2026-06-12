"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpServer = exports.io = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const redis_1 = __importDefault(require("redis"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
require("express-async-errors");
const pino_http_1 = __importDefault(require("pino-http"));
const logger_1 = require("./utils/logger");
const environment_1 = require("./config/environment");
const db_1 = require("./config/db");
const routes_1 = require("./routes");
const handlers_1 = require("./socket/handlers");
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
exports.app = app;
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: environment_1.config.cors.origin,
        credentials: true,
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    adapter: undefined // Will be set after Redis connection
});
exports.io = io;
let redisClient = null;
let pubClient = null;
const initializeRedis = async () => {
    try {
        pubClient = redis_1.default.createClient({
            host: environment_1.config.redis.host,
            port: environment_1.config.redis.port,
            password: environment_1.config.redis.password || undefined,
            db: environment_1.config.redis.db
        });
        redisClient = pubClient.duplicate();
        await Promise.all([
            pubClient.connect?.(),
            redisClient.connect?.()
        ]);
        io.adapter((0, redis_adapter_1.createAdapter)(pubClient, redisClient));
        logger_1.logger.info('Redis connected and Socket.io adapter configured');
    }
    catch (error) {
        logger_1.logger.error('Redis connection failed:', error);
        if (environment_1.config.nodeEnv === 'production')
            throw error;
        logger_1.logger.warn('Continuing without Redis (single-server mode)');
    }
};
const startServer = async () => {
    try {
        // Middleware
        app.use((0, helmet_1.default)());
        app.use((0, cors_1.default)());
        app.use(express_1.default.json({ limit: '10mb' }));
        app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
        app.use((0, pino_http_1.default)({ logger: logger_1.logger }));
        // Initialize database
        logger_1.logger.info('Initializing database...');
        await (0, db_1.initializeDatabase)();
        logger_1.logger.info('Database initialized');
        // Initialize Redis
        logger_1.logger.info('Initializing Redis...');
        await initializeRedis();
        // Setup Socket.io handlers
        (0, handlers_1.setupSocketHandlers)(io);
        logger_1.logger.info('Socket.io handlers configured');
        // Setup routes
        (0, routes_1.setupRoutes)(app);
        logger_1.logger.info('Routes configured');
        // Health check endpoint
        app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                nodeEnv: environment_1.config.nodeEnv,
                uptime: process.uptime()
            });
        });
        // 404 handler
        app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                path: req.path,
                method: req.method
            });
        });
        // Error handler (must be last)
        app.use(errorHandler_1.errorHandler);
        // Start server
        httpServer.listen(environment_1.config.port, () => {
            logger_1.logger.info(`Server running on http://localhost:${environment_1.config.port}`);
            logger_1.logger.info(`Socket.io endpoint available at ws://localhost:${environment_1.config.port}`);
            logger_1.logger.info(`Environment: ${environment_1.config.nodeEnv}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
// Graceful shutdown
const gracefulShutdown = async () => {
    logger_1.logger.info('Shutting down gracefully...');
    try {
        if (redisClient) {
            await redisClient.quit?.();
        }
        if (pubClient) {
            await pubClient.quit?.();
        }
        io.close();
        httpServer.close(() => {
            logger_1.logger.info('Server closed');
            process.exit(0);
        });
        // Force exit after 30 seconds
        setTimeout(() => {
            logger_1.logger.error('Forced shutdown after 30 seconds');
            process.exit(1);
        }, 30000);
    }
    catch (error) {
        logger_1.logger.error('Error during shutdown:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
startServer();
//# sourceMappingURL=index.js.map