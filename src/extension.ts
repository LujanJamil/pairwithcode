import * as vscode from 'vscode';
import { createSocketClient } from './socket/client';
import { createSocketHandlers } from './socket/handlers';
import { createStateStore } from './state/store';
import { createPersistence } from './state/persistence';
import { createRoomHistory } from './state/roomHistory';
import { logger } from './utils/logger';
import { getErrorContext } from './utils/errors';
import { getSettings, onSettingsChange } from './features/settings';
import { initializeApiConfig } from './utils/api-config';
import { createUICommands } from './ui/commands';
import { createPresenceProvider } from './ui/treeView';
import { createActivityTracker } from './features/activity';
import { createConflictResolver } from './features/conflict';
import { createCursorRenderer } from './features/cursor-rendering';
import { ChatPanel } from './ui/webview/chat/chat-panel';
import { PresencePanel } from './ui/webview/presence/presence-panel';
import { createSettingsPanel } from './ui/webview/settings/settings-panel';
import { createShortcutsPanel } from './ui/webview/shortcuts/shortcuts-panel';
import { createAnalyticsPanel } from './ui/webview/analytics/analytics-panel';
import { createCodeReviewPanel } from './ui/webview/review/review-panel';
import { createOAuthManager } from './features/oauth-login';
import { createRecordingPanel } from './ui/webview/recording/recording-panel';
import { createTerminalPanel } from './ui/webview/terminal/terminal-panel';
import { createAVPanel } from './ui/webview/av/av-panel';
import { createServerWizardPanel } from './ui/webview/wizard/server-wizard-panel';

let isApplyingRemoteChange = false;

