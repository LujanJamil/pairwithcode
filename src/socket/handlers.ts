import * as vscode from 'vscode';
import { SocketClient } from './client';
import { StateStore } from '../state/store';
import { Persistence } from '../state/persistence';
import { SocketEvents } from '../models/events';
import { ContentChange, CollaboratorStatus, Message } from '../models/types';
import { logger } from '../utils/logger';
import { generateUUID } from '../utils/uuid';

export class SocketHandlers {
  constructor(
    private socket: SocketClient,
    private store: StateStore,
    private persistence: Persistence,
  ) {}

  setupHandlers(context: vscode.ExtensionContext): void {
    this.setupConnectionHandlers();
    this.setupSyncHandlers();
    this.setupChatHandlers();
  }

  private setupConnectionHandlers(): void {
    this.socket.onEvent(SocketEvents.CONNECT, () => {
      logger.info('Connected to room');
      const room = this.socket.getCurrentRoom();
      if (room) {
        this.socket.joinRoom(room);
      }
    });

    this.socket.onEvent(SocketEvents.DISCONNECT, () => {
      logger.warn('Disconnected from room');
      this.store.setConnectionState(false, false);
    });

    this.socket.onEvent(SocketEvents.ROOM_UPDATE, (data: any) => {
      logger.info('Room updated', { count: data.count });
      if (data.count > 1) {
        vscode.window.showInformationMessage('A partner has joined the session!');
      }
    });

    this.socket.onEvent(SocketEvents.USER_JOINED, (data: any) => {
      logger.info('User joined', { userId: data.userId, userName: data.userName });
      const status: CollaboratorStatus = {
        userId: data.userId,
        userName: data.userName,
        status: 'active',
        lastActive: Date.now(),
      };
      this.store.addCollaborator(data.userId, status);
    });

    this.socket.onEvent(SocketEvents.USER_DISCONNECTED, (userId: string) => {
      logger.info('User disconnected', { userId });
      this.store.removeCollaborator(userId);
      vscode.window.showWarningMessage('A partner has left the session.');
    });
  }

  private setupSyncHandlers(): void {
    this.socket.onEvent(SocketEvents.REMOTE_FILE_SWITCH, async (data: any) => {
      logger.debug('Remote file switch', { path: data.relativePath });
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) return;

      const fullPath = vscode.Uri.joinPath(workspaceFolders[0].uri, data.relativePath);
      try {
        const doc = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(doc, {
          preview: false,
          preserveFocus: true,
        });
      } catch (e) {
        logger.error('Could not find file remotely', { path: data.relativePath });
      }
    });

    this.socket.onEvent(SocketEvents.REMOTE_TYPING, async (data: any) => {
      logger.debug('Remote typing received', { fileName: data.fileName });
      const editor = vscode.window.activeTextEditor;
      if (editor && vscode.workspace.asRelativePath(editor.document.fileName) === data.fileName) {
        const pos = editor.document.positionAt(data.offset);
        await editor.edit((eb) => {
          if (data.text === '') {
            eb.delete(new vscode.Range(pos, editor.document.positionAt(data.offset + data.length)));
          } else {
            eb.insert(pos, data.text);
          }
        });
      }

      // Track change in store
      const change: ContentChange = {
        userId: 'remote',
        timestamp: Date.now(),
        offset: data.offset,
        text: data.text,
        length: data.length,
        fileName: data.fileName,
        version: this.store.getVectorClock(),
      };
      this.store.addChange(change);
    });

    this.socket.onEvent(SocketEvents.REMOTE_CURSOR, (data: any) => {
      logger.debug('Remote cursor received', { userId: data.userId, line: data.line });
      const userId = data.userId;
      const status = this.store.getCollaborator(userId);
      if (status) {
        this.store.updateCollaborator(userId, {
          cursorLine: data.line,
          status: 'active',
          lastActive: Date.now(),
        });
      }
    });

    this.socket.onEvent(SocketEvents.REQUEST_INITIAL_STATE, (data: any) => {
      logger.debug('Initial state requested', { requesterId: data.requesterId });
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        this.socket.emitEvent(SocketEvents.SEND_INITIAL_STATE as any, {
          requesterId: data.requesterId,
          content: editor.document.getText(),
        });
      }
    });

    this.socket.onEvent(SocketEvents.RECEIVE_INITIAL_STATE, async (content: string) => {
      logger.debug('Initial state received');
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await editor.edit((eb) =>
          eb.replace(
            new vscode.Range(
              editor.document.positionAt(0),
              editor.document.positionAt(editor.document.getText().length),
            ),
            content,
          ),
        );
      }
    });
  }

  private setupChatHandlers(): void {
    this.socket.onEvent(SocketEvents.RECEIVE_MESSAGE, (data: any) => {
      logger.debug('Message received', { userId: data.userId });
      const message: Message = {
        id: data.id,
        userId: data.userId,
        userName: data.userName,
        content: data.content,
        timestamp: data.timestamp,
        status: 'delivered',
        reactions: [],
      };
      this.store.addMessage(message);
    });

    this.socket.onEvent(SocketEvents.MESSAGE_DELETED, (data: any) => {
      logger.debug('Message deleted', { messageId: data.messageId });
      this.store.deleteMessage(data.messageId);
    });

    this.socket.onEvent(SocketEvents.MESSAGE_REACTION, (data: any) => {
      logger.debug('Message reaction', { messageId: data.messageId, emoji: data.emoji });
      this.store.updateMessageReaction(data.messageId, data.emoji, data.userId);
    });

    this.socket.onEvent(SocketEvents.MESSAGE_HISTORY, (data: any) => {
      logger.debug('Message history received', { count: data.messages.length });
      for (const msg of data.messages) {
        this.store.addMessage({
          id: msg.id,
          userId: msg.userId,
          userName: msg.userName,
          content: msg.content,
          timestamp: msg.timestamp,
          status: 'delivered',
          reactions: [],
        });
      }
    });
  }

  sendMessage(content: string, roomName: string, userId: string): void {
    if (!this.socket.isConnected()) {
      logger.warn('Socket not connected, cannot send message');
      return;
    }

    const message: Message = {
      id: generateUUID(),
      userId,
      userName: 'Me',
      content,
      timestamp: Date.now(),
      status: 'pending',
      reactions: [],
    };

    this.store.addMessage(message);
    this.socket.emitEvent(SocketEvents.SEND_MESSAGE as any, {
      roomName,
      userId,
      content,
      timestamp: message.timestamp,
    });
  }

  deleteMessage(messageId: string, roomName: string, userId: string): void {
    if (!this.socket.isConnected()) {
      logger.warn('Socket not connected, cannot delete message');
      return;
    }

    this.socket.emitEvent(SocketEvents.DELETE_MESSAGE as any, {
      roomName,
      messageId,
      userId,
    });
  }

  addReaction(messageId: string, emoji: string, roomName: string, userId: string): void {
    if (!this.socket.isConnected()) {
      logger.warn('Socket not connected, cannot add reaction');
      return;
    }

    this.socket.emitEvent(SocketEvents.REACT_TO_MESSAGE as any, {
      roomName,
      messageId,
      emoji,
      userId,
    });
  }
}

export const createSocketHandlers = (
  socket: SocketClient,
  store: StateStore,
  persistence: Persistence,
): SocketHandlers => {
  return new SocketHandlers(socket, store, persistence);
};
