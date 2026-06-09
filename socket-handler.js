const { Server } = require("socket.io");

function attachSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
    maxHttpBufferSize: 10e6, // 10MB per relay chunk
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    const existingPeers = [];
    for (const [id] of io.sockets.sockets) {
      if (id !== socket.id) existingPeers.push({ id });
    }
    socket.emit("server:info", { version: 2, features: ["relay", "peers-list"] });
    socket.emit("peers:list", existingPeers);

    socket.on("peers:request", () => {
      const peers = [];
      for (const [id] of io.sockets.sockets) {
        if (id !== socket.id) peers.push({ id });
      }
      socket.emit("peers:list", peers);
    });

    socket.broadcast.emit("device:joined", { id: socket.id });

    socket.on("signal", (data) => {
      io.to(data.target).emit("signal", {
        sender: socket.id,
        signal: data.signal,
      });
    });

    socket.on("file:request", (data) => {
      io.to(data.target).emit("file:request", {
        sender: socket.id,
        senderName: data.senderName,
        fileId: data.fileId,
        fileName: data.fileName,
        fileSize: data.fileSize,
        isEphemeral: data.isEphemeral,
        passkey: data.passkey,
      });
    });

    socket.on("file:response", (data) => {
      io.to(data.target).emit("file:response", {
        sender: socket.id,
        fileId: data.fileId,
        accepted: data.accepted,
      });
    });

    socket.on("file:relay:start", (data) => {
      io.to(data.target).emit("file:relay:start", {
        sender: socket.id,
        fileId: data.fileId,
        name: data.name,
        size: data.size,
        mimeType: data.mimeType,
        isEphemeral: data.isEphemeral,
      });
    });

    socket.on("file:relay:chunk", (data) => {
      io.to(data.target).emit("file:relay:chunk", {
        sender: socket.id,
        fileId: data.fileId,
        chunkB64: data.chunkB64,
        offset: data.offset,
      });
    });

    socket.on("file:relay:end", (data) => {
      io.to(data.target).emit("file:relay:end", {
        sender: socket.id,
        fileId: data.fileId,
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      socket.broadcast.emit("device:left", { id: socket.id });
    });
  });

  return io;
}

module.exports = { attachSocketServer };
