import * as vscode from 'vscode';
import { StateStore } from '../state/store';
import { Persistence } from '../state/persistence';
import { logger } from '../utils/logger';

export class UICommands {
  constructor(
    private store: StateStore,
    private persistence: Persistence,
  ) {}

  registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('pairtool.recentRooms', this.showRecentRooms.bind(this)),
      vscode.commands.registerCommand('pairtool.openSettings', this.openSettings.bind(this)),
    );
  }

  private async showRecentRooms(): Promise<string | undefined> {
    const history = this.store.getSessionHistory();

    if (history.length === 0) {
      vscode.window.showInformationMessage('No recent rooms. Create a new session to start collaborating.');
      return undefined;
    }

    const items = history.map((session) => ({
      label: session.roomId,
      description: `${session.participants.length} participant(s) • ${new Date(session.lastAccessedAt).toLocaleDateString()}`,
      roomId: session.roomId,
      isFavorite: session.isFavorite,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a room to join',
      matchOnDescription: true,
    });

    if (selected) {
      logger.debug('Selected recent room', { roomId: selected.roomId });
      return selected.roomId;
    }

    return undefined;
  }

  private async openSettings(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'pairWithCode');
    logger.debug('Opened settings');
  }

  async toggleFavoriteRoom(roomId: string, isFavorite: boolean): Promise<void> {
    const history = this.store.getSessionHistory();
    const session = history.find((s) => s.roomId === roomId);

    if (session) {
      session.isFavorite = !isFavorite;
      await this.persistence.saveRoomHistory(history);
      logger.debug('Room favorite status updated', { roomId, isFavorite: !isFavorite });
    }
  }

  async clearRoomHistory(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      'Clear all room history?',
      'Yes',
      'Cancel',
    );

    if (confirm === 'Yes') {
      await this.persistence.saveRoomHistory([]);
      this.store.clear();
      logger.info('Room history cleared');
      vscode.window.showInformationMessage('Room history cleared');
    }
  }
}

export const createUICommands = (store: StateStore, persistence: Persistence): UICommands => {
  return new UICommands(store, persistence);
};
