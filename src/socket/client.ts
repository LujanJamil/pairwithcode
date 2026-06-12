import { io, Socket as IOSocket } from 'socket.io-client';
import { EventEmitter } from 'events';
import { SocketEvent, SocketEventMap, SocketEvents, isValidEvent } from '../models/events';
import { ConnectionState } from '../models/types';
import { ConnectionError, SocketError } from '../utils/errors';
import { logger } from '../utils/logger';

interface ReconnectConfig {
  maxRetries: number;
  backoffMs: number[];
  maxBackoffMs: number;
}

export class SocketClient {
  private socket: IOSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private currentRoom: string | undefined;
  private reconnectAttempt = 0;
  private reconnectConfig: ReconnectConfig;
  private eventListeners: Map<string, Function[]> = new Map();
  private internalEmitter: EventEmitter = new EventEmitter();

  constructor(
    private serverUrl: string,
    reconnectConfig?: Partial<ReconnectConfig>,
  ) {
    this.reconnectConfig = {
      maxRetries: 5,
      backoffMs: [1000, 2000, 4000, 8000, 10000],
      maxBackoffMs: 10000,
      ...reconnectConfig,
    };
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      logger.warn('Already connected');
      return;
    }

    try {
      this.state = ConnectionState.CONNECTING;
      this.internalEmitter.emit('state-changed', this.state);

      this.socket = io(this.serverUrl, {
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.reconnectConfig.maxRetries,
        transports: ['websocket', 'polling'],
      });

      this.setupEventHandlers();

      this.socket.connect();

      // Wait for connection with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new ConnectionError('Connection timeout', this.reconnectAttempt, this.reconnectConfig.maxRetries));
        }, 10000);

        const onConnect = () => {
          clearTimeout(timeout);
          resolve();
        };

        this.socket?.once('connect', onConnect);
      });

      this.state = ConnectionState.CONNECTED;
      this.reconnectAttempt = 0;
      this.internalEmitter.emit('state-changed', this.state);
      logger.info('Connected to socket.io server');
    } catch (error) {
      this.state = ConnectionState.FAILED;
      this.internalEmitter.emit('state-changed', this.state);
      throw new SocketError(`Failed to connect: ${error}`, 'retry');
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      logger.info('Socket connected');
      this.state = ConnectionState.CONNECTED;
      this.reconnectAttempt = 0;
      this.internalEmitter.emit('state-changed', this.state);
      this.internalEmitter.emit('connected');
    });

    this.socket.on('disconnect', (reason: string) => {
      logger.warn('Socket disconnected', { reason });
      this.state = ConnectionState.DISCONNECTED;
      this.internalEmitter.emit('state-changed', this.state);
      this.internalEmitter.emit('disconnected', reason);
    });

    this.socket.on('reconnecting', () => {
      logger.info('Attempting to reconnect');
      this.state = ConnectionState.RECONNECTING;
      this.internalEmitter.emit('state-changed', this.state);
      this.internalEmitter.emit('reconnecting');
    });

    this.socket.on('reconnect_failed', () => {
      logger.error('Reconnection failed after max attempts');
      this.state = ConnectionState.FAILED;
      this.internalEmitter.emit('state-changed', this.state);
      this.internalEmitter.emit('reconnect-failed');
    });

    this.socket.on('connect_error', (error: Error) => {
      logger.error('Connection error', error);
      this.internalEmitter.emit('error', error);
    });
  }

  emitEvent(event: string, data?: any): void {
    if (!this.socket?.connected) {
      logger.warn('Socket not connected, cannot emit', { event });
      return;
    }

    if (!isValidEvent(event)) {
      logger.warn('Invalid socket event', { event });
      return;
    }

    try {
      this.socket.emit(event, data);
      logger.debug(`Emitted socket event: ${event}`, data);
    } catch (error) {
      logger.error(`Failed to emit event ${event}`, error);
    }
  }

  onEvent(event: SocketEvent, callback: (data: any) => void): void {
    if (!isValidEvent(event)) {
      logger.warn('Invalid socket event', { event });
      return;
    }

    if (!this.socket) {
      // Store listener for when socket is created
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, []);
      }
      this.eventListeners.get(event)!.push(callback);
      return;
    }

    this.socket.on(event, (data: any) => {
      logger.debug(`Received socket event: ${event}`, data);
      callback(data);
    });
  }

  onceEvent(event: SocketEvent, callback: (data: any) => void): void {
    if (!this.socket) {
      logger.warn('Socket not initialized');
      return;
    }

    this.socket.once(event, (data: any) => {
      callback(data);
    });
  }

  offEvent(event: SocketEvent, callback: (data: any) => void): void {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  onStateChanged(callback: (state: ConnectionState) => void): void {
    this.internalEmitter.on('state-changed', callback);
  }

  onConnected(callback: () => void): void {
    this.internalEmitter.on('connected', callback);
  }

  onDisconnected(callback: (reason: string) => void): void {
    this.internalEmitter.on('disconnected', callback);
  }

  onError(callback: (error: Error) => void): void {
    this.internalEmitter.on('error', callback);
  }

  async disconnect(): Promise<void> {
    try {
      if (this.socket?.connected) {
        this.socket.disconnect();
      }
      this.state = ConnectionState.DISCONNECTED;
      this.currentRoom = undefined;
      this.internalEmitter.emit('state-changed', this.state);
      logger.info('Disconnected from socket.io server');
    } catch (error) {
      logger.error('Error during disconnect', error);
    }
  }

  joinRoom(roomName: string): void {
    this.currentRoom = roomName;
    this.emitEvent(SocketEvents.JOIN_ROOM as any, { roomName });
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getCurrentRoom(): string | undefined {
    return this.currentRoom;
  }

  setCurrentRoom(room: string | undefined): void {
    this.currentRoom = room;
  }

  getId(): string | undefined {
    return this.socket?.id;
  }
}

export const createSocketClient = (serverUrl: string, reconnectConfig?: Partial<ReconnectConfig>): SocketClient => {
  return new SocketClient(serverUrl, reconnectConfig);
};
