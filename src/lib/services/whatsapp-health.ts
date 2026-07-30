import { prisma } from "@/lib/prisma";

const MONITOR_KEY = "__evolution_monitor__";
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1h entre alertas iguais

export type EvolutionState = "open" | "close" | "connecting" | "unknown";

type MonitorDados = {
  state?: string;
  lastAlertAt?: string;
  lastCheckedAt?: string;
};

function getEvolutionEnv() {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const instance = process.env.EVOLUTION_INSTANCE?.trim();
  if (!baseUrl || !apiKey || !instance) return null;
  return { baseUrl, apiKey, instance };
}

export async function getEvolutionConnectionState(): Promise<{
  state: EvolutionState;
  raw?: unknown;
  error?: string;
}> {
  const env = getEvolutionEnv();
  if (!env) {
    return { state: "unknown", error: "Evolution não configurada" };
  }

  try {
    const res = await fetch(
      `${env.baseUrl}/instance/connectionState/${encodeURIComponent(env.instance)}`,
      {
        headers: { apikey: env.apiKey },
        cache: "no-store"
      }
    );
    const json = (await res.json().catch(() => null)) as {
      instance?: { state?: string };
      state?: string;
    } | null;

    if (!res.ok) {
      return { state: "unknown", raw: json, error: `HTTP ${res.status}` };
    }

    const rawState = String(json?.instance?.state ?? json?.state ?? "unknown").toLowerCase();
    const state: EvolutionState =
      rawState === "open" || rawState === "close" || rawState === "connecting"
        ? rawState
        : "unknown";

    return { state, raw: json };
  } catch (error) {
    return {
      state: "unknown",
      error: error instanceof Error ? error.message : "falha ao consultar Evolution"
    };
  }
}

async function loadMonitor(): Promise<MonitorDados> {
  const row = await prisma.whatsappConversa.findUnique({ where: { telefone: MONITOR_KEY } });
  if (!row?.dados || typeof row.dados !== "object" || Array.isArray(row.dados)) return {};
  return row.dados as MonitorDados;
}

async function saveMonitor(dados: MonitorDados) {
  await prisma.whatsappConversa.upsert({
    where: { telefone: MONITOR_KEY },
    create: { telefone: MONITOR_KEY, etapa: "monitor", dados },
    update: { etapa: "monitor", dados }
  });
}

function getNtfyTopic() {
  return (
    process.env.ALERT_NTFY_TOPIC?.trim() ||
    process.env.NTFY_TOPIC?.trim() ||
    "crediarioms-alerta"
  );
}

function getAlertEmails(): string[] {
  const raw =
    process.env.ALERT_EMAILS?.trim() ||
    "vitoraf70@gmail.com,manspace10@gmail.com";
  return raw
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter(Boolean);
}

/** Push no celular via ntfy.sh (grátis). */
async function sendNtfy(title: string, message: string) {
  const topic = getNtfyTopic();
  const server = (process.env.ALERT_NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "");
  try {
    const res = await fetch(`${server}/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        Title: title,
        Priority: "high",
        Tags: "warning,whatsapp"
      },
      body: message
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Webhook genérico opcional (Make/Zapier/Discord) — ALERT_WEBHOOK_URL. */
async function sendWebhookAlert(title: string, text: string) {
  const url = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, text, emails: getAlertEmails() })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendDisconnectAlert(state: EvolutionState, detail?: string) {
  const instance = process.env.EVOLUTION_INSTANCE ?? "whatsapp";
  const title = "WhatsApp Evolution DESCONECTADO";
  const message = [
    `Instância: ${instance}`,
    `Status: ${state}`,
    detail ? `Detalhe: ${detail}` : "",
    "",
    "Reconecte em: http://177.7.41.117:8080/manager",
    "Escaneie o QR Code com o celular do crediário."
  ]
    .filter(Boolean)
    .join("\n");

  const [ntfy, webhook] = await Promise.all([
    sendNtfy(title, message),
    sendWebhookAlert(title, message)
  ]);

  return { ntfy, webhook, topic: getNtfyTopic() };
}

/**
 * Verifica conexão Evolution e alerta se desconectou.
 * Usa cooldown de 1h para não spammar.
 */
export async function verificarSaudeWhatsApp(options?: {
  forceAlert?: boolean;
  stateOverride?: EvolutionState;
}) {
  const agora = new Date();
  const checked = options?.stateOverride
    ? { state: options.stateOverride, error: undefined as string | undefined }
    : await getEvolutionConnectionState();

  const monitor = await loadMonitor();
  const prev = monitor.state ?? "unknown";
  const state = checked.state;

  await saveMonitor({
    ...monitor,
    state,
    lastCheckedAt: agora.toISOString()
  });

  const desconectado = state === "close" || state === "unknown";
  if (!desconectado) {
    return {
      ok: true,
      state,
      prev,
      alerted: false,
      message: "WhatsApp conectado"
    };
  }

  const lastAlert = monitor.lastAlertAt ? new Date(monitor.lastAlertAt).getTime() : 0;
  const podeAlertar =
    options?.forceAlert ||
    Date.now() - lastAlert >= ALERT_COOLDOWN_MS ||
    prev === "open";

  if (!podeAlertar) {
    return {
      ok: false,
      state,
      prev,
      alerted: false,
      message: "Desconectado — alerta em cooldown"
    };
  }

  const channels = await sendDisconnectAlert(state, checked.error);

  await saveMonitor({
    state,
    lastCheckedAt: agora.toISOString(),
    lastAlertAt: agora.toISOString()
  });

  return {
    ok: false,
    state,
    prev,
    alerted: true,
    channels,
    message: "Desconectado — alerta enviado"
  };
}

/** Extrai estado de evento connection.update da Evolution. */
export function parseEvolutionConnectionEvent(body: unknown): EvolutionState | null {
  const root = body as {
    event?: string;
    data?: { state?: string; instance?: { state?: string } };
  };
  const event = String(root.event ?? "").toLowerCase();
  if (!event.includes("connection")) return null;

  const raw = String(root.data?.state ?? root.data?.instance?.state ?? "").toLowerCase();
  if (raw === "open" || raw === "close" || raw === "connecting") return raw;
  if (raw.includes("close") || raw.includes("refused")) return "close";
  return null;
}
