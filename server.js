const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    
    // Broadcast to all other clients that a new device joined
    socket.broadcast.emit("device:joined", { id: socket.id });

    // Handle signaling for WebRTC
    socket.on("signal", (data) => {
      // Forward the signaling data to the specified target
      io.to(data.target).emit("signal", {
        sender: socket.id,
        signal: data.signal
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

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
