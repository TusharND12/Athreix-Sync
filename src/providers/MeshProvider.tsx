"use client";

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMeshStore } from '@/store/mesh.store';
import { getIceServers } from '@/lib/ice-servers';
import { shouldBeOfferer, waitForIceGathering } from '@/lib/webrtc-utils';
import { arrayBufferToBase64, base64ToArrayBuffer } from '@/lib/binary-utils';
import type { DeviceConnectionState } from '@/store/mesh.store';

interface MeshContextType {
  socket: Socket | null;
  sendFile: (targetId: string, file: File, isEphemeral?: boolean) => void;
  requestFileTransfer: (targetId: string, file: File, isEphemeral?: boolean, passkey?: string) => void;
  respondToFileRequest: (senderId: string, fileId: string, accepted: boolean) => void;
  broadcastClipboard: (text: string) => void;
  broadcastName: (name: string) => void;
}

const MeshContext = createContext<MeshContextType>({ 
  socket: null, 
  sendFile: () => {},
  requestFileTransfer: () => {},
  respondToFileRequest: () => {},
  broadcastClipboard: () => {},
  broadcastName: () => {}
});

export const useMesh = () => useContext(MeshContext);

const CHUNK_SIZE = 16 * 1024; // 16KB — safe for SCTP
const MAX_BUFFERED = 1024 * 1024; // wait when send buffer exceeds 1MB

function configureDataChannel(dc: RTCDataChannel) {
  dc.binaryType = "arraybuffer";
  dc.bufferedAmountLowThreshold = MAX_BUFFERED / 2;
}

function waitForBuffer(dc: RTCDataChannel): Promise<void> {
  if (dc.bufferedAmount <= MAX_BUFFERED) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (dc.readyState !== "open") {
      reject(new Error("Data channel closed"));
      return;
    }

    const onLow = () => {
      dc.removeEventListener("bufferedamountlow", onLow);
      resolve();
    };
    dc.addEventListener("bufferedamountlow", onLow);
  });
}

async function sendBinaryChunk(dc: RTCDataChannel, data: ArrayBuffer) {
  await waitForBuffer(dc);
  if (dc.readyState !== "open") {
    throw new Error("Data channel closed during transfer");
  }
  dc.send(data);
}

function getPeerName(peerId: string) {
  const device = useMeshStore.getState().devices.find((d) => d.id === peerId);
  return device?.name ?? `Node_${peerId.substring(0, 4)}`;
}

const PROGRESS_UPDATE_INTERVAL = CHUNK_SIZE * 8;
const RELAY_CHUNK_SIZE = 64 * 1024;

type RelayReceiveState = {
  metadata: { id: string; name: string; size: number; mimeType: string; isEphemeral?: boolean };
  buffers: ArrayBuffer[];
  receivedSize: number;
  peerId: string;
};

async function detectConnectionMode(pc: RTCPeerConnection): Promise<DeviceConnectionState> {
  try {
    const stats = await pc.getStats();
    let usesRelay = false;
    stats.forEach((report) => {
      if (report.type === "candidate-pair" && report.state === "succeeded") {
        const local = stats.get(report.localCandidateId as string);
        const remote = stats.get(report.remoteCandidateId as string);
        if (local?.candidateType === "relay" || remote?.candidateType === "relay") {
          usesRelay = true;
        }
      }
    });
    return usesRelay ? "relay" : "connected";
  } catch {
    return "connected";
  }
}

