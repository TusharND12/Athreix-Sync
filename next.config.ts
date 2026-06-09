import type { NextConfig } from "next";

const socketServer = (
  process.env.SOCKET_SERVER_URL ||
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  ""
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!socketServer) return [];
    return [
      {
        source: "/socket.io/:path*",
        destination: `${socketServer}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
