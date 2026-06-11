import * as vscode from 'vscode';
import { StateStore } from '../state/store';
import { SocketClient } from '../socket/client';
import { logger } from '../utils/logger';

interface TerminalSession {
  id: string;
  name: string;
  createdAt: number;
  lastActivity: number;
}

export class SharedTerminalManager {
  private terminalSessions: Map<string, TerminalSession> = new Map();
  private localTerminal: vscode.Terminal | null = null;

  constructor(
    private store: StateStore,
    private socket: SocketClient
  ) {
    this.setupListeners();
  }

  private setupListeners() {
    this.socket.onEvent('TERMINAL_OPENED' as any, (data: any) => {
      logger.info('Remote terminal opened', { ptyId: data.ptyId });
    });

    this.socket.onEvent('TERMINAL_OUTPUT' as any, (data: any) => {
      logger.debug('Terminal output received');
      // This would be handled by the terminal panel webview
    });

    this.socket.onEvent('TERMINAL_CLOSED' as any, (data: any) => {
      logger.info('Remote terminal closed');
    });

    // Listen for terminal changes
    vscode.window.onDidChangeActiveTerminal((terminal) => {
      if (terminal && this.store.getCurrentRoom()) {
        this.localTerminal = terminal;
        this.broadcastTerminalOpen();
      }
    });
  }

  private broadcastTerminalOpen() {
    const room = this.store.getCurrentRoom();
    if (!room || !this.localTerminal) return;

    this.socket.emitEvent('TERMINAL_START' as any, {
      roomName: room,
      terminalName: this.localTerminal.name,
      shellType: process.platform,
      cols: 80,
      rows: 30
    });
  }

  async startSharing(): Promise<boolean> {
    const terminal = vscode.window.activeTerminal;
    if (!terminal) {
      vscode.window.showWarningMessage('No active terminal. Please open a terminal first.');
      return false;
    }

    const room = this.store.getCurrentRoom();
    if (!room) {
      vscode.window.showWarningMessage('Not connected to a room');
      return false;
    }

    this.localTerminal = terminal;
    this.broadcastTerminalOpen();

    vscode.window.showInformationMessage('✅ Terminal sharing enabled');
    logger.info('Terminal sharing started', { room });

    return true;
  }

  sendTerminalInput(input: string): void {
    const room = this.store.getCurrentRoom();
    if (!room || !this.localTerminal) return;

    this.socket.emitEvent('TERMINAL_INPUT', {
      roomName: room,
      input
    });

    // Also send to local terminal for echo
    if (this.localTerminal) {
      this.localTerminal.sendText(input, false);
    }
  }

  dispose(): void {
    this.terminalSessions.clear();
  }
}

export const createSharedTerminalManager = (store: StateStore, socket: SocketClient) => {
  return new SharedTerminalManager(store, socket);
};
