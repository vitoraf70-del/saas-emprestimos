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
export function getPublicAppUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
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

export function buildPagarLink(cpf: string) {
  return `${getPublicAppUrl()}/pagar?cpf=${encodeURIComponent(cpf)}`;
}
