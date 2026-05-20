import { Agent, fetch as undiciFetch } from "undici";
import type { RequestInit as UndiciRequestInit } from "undici";
import { readFileSync } from "node:fs";
import { getPublicAppUrl } from "@/lib/app-url";

export { buildPixTxidFromSeed as buildInterTxidFromSeed } from "./pixTxid";

type InterEnv = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  pixKey: string;
  certPem: string;
  keyPem: string;
  caPem?: string;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável ausente: ${name}`);
  return value;
}

function readPemFromEnvOrPath(envName: string, pathName: string) {
  const raw = process.env[envName]?.trim();
  if (raw) return normalizePem(raw);

  const filePath = process.env[pathName]?.trim();
  if (filePath) {
    try {
      return normalizePem(readFileSync(filePath, "utf8"));
    } catch {
      throw new Error(
        `${pathName} aponta para arquivo inexistente (${filePath}). Em produção use ${envName} com o conteúdo PEM na Vercel.`
      );
    }
  }

  throw new Error(`Variável ausente: ${envName} (ou ${pathName})`);
}

function readOptionalCaPem() {
  const inline = process.env.INTER_MTLS_CA?.trim();
  if (inline) return normalizePem(inline);

  const filePath = process.env.INTER_MTLS_CA_PATH?.trim();
  if (!filePath) return undefined;

  try {
    return normalizePem(readFileSync(filePath, "utf8"));
  } catch {
    // Ex.: INTER_MTLS_CA_PATH com caminho do Windows (C:\...) na Vercel — ignora e usa CA do sistema
    return undefined;
  }
}

function readInterEnv(): InterEnv {
  return {
    baseUrl: (process.env.INTER_API_BASE_URL ?? "https://cdpj.partners.bancointer.com.br").replace(/\/$/, ""),
    clientId: requireEnv("INTER_CLIENT_ID"),
    clientSecret: requireEnv("INTER_CLIENT_SECRET"),
    pixKey: requireEnv("INTER_PIX_KEY"),
    certPem: readPemFromEnvOrPath("INTER_MTLS_CERT", "INTER_MTLS_CERT_PATH"),
    keyPem: readPemFromEnvOrPath("INTER_MTLS_KEY", "INTER_MTLS_KEY_PATH"),
    caPem: readOptionalCaPem()
  };
}

function normalizePem(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("BEGIN")) return trimmed;
  return trimmed.replace(/\\n/g, "\n");
}

function buildMtlsAgent(env: InterEnv) {
  return new Agent({
    connect: {
      rejectUnauthorized: true,
      cert: normalizePem(env.certPem),
      key: normalizePem(env.keyPem),
      ca: env.caPem ? normalizePem(env.caPem) : undefined
    }
  });
}

async function interFetch(env: InterEnv, path: string, init: UndiciRequestInit) {
  const url = `${env.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const { body, ...rest } = init;
  const baseInit: UndiciRequestInit = {
    ...rest,
    ...(body === null || body === undefined ? {} : { body })
  };

  try {
    const response = await undiciFetch(url, {
      ...baseInit,
      dispatcher: buildMtlsAgent(env)
    });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    const code = (error as { cause?: { code?: string } })?.cause?.code;
    if (code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" && env.caPem) {
      // Some environments fail with a custom CA chain; retry with system trust store.
      const fallbackEnv = { ...env, caPem: undefined };
      const response = await undiciFetch(url, {
        ...baseInit,
        dispatcher: buildMtlsAgent(fallbackEnv)
      });
      const text = await response.text();
      return { response, text };
    }
    throw error;
  }
}

let cachedToken: { token: string; expiresAtMs: number } | null = null;