export async function activate(context: vscode.ExtensionContext) {
  try {
    logger.initialize();
    logger.info('Pair With Code extension activating');

    // Initialize core modules
    const persistence = createPersistence(context);
    const store = createStateStore();
    const roomHistory = createRoomHistory(persistence);

    // Initialize API configuration with dynamic server URL resolution
    initializeApiConfig(store);

    // Load room history
    const history = await roomHistory.loadHistory();
    history.forEach((room) => store.addSessionToHistory(room));

    // Load settings (these come from VS Code configuration)
    const settings = getSettings();
    store.updatePreferences({
      serverUrl: settings.serverUrl,
      userName: settings.userName,
      autoJoin: settings.autoJoin,
      followMode: settings.followMode,
      autoReconnect: settings.autoReconnect,
      theme: settings.theme,
    });

    const socketClient = createSocketClient(settings.serverUrl);
    const activityTracker = createActivityTracker(store);
    const conflictResolver = createConflictResolver();
    const cursorRenderer = createCursorRenderer(store);
    const handlers = createSocketHandlers(socketClient, store, persistence, activityTracker, conflictResolver);

    // Cleanup on deactivate
    context.subscriptions.push({
      dispose: () => {
        activityTracker.dispose();
        conflictResolver.clearHistory();
        cursorRenderer.dispose();
      },
    });

    // Setup UI commands
    const uiCommands = createUICommands(store, persistence);
    uiCommands.registerCommands(context);

    // Register presence tree view
    const presenceProvider = createPresenceProvider(store);
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('pairPresence', presenceProvider),
    );

    logger.debug('Presence tree view registered');

    // Register commands FIRST (before room prompt, so they're always available)
    context.subscriptions.push(
      vscode.commands.registerCommand('pairtool.copyRoomId', () => {
        const room = store.getCurrentRoom();
        if (room) {
          vscode.env.clipboard.writeText(room);
          vscode.window.showInformationMessage(`Room ID '${room}' copied!`);
        }
      }),

      vscode.commands.registerCommand('pairtool.stopSharing', async () => {
        await socketClient.disconnect();
        store.setCurrentRoom(undefined);
        vscode.window.showInformationMessage('Collaboration session ended.');
      }),

      vscode.commands.registerCommand('pairtool.menu', async () => {
        const choice = await vscode.window.showQuickPick(['Copy Room ID', 'Stop Sharing Session']);
        if (choice === 'Copy Room ID') vscode.commands.executeCommand('pairtool.copyRoomId');
        if (choice === 'Stop Sharing Session') vscode.commands.executeCommand('pairtool.stopSharing');
      }),

      // New panel commands
      vscode.commands.registerCommand('pairtool.openChat', () => {
        if (!store.getCurrentRoom()) {
          vscode.window.showWarningMessage('Join a session first');
          return;
        }
        ChatPanel.createOrShow(context.extensionUri, store, socketClient);
      }),

      vscode.commands.registerCommand('pairtool.openPresence', () => {
        if (!store.getCurrentRoom()) {
          vscode.window.showWarningMessage('Join a session first');
          return;
        }
        PresencePanel.createOrShow(store);
      }),

      vscode.commands.registerCommand('pairtool.openShortcuts', () => {
        createShortcutsPanel();
      }),

      vscode.commands.registerCommand('pairtool.openAnalytics', () => {
        if (!store.getCurrentRoom()) {
          vscode.window.showWarningMessage('Join a session first');
          return;
        }
        const analyticsPanel = createAnalyticsPanel(context, store, socketClient);
        analyticsPanel.show();
      }),

      vscode.commands.registerCommand('pairtool.openCodeReview', () => {
        if (!store.getCurrentRoom()) {
          vscode.window.showWarningMessage('Join a session first');
          return;
        }
        const codeReviewPanel = createCodeReviewPanel(context, store, socketClient);
        codeReviewPanel.show();
      }),

      vscode.commands.registerCommand('pairtool.loginGitHub', async () => {
        const oauthManager = createOAuthManager(context, store);
        await oauthManager.initiateGitHubLogin();
      }),

      vscode.commands.registerCommand('pairtool.loginGitLab', async () => {
        const oauthManager = createOAuthManager(context, store);
        await oauthManager.initiateGitLabLogin();
      }),

      vscode.commands.registerCommand('pairtool.logout', async () => {
        const oauthManager = createOAuthManager(context, store);
        await oauthManager.logout();
      }),

      vscode.commands.registerCommand('pairtool.openRecording', () => {
        if (!store.getCurrentRoom()) {
          vscode.window.showWarningMessage('Join a session first');
          return;
        }
        createRecordingPanel(store, socketClient);
      }),

      vscode.commands.registerCommand('pairtool.openTerminal', () => {
        if (!store.getCurrentRoom()) {
          vscode.window.showWarningMessage('Join a session first');
          return;
        }
        createTerminalPanel(store, socketClient);
      }),

      vscode.commands.registerCommand('pairtool.openAV', () => {
        if (!store.getCurrentRoom()) {
          vscode.window.showWarningMessage('Join a session first');
          return;
        }
        createAVPanel(store, socketClient);
      }),

      vscode.commands.registerCommand('pairtool.setupServer', () => {
        createServerWizardPanel();
      })
    );

    // Register settings change listener
    context.subscriptions.push(
      onSettingsChange((event) => {
        if (event.affectsConfiguration('pairWithCode.serverUrl')) {
          logger.info('Server URL changed, restart extension to apply');
        }
        if (event.affectsConfiguration('pairWithCode.userName')) {
          const newName = getSettings().userName;
          store.updatePreferences({ userName: newName });
          logger.info('User name updated', { userName: newName });
        }
        if (event.affectsConfiguration('pairWithCode.followMode')) {
          const followMode = getSettings().followMode;
          store.updatePreferences({ followMode });
        }
        if (event.affectsConfiguration('pairWithCode.autoReconnect')) {
          const autoReconnect = getSettings().autoReconnect;
          store.updatePreferences({ autoReconnect });
        }
      }),
    );

    // Setup status bar
    const statusBar = vscode.window.createStatusBarItem('pair-status', vscode.StatusBarAlignment.Right, 100);
    statusBar.text = '$(broadcast) Pair: Ready';
    statusBar.command = 'pairtool.menu';
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Setup socket event handlers
    handlers.setupHandlers(context);

    store.on('connection-state-changed', ({ isConnected, isReconnecting }: any) => {
     vscode.commands.executeCommand('setContext', 'pairWithCode.isConnected', isConnected);

     if (isConnected) {
       statusBar.text = '$(primitive-dot) Pair: Online';
       statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.remoteBackground');
       logger.info('Connected to collaboration session');
     } else if (isReconnecting) {
       statusBar.text = '$(sync~spin) Pair: Reconnecting...';
     } else {
       statusBar.text = '$(alert) Pair: Offline';
       statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
     }
    });

    // Register command to join a room
    context.subscriptions.push(
      vscode.commands.registerCommand('pairtool.joinRoom', async () => {
        const room = await vscode.window.showInputBox({
          prompt: 'Join/Create Room ID',
          ignoreFocusOut: true,
          value: (await persistence.getLastRoom()) || '',
        });

        if (!room) {
          logger.info('No room selected');
          return;
        }

        // Connect to room
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Connecting to collaboration server...',
          },
          async () => {
            try {
              store.setCurrentRoom(room);
              await socketClient.connect();
              socketClient.joinRoom(room);
              await persistence.setLastRoom(room);

              // Save room to history
              const roomSession = await roomHistory.addRoom(room, [{ id: settings.userName, name: settings.userName }]);
              store.addSessionToHistory(roomSession);

              store.setConnectionState(true, false);
              vscode.window.showInformationMessage('✅ Connected to session!');
              logger.info('Connected to room', { room });
            } catch (error) {
              const ctx = getErrorContext(error);
              logger.error('Failed to connect', ctx);
              vscode.window.showErrorMessage(`Failed to connect: ${ctx.message}`);
            }
          },
        );
      })
    );

    // Setup document change listeners
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        const currentRoom = store.getCurrentRoom();
        if (editor && currentRoom) {
          socketClient.emitEvent('file-switch' as any, {
            roomName: currentRoom,
            relativePath: vscode.workspace.asRelativePath(editor.document.fileName),
          });
        }
      }),

      vscode.workspace.onDidChangeTextDocument((e) => {
        const currentRoom = store.getCurrentRoom();
        if (!isApplyingRemoteChange && currentRoom) {
          for (const c of e.contentChanges) {
            socketClient.emitEvent('typing' as any, {
              roomName: currentRoom,
              text: c.text,
              offset: c.rangeOffset,
              length: c.rangeLength,
              fileName: vscode.workspace.asRelativePath(e.document.fileName),
            });
          }
        }
      }),

      vscode.window.onDidChangeTextEditorSelection((e) => {
        const currentRoom = store.getCurrentRoom();
        if (!isApplyingRemoteChange && currentRoom) {
          socketClient.emitEvent('cursor' as any, {
            roomName: currentRoom,
            line: e.selections[0].active.line,
            character: e.selections[0].active.character,
            fileName: vscode.workspace.asRelativePath(e.textEditor.document.fileName),
          });
        }
      }),
    );
  } catch (error) {
    const ctx = getErrorContext(error);
    logger.error('Extension activation failed', ctx);
    vscode.window.showErrorMessage('Pair With Code failed to activate');
  }
}

export function deactivate() {
  logger.info('Pair With Code extension deactivating');
  logger.dispose();
}
