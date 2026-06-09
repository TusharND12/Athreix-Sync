export async function GET() {
  const socketUrl = (
    process.env.SOCKET_SERVER_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    ""
  ).replace(/\/$/, "");

  return Response.json({
    socketUrl,
    // Client connects to same origin; Vercel rewrites /socket.io → Railway
    connectSameOrigin: Boolean(socketUrl),
  });
}
