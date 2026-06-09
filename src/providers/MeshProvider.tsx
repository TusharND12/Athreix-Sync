"use client";

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMeshStore } from '@/store/mesh.store';
import { getIceServers } from '@/lib/ice-servers';
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
const DATA_CHANNEL_TIMEOUT_MS = 45000;

async function waitForDataChannel(
  getChannel: () => RTCDataChannel | undefined,
  timeoutMs = DATA_CHANNEL_TIMEOUT_MS
): Promise<RTCDataChannel> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const dc = getChannel();
    if (dc?.readyState === "open") return dc;
    if (dc?.readyState === "closed") break;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Data channel failed to open — peer may be unreachable");
}

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

      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
      socket = socketUrl ? io(socketUrl) : io();
      socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to signaling server as:", socket!.id);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection failed:", err.message);
    });

    socket.on("device:joined", async ({ id }) => {
      console.log("Device joined:", id);
      useMeshStore.getState().addDevice({ id, name: `Node_${id.substring(0, 4)}`, connectionState: "connecting" });
      
      const pc = createPeerConnection(id, socket!);
      
      const dc = pc.createDataChannel("fileTransfer", { ordered: true });
      configureDataChannel(dc);
      dataChannelsRef.current[id] = dc;
      setupDataChannel(dc, id);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket!.emit("signal", {
        target: id,
        signal: { type: "offer", sdp: offer.sdp }
      });
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
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket!.emit("signal", { 
          target: data.sender, 
          signal: { type: "answer", sdp: answer.sdp } 
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
          sendFile(data.sender, file, isEphemeral, data.fileId);
          pendingFilesRef.current.delete(data.fileId);
        }
      } else {
        useMeshStore.getState().addNotification(`File transfer rejected by peer`);
        pendingFilesRef.current.delete(data.fileId);
      }
    });
    };

    init();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, []);

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

  const sendFile = async (targetId: string, file: File, isEphemeral: boolean = false, transferId?: string) => {
    const fileId = transferId ?? Math.random().toString();

    let dc: RTCDataChannel;
    try {
      dc = await waitForDataChannel(() => dataChannelsRef.current[targetId]);
    } catch (err) {
      console.error("Data channel not open to", targetId, err);
      useMeshStore.getState().addNotification(
        "Transfer failed: could not reach peer. Ensure both devices are online and try again."
      );
      useMeshStore.getState().failTransfer(fileId);
      return;
    }

    useMeshStore.getState().startTransfer({
      id: fileId,
      fileName: file.name,
      fileSize: file.size,
      direction: 'send',
      peerId: targetId,
      peerName: getPeerName(targetId),
      status: 'transferring',
    });

    try {
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
    } catch (err) {
      console.error("File transfer failed:", err);
      useMeshStore.getState().failTransfer(fileId);
      useMeshStore.getState().addNotification(`Failed to send ${file.name}`);
    }
  };

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
