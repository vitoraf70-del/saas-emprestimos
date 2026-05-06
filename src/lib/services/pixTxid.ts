import { createHash } from "crypto";

/** txid PIX (26–35 chars alfanuméricos), conforme padrão Bacen. */
export function sanitizePixTxid(input: string) {
  const compact = input.replace(/[^A-Za-z0-9]/g, "");
  const allowedChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  let out = "";
  for (const ch of compact) {
    if (allowedChars.includes(ch)) out += ch;
    if (out.length >= 35) break;
  }

  while (out.length < 26) {
    out += "0";
  }

  return out.slice(0, 35);
}

export function buildPixTxidFromSeed(seed: string) {
  const hash = createHash("sha256").update(seed, "utf8").digest("hex");
  return sanitizePixTxid(hash);
}
