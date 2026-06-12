"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.catchAsync = exports.AppError = void 0;
const logger_1 = require("../utils/logger");
class AppError extends Error {
    statusCode;
    message;
    isOperational;
    constructor(statusCode, message, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const catchAsync = (fn) => {
    return (...args) => fn(...args).catch(args[2]);
};
exports.catchAsync = catchAsync;
const errorHandler = (error, req, res, next) => {
    error.statusCode = error.statusCode || 500;
    error.status = error.status || 'error';
    // Log error
    logger_1.logger.error({
        statusCode: error.statusCode,
        message: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
    });
    // Operational errors
    if (error.isOperational) {
        return res.status(error.statusCode).json({
            status: error.status,
            message: error.message,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
    // Programming or unknown errors
    res.status(500).json({
        status: 'error',
        message: 'Something went very wrong!',
        ...(process.env.NODE_ENV === 'development' && { error })
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map