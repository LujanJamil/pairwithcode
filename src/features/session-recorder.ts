import * as vscode from 'vscode';
import { StateStore } from '../state/store';
import { SocketClient } from '../socket/client';
import { logger } from '../utils/logger';

interface EditorFrame {
  timestamp: number;
  activeFile: string | undefined;
  text: string | undefined;
  selections: readonly vscode.Selection[] | undefined;
  visibleRanges: readonly vscode.Range[] | undefined;
  cursorLine: number | undefined;
  cursorColumn: number | undefined;
}

export class SessionRecorder {
  private isRecording = false;
  private frameBuffer: EditorFrame[] = [];
  private captureInterval: NodeJS.Timeout | null = null;
  private lastFrameTime = 0;
  private recordingStartTime = 0;

  constructor(
    private store: StateStore,
    private socket: SocketClient
  ) {}

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  startRecording(): boolean {
    if (this.isRecording) {
      logger.warn('Recording already in progress');
      return false;
    }

    const room = this.store.getCurrentRoom();
    if (!room) {
      logger.error('Not connected to a room');
      return false;
    }

    this.isRecording = true;
    this.recordingStartTime = Date.now();
    this.frameBuffer = [];
    this.lastFrameTime = this.recordingStartTime;

    logger.info('Recording session started', { room });
    vscode.window.showInformationMessage('🎥 Recording started');

    // Emit socket event to notify other clients
    this.socket.emitEvent('RECORDING_STARTED', {
      roomName: room,
      startTime: this.recordingStartTime
    });

    this.setupFrameCapture();
    return true;
  }

  private setupFrameCapture(): void {
    // Capture frames at 100ms intervals (10fps)
    this.captureInterval = setInterval(() => {
      if (!this.isRecording) return;

      const editor = vscode.window.activeTextEditor;
      const frame: EditorFrame = {
        timestamp: Date.now(),
        activeFile: editor?.document.fileName,
        text: editor?.document.getText(),
        selections: editor?.selections,
        visibleRanges: editor?.visibleRanges,
        cursorLine: editor?.selection.active.line,
        cursorColumn: editor?.selection.active.character
      };

      this.frameBuffer.push(frame);

      // Batch send every 1 second (~10 frames)
      if (this.frameBuffer.length >= 10) {
        this.sendFrameBatch();
      }
    }, 100);
  }

  private sendFrameBatch(): void {
    if (this.frameBuffer.length === 0) return;

    const room = this.store.getCurrentRoom();
    if (!room) return;

    const batch = this.frameBuffer.splice(0, 10);
    const duration = batch[batch.length - 1].timestamp - batch[0].timestamp;

    logger.debug('Sending frame batch', { count: batch.length, duration });

    this.socket.emitEvent('RECORDING_FRAMES', {
      roomName: room,
      frames: batch.map(f => ({
        timestamp: f.timestamp,
        activeFile: f.activeFile,
        cursorLine: f.cursorLine,
        cursorColumn: f.cursorColumn,
        // Don't send full text for every frame (too large)
        // Only key changes are sent separately via regular typing events
      }))
    });
  }

  async stopRecording(): Promise<string | null> {
    if (!this.isRecording) {
      logger.warn('No recording in progress');
      return null;
    }

    this.isRecording = false;

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    // Send remaining frames
    if (this.frameBuffer.length > 0) {
      this.sendFrameBatch();
    }

    const room = this.store.getCurrentRoom();
    if (!room) return null;

    const recordingDuration = Date.now() - this.recordingStartTime;
    logger.info('Recording stopped', { duration: recordingDuration, room });

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        logger.warn('Recording save timed out');
        resolve(null);
      }, 10000);

      this.socket.onceEvent('RECORDING_SAVED' as any, (data: { recordingId: string }) => {
        clearTimeout(timeoutId);
        vscode.window.showInformationMessage('✅ Recording saved!');
        resolve(data.recordingId);
      });

      this.socket.emitEvent('RECORDING_STOPPED' as any, {
        roomName: room,
        duration: recordingDuration
      });
    });
  }

  dispose(): void {
    if (this.isRecording) {
      this.stopRecording();
    }

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    this.frameBuffer = [];
  }
}

export const createSessionRecorder = (store: StateStore, socket: SocketClient) => {
  return new SessionRecorder(store, socket);
};
