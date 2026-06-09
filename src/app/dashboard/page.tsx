"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Folder, 
  FileVideo, 
  FileText, 
  FileImage, 
  Share2, 
  MoreVertical, 
  Clock, 
  Network,
  Settings,
  Bell,
  HardDrive,
  UploadCloud,
  File,
  CheckCircle,
  Activity,
  ShieldAlert,
  Copy,
  Search,
  Cloud,
  FilePlus,
  Menu,
  X
} from "lucide-react";
import { useMeshStore } from "@/store/mesh.store";
import { useMesh } from "@/providers/MeshProvider";
import { AIAssistantBar } from "./components/AIAssistant";

// --- Sub-Components ---

const FileCard = ({ file, delay }: { file: any, delay: number }) => {
  const getFileIcon = (type: string) => {
    if (type.includes("video")) return FileVideo;
    if (type.includes("image")) return FileImage;
    if (type.includes("pdf")) return FileText;
    return File;
  };

  const Icon = getFileIcon(file.type);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card p-5 rounded-2xl hover:border-[var(--lava-300)]/50 transition-all group cursor-pointer"
    >
      <div className="flex justify-between items-start mb-12">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <button className="text-white/30 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
      
      <h4 className="text-white font-medium mb-1 truncate" title={file.name}>{file.name}</h4>
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
        <div className="flex items-center gap-1">
          {file.status === "completed" ? (
            <span className={file.source === 'local' ? "text-[var(--lava-300)]" : "text-green-400"}>
              {file.source === 'local' ? "Available" : "Received"}
            </span>
          ) : (
            <span className="text-yellow-400">Transferring...</span>
          )}
        </div>
      </div>
      {file.blobUrl && (
        <a 
          href={file.blobUrl} 
          download={file.name}
          className="mt-4 block text-center text-xs bg-white/10 hover:bg-white/20 py-1.5 rounded-lg transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          Download
        </a>
      )}
    </motion.div>
  );
};

const EmptyState = ({ message, showActions }: { message: string, showActions?: boolean }) => {
  const addFile = useMeshStore((state) => state.addFile);
  
  return (
    <div className="w-full py-16 flex flex-col items-center justify-center text-white/30 border border-dashed border-white/10 rounded-2xl">
      <Network className="w-12 h-12 mb-4 opacity-50" />
      <p className="mb-8 text-center px-4">{message}</p>
      
      {showActions && (
        <div className="flex flex-wrap justify-center gap-4">
          <button 
            onClick={() => alert("Scanning local network for unlinked Athreix Sync nodes...")}
            className="flex flex-col items-center justify-center w-32 h-32 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors text-white/70 hover:text-white group"
          >
            <Search className="w-8 h-8 mb-2 group-hover:text-[var(--lava-300)] transition-colors" />
            <span className="text-sm font-medium">Scan Network</span>
          </button>
          
          <button 
            onClick={() => {
              addFile({
                id: Math.random().toString(),
                name: "New_Document.txt",
                size: 0,
                type: "text/plain",
                status: "completed",
                source: "local",
                timestamp: Date.now()
              });
            }}
            className="flex flex-col items-center justify-center w-32 h-32 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors text-white/70 hover:text-white group"
          >
            <FilePlus className="w-8 h-8 mb-2 group-hover:text-[var(--lava-400)] transition-colors" />
            <span className="text-sm font-medium">Create File</span>
          </button>
          
          <button 
            onClick={() => alert("Connecting to Cloud Provider... (Mock Feature)")}
            className="flex flex-col items-center justify-center w-32 h-32 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors text-white/70 hover:text-white group"
          >
            <Cloud className="w-8 h-8 mb-2 group-hover:text-[var(--lava-500)] transition-colors" />
            <span className="text-sm font-medium">Cloud Sync</span>
          </button>
        </div>
      )}
    </div>
  );
};

// --- Views ---

const FileGrid = ({ files, emptyMessage, showActions }: { files: any[], emptyMessage: string, showActions?: boolean }) => {
  if (files.length === 0) return <EmptyState message={emptyMessage} showActions={showActions} />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
      {files.map((file, i) => <FileCard key={file.id} file={file} delay={i * 0.1} />)}
    </div>
  );
};

