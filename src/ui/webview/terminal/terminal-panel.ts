import * as vscode from 'vscode';
import { StateStore } from '../../../state/store';
import { SocketClient } from '../../../socket/client';
import { buildApiUrl } from '../../../utils/api-config';

export class TerminalPanel {
  private panel: vscode.WebviewPanel | undefined;
  private isConnected = false;

  constructor(
    private store: StateStore,
    private socket: SocketClient
  ) {}

  async show() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Two);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'terminalPanel',
        'Shared Terminal',
        vscode.ViewColumn.Two,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      this.panel.onDidDispose(() => { this.panel = undefined; });
      this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
    }
    this.updatePanel();
  }

  private updatePanel() {
    if (!this.panel) return;
    this.panel.webview.html = `
      <html><body style="padding:20px;font-family:var(--vscode-font-family)">
      <h2>Shared Terminal</h2>
      <p>Status: ${this.isConnected ? '✅ Connected' : '⏸ Disconnected'}</p>
      <button onclick="sendCmd('${this.isConnected ? 'disconnect' : 'connect'}')">
        ${this.isConnected ? 'Disconnect' : 'Connect Terminal'}
      </button>
      <div style="margin-top:15px;padding:10px;background:var(--vscode-editor-background);border-left:3px solid #007ACC;font-size:12px;color:var(--vscode-descriptionForeground)">
        📌 <strong>Beta Feature:</strong> Share terminal output with collaborators. Both users can type and see results in real-time.
      </div>
      <script>function sendCmd(cmd){vscode.postMessage({command:cmd})}</script>
      </body></html>
    `;
  }

  private async handleMessage(msg: any) {
    const room = this.store.getCurrentRoom();
    const user = this.store.getUser();
    const token = this.store.getUserToken();

    if (msg.command === 'connect') {
      try {
        const response = await fetch(buildApiUrl('/api/terminal/connect'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ sessionId: room, userId: user?.id, shell: 'bash' })
        });
        if (response.ok) {
          this.isConnected = true;
          vscode.window.showInformationMessage('✅ Terminal connected');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Connection error: ${error}`);
      }
    } else if (msg.command === 'disconnect') {
      try {
        await fetch(buildApiUrl('/api/terminal/disconnect'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ ptyId: 'pty-1', userId: user?.id })
        });
        this.isConnected = false;
        vscode.window.showInformationMessage('Terminal disconnected');
      } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error}`);
      }
    }
    this.updatePanel();
  }
}

export function createTerminalPanel(store: StateStore, socket: SocketClient): TerminalPanel {
  return new TerminalPanel(store, socket);
}
