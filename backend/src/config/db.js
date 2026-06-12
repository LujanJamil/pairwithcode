"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transaction = exports.getClient = exports.query = exports.getPool = exports.initializeDatabase = void 0;
const pg_1 = require("pg");
const environment_1 = require("./environment");
const logger_1 = require("../utils/logger");
let pool;
const initializeDatabase = async () => {
    try {
        pool = new pg_1.Pool({
            host: environment_1.config.database.host,
            port: environment_1.config.database.port,
            user: environment_1.config.database.user,
            password: environment_1.config.database.password,
            database: environment_1.config.database.database,
            ssl: environment_1.config.database.ssl ? { rejectUnauthorized: false } : false,
            min: environment_1.config.database.pool.min,
            max: environment_1.config.database.pool.max,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
        });
        pool.on('error', (err) => {
            logger_1.logger.error('Unexpected error on idle client', err);
        });
        // Test connection
        const client = await pool.connect();
        logger_1.logger.info('Database connection established');
        client.release();
        return pool;
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize database:', error);
        throw error;
    }
};
exports.initializeDatabase = initializeDatabase;
const getPool = () => {
    if (!pool) {
        throw new Error('Database pool not initialized');
    }
    return pool;
};
exports.getPool = getPool;
const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await (0, exports.getPool)().query(text, params);
        const duration = Date.now() - start;
        if (duration > 1000) {
            logger_1.logger.warn(`Slow query detected (${duration}ms): ${text}`);
        }
        return result;
    }
    catch (error) {
        logger_1.logger.error('Database query error:', { text, error });
        throw error;
    }
};
exports.query = query;
const getClient = async () => {
    return (0, exports.getPool)().connect();
};
exports.getClient = getClient;
const transaction = async (callback) => {
    const client = await (0, exports.getClient)();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
};
exports.transaction = transaction;
//# sourceMappingURL=db.js.map