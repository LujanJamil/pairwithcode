import { VectorClock, ContentChange } from '../models/types';
import { logger } from '../utils/logger';

export class ConflictResolver {
  private changeHistory: ContentChange[] = [];
  private maxHistorySize = 1000;

  addChange(change: ContentChange): void {
    this.changeHistory.push(change);
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory.shift();
    }
  }

  detectConflict(localChange: ContentChange, remoteChange: ContentChange): boolean {
    // Check if edits overlap in document position
    const localEnd = localChange.offset + localChange.length;
    const remoteEnd = remoteChange.offset + remoteChange.length;

    // Overlapping ranges indicate potential conflict
    const overlap = !(localEnd <= remoteChange.offset || remoteEnd <= localChange.offset);

    if (overlap) {
      logger.debug('Conflict detected', {
        localOffset: localChange.offset,
        remoteOffset: remoteChange.offset,
      });
      return true;
    }

    return false;
  }

  resolveConflict(
    localChange: ContentChange,
    remoteChange: ContentChange,
  ): ContentChange {
    // Last-Write-Wins (LWW) strategy with timestamp
    // Remote changes that are more recent take precedence
    if (remoteChange.timestamp > localChange.timestamp) {
      logger.debug('Conflict resolved: remote wins (newer timestamp)');
      return remoteChange;
    }

    if (localChange.timestamp > remoteChange.timestamp) {
      logger.debug('Conflict resolved: local wins (newer timestamp)');
      return localChange;
    }

    // If timestamps are equal, use vector clock comparison
    const clockComparison = this.compareVectorClocks(localChange.version, remoteChange.version);

    if (clockComparison > 0) {
      logger.debug('Conflict resolved: local wins (vector clock)');
      return localChange;
    } else if (clockComparison < 0) {
      logger.debug('Conflict resolved: remote wins (vector clock)');
      return remoteChange;
    }

    // Fallback: use user ID for deterministic resolution
    if (localChange.userId > remoteChange.userId) {
      logger.debug('Conflict resolved: local wins (user ID)');
      return localChange;
    }

    logger.debug('Conflict resolved: remote wins (default)');
    return remoteChange;
  }

  private compareVectorClocks(clock1: VectorClock, clock2: VectorClock): number {
    let hasGreater = false;
    let hasLess = false;

    // Get all unique user IDs from both clocks
    const allUsers = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);

    for (const userId of allUsers) {
      const v1 = clock1[userId] || 0;
      const v2 = clock2[userId] || 0;

      if (v1 > v2) {
        hasGreater = true;
      }
      if (v1 < v2) {
        hasLess = true;
      }
    }

    // Determine causality
    if (hasGreater && !hasLess) return 1; // clock1 > clock2
    if (hasLess && !hasGreater) return -1; // clock1 < clock2
    return 0; // concurrent or equal
  }

  isValidChange(change: ContentChange, expectedHash?: string): boolean {
    // Validate change structure
    if (!change.userId || change.offset === undefined || change.timestamp === undefined) {
      logger.warn('Invalid change: missing required fields');
      return false;
    }

    // If expected hash provided, could validate document state here
    if (expectedHash) {
      logger.debug('Change hash validation skipped (hash validation pending)');
    }

    return true;
  }

  transformChange(localChange: ContentChange, remoteChange: ContentChange): ContentChange {
    // Operational Transform: adjust local change based on remote change
    // This is a simplified version - full OT is complex

    if (remoteChange.offset < localChange.offset) {
      // Remote change is before local, adjust local offset
      if (remoteChange.text === '') {
        // Remote is a delete
        const adjustedOffset = Math.max(
          remoteChange.offset,
          localChange.offset - remoteChange.length,
        );
        return {
          ...localChange,
          offset: adjustedOffset,
        };
      } else {
        // Remote is an insert
        return {
          ...localChange,
          offset: localChange.offset + remoteChange.text.length,
        };
      }
    }

    // No transformation needed
    return localChange;
  }

  getChangeHistory(): ContentChange[] {
    return [...this.changeHistory];
  }

  clearHistory(): void {
    this.changeHistory = [];
    logger.debug('Conflict history cleared');
  }
}

export const createConflictResolver = (): ConflictResolver => {
  return new ConflictResolver();
};