export const MeshProvider = ({ children }: { children: React.ReactNode }) => {
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<{ [id: string]: RTCPeerConnection }>({});
  const dataChannelsRef = useRef<{ [id: string]: RTCDataChannel }>({});
  const pendingFilesRef = useRef<Map<string, File>>(new Map());
  const iceCandidateQueueRef = useRef<{ [id: string]: RTCIceCandidateInit[] }>({});
  const iceServersRef = useRef<RTCIceServer[]>(getIceServers());
  const relayReceiveRef = useRef<Map<string, RelayReceiveState>>(new Map());
  const socketIdRef = useRef<string>("");
  const sendFileRef = useRef<(targetId: string, file: File, isEphemeral?: boolean, transferId?: string) => void>(() => {});
  const initiatePeerRef = useRef<(peerId: string, socket: Socket) => Promise<void>>(async () => {});
  const finalizeFileRef = useRef<(targetId: string, metadata: RelayReceiveState["metadata"], buffers: ArrayBuffer[]) => void>(() => {});

  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        const res = await fetch("/api/ice-servers");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && Array.isArray(data.iceServers)) {
            iceServersRef.current = data.iceServers;
          }
        }
      } catch {
        iceServersRef.current = getIceServers();
      }

      if (cancelled) return;

      let socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") || "";
      try {
        const cfgRes = await fetch("/api/config");
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          if (cfg.socketUrl) socketUrl = cfg.socketUrl;
        }
      } catch {
        /* use build-time fallback */
      }

      const isLocal = typeof window !== "undefined" && window.location.hostname.includes("localhost");

      if (!socketUrl && !isLocal) {
        useMeshStore.getState().setSocketError(
          "Signaling server URL missing. Set SOCKET_SERVER_URL or NEXT_PUBLIC_SOCKET_URL in Vercel, then redeploy."
        );
        return;
      }

      if (socketUrl) {
        try {
          const healthRes = await fetch(`${socketUrl}/health`, { mode: "cors" });
          if (!healthRes.ok) {
            useMeshStore.getState().setSocketError(
              `Signaling server offline at ${socketUrl} (${healthRes.status}). Redeploy Railway and update the URL in Vercel.`
            );
            return;
          }
        } catch {
          useMeshStore.getState().setSocketError(
            `Cannot reach signaling server at ${socketUrl}. Check Railway is running and the public domain is correct.`
          );
          return;
        }
      }

      socket = io(socketUrl || undefined, {
        transports: ["polling", "websocket"],
        upgrade: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 20000,
      });
      socketRef.current = socket;

    const handlePeerDiscovered = async (id: string) => {
      const myId = socket!.id ?? socketIdRef.current;
      if (!myId || id === myId) return;
      useMeshStore.getState().addDevice({ id, name: `Node_${id.substring(0, 4)}`, connectionState: "connecting" });
      if (shouldBeOfferer(myId, id)) {
        await initiatePeerRef.current(id, socket!);
      }
      setTimeout(() => {
        const dev = useMeshStore.getState().devices.find((d) => d.id === id);
        if (dev && (dev.connectionState === "connecting" || dev.connectionState === "failed")) {
          useMeshStore.getState().updateDeviceConnection(id, "relay");
        }
      }, 4000);
    };

    socket.on("connect", () => {
      socketIdRef.current = socket!.id ?? "";
      useMeshStore.getState().setSocketConnected(true);
      useMeshStore.getState().setSocketError(null);
      console.log("Connected to signaling server as:", socket!.id);
      socket!.emit("peers:request");
    });

    socket.on("disconnect", () => {
      useMeshStore.getState().setSocketConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection failed:", err.message);
      useMeshStore.getState().setSocketConnected(false);
      useMeshStore.getState().setSocketError(
        `Signaling server unreachable${socketUrl ? ` (${socketUrl})` : ""}: ${err.message}. ` +
        `Verify Railway is deployed and NEXT_PUBLIC_SOCKET_URL in Vercel matches your Railway public URL.`
      );
    });

    socket.on("server:info", (info: { version?: number }) => {
      if (!info?.version || info.version < 2) {
        useMeshStore.getState().setSocketError("Signaling server outdated — redeploy Railway with latest code.");
      }
    });

    socket.on("peers:list", async (peers: { id: string }[]) => {
      for (const { id } of peers) {
        await handlePeerDiscovered(id);
      }
    });

    socket.on("device:joined", async ({ id }) => {
      console.log("Device joined:", id);
      await handlePeerDiscovered(id);
    });

    socket.on("device:left", (d: { id: string }) => {
      useMeshStore.getState().removeDevice(d.id);
      if (peersRef.current[d.id]) {
        peersRef.current[d.id].close();
        delete peersRef.current[d.id];
      }
      if (dataChannelsRef.current[d.id]) {
        dataChannelsRef.current[d.id].close();
        delete dataChannelsRef.current[d.id];
      }
      delete iceCandidateQueueRef.current[d.id];
    });

    socket.on("signal", async (data) => {
      let pc = peersRef.current[data.sender];
      if (!pc) {
        useMeshStore.getState().addDevice({ id: data.sender, name: `Node_${data.sender.substring(0, 4)}`, connectionState: "connecting" });
        pc = createPeerConnection(data.sender, socket!);
      }
      
      if (data.signal.type === "offer") {
        if (pc.signalingState === "have-local-offer") {
          if (shouldBeOfferer(socketIdRef.current, data.sender)) return;
          await pc.setLocalDescription({ type: "rollback" });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitForIceGathering(pc);
        socket!.emit("signal", { 
          target: data.sender, 
          signal: { type: "answer", sdp: pc.localDescription?.sdp } 
        });
        // Process queued ICE candidates
        if (iceCandidateQueueRef.current[data.sender]) {
          for (const candidate of iceCandidateQueueRef.current[data.sender]) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          iceCandidateQueueRef.current[data.sender] = [];
        }
      } else if (data.signal.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        // Process queued ICE candidates
        if (iceCandidateQueueRef.current[data.sender]) {
          for (const candidate of iceCandidateQueueRef.current[data.sender]) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          iceCandidateQueueRef.current[data.sender] = [];
        }
      } else if (data.signal.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.signal));
        } else {
          if (!iceCandidateQueueRef.current[data.sender]) {
            iceCandidateQueueRef.current[data.sender] = [];
          }
          iceCandidateQueueRef.current[data.sender].push(data.signal);
        }
      }
    });

    socket.on("file:request", (data) => {
      useMeshStore.getState().addTransferRequest({
        id: data.fileId,
        senderId: data.sender,
        senderName: data.senderName,
        fileName: data.fileName,
        fileSize: data.fileSize,
        isEphemeral: data.isEphemeral,
        passkey: data.passkey
      });
    });

    socket.on("file:response", (data) => {
      if (data.accepted) {
        const file = pendingFilesRef.current.get(data.fileId);
        // We stored the ephemeral flag on the file object manually in requestFileTransfer
        const isEphemeral = (file as any)?.isEphemeral;
        
        if (file) {
          sendFileRef.current(data.sender, file, isEphemeral, data.fileId);
          pendingFilesRef.current.delete(data.fileId);
        }
      } else {
        useMeshStore.getState().addNotification(`File transfer rejected by peer`);
        pendingFilesRef.current.delete(data.fileId);
      }
    });

    socket.on("file:relay:start", (data) => {
      const key = `${data.sender}:${data.fileId}`;
      relayReceiveRef.current.set(key, {
        metadata: {
          id: data.fileId,
          name: data.name,
          size: data.size,
          mimeType: data.mimeType,
          isEphemeral: data.isEphemeral,
        },
        buffers: [],
        receivedSize: 0,
        peerId: data.sender,
      });
      useMeshStore.getState().updateDeviceConnection(data.sender, "relay");
      useMeshStore.getState().startTransfer({
        id: data.fileId,
        fileName: data.name,
        fileSize: data.size,
        direction: "receive",
        peerId: data.sender,
        peerName: getPeerName(data.sender),
        status: "transferring",
      });
    });

    socket.on("file:relay:chunk", (data) => {
      const key = `${data.sender}:${data.fileId}`;
      const state = relayReceiveRef.current.get(key);
      if (!state || !data.chunkB64) return;
      const chunk = base64ToArrayBuffer(data.chunkB64);
      state.buffers.push(chunk);
      state.receivedSize += chunk.byteLength;
      useMeshStore.getState().updateTransferProgress(data.fileId, state.receivedSize);
    });

    socket.on("file:relay:end", (data) => {
      const key = `${data.sender}:${data.fileId}`;
      const state = relayReceiveRef.current.get(key);
      if (!state) return;
      finalizeFileRef.current(state.peerId, state.metadata, state.buffers);
      useMeshStore.getState().completeTransfer(data.fileId);
      relayReceiveRef.current.delete(key);
    });
    };

    init();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, []);

  const initiateConnectionToPeer = async (peerId: string, socket: Socket) => {
    if (peersRef.current[peerId]) return;

    const pc = createPeerConnection(peerId, socket);
    const dc = pc.createDataChannel("fileTransfer", { ordered: true });
    configureDataChannel(dc);
    dataChannelsRef.current[peerId] = dc;
    setupDataChannel(dc, peerId);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    socket.emit("signal", {
      target: peerId,
      signal: { type: "offer", sdp: pc.localDescription?.sdp },
    });
  };

  const createPeerConnection = (targetId: string, socket: Socket) => {
    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      iceCandidatePoolSize: 10,
    });

    peersRef.current[targetId] = pc;
    useMeshStore.getState().updateDeviceConnection(targetId, "connecting");

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { target: targetId, signal: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = async () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        const mode = await detectConnectionMode(pc);
        useMeshStore.getState().updateDeviceConnection(targetId, mode);
      } else if (state === "checking" || state === "disconnected") {
        useMeshStore.getState().updateDeviceConnection(targetId, "connecting");
      } else if (state === "failed") {
        useMeshStore.getState().updateDeviceConnection(targetId, "failed");
        useMeshStore.getState().addNotification(
          `Connection to ${getPeerName(targetId)} failed — retrying via relay…`
        );
        try {
          pc.restartIce();
        } catch (err) {
          console.error("ICE restart failed:", err);
        }
      }
    };

    pc.ondatachannel = (event) => {
      configureDataChannel(event.channel);
      setupDataChannel(event.channel, targetId);
      dataChannelsRef.current[targetId] = event.channel;
    };

    return pc;
  };

  const finalizeReceivedFile = (
    targetId: string,
    metadata: { id: string; name: string; size: number; mimeType: string; isEphemeral?: boolean },
    receivedBuffers: ArrayBuffer[]
  ) => {
    const blob = new Blob(receivedBuffers, { type: metadata.mimeType });
    const url = URL.createObjectURL(blob);

    useMeshStore.getState().addFile({
      id: metadata.id,
      name: metadata.name,
      size: metadata.size,
      type: metadata.mimeType,
      blobUrl: url,
      status: "completed",
      source: "remote",
      timestamp: Date.now(),
      isEphemeral: metadata.isEphemeral,
    });

    if (metadata.isEphemeral) {
      useMeshStore.getState().addNotification(`Received ephemeral file: ${metadata.name}`);
    } else {
      useMeshStore.getState().addNotification(`Received ${metadata.name} from a peer node`);
      const a = document.createElement("a");
      a.href = url;
      a.download = metadata.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const setupDataChannel = (dc: RTCDataChannel, targetId: string) => {
    dc.onopen = () => {
      // Broadcast our current name to the new peer
      dc.send(JSON.stringify({ type: "name_update", name: useMeshStore.getState().userName }));
    };

    let receivingMetadata: any = null;
    let receivedBuffers: ArrayBuffer[] = [];
    let receivedSize = 0;

    dc.onmessage = async (event) => {
      if (typeof event.data === "string") {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "clipboard") {
          try {
            await navigator.clipboard.writeText(parsed.data);
            useMeshStore.getState().setClipboardText(parsed.data);
            useMeshStore.getState().addNotification(`Clipboard synced from mesh!`);
          } catch (e) {
            console.error("Clipboard write failed", e);
          }
          return;
        } else if (parsed.type === "name_update") {
          useMeshStore.getState().updateDeviceName(targetId, parsed.name);
          return;
        } else if (parsed.type === "file_end") {
          if (receivingMetadata && parsed.id === receivingMetadata.id) {
            finalizeReceivedFile(targetId, receivingMetadata, receivedBuffers);
            useMeshStore.getState().completeTransfer(parsed.id);
            receivingMetadata = null;
            receivedBuffers = [];
            receivedSize = 0;
          }
          return;
        } else if (parsed.type === "file_start") {
          receivingMetadata = parsed;
          receivedBuffers = [];
          receivedSize = 0;
          useMeshStore.getState().startTransfer({
            id: parsed.id,
            fileName: parsed.name,
            fileSize: parsed.size,
            direction: 'receive',
            peerId: targetId,
            peerName: getPeerName(targetId),
            status: 'transferring',
          });
          return;
        }
      } else if (event.data instanceof ArrayBuffer) {
        if (!receivingMetadata) return;

        receivedBuffers.push(event.data);
        receivedSize += event.data.byteLength;

        if (receivedSize % PROGRESS_UPDATE_INTERVAL < CHUNK_SIZE || receivedSize >= receivingMetadata.size) {
          useMeshStore.getState().updateTransferProgress(receivingMetadata.id, receivedSize);
        }

        if (receivedSize >= receivingMetadata.size) {
          finalizeReceivedFile(targetId, receivingMetadata, receivedBuffers);
          useMeshStore.getState().completeTransfer(receivingMetadata.id);
          receivingMetadata = null;
          receivedBuffers = [];
          receivedSize = 0;
        }
      }
    };
  };

  const requestFileTransfer = (targetId: string, file: File, isEphemeral: boolean = false, passkey?: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    
    const fileId = Math.random().toString();
    // Hack to attach the ephemeral flag to the pending file
    (file as any).isEphemeral = isEphemeral;
    pendingFilesRef.current.set(fileId, file);
    
    useMeshStore.getState().startTransfer({
      id: fileId,
      fileName: file.name,
      fileSize: file.size,
      direction: 'send',
      peerId: targetId,
      peerName: getPeerName(targetId),
      status: 'pending',
    });

    socket.emit("file:request", {
      target: targetId,
      fileId,
      fileName: file.name,
      fileSize: file.size,
      senderName: useMeshStore.getState().userName,
      isEphemeral,
      passkey
    });
  };

  const respondToFileRequest = (senderId: string, fileId: string, accepted: boolean) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("file:response", { target: senderId, fileId, accepted });
    useMeshStore.getState().removeTransferRequest(fileId);
  };

  const sendFileViaRelay = async (
    targetId: string,
    file: File,
    fileId: string,
    isEphemeral: boolean
  ) => {
    const socket = socketRef.current;
    if (!socket) throw new Error("Signaling server not connected");

    useMeshStore.getState().updateDeviceConnection(targetId, "relay");
    useMeshStore.getState().addNotification("Using cloud relay for cross-network transfer…");

    socket.emit("file:relay:start", {
      target: targetId,
      fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      isEphemeral,
    });

    let offset = 0;
    while (offset < file.size) {
      const chunk = await file.slice(offset, offset + RELAY_CHUNK_SIZE).arrayBuffer();
      socket.emit("file:relay:chunk", {
        target: targetId,
        fileId,
        offset,
        chunkB64: arrayBufferToBase64(chunk),
      });
      offset = Math.min(offset + RELAY_CHUNK_SIZE, file.size);
      useMeshStore.getState().updateTransferProgress(fileId, offset);
      await new Promise((r) => setTimeout(r, 0));
    }

    socket.emit("file:relay:end", { target: targetId, fileId });
    useMeshStore.getState().completeTransfer(fileId);
    useMeshStore.getState().addNotification(`Sent ${file.name} via cloud relay`);
  };

  const sendFileViaWebRTC = async (
    dc: RTCDataChannel,
    targetId: string,
    file: File,
    fileId: string,
    isEphemeral: boolean
  ) => {
    dc.send(JSON.stringify({
      type: "file_start",
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      isEphemeral,
    }));

    let offset = 0;
    while (offset < file.size) {
      const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
      await sendBinaryChunk(dc, chunk);
      offset = Math.min(offset + CHUNK_SIZE, file.size);

      if (offset % PROGRESS_UPDATE_INTERVAL < CHUNK_SIZE || offset >= file.size) {
        useMeshStore.getState().updateTransferProgress(fileId, offset);
      }
    }

    await waitForBuffer(dc);
    dc.send(JSON.stringify({ type: "file_end", id: fileId }));
    useMeshStore.getState().completeTransfer(fileId);
    useMeshStore.getState().addNotification(`Sent ${file.name} successfully`);
  };

  const sendFile = async (targetId: string, file: File, isEphemeral: boolean = false, transferId?: string) => {
    const fileId = transferId ?? Math.random().toString();
    const socket = socketRef.current;

    if (!socket?.connected) {
      useMeshStore.getState().failTransfer(fileId);
      useMeshStore.getState().addNotification("Not connected to signaling server. Check NEXT_PUBLIC_SOCKET_URL.");
      return;
    }

    useMeshStore.getState().startTransfer({
      id: fileId,
      fileName: file.name,
      fileSize: file.size,
      direction: "send",
      peerId: targetId,
      peerName: getPeerName(targetId),
      status: "transferring",
    });

    const dc = dataChannelsRef.current[targetId];
    if (dc?.readyState === "open") {
      try {
        await sendFileViaWebRTC(dc, targetId, file, fileId, isEphemeral);
        return;
      } catch (webrtcErr) {
        console.warn("WebRTC send failed, using cloud relay:", webrtcErr);
      }
    }

    try {
      await sendFileViaRelay(targetId, file, fileId, isEphemeral);
    } catch (relayErr) {
      console.error("File transfer failed:", relayErr);
      useMeshStore.getState().failTransfer(fileId);
      useMeshStore.getState().addNotification(`Failed to send ${file.name}`);
    }
  };

  sendFileRef.current = sendFile;
  initiatePeerRef.current = initiateConnectionToPeer;
  finalizeFileRef.current = finalizeReceivedFile;

  const broadcastClipboard = (text: string) => {
    const message = JSON.stringify({ type: "clipboard", data: text });
    Object.values(dataChannelsRef.current).forEach(dc => {
      if (dc.readyState === "open") {
        dc.send(message);
      }
    });
  };

  const broadcastName = (name: string) => {
    const message = JSON.stringify({ type: "name_update", name });
    Object.values(dataChannelsRef.current).forEach(dc => {
      if (dc.readyState === "open") {
        dc.send(message);
      }
    });
  };

  return (
    <MeshContext.Provider value={{ socket: socketRef.current, sendFile, requestFileTransfer, respondToFileRequest, broadcastClipboard, broadcastName }}>
      {children}
    </MeshContext.Provider>
  );
};
