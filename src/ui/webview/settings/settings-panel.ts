import * as vscode from 'vscode';
import { logger } from '../../../utils/logger';

export class SettingsPanel {
  private static currentPanel: SettingsPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;
    this._panel.webview.html = this.getWebviewContent();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      null,
      this._disposables
    );
  }

  public static createOrShow() {
    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel._panel.reveal(vscode.ViewColumn.Two);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'pairSettings',
      '⚙️ Pair Settings',
      vscode.ViewColumn.Two,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    SettingsPanel.currentPanel = new SettingsPanel(panel);
  }

  private handleWebviewMessage(message: any) {
    switch (message.command) {
      case 'updateSetting':
        this.updateVSCodeSetting(message.key, message.value);
        break;
      case 'testConnection':
        this.testServerConnection();
        break;
    }
  }

  private updateVSCodeSetting(key: string, value: any) {
    vscode.workspace
      .getConfiguration('pairWithCode')
      .update(key, value, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Setting updated: ${key}`);
  }

  private async testServerConnection() {
    const url = vscode.workspace
      .getConfiguration('pairWithCode')
      .get('serverUrl');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${url}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const ok = response.ok ? '✅ Connected' : '❌ Connection failed';
      this._panel.webview.postMessage({
        command: 'connectionStatus',
        status: ok
      });
    } catch (error) {
      this._panel.webview.postMessage({
        command: 'connectionStatus',
        status: '❌ Connection failed'
      });
    }
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    :root { --color-primary: #0078d4; }
    body { font-family: 'Segoe UI', sans-serif; padding: 20px; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
    .setting-group { margin-bottom: 24px; }
    label { display: block; margin-bottom: 8px; font-weight: 600; }
    input, select { width: 100%; padding: 8px; border: 1px solid var(--vscode-input-border); border-radius: 4px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); }
    button { padding: 10px 16px; background-color: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 12px; }
    button:hover { opacity: 0.9; }
    .status { margin-top: 8px; padding: 8px; border-radius: 4px; background-color: var(--vscode-notifications-background); }
  </style>
</head>
<body>
  <h2>⚙️ Pair With Code Settings</h2>

  <div class="setting-group">
    <label>Server URL</label>
    <input type="text" id="serverUrl" placeholder="https://pairwithcode.onrender.com" />
    <button onclick="testConnection()">Test Connection</button>
    <div id="connectionStatus" class="status" style="display:none;"></div>
  </div>

  <div class="setting-group">
    <label>Your Display Name</label>
    <input type="text" id="userName" placeholder="Your name" />
    <button onclick="updateSetting('userName')">Save</button>
  </div>

  <div class="setting-group">
    <label>Theme</label>
    <select id="theme" onchange="updateSetting('theme')">
      <option value="auto">Auto (System)</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </div>

  <div class="setting-group">
    <label><input type="checkbox" id="autoJoin" onchange="updateSetting('autoJoin')" /> Auto-join last room on startup</label>
    <label><input type="checkbox" id="followMode" onchange="updateSetting('followMode')" /> Follow partner's file switches</label>
    <label><input type="checkbox" id="autoReconnect" onchange="updateSetting('autoReconnect')" /> Auto-reconnect on connection loss</label>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function updateSetting(key) {
      const el = document.getElementById(key);
      const value = el.type === 'checkbox' ? el.checked : el.value;
      vscode.postMessage({ command: 'updateSetting', key, value });
    }

    function testConnection() {
      vscode.postMessage({ command: 'testConnection' });
    }

    window.addEventListener('message', (event) => {
      if (event.data.command === 'connectionStatus') {
        const el = document.getElementById('connectionStatus');
        el.textContent = event.data.status;
        el.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;
  }

  public dispose() {
    SettingsPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }
}

export const createSettingsPanel = () => {
  SettingsPanel.createOrShow();
};
