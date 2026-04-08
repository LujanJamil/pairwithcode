const io = require("socket.io")(3000, {
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true }
});

function broadcastRoomSize(roomName) {
  const room = io.sockets.adapter.rooms.get(roomName);
  io.to(roomName).emit("room-update", { count: room ? room.size : 0 });
}

console.log("🚀 Pair Tool PRO Server active on :3000");

io.on("connection", (socket) => {
  socket.on("join-room", (roomName) => {
    socket.join(roomName);
    broadcastRoomSize(roomName);
    const room = io.sockets.adapter.rooms.get(roomName);
    const others = Array.from(room || []).filter(id => id !== socket.id);
    if (others.length > 0) io.to(others).emit("request-initial-state", { requesterId: socket.id });
  });
  socket.on("send-initial-state", (data) => io.to(data.requesterId).emit("receive-initial-state", data.content));
  socket.on("typing", (data) => socket.to(data.roomName).emit("remote-typing", data));
  socket.on("cursor", (data) => socket.to(data.roomName).emit("remote-cursor", { ...data, userId: socket.id }));
  socket.on("file-switch", (data) => socket.to(data.roomName).emit("remote-file-switch", data));
  socket.on("disconnecting", () => {
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.to(room).emit("user-disconnected", socket.id);
        setTimeout(() => broadcastRoomSize(room), 100);
      }
    });
  });
});
