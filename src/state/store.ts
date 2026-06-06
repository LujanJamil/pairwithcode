import { EventEmitter } from 'events';
import { AppState, CollaboratorStatus, ContentChange, Message, RoomSession, UserPreference, VectorClock } from '../models/types';
import { logger } from '../utils/logger';

export class StateStore extends EventEmitter {
  private state: AppState;
  private vectorClock: VectorClock = {};
  private maxChangeHistory = 100;
  private maxMessages = 500;

  constructor() {
    super();
    this.state = {
      connectedUsers: new Map(),
      sessionHistory: [],
      preferences: {
        autoJoin: false,
        followMode: true,
        autoReconnect: true,
        theme: 'auto',
        serverUrl: 'https://pairwithcode.onrender.com',
      },
      changeHistory: [],
      messages: [],
      isConnected: false,
      isReconnecting: false,
    };
  }

  getState(): AppState {
    return this.state;
  }

  getCurrentRoom(): string | undefined {
    return this.state.currentRoom;
  }

  setCurrentRoom(room: string | undefined): void {
    const changed = this.state.currentRoom !== room;
    this.state.currentRoom = room;
    if (changed) {
      this.emit('room-changed', { room });
      logger.debug('Room changed', { room });
    }
  }

  setConnectionState(isConnected: boolean, isReconnecting: boolean = false): void {
    const changed = this.state.isConnected !== isConnected || this.state.isReconnecting !== isReconnecting;
    this.state.isConnected = isConnected;
    this.state.isReconnecting = isReconnecting;
    if (changed) {
      this.emit('connection-state-changed', { isConnected, isReconnecting });
      logger.debug('Connection state changed', { isConnected, isReconnecting });
    }
  }

  addCollaborator(userId: string, status: CollaboratorStatus): void {
    this.state.connectedUsers.set(userId, status);
    this.emit('collaborator-added', { userId, status });
    logger.debug('Collaborator added', { userId, userName: status.userName });
  }

  removeCollaborator(userId: string): void {
    const user = this.state.connectedUsers.get(userId);
    this.state.connectedUsers.delete(userId);
    this.emit('collaborator-removed', { userId });
    logger.debug('Collaborator removed', { userId, userName: user?.userName });
  }

  updateCollaborator(userId: string, partial: Partial<CollaboratorStatus>): void {
    const current = this.state.connectedUsers.get(userId);
    if (current) {
      const updated = { ...current, ...partial };
      this.state.connectedUsers.set(userId, updated);
      this.emit('collaborator-updated', { userId, updated });
    }
  }

  getCollaborators(): CollaboratorStatus[] {
    return Array.from(this.state.connectedUsers.values());
  }

  getCollaborator(userId: string): CollaboratorStatus | undefined {
    return this.state.connectedUsers.get(userId);
  }

  addChange(change: ContentChange): void {
    this.state.changeHistory.push(change);
    if (this.state.changeHistory.length > this.maxChangeHistory) {
      this.state.changeHistory.shift();
    }
    this.updateVectorClock(change.userId);
    this.emit('change-added', { change });
  }

  getChangeHistory(): ContentChange[] {
    return [...this.state.changeHistory];
  }

  addMessage(message: Message): void {
    this.state.messages.push(message);
    if (this.state.messages.length > this.maxMessages) {
      this.state.messages.shift();
    }
    this.emit('message-added', { message });
  }

  deleteMessage(messageId: string): void {
    const index = this.state.messages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      this.state.messages.splice(index, 1);
      this.emit('message-deleted', { messageId });
    }
  }

  updateMessageReaction(messageId: string, emoji: string, userId: string): void {
    const message = this.state.messages.find((m) => m.id === messageId);
    if (message) {
      const reaction = message.reactions.find((r) => r.emoji === emoji);
      if (reaction) {
        if (!reaction.userIds.includes(userId)) {
          reaction.userIds.push(userId);
        }
      } else {
        message.reactions.push({ emoji, userIds: [userId] });
      }
      this.emit('message-reaction-updated', { messageId, emoji, userId });
    }
  }

  getMessages(limit?: number): Message[] {
    if (limit) {
      return this.state.messages.slice(-limit);
    }
    return [...this.state.messages];
  }

  addSessionToHistory(session: RoomSession): void {
    // Remove if already exists
    const index = this.state.sessionHistory.findIndex((s) => s.roomId === session.roomId);
    if (index !== -1) {
      this.state.sessionHistory.splice(index, 1);
    }
    // Add to front
    this.state.sessionHistory.unshift(session);
    // Keep only last 50
    if (this.state.sessionHistory.length > 50) {
      this.state.sessionHistory.pop();
    }
    this.emit('session-added', { session });
  }

  getSessionHistory(): RoomSession[] {
    return [...this.state.sessionHistory];
  }

  getSessionHistoryLimited(limit: number): RoomSession[] {
    return [...this.state.sessionHistory].slice(0, limit);
  }

  updatePreferences(partial: Partial<UserPreference>): void {
    this.state.preferences = { ...this.state.preferences, ...partial };
    this.emit('preferences-updated', { preferences: this.state.preferences });
    logger.debug('Preferences updated', partial);
  }

  getPreferences(): UserPreference {
    return { ...this.state.preferences };
  }

  updateVectorClock(userId: string, version?: number): void {
    if (version !== undefined) {
      this.vectorClock[userId] = version;
    } else {
      this.vectorClock[userId] = (this.vectorClock[userId] || 0) + 1;
    }
  }

  getVectorClock(): VectorClock {
    return { ...this.vectorClock };
  }

  compareVectorClocks(clock1: VectorClock, clock2: VectorClock): -1 | 0 | 1 {
    let hasGreater = false;
    let hasLess = false;

    for (const userId of new Set([...Object.keys(clock1), ...Object.keys(clock2)])) {
      const v1 = clock1[userId] || 0;
      const v2 = clock2[userId] || 0;

      if (v1 > v2) hasGreater = true;
      if (v1 < v2) hasLess = true;
    }

    if (hasGreater && !hasLess) return 1;
    if (hasLess && !hasGreater) return -1;
    return 0;
  }

  clear(): void {
    this.state.connectedUsers.clear();
    this.state.changeHistory = [];
    this.state.messages = [];
    this.state.currentRoom = undefined;
    this.vectorClock = {};
    this.emit('state-cleared');
    logger.info('State cleared');
  }
}

export const createStateStore = (): StateStore => {
  return new StateStore();
};
