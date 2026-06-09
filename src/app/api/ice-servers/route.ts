import { getIceServers } from "@/lib/ice-servers";

export async function GET() {
  const stunServers = getIceServers();

  const appName = process.env.METERED_APP_NAME;
  const turnApiKey =
    process.env.METERED_TURN_API_KEY ||
    process.env.METERED_API_KEY ||
    process.env.NEXT_PUBLIC_METERED_TURN_API_KEY;

  if (appName && turnApiKey) {
    try {
      const res = await fetch(
        `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${turnApiKey}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return Response.json({ iceServers: [...stunServers, ...data] });
        }
      } else {
        console.error("Metered TURN API error:", res.status, await res.text());
      }
    } catch (err) {
      console.error("Failed to fetch Metered TURN credentials:", err);
    }
  }

  return Response.json({
    iceServers: stunServers,
    turnConfigured: false,
  });
}
