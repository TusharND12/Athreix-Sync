const { createServer } = require("http");
const { attachSocketServer } = require("./socket-handler");

const port = process.env.PORT || 3001;
const hostname = "0.0.0.0";

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Athreix Sync signaling server");
});

attachSocketServer(httpServer);

httpServer.listen(port, hostname, () => {
  console.log(`> Signaling server ready on port ${port}`);
});
