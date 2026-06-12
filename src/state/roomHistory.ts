import { RoomSession } from '../models/types';
import { Persistence } from './persistence';
import { logger } from '../utils/logger';

export class RoomHistory {
  private rooms: Map<string, RoomSession> = new Map();

  constructor(private persistence: Persistence) {}

  async loadHistory(): Promise<RoomSession[]> {
    try {
      const history = await this.persistence.loadRoomHistory();
      this.rooms.clear();
      history.forEach((room) => this.rooms.set(room.roomId, room));
      logger.debug('Loaded room history', { count: history.length });
      return history;
    } catch (error) {
      logger.error('Failed to load room history', error);
      return [];
    }
  }

  async addRoom(roomId: string, participants: Array<{ id: string; name: string }>): Promise<RoomSession> {
    const existingRoom = this.rooms.get(roomId);

    const room: RoomSession = {
      roomId,
      createdAt: existingRoom?.createdAt || Date.now(),
      lastAccessedAt: Date.now(),
      participants,
      isFavorite: existingRoom?.isFavorite || false,
    };

    this.rooms.set(roomId, room);
    await this.saveHistory();

    logger.debug('Room added to history', { roomId, participantCount: participants.length });
    return room;
  }

  async removeRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
    await this.saveHistory();
    logger.debug('Room removed from history', { roomId });
  }

  async toggleFavorite(roomId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) {
      logger.warn('Room not found for favorite toggle', { roomId });
      return false;
    }

    room.isFavorite = !room.isFavorite;
    await this.saveHistory();
    logger.debug('Room favorite toggled', { roomId, isFavorite: room.isFavorite });
    return room.isFavorite;
  }

  async updateRoomParticipants(roomId: string, participants: Array<{ id: string; name: string }>): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) {
      room.participants = participants;
      room.lastAccessedAt = Date.now();
      await this.saveHistory();
      logger.debug('Room participants updated', { roomId, participantCount: participants.length });
    }
  }

  getRoom(roomId: string): RoomSession | undefined {
    return this.rooms.get(roomId);
  }

  getAllRooms(): RoomSession[] {
    return Array.from(this.rooms.values()).sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
  }

  getFavoriteRooms(): RoomSession[] {
    return this.getAllRooms().filter((r) => r.isFavorite);
  }

  getRecentRooms(limit: number = 10): RoomSession[] {
    return this.getAllRooms().slice(0, limit);
  }

  async clearHistory(): Promise<void> {
    this.rooms.clear();
    await this.persistence.saveRoomHistory([]);
    logger.info('Room history cleared');
  }

  private async saveHistory(): Promise<void> {
    const rooms = this.getAllRooms();
    try {
      await this.persistence.saveRoomHistory(rooms);
      logger.debug('Room history saved', { count: rooms.length });
    } catch (error) {
      logger.error('Failed to save room history', error);
    }
  }
}

export const createRoomHistory = (persistence: Persistence): RoomHistory => {
  return new RoomHistory(persistence);
};
