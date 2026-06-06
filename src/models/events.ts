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
}

export function isValidEvent(event: string): event is SocketEvent {
  return Object.values(SocketEvents).includes(event as SocketEvent);
}
