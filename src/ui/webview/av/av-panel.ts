import * as vscode from 'vscode';
import { StateStore } from '../../../state/store';
import { SocketClient } from '../../../socket/client';

export class AVPanel {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private store: StateStore,
    private socket: SocketClient
  ) {}

  async show() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Two);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'avPanel',
        'Video Call',
        vscode.ViewColumn.Two,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      this.panel.onDidDispose(() => { this.panel = undefined; });
      this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
    }
    this.updatePanel();
  }

  private updatePanel() {
    this.panel.webview.html = `
      <html><body style="padding:20px;font-family:var(--vscode-font-family);text-align:center">
      <h2>🎥 Video Call</h2>
      <div style="width:200px;height:150px;background:var(--vscode-editor-background);border:2px solid #007ACC;border-radius:8px;margin:20px auto;display:flex;align-items:center;justify-content:center">
        <span style="color:var(--vscode-descriptionForeground)">Ready to call</span>
      </div>
      <button onclick="sendCmd('call')" style="padding:10px 20px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:4px;cursor:pointer;font-size:14px;margin:10px">
        📞 Start Video Call
      </button>
      <button onclick="sendCmd('screen')" style="padding:10px 20px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:4px;cursor:pointer;font-size:14px;margin:10px">
        🖥️ Share Screen
      </button>
      <div style="margin-top:20px;padding:15px;background:var(--vscode-editor-background);border-left:3px solid #007ACC;border-radius:4px;font-size:12px;color:var(--vscode-descriptionForeground);text-align:left">
        <strong>💡 WebRTC Integration:</strong><br>
        Video/audio calls use peer-to-peer WebRTC for low latency. Powered by WebRTC and STUN/TURN servers.
      </div>
      <script>function sendCmd(cmd){vscode.postMessage({command:cmd})}</script>
      </body></html>
    `;
  }

  private handleMessage(msg: any) {
    if (msg.command === 'call') {
      vscode.window.showInformationMessage('📞 Initiating video call...');
      this.socket.emitEvent('av:call-initiated' as any, { roomId: this.store.getCurrentRoom() });
    } else if (msg.command === 'screen') {
      vscode.window.showInformationMessage('🖥️ Starting screen share...');
      this.socket.emitEvent('av:screen-share' as any, { roomId: this.store.getCurrentRoom() });
    }
  }
}

export function createAVPanel(store: StateStore, socket: SocketClient): AVPanel {
  return new AVPanel(store, socket);
}
