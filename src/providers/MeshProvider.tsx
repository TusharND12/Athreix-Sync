"use client";

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMeshStore } from '@/store/mesh.store';

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

export const MeshProvider = ({ children }: { children: React.ReactNode }) => {
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<{ [id: string]: RTCPeerConnection }>({});
  const dataChannelsRef = useRef<{ [id: string]: RTCDataChannel }>({});
  const pendingFilesRef = useRef<Map<string, File>>(new Map());
  const iceCandidateQueueRef = useRef<{ [id: string]: RTCIceCandidateInit[] }>({});
  
  const addDevice = useMeshStore((state) => state.addDevice);
  const removeDevice = useMeshStore((state) => state.removeDevice);
  const addFile = useMeshStore((state) => state.addFile);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    const socket = socketUrl ? io(socketUrl) : io();
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to signaling server as:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection failed:", err.message);
    });

    socket.on("device:joined", async ({ id }) => {
      console.log("Device joined:", id);
      useMeshStore.getState().addDevice({ id, name: `Node_${id.substring(0, 4)}` });
      
      const pc = createPeerConnection(id, socket);
      
      const dc = pc.createDataChannel("fileTransfer", { ordered: true });
      configureDataChannel(dc);
      dataChannelsRef.current[id] = dc;
      setupDataChannel(dc, id);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit("signal", {
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
        useMeshStore.getState().addDevice({ id: data.sender, name: `Node_${data.sender.substring(0, 4)}` });
        pc = createPeerConnection(data.sender, socket);
      }
      
      if (data.signal.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("signal", { 
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
          sendFile(data.sender, file, isEphemeral);
          pendingFilesRef.current.delete(data.fileId);
        }
      } else {
        useMeshStore.getState().addNotification(`File transfer rejected by peer`);
        pendingFilesRef.current.delete(data.fileId);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createPeerConnection = (targetId: string, socket: Socket) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peersRef.current[targetId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { target: targetId, signal: event.candidate });
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
            receivingMetadata = null;
            receivedBuffers = [];
            receivedSize = 0;
          }
          return;
        } else if (parsed.type === "file_start") {
          receivingMetadata = parsed;
          receivedBuffers = [];
          receivedSize = 0;
          return;
        }
      } else if (event.data instanceof ArrayBuffer) {
        if (!receivingMetadata) return;

        receivedBuffers.push(event.data);
        receivedSize += event.data.byteLength;

        if (receivedSize >= receivingMetadata.size) {
          finalizeReceivedFile(targetId, receivingMetadata, receivedBuffers);
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

  const sendFile = async (targetId: string, file: File, isEphemeral: boolean = false) => {
    const dc = dataChannelsRef.current[targetId];
    if (!dc || dc.readyState !== "open") {
      console.error("Data channel not open to", targetId);
      useMeshStore.getState().addNotification("Transfer failed: connection not ready");
      return;
    }

    const fileId = Math.random().toString();

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
        offset += CHUNK_SIZE;
      }

      await waitForBuffer(dc);
      dc.send(JSON.stringify({ type: "file_end", id: fileId }));
      useMeshStore.getState().addNotification(`Sent ${file.name} successfully`);
    } catch (err) {
      console.error("File transfer failed:", err);
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
