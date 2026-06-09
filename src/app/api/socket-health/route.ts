export async function GET() {
  const socketUrl = (
    process.env.SOCKET_SERVER_URL ||
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    ""
  ).replace(/\/$/, "");

  if (!socketUrl) {
    return Response.json({ ok: false, error: "SOCKET_SERVER_URL not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${socketUrl}/health`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    return Response.json({ ok: res.ok, socketUrl, ...body });
  } catch (err) {
    return Response.json(
      { ok: false, socketUrl, error: err instanceof Error ? err.message : "unreachable" },
      { status: 503 }
    );
  }
}
