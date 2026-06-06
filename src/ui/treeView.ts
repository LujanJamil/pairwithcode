import * as vscode from 'vscode';
import { CollaboratorStatus } from '../models/types';
import { StateStore } from '../state/store';
import { logger } from '../utils/logger';

export class CollaboratorTreeItem extends vscode.TreeItem {
  constructor(
    public readonly collaborator: CollaboratorStatus,
    command?: vscode.Command,
  ) {
    const label = collaborator.userName;
    const description = collaborator.status === 'typing' ? '✍️ typing' : collaborator.status === 'idle' ? 'idle' : 'active';
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = description;
    this.contextValue = 'collaborator';
    this.command = command;

    // Set icon based on status
    const iconColor = this.getStatusColor(collaborator.status);
    this.iconPath = new vscode.ThemeIcon('account', new vscode.ThemeColor(iconColor));

    // Set tooltip with file and cursor info
    const details = [];
    if (collaborator.currentFile) {
      details.push(`File: ${collaborator.currentFile}`);
    }
    if (collaborator.cursorLine !== undefined) {
      details.push(`Line: ${collaborator.cursorLine + 1}`);
    }
    if (collaborator.lastActive) {
      const lastActiveMs = Date.now() - collaborator.lastActive;
      const seconds = Math.floor(lastActiveMs / 1000);
      if (seconds < 60) {
        details.push(`Last active: ${seconds}s ago`);
      }
    }
    this.tooltip = details.length > 0 ? details.join('\n') : `${collaborator.userName} (${collaborator.status})`;
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'typing':
        return 'debugConsole.errorForeground';
      case 'active':
        return 'gitDecoration.addedResourceForeground';
      case 'idle':
        return 'textLink.foreground';
      case 'away':
        return 'textBlockQuote.border';
      default:
        return 'foreground';
    }
  }
}

export class PresenceProvider implements vscode.TreeDataProvider<CollaboratorTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CollaboratorTreeItem | undefined | void> = new vscode.EventEmitter<
    CollaboratorTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<CollaboratorTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private store: StateStore) {
    // Listen to store changes
    this.store.on('collaborator-added', () => this.refresh());
    this.store.on('collaborator-removed', () => this.refresh());
    this.store.on('collaborator-updated', () => this.refresh());
  }

  refresh(): void {
    logger.debug('Refreshing presence tree view');
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CollaboratorTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CollaboratorTreeItem): Thenable<CollaboratorTreeItem[]> {
    // No hierarchy yet - just show all collaborators
    if (element) {
      return Promise.resolve([]);
    }

    const collaborators = this.store.getCollaborators();
    const items = collaborators.map((collab) => new CollaboratorTreeItem(collab));

    return Promise.resolve(items);
  }
}

export const createPresenceProvider = (store: StateStore): PresenceProvider => {
  return new PresenceProvider(store);
};
