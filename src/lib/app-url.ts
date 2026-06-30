import os from "node:os";

function detectLanHost() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

/**
 * URL pública usada em links de WhatsApp e cobrança.
 * Em dev, se o .env estiver com localhost, usa o IP da rede (celular na mesma Wi‑Fi).
 */
/** Remove espaços/quebras que quebram o link no WhatsApp (ex.: URL colada na Vercel com Enter). */
export function sanitizePublicUrl(url: string) {
  return url.replace(/\s+/g, "").trim().replace(/\/$/, "");
}

function isPrivateOrLocalHost(url: string) {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[01])\./i.test(url);
}

export function getPublicAppUrl() {
  const explicit = sanitizePublicUrl(process.env.NEXT_PUBLIC_APP_URL ?? "");
  const vercelHost = process.env.VERCEL_URL?.trim().replace(/^https?:\/\//, "");

  if (process.env.NODE_ENV === "production" && vercelHost) {
    const fromVercel = `https://${vercelHost}`;
    if (!explicit || isPrivateOrLocalHost(explicit)) {
      return fromVercel;
    }
  }

  const raw = explicit || "http://localhost:3000";
  const isLocalhost = /localhost|127\.0\.0\.1/i.test(raw);

  if (isLocalhost && process.env.NODE_ENV !== "production") {
    const lan = process.env.APP_URL_LAN_HOST?.trim() || detectLanHost();
    const port = raw.match(/:(\d+)/)?.[1] ?? process.env.PORT ?? "3000";
    if (lan) {
      return `http://${lan}:${port}`;
    }
  }

  return raw;
}

/** Link público de pagamento (cliente informa o CPF na página). */
export function buildPagarLink() {
  return `${getPublicAppUrl()}/pagar`;
}

/** Link com CPF na URL — uso interno / atalho no painel. */
export function buildPagarLinkWithCpf(cpf: string) {
  return `${getPublicAppUrl()}/pagar?cpf=${encodeURIComponent(cpf)}`;
}

/** Link em linha isolada — WhatsApp reconhece a URL inteira (com /pagar). */
export function formatLinkPagamentoWhatsApp(link: string) {
  const url = sanitizePublicUrl(link);
  return `

${url}

Abra o link acima, digite seu CPF e pague pelo PIX.`;
}
