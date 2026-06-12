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
  cursorColumn?: number;
  selectionStartLine?: number;
  selectionEndLine?: number;
  lastActive: number;
  avatarColor?: string;
  isRecording?: boolean;
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
  messageType?: 'text' | 'code' | 'mention' | 'file';
  threadId?: string;
  mentions?: string[];
  editedAt?: number;
  isEncrypted?: boolean;
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
  currentUser?: User;
  userToken?: string;
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

// ===== NEW TYPES FOR ADVANCED FEATURES =====

export interface SessionRecording {
  id: string;
  sessionId: string;
  initiatedBy: string;
  status: 'pending' | 'recording' | 'processing' | 'ready' | 'failed';
  startTime: number;
  endTime?: number;
  durationMs?: number;
  storageUrl?: string;
  frameCount?: number;
  fps?: number;
}

export interface SessionAnalytics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  totalEdits: number;
  totalConflicts: number;
  conflictsResolved: number;
  participantCount: number;
  averageLatencyMs: number;
  totalCharactersAdded: number;
  totalCharactersDeleted: number;
  eventTimeline: AnalyticsEvent[];
}

export interface AnalyticsEvent {
  id: string;
  eventType: 'typing' | 'cursor_move' | 'file_switch' | 'conflict' | 'save' | 'paste' | 'delete';
  userId: string;
  userName: string;
  timestamp: number;
  durationMs?: number;
  metadata?: {
    fileePath?: string;
    language?: string;
    characterCount?: number;
    lineCount?: number;
    conflictSeverity?: 'low' | 'medium' | 'high';
  };
}

export interface CodeReviewComment {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  filePath: string;
  lineNumber: number;
  content: string;
  type: 'comment' | 'suggestion' | 'question' | 'issue' | 'blocker';
  severity: 'info' | 'warning' | 'error';
  status: 'open' | 'resolved' | 'dismissed';
  threadId?: string;
  replyToId?: string;
  createdAt: number;
  resolvedAt?: number;
}

export interface UserSession {
  id: string;
  userId: string;
  userName: string;
  sessionId: string;
  joinedAt: number;
  leftAt?: number;
  editsCount: number;
  charactersAdded: number;
  charactersDeleted: number;
  conflictsCreated: number;
  messagesCount: number;
}

export interface EncryptionKey {
  id: string;
  userId?: string;
  sessionId?: string;
  publicKey: string;
  privateKey?: string;
  algorithm: 'x25519' | 'rsa-4096';
  fingerprint: string;
  createdAt: number;
}

export interface OAuthProfile {
  provider: 'github' | 'gitlab';
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  name?: string;
  accessToken: string;
  refreshToken?: string;
}

export interface ServerConfig {
  name: string;
  url: string;
  isPublic: boolean;
  maxSessions: number;
  maxParticipantsPerSession: number;
  recordingEnabled: boolean;
  encryptionEnabled: boolean;
  version: string;
  nodeEnv: 'development' | 'production';
}

export interface ConflictResolutionSuggestion {
  conflictId: string;
  localChange: ContentChange;
  remoteChange: ContentChange;
  suggestion: string;
  strategy: 'local-wins' | 'remote-wins' | 'merge';
  confidence: number; // 0-1
  explanation: string;
  aiGenerated?: boolean;
}

// ===== RECORDING & PLAYBACK =====

export interface EditorFrame {
  timestamp: number;
  activeFile: string | undefined;
  text: string | undefined;
  selections: Array<{ line: number; character: number; line2: number; character2: number }> | undefined;
  visibleRanges: Array<{ line: number; character: number; line2: number; character2: number }> | undefined;
  cursorLine: number | undefined;
  cursorColumn: number | undefined;
}

export interface RecordingPlaybackState {
  recordingId: string;
  isPlaying: boolean;
  currentFrameIndex: number;
  playbackSpeed: 0.5 | 1 | 1.5 | 2;
  totalFrames: number;
  currentTimeMs: number;
  durationMs: number;
  isLoading: boolean;
}

export interface RecordingMetadata {
  recordingId: string;
  sessionId: string;
  title?: string;
  description?: string;
  initiatedBy: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  frameCount: number;
  fps: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  sizeBytes?: number;
}

// ===== CODE REVIEW & THREADING =====

export interface CodeReviewThread {
  threadId: string;
  sessionId: string;
  filePath: string;
  lineNumber: number;
  createdAt: number;
  resolvedAt?: number;
  status: 'open' | 'resolved';
  comments: CodeReviewComment[];
}

export interface CodeReviewReport {
  sessionId: string;
  totalComments: number;
  openComments: number;
  resolvedComments: number;
  blockers: number;
  errors: number;
  warnings: number;
  suggestions: number;
  averageResolutionTime: number;
  fileStats: Array<{
    filePath: string;
    commentCount: number;
    blockerCount: number;
  }>;
}

