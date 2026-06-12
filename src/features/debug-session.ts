import * as vscode from 'vscode';
import { StateStore } from '../state/store';
import { SocketClient } from '../socket/client';
import { logger } from '../utils/logger';

interface DebugInfo {
  sessionName: string;
  state: 'inactive' | 'initializing' | 'stopped' | 'running' | 'paused';
  breakpoints: Map<string, number[]>;
  callStack: any[];
  variables: any[];
  currentFile: string | undefined;
  currentLine: number | undefined;
}

export class DebugSessionManager {
  private debugSession: vscode.DebugSession | null = null;
  private debugInfo: DebugInfo | null = null;
  private breakpointDecorations: Map<vscode.TextEditor, vscode.TextEditorDecorationType> = new Map();

  constructor(
    private store: StateStore,
    private socket: SocketClient
  ) {
    this.setupListeners();
  }

  private setupListeners() {
    // Listen for local debug session changes
    vscode.debug.onDidChangeActiveDebugSession((session) => {
      if (session && this.store.getCurrentRoom()) {
        this.debugSession = session;
        this.broadcastDebugState();
      }
    });

    // Listen for breakpoint changes
    vscode.debug.onDidChangeBreakpoints((event) => {
      if (this.store.getCurrentRoom()) {
        this.broadcastBreakpoints([...event.added], [...event.removed]);
      }
    });

    // Listen for remote debug state
    this.socket.onEvent('REMOTE_DEBUG_STATE' as any, (data: any) => {
      this.updateRemoteDebugState(data);
    });
  }

  private broadcastDebugState(): void {
    if (!this.debugSession || !this.store.getCurrentRoom()) return;

    this.socket.emitEvent('DEBUG_STATE_CHANGED' as any, {
      roomName: this.store.getCurrentRoom(),
      sessionName: this.debugSession.name,
      configuration: this.debugSession.configuration
    });
  }

  private broadcastBreakpoints(added: vscode.Breakpoint[], removed: vscode.Breakpoint[]): void {
    const room = this.store.getCurrentRoom();
    if (!room) return;

    this.socket.emitEvent('DEBUG_BREAKPOINTS', {
      roomName: room,
      added: added
        .filter((bp): bp is vscode.SourceBreakpoint => bp instanceof vscode.SourceBreakpoint)
        .map(bp => ({
          file: bp.location.uri.fsPath,
          line: bp.location.range.start.line,
          column: bp.location.range.start.character
        })),
      removed: removed
        .filter((bp): bp is vscode.SourceBreakpoint => bp instanceof vscode.SourceBreakpoint)
        .map(bp => ({
          file: bp.location.uri.fsPath,
          line: bp.location.range.start.line
        }))
    });
  }

  private updateRemoteDebugState(data: any): void {
    this.debugInfo = {
      sessionName: data.sessionName,
      state: data.state,
      breakpoints: new Map(),
      callStack: data.callStack || [],
      variables: data.variables || [],
      currentFile: data.currentFile,
      currentLine: data.currentLine
    };

    this.updateBreakpointDecorations(data.breakpoints || []);
    logger.debug('Remote debug state updated', { session: data.sessionName });
  }

  private updateBreakpointDecorations(breakpoints: any[]): void {
    const editors = vscode.window.visibleTextEditors;

    editors.forEach(editor => {
      const filePath = editor.document.fileName;
      const fileBreakpoints = breakpoints.filter(bp => bp.file === filePath);

      const decorationType = vscode.window.createTextEditorDecorationType({
        gutterIconPath: 'debug-breakpoint-function-unverified',
        backgroundColor: new vscode.ThemeColor('editor.lineHighlightBackground'),
        isWholeLine: true
      });

      const ranges = fileBreakpoints.map(bp =>
        new vscode.Range(bp.line, 0, bp.line, 0)
      );

      editor.setDecorations(decorationType, ranges);
      this.breakpointDecorations.set(editor, decorationType);
    });
  }

  dispose(): void {
    this.breakpointDecorations.forEach(dec => dec.dispose());
    this.breakpointDecorations.clear();
  }
}

export const createDebugSessionManager = (store: StateStore, socket: SocketClient) => {
  return new DebugSessionManager(store, socket);
};
