const { createServer } = require("http");
const { attachSocketServer } = require("./socket-handler");

const port = process.env.PORT || 3001;
const hostname = "0.0.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const httpServer = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders });
    res.end(JSON.stringify({ ok: true, service: "athreix-sync-signaling", version: 2 }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain", ...corsHeaders });
  res.end("Athreix Sync signaling server");
});

attachSocketServer(httpServer);

httpServer.listen(port, hostname, () => {
  console.log(`> Signaling server ready on port ${port}`);
});
