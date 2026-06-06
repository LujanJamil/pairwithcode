import { StateStore } from '../state/store';
import { logger } from '../utils/logger';

export interface ActivityIndicator {
  userId: string;
  type: 'typing' | 'cursor-move' | 'file-switch';
  timestamp: number;
  expiresAt: number;
}

export class ActivityTracker {
  private activities: Map<string, ActivityIndicator> = new Map();
  private activityTimeout: NodeJS.Timeout | null = null;
  private idleThreshold = 30000; // 30 seconds
  private activityDecayMs = 5000; // Activity indicator fades after 5 seconds

  constructor(private store: StateStore) {
    this.startActivityCleanup();
  }

  recordTyping(userId: string): void {
    const now = Date.now();
    const key = `${userId}:typing`;

    this.activities.set(key, {
      userId,
      type: 'typing',
      timestamp: now,
      expiresAt: now + this.activityDecayMs,
    });

    this.updateCollaboratorStatus(userId, 'typing');
    logger.debug('Activity recorded: typing', { userId });
  }

  recordCursorMove(userId: string): void {
    const now = Date.now();
    const key = `${userId}:cursor`;

    this.activities.set(key, {
      userId,
      type: 'cursor-move',
      timestamp: now,
      expiresAt: now + this.activityDecayMs,
    });

    this.updateCollaboratorStatus(userId, 'active');
  }

  recordFileSwitch(userId: string): void {
    const now = Date.now();
    const key = `${userId}:file-switch`;

    this.activities.set(key, {
      userId,
      type: 'file-switch',
      timestamp: now,
      expiresAt: now + this.activityDecayMs,
    });

    this.updateCollaboratorStatus(userId, 'active');
    logger.debug('Activity recorded: file switch', { userId });
  }

  private updateCollaboratorStatus(userId: string, status: 'active' | 'typing' | 'idle'): void {
    const collaborator = this.store.getCollaborator(userId);
    if (collaborator && collaborator.status !== status) {
      this.store.updateCollaborator(userId, {
        status,
        lastActive: Date.now(),
      });
    }
  }

  private startActivityCleanup(): void {
    // Run cleanup every second
    this.activityTimeout = setInterval(() => {
      const now = Date.now();
      let changed = false;

      // Remove expired activities
      for (const [key, activity] of this.activities.entries()) {
        if (now > activity.expiresAt) {
          this.activities.delete(key);
          changed = true;

          // Update collaborator status to idle if no active indicators
          const userActivities = Array.from(this.activities.values()).filter(
            (a) => a.userId === activity.userId,
          );
          if (userActivities.length === 0) {
            this.updateCollaboratorStatus(activity.userId, 'idle');
          }
        }
      }

      if (changed) {
        logger.debug('Activity cleanup completed');
      }
    }, 1000);
  }

  getRecentActivity(userId: string): ActivityIndicator | undefined {
    // Get the most recent activity for this user
    const userActivities = Array.from(this.activities.values())
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp);

    return userActivities[0];
  }

  getActivityIndicator(userId: string): string {
    const activity = this.getRecentActivity(userId);
    if (!activity) return '';

    switch (activity.type) {
      case 'typing':
        return '✍️ ';
      case 'cursor-move':
        return '📍 ';
      case 'file-switch':
        return '📄 ';
      default:
        return '';
    }
  }

  dispose(): void {
    if (this.activityTimeout) {
      clearInterval(this.activityTimeout);
    }
    this.activities.clear();
  }
}

export const createActivityTracker = (store: StateStore): ActivityTracker => {
  return new ActivityTracker(store);
};
