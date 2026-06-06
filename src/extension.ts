import * as vscode from 'vscode';
import { createSocketClient } from './socket/client';
import { createSocketHandlers } from './socket/handlers';
import { createStateStore } from './state/store';
import { createPersistence } from './state/persistence';
import { createRoomHistory } from './state/roomHistory';
import { logger } from './utils/logger';
import { getErrorContext } from './utils/errors';
import { getSettings, onSettingsChange } from './features/settings';
import { createUICommands } from './ui/commands';

let isApplyingRemoteChange = false;

export async function activate(context: vscode.ExtensionContext) {
  try {
    logger.initialize();
    logger.info('Pair With Code extension activating');

    // Initialize core modules
    const persistence = createPersistence(context);
    const store = createStateStore();
    const roomHistory = createRoomHistory(persistence);

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
    const handlers = createSocketHandlers(socketClient, store, persistence);

    // Setup UI commands
    const uiCommands = createUICommands(store, persistence);
    uiCommands.registerCommands(context);

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

    // Register commands
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
      if (isConnected) {
        statusBar.text = '$(primitive-dot) Pair: Online';
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.remoteBackground');
      } else if (isReconnecting) {
        statusBar.text = '$(sync~spin) Pair: Reconnecting...';
      } else {
        statusBar.text = '$(alert) Pair: Offline';
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      }
    });

    // Prompt for room
    const room = await vscode.window.showInputBox({
      prompt: 'Join/Create Room ID',
      ignoreFocusOut: true,
      value: (await persistence.getLastRoom()) || '',
    });

    if (!room) {
      logger.info('No room selected, extension inactive');
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
          throw error;
        }
      },
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
