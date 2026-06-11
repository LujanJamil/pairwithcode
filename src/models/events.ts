// Socket.IO event definitions with type safety

export const SocketEvents = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',

  // Room management
  JOIN_ROOM: 'join-room',
  ROOM_UPDATE: 'room-update',
  USER_DISCONNECTED: 'user-disconnected',

  // Presence events
  USER_INFO: 'user-info',
  USERS_IN_ROOM: 'users-in-room',
  USER_JOINED: 'user-joined',
  USER_AWAY: 'user-away',
  USER_RETURNED: 'user-returned',

  // File sync events
  FILE_SWITCH: 'file-switch',
  REMOTE_FILE_SWITCH: 'remote-file-switch',
  REQUEST_FILE_INFO: 'request-file-info',
  FILE_INFO: 'file-info',

  // Content sync events
  TYPING: 'typing',
  REMOTE_TYPING: 'remote-typing',
  CURSOR: 'cursor',
  REMOTE_CURSOR: 'remote-cursor',

  // State sync events
  REQUEST_INITIAL_STATE: 'request-initial-state',
  SEND_INITIAL_STATE: 'send-initial-state',
  RECEIVE_INITIAL_STATE: 'receive-initial-state',

  // Chat events
  SEND_MESSAGE: 'send-message',
  RECEIVE_MESSAGE: 'receive-message',
  REACT_TO_MESSAGE: 'react-to-message',
  MESSAGE_REACTION: 'message-reaction',
  DELETE_MESSAGE: 'delete-message',
  MESSAGE_DELETED: 'message-deleted',
  MESSAGE_HISTORY: 'message-history',

  // Recording events
  RECORDING_STARTED: 'recording-started',
  RECORDING_FRAMES: 'recording-frames',
  RECORDING_STOPPED: 'recording-stopped',
  RECORDING_SAVED: 'recording-saved',
  RECORDING_ERROR: 'recording-error',
  RECORDING_LIST_UPDATED: 'recording-list-updated',

  // Code Review events
  CODE_REVIEW_COMMENT_ADDED: 'code-review-comment-added',
  CODE_REVIEW_COMMENT_UPDATED: 'code-review-comment-updated',
  CODE_REVIEW_COMMENT_DELETED: 'code-review-comment-deleted',
  CODE_REVIEW_THREAD_REPLY: 'code-review-thread-reply',
  CODE_REVIEW_THREAD_RESOLVED: 'code-review-thread-resolved',

  // Analytics events
  ANALYTICS_EVENT_BATCH: 'analytics-event-batch',
  ANALYTICS_SESSION_END: 'analytics-session-end',

  // Encryption events
  ENCRYPTION_KEY_EXCHANGE: 'encryption-key-exchange',
  ENCRYPTION_KEY_ACK: 'encryption-key-ack',
  ENCRYPTION_KEY_FINGERPRINT_VERIFIED: 'encryption-key-fingerprint-verified',

  // A/V events
  AV_CALL_INITIATED: 'av-call-initiated',
  AV_CALL_OFFER: 'av-call-offer',
  AV_CALL_ANSWER: 'av-call-answer',
  AV_ICE_CANDIDATE: 'av-ice-candidate',
  AV_CALL_ACCEPTED: 'av-call-accepted',
  AV_CALL_DECLINED: 'av-call-declined',
  AV_CALL_ENDED: 'av-call-ended',
  AV_CALL_FAILED: 'av-call-failed',

  // Terminal events
  TERMINAL_START: 'terminal-start',
  TERMINAL_INPUT: 'terminal-input',
  TERMINAL_OUTPUT: 'terminal-output',
  TERMINAL_CLOSED: 'terminal-closed',
  TERMINAL_ERROR: 'terminal-error',

  // OAuth events
  OAUTH_LOGIN_INITIATED: 'oauth-login-initiated',
  OAUTH_LOGIN_SUCCESS: 'oauth-login-success',
  OAUTH_LOGIN_FAILED: 'oauth-login-failed',

  // Error/Control events
  ERROR: 'error',
  RECONNECTING: 'reconnecting',
  RECONNECTED: 'reconnected',
} as const;

export type SocketEvent = (typeof SocketEvents)[keyof typeof SocketEvents];

