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

export type Device = {
  id: string;
  name: string;
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
};

interface MeshState {
  devices: Device[];
  files: FileState[];
  notifications: Notification[];
  transferRequests: TransferRequest[];
  clipboardText: string | null;
  userName: string;
  addDevice: (device: Device) => void;
  removeDevice: (id: string) => void;
  addFile: (file: FileState) => void;
  removeFile: (id: string) => void;
  updateFileStatus: (id: string, status: FileState['status']) => void;
  setFiles: (files: FileState[]) => void;
  addNotification: (msg: string) => void;
  markNotificationsRead: () => void;
  addTransferRequest: (req: TransferRequest) => void;
  removeTransferRequest: (id: string) => void;
  setClipboardText: (text: string) => void;
  setUserName: (name: string) => void;
}

export const useMeshStore = create<MeshState>((set) => ({
  devices: [],
  files: [],
  notifications: [],
  transferRequests: [],
  clipboardText: null,
  userName: "Athreix Node",
  addDevice: (device) => set((state) => {
    if (state.devices.find(d => d.id === device.id)) return state;
    return { devices: [...state.devices, device] };
  }),
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
  addTransferRequest: (req) => set((state) => ({
    transferRequests: [...state.transferRequests, req]
  })),
  removeTransferRequest: (id) => set((state) => ({
    transferRequests: state.transferRequests.filter(r => r.id !== id)
  })),
  setClipboardText: (text) => set({ clipboardText: text }),
  setUserName: (name) => set({ userName: name })
}));
