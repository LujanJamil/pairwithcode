import * as vscode from "vscode";
import { io, Socket } from "socket.io-client";

const socket: Socket = io("http://localhost:3000", { autoConnect: false });
let isApplyingRemoteChange = false;
let currentRoom: string | undefined;
let statusBarItem: vscode.StatusBarItem;
const remoteDecorations = new Map<string, vscode.TextEditorDecorationType>();

export async function activate(context: vscode.ExtensionContext) {
  // 1. SETUP COMMANDS
  context.subscriptions.push(
    vscode.commands.registerCommand("pairtool.copyRoomId", () => {
      if (currentRoom) {
        vscode.env.clipboard.writeText(currentRoom);
        vscode.window.showInformationMessage(
          `Room ID '${currentRoom}' copied!`,
        );
      }
    }),
    vscode.commands.registerCommand("pairtool.stopSharing", () => {
      socket.disconnect();
      currentRoom = undefined;
      statusBarItem.hide();
      remoteDecorations.forEach((d) => d.dispose());
      vscode.window.showInformationMessage("Collaboration session ended.");
    }),
    vscode.commands.registerCommand("pairtool.menu", async () => {
      const choice = await vscode.window.showQuickPick([
        "Copy Room ID",
        "Stop Sharing Session",
      ]);
      if (choice === "Copy Room ID")
        {vscode.commands.executeCommand("pairtool.copyRoomId");}
      if (choice === "Stop Sharing Session")
        {vscode.commands.executeCommand("pairtool.stopSharing");}
    }),
  );

  // 2. STATUS BAR
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "pairtool.menu";
  context.subscriptions.push(statusBarItem);

  // 3. JOIN SESSION
  currentRoom = await vscode.window.showInputBox({
    prompt: "Join/Create Room ID",
    ignoreFocusOut: true,
  });
  if (!currentRoom) return;

  socket.connect();
  socket.on("connect", () => socket.emit("join-room", currentRoom));

  // --- 4. RECEIVERS ---
  socket.on("room-update", (data: { count: number }) => {
    statusBarItem.text = `$(broadcast) Room: ${currentRoom} (${data.count})`;
    statusBarItem.show();
    if (data.count > 1)
      vscode.window.showInformationMessage("A partner has joined the session!");
  });

  // Follow Mode Receiver: Opens the file sent by partner
  socket.on("remote-file-switch", async (data: { relativePath: string }) => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const fullPath = vscode.Uri.joinPath(
      workspaceFolders[0].uri,
      data.relativePath,
    );
    try {
      const doc = await vscode.workspace.openTextDocument(fullPath);
      await vscode.window.showTextDocument(doc, {
        preview: false,
        preserveFocus: true,
      });
    } catch (e) {
      console.error("Could not find file remotely:", data.relativePath);
    }
  });

  socket.on("remote-typing", async (data) => {
    const editor = vscode.window.activeTextEditor;
    if (
      editor &&
      vscode.workspace.asRelativePath(editor.document.fileName) ===
        data.fileName
    ) {
      isApplyingRemoteChange = true;
      await editor.edit(
        (eb) => {
          const pos = editor.document.positionAt(data.offset);
          data.text === ""
            ? eb.delete(
                new vscode.Range(
                  pos,
                  editor.document.positionAt(data.offset + data.length),
                ),
              )
            : eb.insert(pos, data.text);
        },
        { undoStopBefore: false, undoStopAfter: false },
      );
      isApplyingRemoteChange = false;
    }
  });

  socket.on("remote-cursor", async (data) => {
    const editor = vscode.window.activeTextEditor;
    if (
      editor &&
      vscode.workspace.asRelativePath(editor.document.fileName) ===
        data.fileName
    ) {
      const deco = getOrCreateDecoration(data.userId);
      const pos = new vscode.Position(data.line, data.character);
      editor.setDecorations(deco, [new vscode.Range(pos, pos)]);
    }
  });

  socket.on("request-initial-state", (data) => {
    const editor = vscode.window.activeTextEditor;
    if (editor)
      socket.emit("send-initial-state", {
        requesterId: data.requesterId,
        content: editor.document.getText(),
      });
  });

  socket.on("receive-initial-state", async (content) => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      isApplyingRemoteChange = true;
      await editor.edit((eb) =>
        eb.replace(
          new vscode.Range(
            editor.document.positionAt(0),
            editor.document.positionAt(editor.document.getText().length),
          ),
          content,
        ),
      );
      isApplyingRemoteChange = false;
    }
  });

  socket.on("user-disconnected", (id) => {
    remoteDecorations.get(id)?.dispose();
    remoteDecorations.delete(id);
    vscode.window.showWarningMessage("A partner has left the session.");
  });

  // --- 5. SENDERS ---
  context.subscriptions.push(
    // Sync active file switch (Follow Mode)
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && currentRoom) {
        socket.emit("file-switch", {
          roomName: currentRoom,
          relativePath: vscode.workspace.asRelativePath(
            editor.document.fileName,
          ),
        });
      }
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (!isApplyingRemoteChange && currentRoom) {
        for (const c of e.contentChanges) {
          socket.emit("typing", {
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
      if (!isApplyingRemoteChange && currentRoom) {
        socket.emit("cursor", {
          roomName: currentRoom,
          line: e.selections[0].active.line,
          character: e.selections[0].active.character,
          fileName: vscode.workspace.asRelativePath(
            e.textEditor.document.fileName,
          ),
        });
      }
    }),
  );
}

function getOrCreateDecoration(id: string) {
  if (remoteDecorations.has(id)) return remoteDecorations.get(id)!;
  const color = `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 0.8)`;
  const deco = vscode.window.createTextEditorDecorationType({
    borderStyle: "solid",
    borderWidth: "0 0 0 2px",
    borderColor: color,
    after: { contentText: ` Partner`, color, margin: "0 0 0 10px" },
  });
  remoteDecorations.set(id, deco);
  return deco;
}

export function deactivate() {
  socket.disconnect();
}
