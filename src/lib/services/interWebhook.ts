import { verificarEBaixarPagamento } from "@/lib/services/pix-baixa";

export type PixWebhookItem = {
  txid?: string;
  endToEndId?: string;
  valor?: string;
  horario?: string;
};

export function extractPixWebhookItems(payload: unknown): PixWebhookItem[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as Record<string, unknown>;

  if (Array.isArray(body.pix)) return body.pix as PixWebhookItem[];
  if (Array.isArray(body.data)) return body.data as PixWebhookItem[];
  if (body.txid) return [body as PixWebhookItem];

  return [];
}

export async function processInterPixWebhookPayload(payload: unknown) {
  const pixItems = extractPixWebhookItems(payload);
  if (pixItems.length === 0) {
    return { processed: 0, results: [] as { txid: string; baixado: boolean; motivo: string }[] };
  }

  const results: { txid: string; baixado: boolean; motivo: string }[] = [];
  let processed = 0;

  for (const pix of pixItems) {
    const txid = String(pix.txid ?? "").trim();
    if (!txid) continue;

    const result = await verificarEBaixarPagamento(txid);
    results.push({ txid, baixado: result.baixado, motivo: result.motivo });
    if (result.baixado) processed += 1;
  }

  return { processed, results };
}
