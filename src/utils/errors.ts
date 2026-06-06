import { ErrorContext, ErrorRecoveryStrategy } from '../models/types';

export class SocketError extends Error {
  readonly recoveryStrategy: ErrorRecoveryStrategy = 'retry';
  readonly retryable: boolean = true;

  constructor(message: string, strategy: ErrorRecoveryStrategy = 'retry') {
    super(message);
    this.name = 'SocketError';
    this.recoveryStrategy = strategy;
    this.retryable = strategy !== 'ignore' && strategy !== 'notify';
  }
}

export class PersistenceError extends Error {
  readonly recoveryStrategy: ErrorRecoveryStrategy = 'fallback';
  readonly retryable: boolean = true;

  constructor(message: string, strategy: ErrorRecoveryStrategy = 'fallback') {
    super(message);
    this.name = 'PersistenceError';
    this.recoveryStrategy = strategy;
  }
}

export class ConflictError extends Error {
  readonly recoveryStrategy: ErrorRecoveryStrategy = 'notify';
  readonly retryable: boolean = false;
  readonly localVersion: string;
  readonly remoteVersion: string;

  constructor(message: string, localVersion: string, remoteVersion: string) {
    super(message);
    this.name = 'ConflictError';
    this.localVersion = localVersion;
    this.remoteVersion = remoteVersion;
  }
}

export class ConnectionError extends Error {
  readonly recoveryStrategy: ErrorRecoveryStrategy = 'retry';
  readonly retryable: boolean = true;
  readonly attempt: number;
  readonly maxAttempts: number;

  constructor(message: string, attempt: number, maxAttempts: number) {
    super(message);
    this.name = 'ConnectionError';
    this.attempt = attempt;
    this.maxAttempts = maxAttempts;
  }
}

export class ValidationError extends Error {
  readonly recoveryStrategy: ErrorRecoveryStrategy = 'ignore';
  readonly retryable: boolean = false;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function isRetryableError(error: any): boolean {
  if (error instanceof SocketError || error instanceof PersistenceError || error instanceof ConnectionError) {
    return error.retryable;
  }
  return false;
}

export function getErrorContext(error: any): ErrorContext {
  if (error instanceof SocketError) {
    return {
      type: 'SocketError',
      message: error.message,
      recoveryStrategy: error.recoveryStrategy,
      originalError: error,
    };
  }

  if (error instanceof PersistenceError) {
    return {
      type: 'PersistenceError',
      message: error.message,
      recoveryStrategy: error.recoveryStrategy,
      originalError: error,
    };
  }

  if (error instanceof ConflictError) {
    return {
      type: 'ConflictError',
      message: error.message,
      recoveryStrategy: error.recoveryStrategy,
      originalError: error,
    };
  }

  if (error instanceof ConnectionError) {
    return {
      type: 'ConnectionError',
      message: error.message,
      recoveryStrategy: error.recoveryStrategy,
      originalError: error,
      retryCount: error.attempt,
    };
  }

  return {
    type: error?.name || 'UnknownError',
    message: error?.message || 'An unknown error occurred',
    recoveryStrategy: 'notify',
    originalError: error,
  };
}
