import { logger } from '../utils/logger';
import { ConnectionError } from '../utils/errors';

export interface ReconnectionConfig {
  maxRetries: number;
  backoffMs: number[];
  maxBackoffMs: number;
}

export class ReconnectionManager {
  private reconnectAttempt = 0;
  private backoffMs: number[];
  private maxRetries: number;
  private maxBackoffMs: number;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(config: ReconnectionConfig) {
    this.maxRetries = config.maxRetries;
    this.backoffMs = config.backoffMs;
    this.maxBackoffMs = config.maxBackoffMs;
  }

  shouldRetry(): boolean {
    return this.reconnectAttempt < this.maxRetries;
  }

  getBackoffDelay(): number {
    if (this.reconnectAttempt >= this.backoffMs.length) {
      return Math.min(this.backoffMs[this.backoffMs.length - 1] * 2, this.maxBackoffMs);
    }
    return this.backoffMs[this.reconnectAttempt];
  }

  getAttempt(): number {
    return this.reconnectAttempt;
  }

  incrementAttempt(): void {
    this.reconnectAttempt++;
    const delay = this.getBackoffDelay();
    logger.info('Reconnection attempt', {
      attempt: this.reconnectAttempt,
      maxRetries: this.maxRetries,
      nextDelayMs: delay,
    });
  }

  reset(): void {
    const wasAttempting = this.reconnectAttempt > 0;
    this.reconnectAttempt = 0;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (wasAttempting) {
      logger.info('Reconnection reset');
    }
  }

  scheduleReconnect(callback: () => void): void {
    const delay = this.getBackoffDelay();
    this.reconnectTimeout = setTimeout(() => {
      logger.debug('Executing scheduled reconnect');
      callback();
    }, delay);
  }

  cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
      logger.debug('Reconnection cancelled');
    }
  }

  dispose(): void {
    this.cancelReconnect();
  }
}

export const createReconnectionManager = (config: ReconnectionConfig): ReconnectionManager => {
  return new ReconnectionManager(config);
};