export interface SocketEventMap {
  [SocketEvents.CONNECT]: void;
  [SocketEvents.DISCONNECT]: void;
  [SocketEvents.CONNECT_ERROR]: Error;

  [SocketEvents.JOIN_ROOM]: { roomName: string };
  [SocketEvents.ROOM_UPDATE]: { count: number };
  [SocketEvents.USER_DISCONNECTED]: string; // userId

  [SocketEvents.USER_INFO]: { userId: string; userName: string; avatar?: string };
  [SocketEvents.USERS_IN_ROOM]: { users: Array<{ id: string; name: string }> };
  [SocketEvents.USER_JOINED]: { userId: string; userName: string };
  [SocketEvents.USER_AWAY]: { userId: string };
  [SocketEvents.USER_RETURNED]: { userId: string };

  [SocketEvents.FILE_SWITCH]: { roomName: string; relativePath: string };
  [SocketEvents.REMOTE_FILE_SWITCH]: { relativePath: string };
  [SocketEvents.REQUEST_FILE_INFO]: { roomName: string; fileName: string };
  [SocketEvents.FILE_INFO]: { fileName: string; lastModified: number; size: number; collaborators: string[] };

  [SocketEvents.TYPING]: { roomName: string; text: string; offset: number; length: number; fileName: string };
  [SocketEvents.REMOTE_TYPING]: { text: string; offset: number; length: number; fileName: string };
  [SocketEvents.CURSOR]: { roomName: string; line: number; character: number; fileName: string };
  [SocketEvents.REMOTE_CURSOR]: { line: number; character: number; fileName: string; userId: string; userName: string };

  [SocketEvents.REQUEST_INITIAL_STATE]: { requesterId: string };
  [SocketEvents.SEND_INITIAL_STATE]: { requesterId: string; content: string };
  [SocketEvents.RECEIVE_INITIAL_STATE]: string; // content

  [SocketEvents.SEND_MESSAGE]: { roomName: string; userId: string; content: string; timestamp: number };
  [SocketEvents.RECEIVE_MESSAGE]: { id: string; userId: string; userName: string; content: string; timestamp: number; status: 'sent' | 'delivered' };
  [SocketEvents.REACT_TO_MESSAGE]: { roomName: string; messageId: string; emoji: string; userId: string };
  [SocketEvents.MESSAGE_REACTION]: { messageId: string; emoji: string; userId: string; userName: string };
  [SocketEvents.DELETE_MESSAGE]: { roomName: string; messageId: string; userId: string };
  [SocketEvents.MESSAGE_DELETED]: { messageId: string };
  [SocketEvents.MESSAGE_HISTORY]: { messages: Array<{ id: string; userId: string; userName: string; content: string; timestamp: number }> };

  [SocketEvents.ERROR]: { message: string };
  [SocketEvents.RECONNECTING]: void;
  [SocketEvents.RECONNECTED]: void;

  // Recording event payloads
  [SocketEvents.RECORDING_STARTED]: {
    recordingId: string;
    roomName: string;
    initiatedBy: string;
    startTime: number;
  };
  [SocketEvents.RECORDING_FRAMES]: {
    recordingId: string;
    frames: Array<{
      timestamp: number;
      activeFile?: string;
      cursorLine?: number;
      cursorColumn?: number;
    }>;
  };
  [SocketEvents.RECORDING_STOPPED]: {
    recordingId: string;
    roomName: string;
    duration: number;
    frameCount: number;
  };
  [SocketEvents.RECORDING_SAVED]: {
    recordingId: string;
    storageUrl: string;
    videoUrl?: string;
    metadata: Record<string, any>;
  };
  [SocketEvents.RECORDING_ERROR]: {
    recordingId: string;
    error: string;
  };
  [SocketEvents.RECORDING_LIST_UPDATED]: {
    recordings: Array<{
      id: string;
      status: string;
      startTime: number;
      endTime?: number;
      durationMs?: number;
    }>;
  };