async function getInterAccessToken(env: InterEnv) {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - now > 30_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: "client_credentials",
    scope:
      process.env.INTER_OAUTH_SCOPE?.trim() ??
      "cob.read cob.write pix.read pix.write webhook.read webhook.write payloadlocation.read payloadlocation.write"
  });

  const { response, text } = await interFetch(env, "/oauth/v2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Inter OAuth falhou: ${response.status} ${text}`);
  }

  const json = JSON.parse(text) as { access_token: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error("Inter OAuth retornou access_token vazio");
  }

  const expiresInSec = typeof json.expires_in === "number" ? json.expires_in : 3600;
  cachedToken = {
    token: json.access_token,
    expiresAtMs: Date.now() + Math.max(60, expiresInSec - 60) * 1000
  };

  return json.access_token;
}

export async function interCreateCobrancaImediata(input: {
  txid: string;
  amount: number;
  solicitacaoPagador?: string;
  expiracaoSegundos?: number;
  devedor?: { cpf: string; nome: string };
}) {
  const env = readInterEnv();
  const token = await getInterAccessToken(env);

  const payload = {
    calendario: { expiracao: input.expiracaoSegundos ?? 180 },
    valor: { original: input.amount.toFixed(2) },
    chave: env.pixKey,
    ...(input.solicitacaoPagador ? { solicitacaoPagador: input.solicitacaoPagador } : {}),
    ...(input.devedor ? { devedor: input.devedor } : {})
  };

  const { response, text } = await interFetch(env, `/pix/v2/cob/${encodeURIComponent(input.txid)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Inter PIX cob falhou: ${response.status} ${text}`);
  }

  const json = JSON.parse(text) as Record<string, unknown>;

  const pixCopiaECola =
    (typeof json.pixCopiaECola === "string" && json.pixCopiaECola) ||
    (typeof (json as { pix?: { pixCopiaECola?: string } }).pix?.pixCopiaECola === "string" &&
      (json as { pix?: { pixCopiaECola?: string } }).pix?.pixCopiaECola) ||
    "";

  return {
    txid: String((json as { txid?: string }).txid ?? input.txid),
    pixCopiaECola,
    raw: json
  };
}

export function getInterWebhookCallbackUrl() {
  const override = process.env.INTER_WEBHOOK_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return `${getPublicAppUrl()}/api/webhooks/pix/inter`;
}

export async function interPutPixWebhook(webhookUrl?: string) {
  const env = readInterEnv();
  const token = await getInterAccessToken(env);
  const url = webhookUrl?.trim() || getInterWebhookCallbackUrl();

  const { response, text } = await interFetch(
    env,
    `/pix/v2/webhook/${encodeURIComponent(env.pixKey)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ webhookUrl: url })
    }
  );

  if (!response.ok) {
    throw new Error(`Inter webhook PUT falhou: ${response.status} ${text}`);
  }

  return { webhookUrl: url, raw: text ? JSON.parse(text) : null };
}

export async function interGetPixWebhook() {
  const env = readInterEnv();
  const token = await getInterAccessToken(env);

  const { response, text } = await interFetch(
    env,
    `/pix/v2/webhook/${encodeURIComponent(env.pixKey)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Inter webhook GET falhou: ${response.status} ${text}`);
  }

  return JSON.parse(text) as { webhookUrl?: string; criacao?: string; [key: string]: unknown };
}

export async function interDeletePixWebhook() {
  const env = readInterEnv();
  const token = await getInterAccessToken(env);

  const { response, text } = await interFetch(
    env,
    `/pix/v2/webhook/${encodeURIComponent(env.pixKey)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    }
  );

  if (response.status === 404) {
    return { removed: false };
  }

  if (!response.ok) {
    throw new Error(`Inter webhook DELETE falhou: ${response.status} ${text}`);
  }

  return { removed: true, raw: text || null };
}

export async function interGetCobrancaImediata(txid: string) {
  const env = readInterEnv();
  const token = await getInterAccessToken(env);

  const { response, text } = await interFetch(env, `/pix/v2/cob/${encodeURIComponent(txid)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Inter PIX consulta cob falhou: ${response.status} ${text}`);
  }

  return JSON.parse(text) as {
    txid?: string;
    valor?: { original?: string };
    solicitacaoPagador?: string;
    [key: string]: unknown;
  };
}
