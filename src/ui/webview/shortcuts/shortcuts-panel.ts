import * as vscode from 'vscode';
import { logger } from '../../../utils/logger';

export class ShortcutsPanel {
  private static currentPanel: ShortcutsPanel | undefined;
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
    if (ShortcutsPanel.currentPanel) {
      ShortcutsPanel.currentPanel._panel.reveal(vscode.ViewColumn.Two);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'pairShortcuts',
      '⌨️ Shortcuts',
      vscode.ViewColumn.Two,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    ShortcutsPanel.currentPanel = new ShortcutsPanel(panel);
  }

  private handleWebviewMessage(message: any) {
    if (message.command === 'openKeybindings') {
      vscode.commands.executeCommand('workbench.action.openGlobalKeybindings');
    }
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', sans-serif; padding: 20px; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border); }
    th { background-color: var(--vscode-list-activeSelectionBackground); font-weight: 600; }
    code { background-color: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 3px; font-family: 'Cascadia Code', monospace; }
    .group { margin-bottom: 24px; }
    button { padding: 10px 16px; background-color: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 16px; }
    button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <h2>⌨️ Pair With Code Shortcuts</h2>

  <div class="group">
    <h3>Collaboration</h3>
    <table>
      <tr><th>Command</th><th>Shortcut</th></tr>
      <tr><td>Copy Room ID</td><td><code>Ctrl+Shift+C</code></td></tr>
      <tr><td>Stop Sharing</td><td><code>Ctrl+Shift+X</code></td></tr>
      <tr><td>Open Chat</td><td><code>Ctrl+Shift+M</code></td></tr>
      <tr><td>Show Collaborators</td><td><code>Ctrl+Shift+P</code></td></tr>
    </table>
  </div>

  <div class="group">
    <h3>Settings</h3>
    <table>
      <tr><th>Command</th><th>Shortcut</th></tr>
      <tr><td>Open Settings</td><td><code>Ctrl+Shift+S</code></td></tr>
      <tr><td>Toggle Follow Mode</td><td><code>Ctrl+Shift+F</code></td></tr>
      <tr><td>Recent Rooms</td><td><code>Ctrl+Shift+R</code></td></tr>
    </table>
  </div>

  <button onclick="editKeybindings()">Edit Keybindings</button>

  <script>
    const vscode = acquireVsCodeApi();

    function editKeybindings() {
      vscode.postMessage({ command: 'openKeybindings' });
    }
  </script>
</body>
</html>`;
  }

  public dispose() {
    ShortcutsPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      this._disposables.pop()?.dispose();
    }
  }
}

export const createShortcutsPanel = () => {
  ShortcutsPanel.createOrShow();
};
