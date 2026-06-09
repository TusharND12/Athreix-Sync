"use client";

import { useState } from "react";
import { useMeshStore } from "@/store/mesh.store";
import { useMesh } from "@/providers/MeshProvider";
import { Cpu } from "lucide-react";

export const AIAssistantBar = () => {
  const [input, setInput] = useState("");
  const { requestFileTransfer } = useMesh();
  const devices = useMeshStore((state) => state.devices);
  const files = useMeshStore((state) => state.files);
  const addFile = useMeshStore((state) => state.addFile);

  const handleCommand = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      // Mock AI Intent Parser
      const command = input.toLowerCase();
      
      // Simple parse: "send [filename] to [devicename]"
      if (command.includes("send") || command.includes("share")) {
        // Find target device by exact name, OR just pick the first device if they typed "node" or "device"
        let targetDevice = devices.find(d => command.includes(d.name.toLowerCase()));
        
        if (!targetDevice && devices.length === 1 && (command.includes("node") || command.includes("device") || command.includes("peer"))) {
          targetDevice = devices[0];
        }

        if (targetDevice) {
          // Extract the filename from the command using regex
          const match = command.match(/(?:send|share)\s+(.+?)(?:\s+to\s+|$)/i);
          let fileName = match ? match[1].trim() : "file.txt";

          // Check if the user is referring to an existing file in the mesh
          const existingFile = files.find(f => f.name.toLowerCase() === fileName.toLowerCase());
          
          if (existingFile?.fileObject) {
            // File exists in memory, send it immediately
            requestFileTransfer(targetDevice.id, existingFile.fileObject);
            alert(`AI Intent Executed: Requested to send '${existingFile.name}' to ${targetDevice.name}`);
          } else {
            // Try to auto-fetch from local backend API (bypassing OS Picker!)
            try {
              const res = await fetch(`/api/local-fetch?filename=${encodeURIComponent(fileName)}`);
              
              if (res.ok) {
                const blob = await res.blob();
                const exactName = res.headers.get('X-Exact-Filename') || fileName;
                const fetchedFile = new File([blob], exactName, { type: blob.type });
                
                // Add to mesh store
                addFile({
                  id: Math.random().toString(),
                  name: fetchedFile.name,
                  size: fetchedFile.size,
                  type: fetchedFile.type,
                  status: "ready",
                  source: "local",
                  timestamp: Date.now(),
                  fileObject: fetchedFile
                });
                
                // Automatically send it!
                requestFileTransfer(targetDevice.id, fetchedFile);
                alert(`Magic Auto-Fetch Executed: Found '${fetchedFile.name}' on your hard drive and sent it to ${targetDevice.name}!`);
                return; // Exit early since we succeeded!
              }
            } catch (err) {
              console.error("Local fetch failed:", err);
            }

            // Fallback: If not found on hard drive, prompt OS File Picker
            alert(`File '${fileName}' not found on hard drive. Opening your device's file picker...`);
            
            const inputElement = document.createElement('input');
            inputElement.type = 'file';
            inputElement.onchange = (e: any) => {
              const selectedFile = e.target.files?.[0];
              if (selectedFile) {
                addFile({
                  id: Math.random().toString(),
                  name: selectedFile.name,
                  size: selectedFile.size,
                  type: selectedFile.type,
                  status: "ready",
                  source: "local",
                  timestamp: Date.now(),
                  fileObject: selectedFile
                });
                
                requestFileTransfer(targetDevice!.id, selectedFile);
                alert(`AI Intent Executed: Sent '${selectedFile.name}' to ${targetDevice!.name}`);
              }
            };
            inputElement.click();
          }
        } else if (devices.length === 0) {
          alert("AI Intent Error: No devices connected. Open another browser tab to form a mesh.");
        } else {
          alert("AI Intent Error: Could not resolve target device from your command.");
        }
      } else {
        alert("Try typing a command like: 'send my_photo.jpg to node'");
      }
      
      setInput("");
    }
  };

  return (
    <div className="relative max-w-2xl mx-auto w-full group">
      <div className="absolute -inset-1 bg-gradient-to-r from-[#ff5b1f] to-[#ff9a4a] rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000" />
      <div className="relative flex items-center bg-[#101015] border border-white/10 rounded-full px-6 py-4 shadow-2xl">
        <Cpu className="w-5 h-5 text-[var(--lava-300)] pulse-dot mr-4" />
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleCommand}
          placeholder="Type to share... (e.g., 'send presentation to Node_...')"
          className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-lg font-light"
        />
        <div className="flex items-center gap-2 text-white/40">
          <kbd className="hidden md:inline-block px-2 py-1 rounded bg-white/5 text-xs border border-white/10 font-mono">↵ Enter</kbd>
        </div>
      </div>
    </div>
  );
};
