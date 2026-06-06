import * as vscode from 'vscode';
import { RoomSession, UserPreference } from '../models/types';
import { PersistenceError } from '../utils/errors';
import { logger } from '../utils/logger';

const ROOM_HISTORY_KEY = 'pair.roomHistory';
const USER_PREFERENCES_KEY = 'pair.userPreferences';
const LAST_ROOM_KEY = 'pair.lastRoom';
const SESSION_MESSAGES_KEY = 'pair.sessionMessages';

export class Persistence {
  constructor(
    private globalState: vscode.Memento,
    private workspaceState: vscode.Memento,
  ) {}

  async loadRoomHistory(): Promise<RoomSession[]> {
    try {
      const history = this.globalState.get<RoomSession[]>(ROOM_HISTORY_KEY, []);
      logger.debug('Loaded room history', { count: history.length });
      return history;
    } catch (error) {
      throw new PersistenceError(`Failed to load room history: ${error}`, 'fallback');
    }
  }

  async saveRoomHistory(history: RoomSession[]): Promise<void> {
    try {
      // Keep only last 50
      const limited = history.slice(0, 50);
      await this.globalState.update(ROOM_HISTORY_KEY, limited);
      logger.debug('Saved room history', { count: limited.length });
    } catch (error) {
      throw new PersistenceError(`Failed to save room history: ${error}`, 'fallback');
    }
  }

  async loadUserPreferences(): Promise<UserPreference> {
    try {
      const prefs = this.globalState.get<UserPreference>(USER_PREFERENCES_KEY, {
        autoJoin: false,
        followMode: true,
        autoReconnect: true,
        theme: 'auto',
        serverUrl: 'https://pairwithcode.onrender.com',
      });
      // Merge with current settings (settings take precedence)
      const merged = { ...prefs };
      logger.debug('Loaded user preferences');
      return merged;
    } catch (error) {
      throw new PersistenceError(`Failed to load preferences: ${error}`, 'fallback');
    }
  }

  async saveUserPreferences(prefs: UserPreference): Promise<void> {
    try {
      await this.globalState.update(USER_PREFERENCES_KEY, prefs);
      logger.debug('Saved user preferences');
    } catch (error) {
      throw new PersistenceError(`Failed to save preferences: ${error}`, 'fallback');
    }
  }

  async getLastRoom(): Promise<string | undefined> {
    try {
      return this.globalState.get<string | undefined>(LAST_ROOM_KEY);
    } catch (error) {
      logger.warn('Failed to get last room', error);
      return undefined;
    }
  }

  async setLastRoom(roomId: string): Promise<void> {
    try {
      await this.globalState.update(LAST_ROOM_KEY, roomId);
    } catch (error) {
      logger.warn('Failed to set last room', error);
    }
  }

  async saveSessionMessages(roomId: string, messages: any[]): Promise<void> {
    try {
      const key = `${SESSION_MESSAGES_KEY}.${roomId}`;
      // Keep only last 500 messages
      const limited = messages.slice(-500);
      await this.workspaceState.update(key, limited);
      logger.debug('Saved session messages', { roomId, count: limited.length });
    } catch (error) {
      logger.warn('Failed to save session messages', error);
    }
  }

  async loadSessionMessages(roomId: string): Promise<any[]> {
    try {
      const key = `${SESSION_MESSAGES_KEY}.${roomId}`;
      return this.workspaceState.get<any[]>(key, []);
    } catch (error) {
      logger.warn('Failed to load session messages', error);
      return [];
    }
  }

  async clearSessionData(roomId: string): Promise<void> {
    try {
      const key = `${SESSION_MESSAGES_KEY}.${roomId}`;
      await this.workspaceState.update(key, undefined);
      logger.debug('Cleared session data', { roomId });
    } catch (error) {
      logger.warn('Failed to clear session data', error);
    }
  }
}

export const createPersistence = (context: vscode.ExtensionContext): Persistence => {
  return new Persistence(context.globalState, context.workspaceState);
};
