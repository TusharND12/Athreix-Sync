const { Server } = require("socket.io");

function attachSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

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

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      socket.broadcast.emit("device:left", { id: socket.id });
    });
  });

  return io;
}

module.exports = { attachSocketServer };
