"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Upload, Download, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useMeshStore, ActiveTransfer } from "@/store/mesh.store";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatSpeed(bps: number) {
  if (bps <= 0) return "—";
  if (bps < 1024) return `${bps.toFixed(0)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
}

function formatEta(transfer: ActiveTransfer) {
  if (transfer.status === "completed") return "Done";
  if (transfer.status === "error") return "Failed";
  if (transfer.status === "pending") return "Waiting…";
  if (transfer.speedBps <= 0) return "Calculating…";
  const remaining = transfer.fileSize - transfer.bytesTransferred;
  const seconds = Math.ceil(remaining / transfer.speedBps);
  if (seconds < 60) return `${seconds}s left`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s left`;
}

const TransferRow = ({ transfer }: { transfer: ActiveTransfer }) => {
  const isSend = transfer.direction === "send";
  const Icon = isSend ? Upload : Download;
  const statusIcon =
    transfer.status === "completed" ? (
      <CheckCircle className="w-4 h-4 text-green-400" />
    ) : transfer.status === "error" ? (
      <AlertCircle className="w-4 h-4 text-red-400" />
    ) : transfer.status === "pending" ? (
      <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />
    ) : (
      <Icon className="w-4 h-4 text-[var(--lava-300)]" />
    );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      className="glass-card rounded-2xl p-4 border border-white/10"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            {statusIcon}
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate" title={transfer.fileName}>
              {transfer.fileName}
            </p>
            <p className="text-white/40 text-xs mt-0.5">
              {isSend ? "Sending to" : "Receiving from"}{" "}
              <span className="text-[var(--lava-300)]">{transfer.peerName}</span>
            </p>
          </div>
        </div>
        <span className="text-white font-mono text-sm shrink-0">
          {transfer.progress.toFixed(0)}%
        </span>
      </div>

      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden mb-2">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--lava-500)] to-[var(--lava-300)] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${transfer.progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
        {transfer.status === "transferring" && (
          <div className="absolute inset-0 shimmer opacity-60" />
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-white/40 font-mono">
        <span>
          {formatBytes(transfer.bytesTransferred)} / {formatBytes(transfer.fileSize)}
        </span>
        <span className="flex items-center gap-3">
          {transfer.status === "transferring" && (
            <span>{formatSpeed(transfer.speedBps)}</span>
          )}
          <span className="text-white/60">{formatEta(transfer)}</span>
        </span>
      </div>
    </motion.div>
  );
};

export const TransferTimeline = () => {
  const activeTransfers = useMeshStore((state) => state.activeTransfers);

  if (activeTransfers.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-[400px] z-[60] pointer-events-none">
      <div className="pointer-events-auto">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-2 h-2 rounded-full bg-[var(--lava-300)] pulse-dot" />
          <span className="text-xs uppercase tracking-widest text-white/60 font-mono">
            Active Transfers ({activeTransfers.length})
          </span>
        </div>
        <AnimatePresence mode="popLayout">
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {activeTransfers.map((transfer) => (
              <TransferRow key={transfer.id} transfer={transfer} />
            ))}
          </div>
        </AnimatePresence>
      </div>
    </div>
  );
};
