export function getIceServers(): RTCIceServer[] {
  const customJson = process.env.NEXT_PUBLIC_ICE_SERVERS;
  if (customJson) {
    try {
      return JSON.parse(customJson) as RTCIceServer[];
    } catch {
      console.warn("Invalid NEXT_PUBLIC_ICE_SERVERS JSON, using defaults");
    }
  }

  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.relay.metered.ca:80" },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl && turnUser && turnCred) {
    servers.push({
      urls: turnUrl.split(",").map((u) => u.trim()),
      username: turnUser,
      credential: turnCred,
    });
    return servers;
  }

  // Public TURN relay — enables cross-network transfers when no custom TURN is configured
  servers.push({
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  });

  return servers;
}
