"use client";

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMeshStore } from '@/store/mesh.store';

interface MeshContextType {
  socket: Socket | null;
  sendFile: (targetId: string, file: File, isEphemeral?: boolean) => void;
  requestFileTransfer: (targetId: string, file: File, isEphemeral?: boolean) => void;
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
    // Initialize Socket.io connection
    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to signaling server as:", socket.id);
    });

    socket.on("device:joined", async ({ id }) => {
      console.log("Device joined:", id);
      useMeshStore.getState().addDevice({ id, name: `Node_${id.substring(0, 4)}` });
      
      const pc = createPeerConnection(id, socket);
      
      const dc = pc.createDataChannel("fileTransfer", { ordered: true });
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
        isEphemeral: data.isEphemeral
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
      setupDataChannel(event.channel, targetId);
      dataChannelsRef.current[targetId] = event.channel;
    };

    return pc;
  };

  const setupDataChannel = (dc: RTCDataChannel, targetId: string) => {
    dc.binaryType = "arraybuffer";

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
        } else {
          // File metadata
          receivingMetadata = parsed;
          receivedBuffers = [];
          receivedSize = 0;
        }
      } else if (event.data instanceof ArrayBuffer) {
        if (!receivingMetadata) return;

        receivedBuffers.push(event.data);
        receivedSize += event.data.byteLength;

        if (receivedSize === receivingMetadata.size) {
          const blob = new Blob(receivedBuffers, { type: receivingMetadata.type });
          const url = URL.createObjectURL(blob);
          
          useMeshStore.getState().addFile({
            id: receivingMetadata.id,
            name: receivingMetadata.name,
            size: receivingMetadata.size,
            type: receivingMetadata.type,
            blobUrl: url,
            status: "completed",
            source: "remote",
            timestamp: Date.now(),
            isEphemeral: receivingMetadata.isEphemeral
          });
          
          if (receivingMetadata.isEphemeral) {
            useMeshStore.getState().addNotification(`Received ephemeral file: ${receivingMetadata.name}`);
          } else {
            useMeshStore.getState().addNotification(`Received ${receivingMetadata.name} from a peer node`);
            // Trigger automatic download
            const a = document.createElement('a');
            a.href = url;
            a.download = receivingMetadata.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }

          // Reset
          receivingMetadata = null;
          receivedBuffers = [];
          receivedSize = 0;
        }
      }
    };
  };

  const requestFileTransfer = (targetId: string, file: File, isEphemeral: boolean = false) => {
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
      isEphemeral
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
      return;
    }

    const fileId = Math.random().toString();
    
    // Send metadata
    dc.send(JSON.stringify({
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      isEphemeral
    }));

    // Chunk and send
    const chunkSize = 16384;
    const arrayBuffer = await file.arrayBuffer();
    
    let offset = 0;
    while (offset < arrayBuffer.byteLength) {
      const slice = arrayBuffer.slice(offset, offset + chunkSize);
      dc.send(slice);
      offset += chunkSize;
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
