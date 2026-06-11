import * as vscode from 'vscode';

export class ServerWizardPanel {
  private panel: vscode.WebviewPanel | undefined;

  async show() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'wizardPanel',
        'Self-Hosted Server Setup',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
      );
      this.panel.onDidDispose(() => { this.panel = undefined; });
    }
    if (this.panel) {
      this.panel.webview.html = `
        <html><body style="padding:20px;font-family:var(--vscode-font-family)">
        <h2>Self-Hosted Server Setup</h2>
        <ol>
          <li><strong>Option 1: Docker</strong><br>Run: <code>docker-compose up</code></li>
          <li><strong>Option 2: AWS/GCP/Azure</strong><br>Use cloud templates in deployment folder</li>
          <li><strong>Configure Server URL</strong><br>Settings > Pair With Code > Server URL</li>
          <li><strong>Start Pairing!</strong><br>Create or join a room</li>
        </ol>
        <p><strong>Docs:</strong> See QUICK_START.md for detailed instructions</p>
        </body></html>
      `;
    }
  }
}

export function createServerWizardPanel(): ServerWizardPanel {
  const wizard = new ServerWizardPanel();
  wizard.show();
  return wizard;
}
