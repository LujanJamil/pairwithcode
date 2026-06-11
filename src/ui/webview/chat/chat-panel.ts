import * as vscode from 'vscode';
import { StateStore } from '../../../state/store';
import { SocketClient } from '../../../socket/client';
import { logger } from '../../../utils/logger';

export class ChatPanel {
  private static currentPanel: ChatPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private store: StateStore,
    private socket: SocketClient
  ) {
    this._panel = panel;
    this._panel.webview.html = this.getWebviewContent();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      null,
      this._disposables
    );

    // Listen to store events and notify webview
    this.setupStoreListeners();
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    store: StateStore,
    socket: SocketClient
  ) {
    // If we already have a panel, show it
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal(vscode.ViewColumn.Two);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'pairChat',
      'Pair Chat',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [],
        retainContextWhenHidden: true
      }
    );

    ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, store, socket);
  }

  private handleWebviewMessage(message: any) {
    switch (message.command) {
      case 'sendMessage':
        this.handleSendMessage(message.content);
        break;
      case 'deleteMessage':
        this.handleDeleteMessage(message.messageId);
        break;
      case 'addReaction':
        this.handleAddReaction(message.messageId, message.emoji);
        break;
      case 'removeReaction':
        this.handleRemoveReaction(message.messageId, message.emoji);
        break;
      case 'loadHistory':
        this.handleLoadHistory(message.sessionId);
        break;
    }
  }

  private handleSendMessage(content: string) {
    const room = this.store.getCurrentRoom();
    if (!room) {
      logger.warn('Cannot send message: no room selected');
      return;
    }

    // Emit to server
    this.socket.emitEvent('SEND_MESSAGE' as any, {
      roomName: room,
      content,
      timestamp: Date.now()
    });

    logger.debug('Message sent:', { content });
  }

  private handleDeleteMessage(messageId: string) {
    const room = this.store.getCurrentRoom();
    if (!room) return;

    this.socket.emitEvent('DELETE_MESSAGE' as any, {
      roomName: room,
      messageId
    });
  }

  private handleAddReaction(messageId: string, emoji: string) {
    const room = this.store.getCurrentRoom();
    if (!room) return;

    this.socket.emitEvent('MESSAGE_REACTION' as any, {
      roomName: room,
      messageId,
      emoji,
      action: 'add'
    });
  }

  private handleRemoveReaction(messageId: string, emoji: string) {
    const room = this.store.getCurrentRoom();
    if (!room) return;

    this.socket.emitEvent('MESSAGE_REACTION' as any, {
      roomName: room,
      messageId,
      emoji,
      action: 'remove'
    });
  }

  private handleLoadHistory(sessionId: string) {
    // Load message history from store and send to webview
    const messages = this.store.getMessages();
    this._panel.webview.postMessage({
      command: 'loadHistory',
      messages: messages.slice(-50) // Last 50 messages
    });
  }

  private setupStoreListeners() {
    // Listen for new messages
    this.store.on('message-added', (message: any) => {
      this._panel.webview.postMessage({
        command: 'newMessage',
        message
      });
    });

    // Listen for message deletions
    this.store.on('message-deleted', (messageId: string) => {
      this._panel.webview.postMessage({
        command: 'messageDeleted',
        messageId
      });
    });

    // Listen for reactions
    this.store.on('message-reaction-updated', (data: any) => {
      this._panel.webview.postMessage({
        command: 'reactionUpdated',
        messageId: data.messageId,
        reactions: data.reactions
      });
    });
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pair Chat</title>
  <style>
    :root {
      --color-primary: #0078d4;
      --color-primary-dark: #005a9e;
      --color-success: #107c10;
      --color-bg: #ffffff;
      --color-bg-secondary: #f3f3f3;
      --color-fg: #333333;
      --color-fg-secondary: #666666;
      --color-border: #e0e0e0;
      --color-your-bubble: #0078d4;
      --color-their-bubble: #f3f3f3;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.12);
      --shadow-md: 0 4px 6px rgba(0,0,0,0.15);
      --transition-fast: 150ms ease;
      --transition-slow: 300ms ease;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --color-bg: #1e1e1e;
        --color-bg-secondary: #252525;
        --color-fg: #e0e0e0;
        --color-fg-secondary: #b0b0b0;
        --color-border: #404040;
        --color-their-bubble: #333333;
        --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
        --shadow-md: 0 4px 6px rgba(0,0,0,0.5);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      height: 100%;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background-color: var(--color-bg);
      color: var(--color-fg);
    }

    body {
      display: flex;
      flex-direction: column;
    }

    .chat-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .chat-header {
      padding: 16px;
      border-bottom: 1px solid var(--color-border);
      background-color: var(--color-bg-secondary);
      box-shadow: var(--shadow-sm);
      flex-shrink: 0;
    }

    .chat-header h2 {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .chat-messages::-webkit-scrollbar {
      width: 8px;
    }

    .chat-messages::-webkit-scrollbar-track {
      background: transparent;
    }

    .chat-messages::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: 4px;
    }

    .chat-messages::-webkit-scrollbar-thumb:hover {
      background: var(--color-fg-secondary);
    }

    .message-group {
      display: flex;
      gap: 8px;
      margin-bottom: 4px;
      animation: fadeInUp 300ms ease forwards;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message-group.own {
      justify-content: flex-end;
    }

    .message-content {
      max-width: 70%;
      padding: 10px 14px;
      border-radius: 12px;
      word-wrap: break-word;
      font-size: 13px;
      line-height: 1.4;
      box-shadow: var(--shadow-sm);
      transition: all var(--transition-fast);
    }

    .message-content:hover {
      box-shadow: var(--shadow-md);
    }

    .message-group.own .message-content {
      background-color: var(--color-your-bubble);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message-group.other .message-content {
      background-color: var(--color-their-bubble);
      color: var(--color-fg);
      border-bottom-left-radius: 4px;
      border: 1px solid var(--color-border);
    }

    .message-meta {
      font-size: 11px;
      color: var(--color-fg-secondary);
      margin-top: 4px;
      opacity: 0.7;
    }

    .message-group.own .message-meta {
      text-align: right;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 10px 14px;
      background-color: var(--color-their-bubble);
      border-radius: 12px;
      width: fit-content;
      border: 1px solid var(--color-border);
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--color-fg-secondary);
      animation: typingBounce 1.4s infinite;
    }

    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typingBounce {
      0%, 60%, 100% {
        opacity: 0.3;
        transform: translateY(0);
      }
      30% {
        opacity: 1;
        transform: translateY(-10px);
      }
    }

    .chat-input-area {
      padding: 16px;
      border-top: 1px solid var(--color-border);
      background-color: var(--color-bg-secondary);
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-shrink: 0;
    }

    .message-input-wrapper {
      flex: 1;
      display: flex;
      gap: 8px;
      align-items: center;
    }

    input[type="text"] {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background-color: var(--color-bg);
      color: var(--color-fg);
      font-size: 13px;
      outline: none;
      transition: all var(--transition-fast);
    }

    input[type="text"]:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(0, 120, 212, 0.1);
    }

    button {
      padding: 10px 16px;
      background-color: var(--color-primary);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      user-select: none;
    }

    button:hover:not(:disabled) {
      background-color: var(--color-primary-dark);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    button:active:not(:disabled) {
      transform: translateY(0);
    }

    button:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .emoji-picker-btn {
      padding: 8px 12px;
      background-color: transparent;
      color: var(--color-fg);
      border: 1px solid var(--color-border);
      font-size: 16px;
    }

    .emoji-picker-btn:hover:not(:disabled) {
      background-color: var(--color-bg);
      border-color: var(--color-fg-secondary);
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      color: var(--color-fg-secondary);
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
  </style>
</head>
<body>
  <div class="chat-container">
    <div class="chat-header">
      <h2>💬 Pair Chat</h2>
    </div>

    <div class="chat-messages" id="messagesContainer">
      <div class="empty-state">
        <div>
          <div class="empty-state-icon">💬</div>
          <p>No messages yet. Start typing!</p>
        </div>
      </div>
    </div>

    <div class="chat-input-area">
      <div class="message-input-wrapper">
        <button class="emoji-picker-btn" id="emojiBtn" title="Add emoji" aria-label="Add emoji">😊</button>
        <input
          type="text"
          id="messageInput"
          placeholder="Type a message... (Shift+Enter for new line)"
          autocomplete="off"
          aria-label="Message input"
        />
      </div>
      <button id="sendBtn" type="submit" aria-label="Send message">Send</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const messagesContainer = document.getElementById('messagesContainer');

    sendBtn.addEventListener('click', () => {
      const message = messageInput.value.trim();
      if (message) {
        vscode.postMessage({
          command: 'sendMessage',
          content: message
        });
        messageInput.value = '';
        messageInput.focus();
      }
    });

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });

    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.command) {
        case 'newMessage':
          addMessage(message.message);
          break;
        case 'loadHistory':
          loadHistory(message.messages);
          break;
        case 'messageDeleted':
          deleteMessageUI(message.messageId);
          break;
      }
    });

    function addMessage(msg) {
      if (messagesContainer.querySelector('.empty-state')) {
        messagesContainer.innerHTML = '';
      }

      const isOwn = msg.isOwn || false;
      const group = document.createElement('div');
      group.className = \`message-group \${isOwn ? 'own' : 'other'}\`;
      group.id = \`msg-\${msg.id}\`;

      const content = document.createElement('div');
      content.className = 'message-content';
      content.textContent = msg.content;

      const meta = document.createElement('div');
      meta.className = 'message-meta';
      meta.textContent = formatTime(msg.timestamp);

      group.appendChild(content);
      group.appendChild(meta);
      messagesContainer.appendChild(group);

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function loadHistory(messages) {
      messagesContainer.innerHTML = '';
      if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-state"><div><div class="empty-state-icon">💬</div><p>No messages yet</p></div></div>';
      } else {
        messages.forEach(msg => addMessage(msg));
      }
    }

    function deleteMessageUI(messageId) {
      const el = document.getElementById(\`msg-\${messageId}\`);
      if (el) {
        el.style.opacity = '0.5';
        el.style.textDecoration = 'line-through';
      }
    }

    function formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  </script>
</body>
</html>`;
  }

  public postMessage(message: any) {
    this._panel.webview.postMessage(message);
  }

  public dispose() {
    ChatPanel.currentPanel = undefined;
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
