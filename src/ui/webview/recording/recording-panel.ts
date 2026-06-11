import * as vscode from 'vscode';
import { StateStore } from '../../../state/store';
import { SocketClient } from '../../../socket/client';
import { buildApiUrl } from '../../../utils/api-config';

export class RecordingPanel {
  private panel: vscode.WebviewPanel | undefined;
  private isRecording = false;
  private recordingId: string | null = null;
  private startTime: number | null = null;

  constructor(
    private store: StateStore,
    private socket: SocketClient
  ) {}

  async show() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Two);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'recordingPanel',
        'Session Recording',
        vscode.ViewColumn.Two,
        { enableScripts: true, retainContextWhenHidden: true }
      );

      this.panel.onDidDispose(() => { this.panel = undefined; });
      this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
    }

    this.updatePanel();
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  private updatePanel() {
    if (!this.panel) return;

    const elapsed = this.isRecording && this.startTime ? Date.now() - this.startTime : 0;
    const status = this.isRecording ? `Recording... ${this.formatTime(elapsed)}` : 'Ready to Record';
    const buttonText = this.isRecording ? '⏹ Stop Recording' : '⏹ Start Recording';
    const buttonClass = this.isRecording ? 'recording' : '';

    this.panel.webview.html = `
      <!DOCTYPE html>
      <html><head><style>
      body{padding:20px;font-family:var(--vscode-font-family)}
      .status-box{background:var(--vscode-editor-background);padding:15px;border-radius:5px;margin-bottom:20px;text-align:center}
      .status-label{color:var(--vscode-descriptionForeground);font-size:12px;margin-bottom:5px}
      .status-value{font-size:24px;font-weight:bold;color:var(--vscode-editor-foreground)}
      .button{display:block;width:100%;padding:10px;background:var(--vscode-button-background);border:none;border-radius:4px;cursor:pointer;font-size:14px;margin-bottom:10px}
      .button.recording{background:#f48771}
      .info{font-size:12px;color:var(--vscode-descriptionForeground);margin-top:15px;padding:10px;background:var(--vscode-editor-background);border-left:3px solid #007ACC}
      </style></head>
      <body>
      <h2>Session Recording</h2>
      <div class="status-box">
        <div class="status-label">Status</div>
        <div class="status-value">${status}</div>
      </div>
      <button class="button ${buttonClass}" onclick="sendCmd('${this.isRecording ? 'stop' : 'start'}')">
        ${buttonText}
      </button>
      <button class="button" onclick="sendCmd('export')" ${this.isRecording ? 'disabled' : ''}>
        📥 Export Video
      </button>
      <div class="info">Click Start to record edits, chat, and cursor movements. Export saves to MP4.</div>
      <script>function sendCmd(cmd){vscode.postMessage({command:cmd})}</script>
      </body></html>
    `;
  }

  private async handleMessage(msg: any) {
    const room = this.store.getCurrentRoom();
    const user = this.store.getUser();
    const token = this.store.getUserToken();

    if (!room) {
      vscode.window.showErrorMessage('No active session');
      return;
    }

    try {
      if (msg.command === 'start') {
        const response = await fetch(buildApiUrl('/api/recording/start'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ sessionId: room, userId: user?.id })
        });

        if (response.ok) {
          const data = await response.json();
          this.recordingId = data.recordingId;
          this.startTime = Date.now();
          this.isRecording = true;
          this.socket.emitEvent('recording:started' as any, { roomId: room, recordingId: this.recordingId });
          vscode.window.showInformationMessage('🔴 Recording started');
        }
      } else if (msg.command === 'stop' && this.recordingId) {
        const response = await fetch(buildApiUrl('/api/recording/stop'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ recordingId: this.recordingId, userId: user?.id })
        });

        if (response.ok) {
          this.isRecording = false;
          this.socket.emitEvent('recording:stopped' as any, { roomId: room, recordingId: this.recordingId });
          vscode.window.showInformationMessage('✅ Recording stopped');
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${error}`);
    }

    this.updatePanel();
  }
}

export function createRecordingPanel(store: StateStore, socket: SocketClient): RecordingPanel {
  return new RecordingPanel(store, socket);
}
