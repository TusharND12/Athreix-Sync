import { create } from 'zustand';

export type FileState = {
  id: string;
  name: string;
  size: number;
  type: string;
  progress?: number;
  status: 'uploading' | 'ready' | 'transferring' | 'completed' | 'error';
  source: 'local' | 'remote';
  blobUrl?: string;
  timestamp: number;
  isEphemeral?: boolean;
  fileObject?: File;
};

export type DeviceConnectionState = 'connecting' | 'connected' | 'relay' | 'failed';

export type Device = {
  id: string;
  name: string;
  connectionState?: DeviceConnectionState;
};

export type Notification = {
  id: string;
  message: string;
  time: number;
  read: boolean;
};

export type TransferRequest = {
  id: string;
  senderId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  isEphemeral: boolean;
  passkey?: string;
};

export type ActiveTransfer = {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  bytesTransferred: number;
  direction: 'send' | 'receive';
  peerId: string;
  peerName: string;
  status: 'pending' | 'transferring' | 'completed' | 'error';
  startedAt: number;
  speedBps: number;
};

interface MeshState {
  devices: Device[];
  files: FileState[];
  notifications: Notification[];
  transferRequests: TransferRequest[];
  activeTransfers: ActiveTransfer[];
  clipboardText: string | null;
  socketConnected: boolean;
  socketError: string | null;
  userName: string;
  addDevice: (device: Device) => void;
  updateDeviceName: (id: string, name: string) => void;
  updateDeviceConnection: (id: string, connectionState: DeviceConnectionState) => void;
  removeDevice: (id: string) => void;
  addFile: (file: FileState) => void;
  removeFile: (id: string) => void;
  updateFileStatus: (id: string, status: FileState['status']) => void;
  setFiles: (files: FileState[]) => void;
  addNotification: (msg: string) => void;
  markNotificationsRead: () => void;
  clearNotifications: () => void;
  addTransferRequest: (req: TransferRequest) => void;
  removeTransferRequest: (id: string) => void;
  startTransfer: (transfer: Omit<ActiveTransfer, 'progress' | 'bytesTransferred' | 'startedAt' | 'speedBps'> & Partial<Pick<ActiveTransfer, 'progress' | 'bytesTransferred' | 'startedAt' | 'speedBps'>>) => void;
  updateTransferProgress: (id: string, bytesTransferred: number) => void;
  completeTransfer: (id: string) => void;
  failTransfer: (id: string) => void;
  removeTransfer: (id: string) => void;
  setClipboardText: (text: string) => void;
  setSocketConnected: (connected: boolean) => void;
  setSocketError: (error: string | null) => void;
  setUserName: (name: string) => void;
}

export const useMeshStore = create<MeshState>((set) => ({
  devices: [],
  files: [],
  notifications: [],
  transferRequests: [],
  activeTransfers: [],
  clipboardText: null,
  socketConnected: false,
  socketError: null,
  userName: "Athreix Node",
  addDevice: (device) => set((state) => {
    const existing = state.devices.find(d => d.id === device.id);
    if (existing) {
      return {
        devices: state.devices.map(d =>
          d.id === device.id ? { ...d, ...device, name: device.name || d.name } : d
        ),
      };
    }
    return { devices: [...state.devices, { ...device, connectionState: device.connectionState ?? 'connecting' }] };
  }),
  updateDeviceName: (id, name) => set((state) => ({
    devices: state.devices.map(d => d.id === id ? { ...d, name } : d)
  })),
  updateDeviceConnection: (id, connectionState) => set((state) => ({
    devices: state.devices.map(d => d.id === id ? { ...d, connectionState } : d)
  })),
  removeDevice: (id) => set((state) => ({
    devices: state.devices.filter(d => d.id !== id)
  })),
  addFile: (file) => set((state) => ({
    files: [...state.files, file]
  })),
  removeFile: (id) => set((state) => ({
    files: state.files.filter(f => f.id !== id)
  })),
  updateFileStatus: (id, status) => set((state) => ({
    files: state.files.map(f => f.id === id ? { ...f, status } : f)
  })),
  setFiles: (files) => set({ files }),
  addNotification: (msg) => set((state) => ({
    notifications: [{ id: Math.random().toString(), message: msg, time: Date.now(), read: false }, ...state.notifications]
  })),
  markNotificationsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true }))
  })),
  clearNotifications: () => set({ notifications: [] }),
  addTransferRequest: (req) => set((state) => ({
    transferRequests: [...state.transferRequests, req]
  })),
  removeTransferRequest: (id) => set((state) => ({
    transferRequests: state.transferRequests.filter(r => r.id !== id)
  })),
  startTransfer: (transfer) => set((state) => {
    const existing = state.activeTransfers.find(t => t.id === transfer.id);
    const entry: ActiveTransfer = {
      progress: 0,
      bytesTransferred: 0,
      startedAt: Date.now(),
      speedBps: 0,
      ...transfer,
    };
    if (existing) {
      return {
        activeTransfers: state.activeTransfers.map(t =>
          t.id === transfer.id ? { ...t, ...entry, startedAt: t.startedAt } : t
        ),
      };
    }
    return { activeTransfers: [...state.activeTransfers, entry] };
  }),
  updateTransferProgress: (id, bytesTransferred) => set((state) => ({
    activeTransfers: state.activeTransfers.map((t) => {
      if (t.id !== id) return t;
      const elapsed = (Date.now() - t.startedAt) / 1000;
      const speedBps = elapsed > 0 ? bytesTransferred / elapsed : 0;
      const progress = t.fileSize > 0
        ? Math.min(100, (bytesTransferred / t.fileSize) * 100)
        : 0;
      return {
        ...t,
        bytesTransferred,
        progress,
        speedBps,
        status: 'transferring' as const,
      };
    }),
  })),
  completeTransfer: (id) => {
    set((state) => ({
      activeTransfers: state.activeTransfers.map((t) =>
        t.id === id
          ? { ...t, status: 'completed' as const, progress: 100, bytesTransferred: t.fileSize }
          : t
      ),
    }));
    setTimeout(() => {
      useMeshStore.getState().removeTransfer(id);
    }, 4000);
  },
  failTransfer: (id) => {
    set((state) => ({
      activeTransfers: state.activeTransfers.map((t) =>
        t.id === id ? { ...t, status: 'error' as const } : t
      ),
    }));
    setTimeout(() => {
      useMeshStore.getState().removeTransfer(id);
    }, 5000);
  },
  removeTransfer: (id) => set((state) => ({
    activeTransfers: state.activeTransfers.filter(t => t.id !== id),
  })),
  setClipboardText: (text) => set({ clipboardText: text }),
  setSocketConnected: (connected) => set({ socketConnected: connected }),
  setSocketError: (error) => set({ socketError: error }),
  setUserName: (name) => set({ userName: name })
}));