  // Code Review event payloads
  [SocketEvents.CODE_REVIEW_COMMENT_ADDED]: {
    id: string;
    sessionId: string;
    filePath: string;
    lineNumber: number;
    userId: string;
    userName: string;
    content: string;
    type: string;
    severity: string;
    threadId?: string;
    timestamp: number;
  };
  [SocketEvents.CODE_REVIEW_COMMENT_UPDATED]: {
    commentId: string;
    status: 'open' | 'resolved' | 'dismissed';
    updatedAt: number;
  };
  [SocketEvents.CODE_REVIEW_COMMENT_DELETED]: {
    commentId: string;
    filePath: string;
  };
  [SocketEvents.CODE_REVIEW_THREAD_REPLY]: {
    threadId: string;
    replyId: string;
    userId: string;
    userName: string;
    content: string;
    timestamp: number;
  };
  [SocketEvents.CODE_REVIEW_THREAD_RESOLVED]: {
    threadId: string;
    resolvedBy: string;
    resolvedAt: number;
  };

  // Analytics event payloads
  [SocketEvents.ANALYTICS_EVENT_BATCH]: {
    events: Array<{
      userId: string;
      roomName: string;
      timestamp: number;
      eventType: string;
      metadata?: Record<string, any>;
    }>;
  };
  [SocketEvents.ANALYTICS_SESSION_END]: {
    sessionId: string;
    endTime: number;
    totalEvents: number;
  };

  // Encryption event payloads
  [SocketEvents.ENCRYPTION_KEY_EXCHANGE]: {
    userId: string;
    userName: string;
    publicKey: string;
    algorithm: string;
    fingerprint: string;
    timestamp: number;
  };
  [SocketEvents.ENCRYPTION_KEY_ACK]: {
    userId: string;
    fingerprint: string;
  };
  [SocketEvents.ENCRYPTION_KEY_FINGERPRINT_VERIFIED]: {
    userId: string;
    fingerprint: string;
  };

  // A/V event payloads
  [SocketEvents.AV_CALL_INITIATED]: {
    callId: string;
    initiatorId: string;
    recipientId: string;
    mediaType: 'audio' | 'video' | 'screen';
    timestamp: number;
  };
  [SocketEvents.AV_CALL_OFFER]: {
    callId: string;
    offer: string;
  };
  [SocketEvents.AV_CALL_ANSWER]: {
    callId: string;
    answer: string;
  };
  [SocketEvents.AV_ICE_CANDIDATE]: {
    callId: string;
    candidate: string;
  };
  [SocketEvents.AV_CALL_ACCEPTED]: {
    callId: string;
    acceptedAt: number;
  };
  [SocketEvents.AV_CALL_DECLINED]: {
    callId: string;
    declinedBy: string;
    declinedAt: number;
  };
  [SocketEvents.AV_CALL_ENDED]: {
    callId: string;
    endedBy: string;
    durationMs: number;
  };
  [SocketEvents.AV_CALL_FAILED]: {
    callId: string;
    error: string;
    failedAt: number;
  };

  // Terminal event payloads
  [SocketEvents.TERMINAL_START]: {
    sessionId: string;
    ptyId: string;
    shell: string;
    cols: number;
    rows: number;
  };
  [SocketEvents.TERMINAL_INPUT]: {
    sessionId: string;
    ptyId: string;
    data: string;
    userId: string;
  };
  [SocketEvents.TERMINAL_OUTPUT]: {
    sessionId: string;
    ptyId: string;
    data: string;
  };
  [SocketEvents.TERMINAL_CLOSED]: {
    sessionId: string;
    ptyId: string;
    exitCode: number;
  };
  [SocketEvents.TERMINAL_ERROR]: {
    sessionId: string;
    ptyId: string;
    error: string;
  };

  // OAuth event payloads
  [SocketEvents.OAUTH_LOGIN_INITIATED]: {
    provider: 'github' | 'gitlab';
    state: string;
  };
  [SocketEvents.OAUTH_LOGIN_SUCCESS]: {
    provider: 'github' | 'gitlab';
    token: string;
    user: {
      id: string;
      username: string;
      email?: string;
      avatar?: string;
    };
  };
  [SocketEvents.OAUTH_LOGIN_FAILED]: {
    provider: 'github' | 'gitlab';
    error: string;
  };
}

export function isValidEvent(event: string): event is SocketEvent {
  return Object.values(SocketEvents).includes(event as SocketEvent);
}
