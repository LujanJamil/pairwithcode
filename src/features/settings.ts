import * as vscode from 'vscode';
import { UserPreference } from '../models/types';
import { logger } from '../utils/logger';

const SETTINGS_NAMESPACE = 'pairWithCode';

export interface SettingsConfig {
  serverUrl: string;
  userName: string;
  autoJoin: boolean;
  followMode: boolean;
  autoReconnect: boolean;
  theme: 'light' | 'dark' | 'auto';
  showActivityIndicators: boolean;
  maxChatHistory: number;
}

export class Settings {
  constructor() {}

  static getConfig(): SettingsConfig {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);

    return {
      serverUrl: config.get('serverUrl') || 'https://pairwithcode.onrender.com',
      userName: config.get('userName') || this.generateDefaultUserName(),
      autoJoin: config.get('autoJoin') ?? false,
      followMode: config.get('followMode') ?? true,
      autoReconnect: config.get('autoReconnect') ?? true,
      theme: (config.get('theme') || 'auto') as 'light' | 'dark' | 'auto',
      showActivityIndicators: config.get('showActivityIndicators') ?? true,
      maxChatHistory: config.get('maxChatHistory') ?? 500,
    };
  }

  static getServerUrl(): string {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    const url = config.get<string>('serverUrl');
    logger.debug('Server URL from config', { url });
    return url || 'https://pairwithcode.onrender.com';
  }

  static getUserName(): string {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    let userName = config.get<string>('userName');

    if (!userName || userName.trim() === '') {
      userName = this.generateDefaultUserName();
    }

    logger.debug('User name from config', { userName });
    return userName;
  }

  static getFollowMode(): boolean {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    return config.get('followMode') ?? true;
  }

  static getAutoReconnect(): boolean {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    return config.get('autoReconnect') ?? true;
  }

  static getAutoJoin(): boolean {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    return config.get('autoJoin') ?? false;
  }

  static getTheme(): 'light' | 'dark' | 'auto' {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    return (config.get('theme') || 'auto') as 'light' | 'dark' | 'auto';
  }

  static getShowActivityIndicators(): boolean {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    return config.get('showActivityIndicators') ?? true;
  }

  static getMaxChatHistory(): number {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    return config.get('maxChatHistory') ?? 500;
  }

  static async setUserName(name: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    await config.update('userName', name, vscode.ConfigurationTarget.Global);
    logger.debug('User name updated', { name });
  }

  static async setServerUrl(url: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    await config.update('serverUrl', url, vscode.ConfigurationTarget.Global);
    logger.debug('Server URL updated', { url });
  }

  static async setFollowMode(enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    await config.update('followMode', enabled, vscode.ConfigurationTarget.Global);
    logger.debug('Follow mode updated', { enabled });
  }

  static async setAutoReconnect(enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    await config.update('autoReconnect', enabled, vscode.ConfigurationTarget.Global);
    logger.debug('Auto reconnect updated', { enabled });
  }

  static async setAutoJoin(enabled: boolean): Promise<void> {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    await config.update('autoJoin', enabled, vscode.ConfigurationTarget.Global);
    logger.debug('Auto join updated', { enabled });
  }

  static async setTheme(theme: 'light' | 'dark' | 'auto'): Promise<void> {
    const config = vscode.workspace.getConfiguration(SETTINGS_NAMESPACE);
    await config.update('theme', theme, vscode.ConfigurationTarget.Global);
    logger.debug('Theme updated', { theme });
  }

  static onConfigurationChange(callback: (event: vscode.ConfigurationChangeEvent) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(SETTINGS_NAMESPACE)) {
        logger.debug('Configuration changed');
        callback(event);
      }
    });
  }

  static toUserPreference(settings: SettingsConfig): UserPreference {
    return {
      serverUrl: settings.serverUrl,
      userName: settings.userName,
      autoJoin: settings.autoJoin,
      followMode: settings.followMode,
      autoReconnect: settings.autoReconnect,
      theme: settings.theme,
    };
  }

  private static generateDefaultUserName(): string {
    const gitConfig = vscode.workspace.getConfiguration('git');
    let userName = gitConfig.get<string>('userConfigName');

    if (!userName) {
      const machineUserName = process.env.USER || process.env.USERNAME || 'Collaborator';
      userName = machineUserName.split(/[\\\/]/)[0]; // Get just the username part
    }

    return userName || 'Collaborator';
  }
}

export const getSettings = (): SettingsConfig => Settings.getConfig();

export const getServerUrl = (): string => Settings.getServerUrl();

export const getUserName = (): string => Settings.getUserName();

export const onSettingsChange = (callback: (event: vscode.ConfigurationChangeEvent) => void): vscode.Disposable => {
  return Settings.onConfigurationChange(callback);
};
