export function shouldBeOfferer(localId: string, remoteId: string): boolean {
  return localId < remoteId;
}

export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 10000): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();

  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    pc.addEventListener("icegatheringstatechange", onChange);
    const timer = setTimeout(done, timeoutMs);
  });
}

export async function waitForDataChannel(
  getChannel: () => RTCDataChannel | undefined,
  timeoutMs: number
): Promise<RTCDataChannel> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const dc = getChannel();
    if (dc?.readyState === "open") return dc;
    if (dc?.readyState === "closed") break;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Data channel not open");
}
