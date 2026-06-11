import * as vscode from 'vscode';
import { StateStore } from '../../../state/store';
import { logger } from '../../../utils/logger';

export class PresencePanel {
  private static currentPanel: PresencePanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private store: StateStore
  ) {
    this._panel = panel;
    this._panel.webview.html = this.getWebviewContent();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      null,
      this._disposables
    );
  }

  private handleWebviewMessage(message: any) {
    if (message.command === 'followUser') {
      this.store.setFollowingUser(message.userId);
    } else if (message.command === 'unfollowUser') {
      this.store.clearFollowingUser();
    } else if (message.command === 'copyRoomId') {
      const room = this.store.getCurrentRoom();
      if (room) {
        vscode.env.clipboard.writeText(room);
        vscode.window.showInformationMessage(`Room ID '${room}' copied!`);
      }
    }
  }

  public static createOrShow(store: StateStore) {
    if (PresencePanel.currentPanel) {
      PresencePanel.currentPanel._panel.reveal(vscode.ViewColumn.Three);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'pairPresence',
      '👥 Collaborators',
      vscode.ViewColumn.Three,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    PresencePanel.currentPanel = new PresencePanel(panel, store);
  }

  public refreshUI = () => {
    const collaborators = this.store.getCollaborators();
    const room = this.store.getCurrentRoom();

    this._panel.webview.postMessage({
      command: 'update',
      collaborators: collaborators.map((c) => ({
        userId: c.userId,
        userName: c.userName,
        status: c.status,
        currentFile: c.currentFile,
        cursorLine: c.cursorLine,
        lastActive: c.lastActive
      })),
      roomId: room
    });
  };

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', sans-serif; padding: 16px; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
    .collaborator { display: flex; align-items: center; padding: 12px; margin-bottom: 8px; border-radius: 6px; background-color: var(--vscode-sideBar-background); border: 1px solid var(--vscode-sideBarSectionHeader-border); cursor: pointer; transition: all 0.2s; }
    .collaborator:hover { background-color: var(--vscode-list-hoverBackground); }
    .avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; margin-right: 12px; }
    .info { flex: 1; }
    .name { font-weight: 600; margin-bottom: 4px; }
    .status { font-size: 12px; opacity: 0.7; }
    .room-info { padding: 12px; background-color: var(--vscode-list-activeSelectionBackground); border-radius: 6px; margin-bottom: 16px; text-align: center; }
    button { padding: 8px 12px; background-color: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 8px; }
    button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <h3>👥 Active Collaborators</h3>

  <div class="room-info" id="roomInfo" style="display:none;">
    <strong>Room:</strong> <code id="roomCode"></code>
    <button onclick="copyRoom()">Copy Room ID</button>
  </div>

  <div id="collaboratorsList"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

    function getColor(userId) {
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      }
      return colors[Math.abs(hash) % colors.length];
    }

    function copyRoom() {
      vscode.postMessage({ command: 'copyRoomId' });
    }

    function renderCollaborators(data) {
      const container = document.getElementById('collaboratorsList');
      const roomInfo = document.getElementById('roomInfo');
      const roomCode = document.getElementById('roomCode');

      if (data.roomId) {
        roomInfo.style.display = 'block';
        roomCode.textContent = data.roomId;
      }

      container.innerHTML = data.collaborators
        .map((c) => \`
          <div class="collaborator" onclick="follow('\${c.userId}')">
            <div class="avatar" style="background-color: \${getColor(c.userId)}">
              \${c.userName.charAt(0).toUpperCase()}
            </div>
            <div class="info">
              <div class="name">\${c.userName}</div>
              <div class="status">
                \${c.status === 'typing' ? '✍️ Typing' : c.status === 'idle' ? '💤 Idle' : '✨ Active'}
                \${c.currentFile ? ' • ' + c.currentFile.split('/').pop() : ''}
              </div>
            </div>
          </div>
        \`)
        .join('');
    }

    function follow(userId) {
      vscode.postMessage({ command: 'followUser', userId });
    }

    window.addEventListener('message', (event) => {
      if (event.data.command === 'update') {
        renderCollaborators(event.data);
      }
    });
  </script>
</body>
</html>`;
  }

  public dispose() {
    PresencePanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }
}

export const createPresencePanel = (store: StateStore) => {
  PresencePanel.createOrShow(store);
};
