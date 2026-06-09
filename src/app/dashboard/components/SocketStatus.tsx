"use client";

import { useMeshStore } from "@/store/mesh.store";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";

export const SocketStatus = () => {
  const socketConnected = useMeshStore((s) => s.socketConnected);
  const socketError = useMeshStore((s) => s.socketError);

  if (socketError) {
    return (
      <div className="mb-4 flex items-start gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Connection issue</p>
          <p className="text-red-200/80 mt-1">{socketError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-4 flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-mono uppercase tracking-wider ${
      socketConnected
        ? "border-green-500/30 bg-green-500/10 text-green-300"
        : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
    }`}>
      {socketConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
      {socketConnected ? "Signaling server connected" : "Connecting to signaling server…"}
    </div>
  );
};
