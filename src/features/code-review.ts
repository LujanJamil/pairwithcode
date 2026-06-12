import { StateStore } from '../state/store';
import { SocketClient } from '../socket/client';
import * as vscode from 'vscode';
import { buildApiUrl } from '../utils/api-config';

interface CodeReviewComment {
  id: string;
  sessionId: string;
  filePath: string;
  lineNumber: number;
  userId: string;
  userName: string;
  content: string;
  type: 'suggestion' | 'question' | 'issue' | 'blocker';
  severity: 'info' | 'warning' | 'error';
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
}

export class CodeReviewManager {
  private comments: Map<string, CodeReviewComment[]> = new Map();
  private decorationType: vscode.TextEditorDecorationType | null = null;

  constructor(
    private store: StateStore,
    private socket: SocketClient
  ) {
    this.setupListeners();
    this.createDecorationStyle();
  }

  private createDecorationStyle() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: 'comment',
      gutterIconSize: 'contain',
      backgroundColor: new vscode.ThemeColor('editorWarning.background'),
      borderRadius: '3px',
      isWholeLine: false,
      overviewRulerColor: new vscode.ThemeColor('editorWarning.foreground'),
      overviewRulerLane: vscode.OverviewRulerLane.Full,
    });
  }

  private setupListeners() {
    this.socket.onEvent('code-review-comment-added' as any, (comment: CodeReviewComment) => {
      this.addCommentToCache(comment);
      this.store.emit('code-review-comment-added', comment);
      this.updateEditorDecorations();
    });

    this.socket.onEvent('code-review-comment-updated' as any, (data: { commentId: string; status: string }) => {
      this.store.emit('code-review-comment-updated', data);
      this.updateEditorDecorations();
    });

    // Update decorations when active editor changes
    vscode.window.onDidChangeActiveTextEditor(() => {
      this.updateEditorDecorations();
    });
  }

  async createComment(data: {
    filePath: string;
    lineNumber: number;
    content: string;
    type: 'suggestion' | 'question' | 'issue' | 'blocker';
    severity: 'info' | 'warning' | 'error';
  }): Promise<CodeReviewComment | null> {
    const session = this.store.getCurrentRoom();
    const user = this.store.getPreferences();

    if (!session || !user.userName) {
      return null;
    }

    try {
      const response = await fetch(buildApiUrl('/api/code-review/comments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session,
          filePath: data.filePath,
          lineNumber: data.lineNumber,
          userId: user.userName,
          userName: user.userName,
          content: data.content,
          type: data.type,
          severity: data.severity
        })
      });

      if (!response.ok) throw new Error('Failed to create comment');

      const comment = await response.json() as CodeReviewComment;
      this.addCommentToCache(comment);
      this.socket.emitEvent('code-review-comment-added' as any, comment);
      this.updateEditorDecorations();

      return comment;
    } catch (error) {
      console.error('Error creating code review comment:', error);
      return null;
    }
  }

  async getFileComments(filePath: string): Promise<CodeReviewComment[]> {
    const session = this.store.getCurrentRoom();
    if (!session) return [];

    const cached = this.comments.get(filePath);
    if (cached) return cached;

    try {
      const response = await fetch(
        buildApiUrl(`/api/code-review/sessions/${session}/files/${encodeURIComponent(filePath)}/comments`)
      );

      if (!response.ok) return [];

      const data = await response.json() as { comments: CodeReviewComment[] };
      this.comments.set(filePath, data.comments);
      this.updateEditorDecorations();

      return data.comments;
    } catch (error) {
      console.error('Error fetching file comments:', error);
      return [];
    }
  }

  async updateCommentStatus(commentId: string, status: 'open' | 'resolved' | 'dismissed'): Promise<boolean> {
    try {
      const response = await fetch(buildApiUrl(`/api/code-review/comments/${commentId}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!response.ok) return false;

      this.store.emit('code-review-comment-updated', { commentId, status });
      this.socket.emitEvent('code-review-comment-updated' as any, { commentId, status });
      this.updateEditorDecorations();

      return true;
    } catch (error) {
      console.error('Error updating comment status:', error);
      return false;
    }
  }

  async deleteComment(commentId: string): Promise<boolean> {
    try {
      const response = await fetch(buildApiUrl(`/api/code-review/comments/${commentId}`), {
        method: 'DELETE'
      });

      if (!response.ok) return false;

      this.store.emit('code-review-comment-deleted', commentId);
      this.socket.emitEvent('code-review-comment-deleted' as any, { commentId });
      this.updateEditorDecorations();

      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      return false;
    }
  }

  private addCommentToCache(comment: CodeReviewComment): void {
    const existing = this.comments.get(comment.filePath) || [];
    const filtered = existing.filter(c => c.id !== comment.id);
    this.comments.set(comment.filePath, [...filtered, comment]);
  }

  private updateEditorDecorations(): void {
    if (!this.decorationType) return;

    // Get all open editors
    const editors = vscode.window.visibleTextEditors;

    editors.forEach(editor => {
      const filePath = vscode.workspace.asRelativePath(editor.document.fileName);
      const fileComments = this.comments.get(filePath) || [];

      // Filter for open comments
      const openComments = fileComments.filter(c => c.status === 'open');

      if (openComments.length === 0) {
        editor.setDecorations(this.decorationType!, []);
        return;
      }

      // Create decorations for each comment
      const decorations = openComments.map(comment => {
        const range = new vscode.Range(comment.lineNumber, 0, comment.lineNumber, 0);
        return {
          range,
          hoverMessage: new vscode.MarkdownString(
            `**${comment.type}** (${comment.severity})\n\n${comment.content}\n\n*by ${comment.userName}*`
          )
        };
      });

      editor.setDecorations(this.decorationType!, decorations);
    });
  }

  dispose(): void {
    this.comments.clear();
    if (this.decorationType) {
      this.decorationType.dispose();
    }
  }
}

export const createCodeReviewManager = (store: StateStore, socket: SocketClient) => {
  return new CodeReviewManager(store, socket);
};
