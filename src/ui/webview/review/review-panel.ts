import * as vscode from 'vscode';
import { StateStore } from '../../../state/store';
import { SocketClient } from '../../../socket/client';
import { logger } from '../../../utils/logger';
import { buildApiUrl } from '../../../utils/api-config';

interface CodeComment {
  id: string;
  line: number;
  author: string;
  content: string;
  type: 'suggestion' | 'question' | 'issue' | 'blocker';
  severity: 'info' | 'warning' | 'error';
  status: 'open' | 'resolved';
  timestamp: number;
  replies?: CodeComment[];
}

export class CodeReviewPanel {
  private panel: vscode.WebviewPanel | undefined;
  private comments: Map<string, CodeComment[]> = new Map();
  private activeEditor: vscode.TextEditor | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private store: StateStore,
    private socket: SocketClient
  ) {
    this.setupEditorListeners();
    this.setupSocketListeners();
  }

  private setupEditorListeners() {
    vscode.window.onDidChangeActiveTextEditor(editor => {
      this.activeEditor = editor;
      this.refreshComments();
    });
  }

  private setupSocketListeners() {
    this.socket.onEvent('code-review:comment-added' as any, (data: any) => {
      this.handleNewComment(data);
    });
    this.socket.onEvent('code-review:comment-resolved' as any, (data: any) => {
      this.handleCommentResolved(data);
    });
  }

  async show() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Two);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'codeReviewPanel',
        'Code Review',
        vscode.ViewColumn.Two,
        { enableScripts: true, retainContextWhenHidden: true }
      );

      this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
      this.panel.onDidDispose(() => { this.panel = undefined; });
    }

    this.refreshComments();
  }

  private async refreshComments() {
    if (!this.activeEditor) return;

    const filePath = this.activeEditor.document.fileName;
    const room = this.store.getCurrentRoom();
    if (!room) return;

    try {
      const response = await fetch(
        buildApiUrl(`/api/code-review/${room}/${encodeURIComponent(filePath)}`),
        { headers: { 'Authorization': `Bearer ${this.store.getUserToken()}` } }
      );

      if (response.ok) {
        const data = await response.json();
        this.comments.set(filePath, data.comments);
        this.renderComments(data.comments);
        this.updateEditorDecorations(data.comments);
      }
    } catch (error) {
      logger.error('Failed to fetch comments', error);
    }
  }

  private renderComments(comments: CodeComment[]) {
    if (!this.panel) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: var(--vscode-font-family); padding: 20px; }
          .comment { padding: 12px; margin-bottom: 10px; border-left: 3px solid #007ACC; background: var(--vscode-editor-background); }
          .comment.blocker { border-left-color: #f48771; }
          .comment.issue { border-left-color: #dcdcaa; }
          .comment.question { border-left-color: #569cd6; }
          .comment.suggestion { border-left-color: #4ec9b0; }
          .comment-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .comment-author { font-weight: bold; font-size: 12px; }
          .comment-line { font-size: 11px; color: var(--vscode-descriptionForeground); }
          .comment-content { margin: 8px 0; }
          .comment-actions { display: flex; gap: 5px; }
          button { padding: 4px 8px; font-size: 11px; background: var(--vscode-button-background); border: none; cursor: pointer; }
        </style>
      </head>
      <body>
        <h3>Code Review</h3>
        ${comments.map((c, i) => `
          <div class="comment ${c.type}">
            <div class="comment-header">
              <span class="comment-author">${c.author} • Line ${c.line}</span>
              <span class="comment-line">${c.type}</span>
            </div>
            <div class="comment-content">${c.content}</div>
            <div class="comment-actions">
              <button onclick="sendCmd('resolve', '${c.id}')">✓ Resolve</button>
              <button onclick="sendCmd('reply', '${c.id}')">Reply</button>
            </div>
          </div>
        `).join('')}
        <script>
          function sendCmd(action, commentId) {
            vscode.postMessage({ command: action, commentId });
          }
        </script>
      </body>
      </html>
    `;

    this.panel.webview.html = html;
  }

  private updateEditorDecorations(comments: CodeComment[]) {
    if (!this.activeEditor) return;

    const decorations: vscode.DecorationOptions[] = comments
      .filter(c => c.status === 'open')
      .map(c => ({
        range: new vscode.Range(c.line - 1, 0, c.line - 1, 0),
        hoverMessage: new vscode.MarkdownString(`**${c.author}**: ${c.content}`),
        renderOptions: {
          before: {
            contentText: '●',
            color: c.severity === 'error' ? '#f48771' : '#dcdcaa',
            margin: '0 10px',
          },
        },
      }));

    const decorationType = vscode.window.createTextEditorDecorationType({});
    this.activeEditor.setDecorations(decorationType, decorations);
  }

  private handleNewComment(data: any) {
    logger.info(`New comment from ${data.author}`);
    this.refreshComments();
  }

  private handleCommentResolved(data: any) {
    logger.info(`Comment resolved: ${data.commentId}`);
    this.refreshComments();
  }

  private handleMessage(msg: any) {
    if (msg.command === 'resolve') {
      this.resolveComment(msg.commentId);
    }
  }

  private async resolveComment(commentId: string) {
    try {
      const response = await fetch(
        buildApiUrl(`/api/code-review/${commentId}/resolve`),
        {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${this.store.getUserToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: this.store.getUser()?.id }),
        }
      );
      if (response.ok) {
        this.refreshComments();
      }
    } catch (error) {
      logger.error('Failed to resolve comment', error);
    }
  }
}

export function createCodeReviewPanel(
  context: vscode.ExtensionContext,
  store: StateStore,
  socket: SocketClient
): CodeReviewPanel {
  return new CodeReviewPanel(context, store, socket);
}
