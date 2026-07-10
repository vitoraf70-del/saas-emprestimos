const MAX_CONTINUATION_DEPTH = 40;

export function parseContinuationDepth(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("continuation");
  const depth = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(depth) && depth >= 0 ? depth : 0;
}

export function canScheduleContinuation(depth: number) {
  return depth < MAX_CONTINUATION_DEPTH;
}

export async function scheduleCronContinuation(request: Request, depth: number) {
  const secret = process.env.CRON_SECRET?.trim();
  const base = getCronBaseUrl(request);
  const url = new URL(`${base}/api/cron/cobrancas`);
  url.searchParams.set("continuation", String(depth + 1));
  if (secret) {
    url.searchParams.set("secret", secret);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: secret ? { Authorization: `Bearer ${secret}` } : undefined
    });
  } catch {
    // Próxima janela de horário tenta de novo se a continuação falhar.
  } finally {
    clearTimeout(timer);
  }
}

function getCronBaseUrl(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}
