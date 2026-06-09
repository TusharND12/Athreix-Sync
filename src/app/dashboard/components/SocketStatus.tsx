"use client";

import { useMeshStore } from "@/store/mesh.store";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";

export const SocketStatus = () => {
  const socketConnected = useMeshStore((s) => s.socketConnected);
  const socketError = useMeshStore((s) => s.socketError);

  if (socketError) {
    return (
      <div className="mb-3 md:mb-4 flex items-start gap-2.5 md:gap-3 p-3 md:p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-xs md:text-sm">
        <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium">Connection issue</p>
          <p className="text-red-200/80 mt-1 break-words">{socketError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-3 md:mb-4 flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl border text-[10px] md:text-xs font-mono uppercase tracking-wide md:tracking-wider ${
      socketConnected
        ? "border-green-500/30 bg-green-500/10 text-green-300"
        : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
    }`}>
      {socketConnected ? <Wifi className="w-4 h-4 shrink-0" /> : <WifiOff className="w-4 h-4 shrink-0" />}
      <span className="truncate">{socketConnected ? "Signaling server connected" : "Connecting to signaling server…"}</span>
    </div>
  );
};
