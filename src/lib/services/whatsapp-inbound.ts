import { normalizeWhatsAppDigits } from "@/lib/services/whatsapp";

export type InboundWhatsAppMessage = {
  telefone: string;
  texto: string;
  fromMe: boolean;
  pushName?: string;
};

function extractText(message: Record<string, unknown> | undefined): string {
  if (!message) return "";
  if (typeof message.conversation === "string") return message.conversation;
  const extended = message.extendedTextMessage as { text?: string } | undefined;
  if (extended?.text) return extended.text;
  const buttons = message.buttonsResponseMessage as { selectedDisplayText?: string } | undefined;
  if (buttons?.selectedDisplayText) return buttons.selectedDisplayText;
  const list = message.listResponseMessage as { title?: string } | undefined;
  if (list?.title) return list.title;
  return "";
}

function jidToPhone(jid: string) {
  const digits = jid.replace(/@.*/, "").replace(/\D/g, "");
  return normalizeWhatsAppDigits(digits);
}

/** Evolution API — evento messages.upsert */
export function parseEvolutionInbound(body: unknown): InboundWhatsAppMessage | null {
  const root = body as {
    event?: string;
    data?: {
      key?: { remoteJid?: string; fromMe?: boolean };
      message?: Record<string, unknown>;
      pushName?: string;
    };
  };

  const data = root.data;
  if (!data?.key?.remoteJid) return null;
  if (root.event && !root.event.includes("messages")) return null;

  const jid = data.key.remoteJid;
  if (jid.endsWith("@g.us")) return null;

  const texto = extractText(data.message).trim();
  if (!texto) return null;

  return {
    telefone: jidToPhone(jid),
    texto,
    fromMe: Boolean(data.key.fromMe),
    pushName: data.pushName
  };
}

/** Z-API — ReceivedCallback */
export function parseZapiInbound(body: unknown): InboundWhatsAppMessage | null {
  const root = body as {
    phone?: string;
    text?: { message?: string };
    message?: string;
    fromMe?: boolean;
    isGroup?: boolean;
  };

  if (root.isGroup) return null;
  const texto = (root.text?.message ?? root.message ?? "").trim();
  if (!texto || !root.phone) return null;

  return {
    telefone: normalizeWhatsAppDigits(root.phone),
    texto,
    fromMe: Boolean(root.fromMe)
  };
}

export function parseInboundWhatsApp(body: unknown, provider: string): InboundWhatsAppMessage | null {
  const p = provider.toLowerCase();
  if (p === "zapi") return parseZapiInbound(body);
  return parseEvolutionInbound(body);
}
