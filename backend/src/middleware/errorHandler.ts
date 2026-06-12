import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational: boolean = true
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const catchAsync = (fn: Function) => {
  return (...args: any[]) => fn(...args).catch(args[2]);
};

export const errorHandler = (
  error: any,
  req: any,
  res: Response,
  next: NextFunction
) => {
  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  // Log error
  logger.error({
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