const DeviceSyncView = ({ onTriggerSend }: { onTriggerSend?: (file: File, targetId: string) => void }) => {
  const devices = useMeshStore((state) => state.devices);
  const addFile = useMeshStore((state) => state.addFile);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  const handleDeviceFileUpload = (e: React.ChangeEvent<HTMLInputElement>, deviceId: string) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      addFile({
        id: Math.random().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        status: "completed",
        source: "local",
        timestamp: Date.now()
      });
      if (onTriggerSend) {
        onTriggerSend(file, deviceId);
      }
    }
  };

  if (devices.length === 0) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center text-white/30 border border-dashed border-white/10 rounded-2xl">
        <Network className="w-12 h-12 mb-4 opacity-50" />
        <p>No devices connected in the mesh network.</p>
        <p className="text-sm mt-2 opacity-60">Open Athreix Sync on another device or browser tab to see them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-8">
      {devices.map((device, i) => {
        const isExpanded = expandedDevice === device.id;
        
        return (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            key={device.id} 
            className="glass-card rounded-2xl overflow-hidden cursor-pointer hover:border-[var(--lava-300)]/50 transition-colors"
            onClick={() => setExpandedDevice(isExpanded ? null : device.id)}
          >
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                  <Activity className="w-6 h-6 text-green-400 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-white font-medium text-lg">{device.name}</h4>
                  <p className="text-sm text-white/50">WebRTC DataChannel • Connected</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-white/40 mb-1">Latency</span>
                <span className="text-[var(--lava-300)] font-mono font-medium">~{Math.floor(Math.random() * 30 + 10)}ms</span>
              </div>
            </div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-black/40 border-t border-white/10 px-6 py-4 flex gap-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="flex-1 py-3 bg-[var(--lava-400)]/20 hover:bg-[var(--lava-400)]/40 border border-[var(--lava-400)]/50 text-white rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors font-medium">
                    <UploadCloud className="w-5 h-5" />
                    Send File
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => handleDeviceFileUpload(e, device.id)} 
                    />
                  </label>
                  <button 
                    onClick={() => alert(`Sent a ping to ${device.name} to request files! (Mock feature)`)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl flex items-center justify-center gap-2 transition-colors font-medium"
                  >
                    <Share2 className="w-5 h-5" />
                    Request File
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
};

// --- Modals ---

const IncomingTransferModal = () => {
  const transferRequests = useMeshStore((state) => state.transferRequests);
  const { respondToFileRequest } = useMesh();
  const [passkeyInput, setPasskeyInput] = useState("");
  const [error, setError] = useState("");

  if (transferRequests.length === 0) return null;

  const request = transferRequests[0];
  const requiresPasskey = !!request.passkey && request.passkey.length > 0;
  
  const handleAccept = () => {
    if (requiresPasskey && passkeyInput !== request.passkey) {
      setError("Incorrect passkey");
      return;
    }
    setError("");
    respondToFileRequest(request.senderId, request.id, true);
    setPasskeyInput("");
  };

  const handleDecline = () => {
    respondToFileRequest(request.senderId, request.id, false);
    setPasskeyInput("");
    setError("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-[400px] p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center text-center"
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[var(--lava-400)] to-[var(--lava-300)] flex items-center justify-center mb-4">
          <Share2 className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Incoming File</h3>
        <p className="text-white/60 mb-6">
          <strong className="text-white">{request.senderName}</strong> wants to send you <br />
          <strong className="text-white">"{request.fileName}"</strong> ({(request.fileSize / 1024 / 1024).toFixed(2)} MB)
        </p>

        {requiresPasskey && (
          <div className="w-full mb-6 text-left">
            <label className="block text-sm font-medium text-white/70 mb-2">Enter Passkey to Accept</label>
            <input 
              type="password" 
              value={passkeyInput}
              onChange={(e) => { setPasskeyInput(e.target.value); setError(""); }}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-[var(--lava-300)] transition-colors"
              placeholder="Passkey required"
            />
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>
        )}
        
        <div className="flex w-full gap-3">
          <button 
            onClick={handleDecline}
            className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-colors font-medium"
          >
            Decline
          </button>
          <button 
            onClick={handleAccept}
            className="flex-1 py-3 bg-[var(--lava-500)] hover:bg-[var(--lava-400)] text-white shadow-[0_0_20px_rgba(255,91,31,0.4)] rounded-xl transition-all font-medium"
          >
            Accept
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const EphemeralViewerModal = () => {
  const files = useMeshStore((state) => state.files);
  const removeFile = useMeshStore((state) => state.removeFile);

  // Find any ephemeral file that has been fully received
  const ephemeralFile = files.find(f => f.isEphemeral && f.blobUrl);

  if (!ephemeralFile) return null;

  const destroyAndClose = () => {
    if (ephemeralFile.blobUrl) {
      URL.revokeObjectURL(ephemeralFile.blobUrl);
    }
    removeFile(ephemeralFile.id);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-[90vw] max-w-4xl h-[80vh] p-6 rounded-3xl border border-red-500/30 shadow-[0_0_50px_rgba(255,0,0,0.1)] flex flex-col items-center"
      >
        <div className="flex justify-between items-center w-full mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white leading-none">Burn After Reading</h3>
              <p className="text-red-400 text-sm">Highly classified transmission</p>
            </div>
          </div>
          <button 
            onClick={destroyAndClose}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-full transition-colors flex items-center gap-2"
          >
            Close & Destroy
          </button>
        </div>

        <div className="flex-1 w-full bg-black/50 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center relative">
          {ephemeralFile.type.startsWith('image/') ? (
            <img src={ephemeralFile.blobUrl} className="max-w-full max-h-full object-contain" alt="Ephemeral Content" />
          ) : (
            <div className="text-white/50 text-center">
              <FileIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Text/Binary content available.</p>
              <a href={ephemeralFile.blobUrl} download={ephemeralFile.name} className="mt-4 inline-block px-4 py-2 bg-white/10 rounded-lg text-white">Temporary Download</a>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const SettingsModal = ({ show, onClose, onSave }: { show: boolean, onClose: () => void, onSave: (name: string) => void }) => {
  const userName = useMeshStore((state) => state.userName);
  const setUserName = useMeshStore((state) => state.setUserName);
  const [tempName, setTempName] = useState(userName);

  // Sync tempName when modal opens
  useEffect(() => {
    if (show) setTempName(userName);
  }, [show, userName]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-[90%] max-w-[400px] p-6 rounded-3xl border border-white/10 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Settings</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Display Name</label>
            <input 
              type="text" 
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-[var(--lava-300)] transition-colors"
              placeholder="e.g. Athreix Node"
            />
            <p className="text-xs text-white/40 mt-2">This name will be visible to peers when you send them files.</p>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              const newName = tempName || "Anonymous Node";
              setUserName(newName);
              onSave(newName);
              onClose();
            }}
            className="flex-1 py-2.5 bg-[var(--lava-500)] hover:bg-[var(--lava-400)] text-white shadow-[0_0_15px_rgba(255,91,31,0.3)] rounded-xl transition-all font-medium"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const SendFileModal = ({ 
  pendingSend, 
  onClose, 
  onSend 
}: { 
  pendingSend: { file: File, targetId?: string } | null, 
  onClose: () => void,
  onSend: (targetId: string, file: File, isEphemeral: boolean, passkey: string) => void
}) => {
  const devices = useMeshStore(state => state.devices);
  const [passkey, setPasskey] = useState("");
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string>("");

  useEffect(() => {
    if (pendingSend?.targetId) setSelectedDevice(pendingSend.targetId);
    else if (devices.length > 0 && !selectedDevice) setSelectedDevice(devices[0].id);
  }, [pendingSend, devices, selectedDevice]);

  if (!pendingSend) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-[90%] max-w-[400px] p-6 rounded-3xl border border-white/10 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Send File</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-sm font-medium text-white truncate">{pendingSend.file.name}</p>
            <p className="text-xs text-white/50">{(pendingSend.file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Target Device</label>
            <select 
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-[var(--lava-300)] transition-colors"
            >
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Passkey (Optional)</label>
            <input 
              type="password" 
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-[var(--lava-300)] transition-colors"
              placeholder="Leave blank for no passkey"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer mt-4">
            <input 
              type="checkbox" 
              checked={isEphemeral} 
              onChange={(e) => setIsEphemeral(e.target.checked)} 
              className="accent-[var(--lava-500)]"
            />
            <span className="text-sm text-white/70">Burn After Reading (Ephemeral)</span>
          </label>
        </div>

        <div className="mt-8 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-colors font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onSend(selectedDevice, pendingSend.file, isEphemeral, passkey);
              onClose();
            }}
            disabled={!selectedDevice}
            className="flex-1 py-2.5 bg-[var(--lava-500)] hover:bg-[var(--lava-400)] text-white shadow-[0_0_15px_rgba(255,91,31,0.3)] rounded-xl transition-all font-medium disabled:opacity-50"
          >
            Send Request
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main Page ---

export default function Dashboard() {
  const [activeView, setActiveView] = useState("My Mesh");
  const [isDragging, setIsDragging] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingSendFile, setPendingSendFile] = useState<{file: File, targetId?: string} | null>(null);

  const files = useMeshStore((state) => state.files);
  const devices = useMeshStore((state) => state.devices);
  const notifications = useMeshStore((state) => state.notifications);
  const clipboardText = useMeshStore((state) => state.clipboardText);
  const markNotificationsRead = useMeshStore((state) => state.markNotificationsRead);
  const addFile = useMeshStore((state) => state.addFile);
  const { requestFileTransfer, broadcastClipboard, broadcastName } = useMesh();

  // Phase 1: Ephemeral Toggle state
  const [isEphemeral, setIsEphemeral] = useState(false);

  // Phase 1: Spatial Flick-to-Send (DeviceMotion Hook)
  useEffect(() => {
    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (acc && acc.z && Math.abs(acc.z) > 15) { // 15 m/s^2 is a strong flick
        // Only trigger if we have devices and a recent local file
        if (devices.length > 0) {
          const recentLocal = [...files].filter(f => f.source === 'local').sort((a,b) => b.timestamp - a.timestamp)[0];
          if (recentLocal && Date.now() - recentLocal.timestamp < 60000) {
            // Find actual file object in a real implementation (mocking for conceptual flick)
            alert(`Flick detected! Requesting transfer of ${recentLocal.name} to ${devices[0].name}`);
          }
        }
      }
    };

    // Need to request permission on iOS
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      // Typically requires a user gesture, so this will only work if attached to a button on iOS
    } else {
      window.addEventListener('devicemotion', handleMotion);
    }

    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [devices, files]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const usedStorageBytes = useMemo(() => {
    return files.filter(f => f.source === 'local').reduce((acc, curr) => acc + curr.size, 0);
  }, [files]);

  const usedStorageMB = (usedStorageBytes / 1024 / 1024).toFixed(2);

  // Filtered views
  const localFiles = files.filter(f => f.source === 'local');
  const remoteFiles = files.filter(f => f.source === 'remote');
  const recentFiles = [...files].sort((a, b) => b.timestamp - a.timestamp);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    addFile({
      id: Math.random().toString(),
      name: file.name,
      size: file.size,
      type: file.type,
      status: "completed",
      source: "local",
      timestamp: Date.now(),
      fileObject: file
    });

    if (devices.length > 0) {
      setPendingSendFile({ file });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const renderActiveView = () => {
    switch (activeView) {
      case "My Mesh":
        return <DeviceSyncView onTriggerSend={(file, targetId) => setPendingSendFile({ file, targetId })} />;
      case "Shared with Me":
        return <FileGrid files={remoteFiles} emptyMessage="No files received from peers yet." />;
      case "Recent":
        return <FileGrid files={recentFiles} emptyMessage="No recent files." />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex">
      <IncomingTransferModal />
      <EphemeralViewerModal />
      <SettingsModal show={showSettings} onClose={() => setShowSettings(false)} onSave={broadcastName} />
      <SendFileModal 
        pendingSend={pendingSendFile} 
        onClose={() => setPendingSendFile(null)} 
        onSend={(targetId, file, ephemeral, pk) => {
          requestFileTransfer(targetId, file, ephemeral, pk);
          alert(`Transfer requested to ${devices.find(d => d.id === targetId)?.name}! Waiting for acceptance.`);
        }}
      />
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`w-64 border-r border-white/5 h-screen flex flex-col glass fixed left-0 top-0 z-50 transform transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff5b1f] to-[#ff9a4a] flex items-center justify-center">
              <Network className="w-4 h-4 text-white" />
            </div>
            <span className="display text-xl tracking-[0.18em] text-white">ATHREIXSYNC</span>
          </div>
          <button 
            className="md:hidden text-white/50 hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 py-6 px-4 space-y-2">
          <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4 px-2">Navigation</div>
          
          {[
            { icon: Network, label: "My Mesh" },
            { icon: Share2, label: "Shared with Me" },
            { icon: Clock, label: "Recent" },
          ].map((item) => (
            <button 
              key={item.label}
              onClick={() => {
                setActiveView(item.label);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                activeView === item.label 
                  ? "bg-[var(--lava-400)]/20 text-[var(--lava-300)] border border-[var(--lava-400)]/30" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto p-6 border-t border-white/5 space-y-4">
          <button 
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                broadcastClipboard(text);
                alert("Clipboard broadcasted to mesh!");
              } catch (e) {
                alert("Could not read clipboard. Please ensure HTTPS or localhost.");
              }
            }}
            className="w-full py-3 bg-[var(--lava-300)]/10 hover:bg-[var(--lava-300)]/20 text-[var(--lava-300)] rounded-xl flex items-center justify-center gap-2 transition-all font-medium border border-[var(--lava-300)]/20"
          >
            <Copy className="w-4 h-4" />
            Broadcast Clipboard
          </button>
          
          <div className="bg-white/5 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm font-medium">Local Storage</span>
              <span className="text-white text-sm font-bold">{usedStorageMB} MB</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[var(--lava-400)] to-[var(--lava-300)]" 
                style={{ width: `${Math.min((usedStorageBytes / (100 * 1024 * 1024)) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <main 
        className={`flex-1 md:ml-64 p-4 md:p-8 relative overflow-hidden transition-colors ${isDragging ? 'bg-[var(--lava-300)]/10' : ''} w-full`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={handleDrop}
      >
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[var(--lava-400)] opacity-10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[20%] w-[500px] h-[500px] rounded-full bg-[var(--lava-300)] opacity-10 blur-[100px] pointer-events-none" />

        <header className="flex items-center justify-between mb-12 relative z-40">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden w-10 h-10 rounded-full glass flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="display text-2xl md:text-3xl text-white mb-1">{activeView}</h1>
              <p className="text-white/50 hidden md:block text-sm">
                {activeView === "Device Sync" ? "Manage your real-time peer connections." : "Your files are synced securely across your devices."}
              </p>
            </div>
          </div>
          <div className="flex gap-2 md:gap-4 relative">
            <button 
              onClick={() => setIsEphemeral(!isEphemeral)}
              className={`px-3 md:px-4 py-2 rounded-xl flex items-center gap-2 transition-all font-bold text-sm ${
                isEphemeral 
                  ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] border border-red-400" 
                  : "glass text-white/50 hover:text-white"
              }`}
              title="Toggle 'Burn After Reading' mode for next upload"
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden md:inline">{isEphemeral ? "Ephemeral ON" : "Ephemeral OFF"}</span>
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 rounded-full glass flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (showNotifications) markNotificationsRead();
                }}
                className="w-10 h-10 rounded-full glass flex items-center justify-center text-white/60 hover:text-white transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <div className="absolute top-0 right-0 w-4 h-4 rounded-full bg-[var(--lava-500)] text-[10px] font-bold text-white flex items-center justify-center pulse-dot">
                    {unreadCount}
                  </div>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-80 glass-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                      <h4 className="text-white font-medium">Notifications</h4>
                      <button onClick={markNotificationsRead} className="text-xs text-[var(--lava-300)] hover:underline">Mark all read</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-white/40 text-sm">No new notifications</div>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className={`p-4 border-b border-white/5 flex gap-3 ${!n.read ? 'bg-white/5' : ''}`}>
                            <div className="mt-1"><CheckCircle className="w-4 h-4 text-[var(--lava-300)]" /></div>
                            <div>
                              <p className="text-sm text-white/80">{n.message}</p>
                              <p className="text-xs text-white/30 mt-1">{new Date(n.time).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="relative z-10">
          {activeView !== "Device Sync" && <AIAssistantBar />}
          
          <div className="mt-16">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white">
                {activeView === "Recent" ? "Timeline" : "All Items"}
              </h3>
            </div>
            
            {renderActiveView()}
          </div>

          <div className="mt-12 glass p-6 rounded-2xl border border-white/5 flex items-center justify-between bg-gradient-to-r from-[#1a1a2e] to-transparent">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full ${devices.length > 0 ? 'bg-green-500/20 border-green-500/30' : 'bg-white/10 border-white/20'} flex items-center justify-center border`}>
                <Network className={`w-6 h-6 ${devices.length > 0 ? 'text-green-400' : 'text-white/40'}`} />
              </div>
              <div>
                <h4 className="text-white font-medium">Local Mesh Active</h4>
                <p className="text-sm text-white/50">
                  {devices.length > 0 
                    ? `Connected to ${devices.length} peer(s): ${devices.map(d => d.name).join(", ")}. Ready for transfer.`
                    : "Waiting for peers to join the network. Open another browser tab to connect."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
