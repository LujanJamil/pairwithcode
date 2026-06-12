import * as vscode from 'vscode';
import { StateStore } from '../../../state/store';
import { SocketClient } from '../../../socket/client';
import { logger } from '../../../utils/logger';
import { buildApiUrl } from '../../../utils/api-config';

interface AnalyticsMetrics {
  sessionDuration: number;
  editCount: number;
  fileChanges: number;
  conflictCount: number;
  collaboratorCount: number;
  messagesCount: number;
  activeTime: number;
  idleTime: number;
  editsPerMinute: number;
  collaborators: { name: string; edits: number; duration: number }[];
  fileActivity: { file: string; edits: number }[];
  timeline: { time: string; edits: number }[];
}

export class AnalyticsPanel {
  private panel: vscode.WebviewPanel | undefined;
  private metrics: AnalyticsMetrics | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(
    private context: vscode.ExtensionContext,
    private store: StateStore,
    private socket: SocketClient
  ) {
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.socket.onEvent('analytics:update' as any, (data: AnalyticsMetrics) => {
      this.metrics = data;
      this.updatePanel();
    });
  }

  async show() {
    const column = vscode.ViewColumn.Two;
    const title = 'Session Analytics';

    if (this.panel) {
      this.panel.reveal(column);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'analyticsPanel',
        title,
        column,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
        if (this.refreshInterval) clearInterval(this.refreshInterval);
      });

      this.panel.webview.onDidReceiveMessage((message) => {
        this.handleMessage(message);
      });
    }

    await this.refreshMetrics();
    this.refreshInterval = setInterval(() => this.refreshMetrics(), 2000);
    this.updatePanel();
  }

  private async refreshMetrics() {
    try {
      const room = this.store.getCurrentRoom();
      if (!room) return;

      const response = await fetch(
        buildApiUrl(`/api/analytics/${room}`),
        {
          headers: {
            'Authorization': `Bearer ${this.store.getUserToken()}`,
          },
        }
      );

      if (response.ok) {
        this.metrics = await response.json();
      }
    } catch (error) {
      logger.error('Failed to refresh analytics', error);
    }
  }

  private updatePanel() {
    if (!this.panel) return;
    this.panel.webview.html = this.getWebviewContent();
  }

  private getWebviewContent(): string {
    if (!this.metrics) {
      return `<div style="padding: 20px; text-align: center;"><p>No active session</p></div>`;
    }

    const { metrics } = this;
    const duration = Math.floor(metrics.sessionDuration / 1000 / 60);
    const editsPerMin = (metrics.editCount / Math.max(duration, 1)).toFixed(1);

    return `<!DOCTYPE html><html><head><script src="https://cdn.jsdelivr.net/npm/chart.js"></script><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px}.stat{background:var(--vscode-editor-background);padding:15px;border-radius:5px}.stat-label{color:var(--vscode-descriptionForeground);font-size:12px}.stat-value{font-size:28px;font-weight:700;color:var(--vscode-editor-foreground)}.chart-container{position:relative;height:300px;margin-bottom:20px;background:var(--vscode-editor-background);padding:15px;border-radius:5px}.collaborator{padding:10px;background:var(--vscode-editor-background);margin-bottom:8px;border-radius:4px;display:flex;justify-content:space-between}button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:8px 15px;border-radius:4px;cursor:pointer;margin-right:5px}</style></head><body><h2>Session Analytics</h2><div class="grid"><div class="stat"><div class="stat-label">Duration</div><div class="stat-value">${duration}m</div></div><div class="stat"><div class="stat-label">Total Edits</div><div class="stat-value">${metrics.editCount}</div></div><div class="stat"><div class="stat-label">Edits/Min</div><div class="stat-value">${editsPerMin}</div></div><div class="stat"><div class="stat-label">Collaborators</div><div class="stat-value">${metrics.collaboratorCount}</div></div><div class="stat"><div class="stat-label">Conflicts</div><div class="stat-value">${metrics.conflictCount}</div></div><div class="stat"><div class="stat-label">Messages</div><div class="stat-value">${metrics.messagesCount}</div></div></div><div class="chart-container"><canvas id="editChart"></canvas></div><div class="chart-container"><canvas id="fileChart"></canvas></div><h3>Collaborators</h3>${metrics.collaborators.map(c => `<div class="collaborator"><span>${c.name}</span><span>${c.edits} edits</span></div>`).join('')}<button onclick="sendCommand('export-csv')">Export CSV</button><button onclick="sendCommand('export-pdf')">Export PDF</button><script>function sendCommand(cmd){vscode.postMessage({command:cmd})}const editCtx=document.getElementById('editChart').getContext('2d');new Chart(editCtx,{type:'line',data:{labels:${JSON.stringify(metrics.timeline.map(t => t.time))},datasets:[{label:'Edits Over Time',data:${JSON.stringify(metrics.timeline.map(t => t.edits))},borderColor:'#007ACC',backgroundColor:'rgba(0,122,204,0.1)',tension:0.4}]},options:{responsive:true,maintainAspectRatio:false}});const fileCtx=document.getElementById('fileChart').getContext('2d');new Chart(fileCtx,{type:'bar',data:{labels:${JSON.stringify(metrics.fileActivity.map(f => f.file.split('/').pop()))},datasets:[{label:'Edits per File',data:${JSON.stringify(metrics.fileActivity.map(f => f.edits))},backgroundColor:'#007ACC'}]},options:{responsive:true,maintainAspectRatio:false}})</script></body></html>`;
  }

  private handleMessage(message: any) {
    if (message.command === 'export-csv') this.exportCSV();
  }

  private exportCSV() {
    if (!this.metrics) return;
    const csv = [['Metric', 'Value'], ['Duration (min)', Math.floor(this.metrics.sessionDuration / 1000 / 60)], ['Total Edits', this.metrics.editCount], ['Conflicts', this.metrics.conflictCount], ['Collaborators', this.metrics.collaboratorCount], ...this.metrics.collaborators.map(c => [c.name, c.edits])].map(row => row.join(',')).join('\n');
    const uri = vscode.Uri.parse(`untitled:analytics-${Date.now()}.csv`);
    vscode.workspace.openTextDocument(uri).then(doc => {
      vscode.window.showTextDocument(doc).then(editor => {
        editor.edit(edit => edit.insert(new vscode.Position(0, 0), csv));
      });
    });
  }
}

export function createAnalyticsPanel(
  context: vscode.ExtensionContext,
  store: StateStore,
  socket: SocketClient
): AnalyticsPanel {
  return new AnalyticsPanel(context, store, socket);
}