// ===== ENCRYPTION & SECURITY =====

export interface EncryptedMessage {
  messageId?: string;
  ciphertext: string; // base64 encoded
  nonce: string; // base64 encoded
  publicKey: string; // base64 encoded sender public key
  algorithm: 'nacl-box' | 'rsa-oaep';
  isEncrypted: boolean;
}

export interface KeyExchangePayload {
  userId: string;
  userName: string;
  publicKey: string; // base64 encoded
  algorithm: 'x25519' | 'rsa-4096';
  fingerprint: string;
  timestamp: number;
}

export interface EncryptionSessionState {
  enabled: boolean;
  localPublicKey: string;
  localSecretKey: string; // stored in VS Code secrets
  remotePublicKeys: Map<string, string>; // userId -> publicKey
  verifiedKeyFingerprints: Set<string>; // verified fingerprints
  algorithm: 'nacl-box' | 'rsa-oaep';
}

// ===== ANALYTICS =====

export interface AnalyticsCollectionState {
  isCollecting: boolean;
  bufferedEvents: AnalyticsEvent[];
  lastFlushTime: number;
  eventCount: number;
  sessionStartTime: number;
}

export interface AnalyticsReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  participantCount: number;
  totalEvents: number;
  eventDistribution: Record<string, number>;
  userStats: Array<{
    userId: string;
    userName: string;
    eventCount: number;
    typingEvents: number;
    cursorMoves: number;
    filesSwitched: number;
  }>;
  topFiles: Array<{
    filePath: string;
    edits: number;
    conflicts: number;
  }>;
  conflictStats: {
    totalConflicts: number;
    conflictRate: number;
    averageResolutionTime: number;
  };
}

// ===== A/V & COMMUNICATION =====

export interface AVCallState {
  callId: string;
  initiator: string;
  recipient: string;
  status: 'pending' | 'accepted' | 'rejected' | 'active' | 'ended' | 'failed';
  startTime?: number;
  endTime?: number;
  mediaType: 'audio' | 'video' | 'screen';
  offer?: string; // WebRTC offer SDP
  answer?: string; // WebRTC answer SDP
  iceCandidates: string[]; // ICE candidate strings
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  iceConnectionState?: 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed';
  connectionStats?: {
    latency: number;
    jitter: number;
    packetLoss: number;
    bandwidth: number;
  };
}

export interface AVCallHistory {
  callId: string;
  initiator: string;
  recipient: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  mediaType: 'audio' | 'video' | 'screen';
  status: 'completed' | 'missed' | 'declined' | 'failed';
  recordingUrl?: string;
}

// ===== TERMINAL SHARING =====

export interface TerminalSessionState {
  sessionId: string;
  ptyId: string;
  shell: string; // 'bash', 'zsh', 'powershell', etc.
  isConnected: boolean;
  isActive: boolean;
  cols: number;
  rows: number;
  environment?: Record<string, string>;
}

export interface TerminalOutput {
  timestamp: number;
  data: string; // ANSI-encoded terminal output
  userId?: string; // who typed it
}

export interface TerminalInput {
  timestamp: number;
  data: string; // raw input
  userId: string;
}

export interface TerminalSessionTranscript {
  sessionId: string;
  startTime: number;
  endTime: number;
  shell: string;
  events: Array<TerminalInput | TerminalOutput>;
  rawText: string; // plain text log
}

// ===== ENTERPRISE & RBAC =====

export interface UserRole {
  roleId: string;
  name: string; // 'owner', 'editor', 'reviewer', 'viewer', 'custom'
  permissions: Set<string>;
  description?: string;
}

export interface UserRoleAssignment {
  userId: string;
  sessionId: string;
  roleId: string;
  assignedAt: number;
  assignedBy: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string; // 'file_edit', 'comment_created', 'user_invited', etc.
  resourceType: string; // 'session', 'message', 'code_review', etc.
  resourceId: string;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, any>; // before/after values
  status: 'success' | 'failure';
  errorMessage?: string;
}

export interface TeamMetrics {
  teamId: string;
  sessionCount: number;
  totalActiveMinutes: number;
  averageSessionDuration: number;
  mostActiveUsers: Array<{
    userId: string;
    userName: string;
    sessionsCount: number;
    totalMinutes: number;
  }>;
  topFiles: Array<{
    filePath: string;
    edits: number;
    conflicts: number;
  }>;
  conflictRate: number;
  codeReviewStats: {
    totalComments: number;
    averageResolutionTime: number;
    blockersResolved: number;
  };
}
