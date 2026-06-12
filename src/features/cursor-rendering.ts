import * as vscode from 'vscode';
import { StateStore } from '../state/store';
import { logger } from '../utils/logger';

interface CursorDecoration {
  userId: string;
  userName: string;
  color: string;
  decorationType: vscode.TextEditorDecorationType;
}

export class CursorRenderer {
  private cursors: Map<string, CursorDecoration> = new Map();
  private colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B195', '#AA96DA'
  ];
  private colorIndex = 0;

  constructor(private store: StateStore) {
    this.setupListeners();
  }

  private setupListeners() {
    // When a collaborator is added/updated, create or update their cursor
    this.store.on('collaborator-updated', (collaborator: any) => {
      if (collaborator.cursorLine !== undefined && collaborator.currentFile) {
        this.updateCursor(
          collaborator.userId,
          collaborator.userName,
          collaborator.currentFile,
          collaborator.cursorLine,
          collaborator.cursorColumn || 0,
          collaborator.selectionStartLine,
          collaborator.selectionEndLine
        );
      }
    });

    // Listen for remote cursor events from socket handlers
    this.store.on('remote-cursor-moved', (data: any) => {
      this.updateCursor(
        data.userId,
        data.userName,
        data.fileName,
        data.line,
        data.character,
        data.selectionStartLine,
        data.selectionEndLine
      );
    });

    // When collaborator leaves, clean up cursor
    this.store.on('collaborator-removed', (collaborator: any) => {
      this.removeCursor(collaborator.userId);
    });
  }

  private getOrCreateCursorDecoration(
    userId: string,
    userName: string,
    color: string
  ): CursorDecoration {
    if (this.cursors.has(userId)) {
      return this.cursors.get(userId)!;
    }

    // Determine color to use
    const displayColor = color || this.colors[this.colorIndex % this.colors.length];
    this.colorIndex++;

    // Create decoration type for this cursor
    const decorationType = vscode.window.createTextEditorDecorationType({
      gutterIconPath: undefined,
      // Cursor position marker (before content)
      before: {
        contentText: '▐',
        color: displayColor,
        backgroundColor: `${displayColor}30`, // Transparent background
        margin: '0 2px 0 0'
      },
      // Cursor label (above line)
      after: {
        contentText: userName,
        color: 'white',
        backgroundColor: displayColor,
        margin: '0 0 0 4px',
        border: 'none'
      },
      isWholeLine: false,
      backgroundColor: `${displayColor}10` // Very transparent background for current line
    });

    // Create selection highlight decoration (semi-transparent)
    const selectionDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: `${displayColor}20`,
      borderRadius: '2px',
      isWholeLine: false
    });

    const decoration: CursorDecoration = {
      userId,
      userName,
      color: displayColor,
      decorationType
    };

    this.cursors.set(userId, decoration);
    return decoration;
  }

  public updateCursor(
    userId: string,
    userName: string,
    fileName: string,
    line: number,
    character: number,
    selectionStartLine?: number,
    selectionEndLine?: number
  ) {
    try {
      // Find editor for this file
      const editor = vscode.window.visibleTextEditors.find(
        (ed) =>
          vscode.workspace.asRelativePath(ed.document.fileName) === fileName
      );

      if (!editor) {
        logger.debug(`No editor open for file: ${fileName}`);
        return;
      }

      // Get or create decoration for this user
      const decoration = this.getOrCreateCursorDecoration(
        userId,
        userName,
        this.generateColorForUser(userId)
      );

      // Create range for cursor position
      const range = new vscode.Range(line, character, line, character + 1);

      // Apply cursor decoration
      editor.setDecorations(decoration.decorationType, [
        {
          range,
          hoverMessage: new vscode.MarkdownString(`**${userName}** (Line ${line + 1})`)
        }
      ]);

      // If selection exists, create selection decorations
      if (
        selectionStartLine !== undefined &&
        selectionEndLine !== undefined &&
        selectionStartLine <= selectionEndLine
      ) {
        this.renderSelection(
          editor,
          selectionStartLine,
          selectionEndLine,
          decoration.color
        );
      }

      logger.debug(`Cursor updated for ${userName} at ${fileName}:${line}`);
    } catch (error) {
      logger.error(`Error updating cursor for ${userName}:`, error);
    }
  }

  private renderSelection(
    editor: vscode.TextEditor,
    startLine: number,
    endLine: number,
    color: string
  ) {
    const ranges: vscode.Range[] = [];

    for (let line = startLine; line <= endLine && line < editor.document.lineCount; line++) {
      const lineText = editor.document.lineAt(line);
      ranges.push(
        new vscode.Range(
          line,
          0,
          line,
          lineText.text.length
        )
      );
    }

    // Create temporary decoration for selection highlight
    const selectionDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: `${color}15`,
      isWholeLine: true,
      overviewRulerColor: color,
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });

    editor.setDecorations(selectionDecorationType, ranges);

    // Clean up after 500ms (selection is temporary)
    setTimeout(() => {
      selectionDecorationType.dispose();
    }, 500);
  }

  private generateColorForUser(userId: string): string {
    // Deterministic color based on userId hash
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }

    return this.colors[Math.abs(hash) % this.colors.length];
  }

  public removeCursor(userId: string) {
    const decoration = this.cursors.get(userId);
    if (decoration) {
      decoration.decorationType.dispose();
      this.cursors.delete(userId);
      logger.debug(`Cursor removed for user: ${userId}`);
    }
  }

  public clearAllCursors() {
    this.cursors.forEach((decoration) => {
      decoration.decorationType.dispose();
    });
    this.cursors.clear();
    logger.debug('All cursors cleared');
  }

  public dispose() {
    this.clearAllCursors();
  }
}

export const createCursorRenderer = (store: StateStore): CursorRenderer => {
  return new CursorRenderer(store);
};
