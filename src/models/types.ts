// Shared type definitions for Pair With Code extension

export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface UserActivity {
  userId: string;
  fileName: string;
  line: number;
  character: number;
  isTyping: boolean;
  lastActivityTime: number;
}

export interface VectorClock {
  [userId: string]: number;
}

export interface ContentChange {
  userId: string;
  timestamp: number;
  offset: number;
  text: string;
  length: number;
  fileName: string;
  version: VectorClock;
}

export interface CursorPosition {
  userId: string;
  userName: string;
  fileName: string;
  line: number;
  character: number;
  timestamp: number;
}

export interface RoomSession {
  roomId: string;
  createdAt: number;
  lastAccessedAt: number;
  participants: User[];
  isFavorite: boolean;
}

export interface UserPreference {
  lastRoomId?: string;
  userName?: string;
  autoJoin: boolean;
  followMode: boolean;
  autoReconnect: boolean;
  theme: 'light' | 'dark' | 'auto';
  serverUrl: string;
}

export interface SessionMetadata {
  roomId: string;
  joinedAt: number;
  participantCount: number;
  filesSynced: number;
}

export interface CollaboratorStatus {
  userId: string;
  userName: string;
  status: 'active' | 'typing' | 'idle' | 'away';
  currentFile?: string;
  cursorLine?: number;
  lastActive: number;
}

export interface PresenceInfo {
  userId: string;
  userName: string;
  currentFile: string;
  cursorLine: number;
  character: number;
  status: 'active' | 'typing' | 'idle';
  lastActive: number;
}

export interface RichPresence {
  userId: string;
  userName: string;
  currentFile: string;
  functionName?: string;
  functionLine?: number;
  status: 'coding' | 'debugging' | 'idle';
}

export interface FunctionInfo {
  name: string;
  line: number;
  column: number;
  language: string;
}

export interface Message {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: number;
  status: 'pending' | 'sent' | 'delivered';
  reactions: Reaction[];
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface ChatThread {
  id: string;
  roomId: string;
  fileName: string;
  line: number;
  character: number;
  messages: Message[];
  createdAt: number;
}

export interface MessageStatus {
  messageId: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  error?: string;
}

export interface ConflictAwareChange {
  change: ContentChange;
  clock: VectorClock;
  lineHash: string;
}

export interface ChangeMetadata {
  changeId: string;
  userId: string;
  timestamp: number;
  conflictResolved: boolean;
  resolutionStrategy: 'local-wins' | 'remote-wins' | 'ot';
}

export interface AppState {
  currentRoom?: string;
  connectedUsers: Map<string, CollaboratorStatus>;
  sessionHistory: RoomSession[];
  preferences: UserPreference;
  changeHistory: ContentChange[];
  messages: Message[];
  isConnected: boolean;
  isReconnecting: boolean;
}

export interface SocketEventPayload {
  [key: string]: any;
}

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

export type ErrorRecoveryStrategy = 'retry' | 'fallback' | 'notify' | 'ignore';

export interface ErrorContext {
  type: string;
  message: string;
  originalError?: Error;
  recoveryStrategy: ErrorRecoveryStrategy;
  retryCount?: number;
}
