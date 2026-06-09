import { getIceServers } from "@/lib/ice-servers";

export async function GET() {
  const servers: RTCIceServer[] = [...getIceServers()];

  const apiKey = process.env.METERED_API_KEY;
  const appName = process.env.METERED_APP_NAME;

  if (apiKey && appName) {
    try {
      const res = await fetch(
        `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
        { next: { revalidate: 3600 } }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return Response.json({ iceServers: data });
        }
        if (data.iceServers && Array.isArray(data.iceServers)) {
          return Response.json({ iceServers: data.iceServers });
        }
      }
    } catch (err) {
      console.error("Failed to fetch Metered TURN credentials:", err);
    }
  }

  return Response.json({ iceServers: servers });
}
