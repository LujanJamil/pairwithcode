import * as vscode from 'vscode';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const namespace = 'pair-with-code';

export class Logger {
  private static outputChannel: vscode.OutputChannel | null = null;

  static initialize(): vscode.OutputChannel {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel(namespace, { log: true });
    }
    return this.outputChannel;
  }

  private static log(level: LogLevel, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const fullMessage = data ? `${prefix} ${message} ${JSON.stringify(data, null, 2)}` : `${prefix} ${message}`;

    if (!this.outputChannel) {
      this.initialize();
    }

    this.outputChannel?.appendLine(fullMessage);

    // Also log to console for development
    if (level === 'error') {
      console.error(`${namespace}: ${message}`, data);
    } else if (level === 'warn') {
      console.warn(`${namespace}: ${message}`, data);
    } else {
      console.log(`${namespace}: ${message}`, data);
    }
  }

  static debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  static info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  static warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  static error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  static dispose(): void {
    this.outputChannel?.dispose();
    this.outputChannel = null;
  }

  static show(): void {
    this.outputChannel?.show();
  }
}

// Create singleton instance
export const logger = Logger;
