import { Agent, fetch as undiciFetch } from "undici";
import type { RequestInit as UndiciRequestInit } from "undici";

type C6Env = {
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

function readC6Env(): C6Env {
  const explicit = process.env.C6_API_BASE_URL?.trim();
  const sandbox =
    process.env.C6_SANDBOX === "true" || process.env.C6_SANDBOX === "1";
  const baseUrl =
    explicit?.replace(/\/$/, "") ??
    (sandbox ? "https://baas-api-sandbox.c6bank.info" : "https://baas-api.c6bank.info");

  return {
    baseUrl,
    clientId: requireEnv("C6_CLIENT_ID"),
    clientSecret: requireEnv("C6_CLIENT_SECRET"),
    pixKey: requireEnv("C6_PIX_KEY"),
    certPem: requireEnv("C6_MTLS_CERT"),
    keyPem: requireEnv("C6_MTLS_KEY"),
    caPem: process.env.C6_MTLS_CA?.trim()
  };
}

function normalizePem(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("BEGIN")) return trimmed;
  return trimmed.replace(/\\n/g, "\n");
}

function buildMtlsAgent(env: C6Env) {
  return new Agent({
    connect: {
      rejectUnauthorized: true,
      cert: normalizePem(env.certPem),
      key: normalizePem(env.keyPem),
      ca: env.caPem ? normalizePem(env.caPem) : undefined
    }
  });
}

async function c6Fetch(env: C6Env, path: string, init: UndiciRequestInit) {
  const agent = buildMtlsAgent(env);
  const url = `${env.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  const { body, ...rest } = init;
  const requestInit: UndiciRequestInit = {
    ...rest,
    ...(body === null || body === undefined ? {} : { body }),
    dispatcher: agent
  };
  const response = await undiciFetch(url, requestInit);
  const text = await response.text();
  return { response, text };
}

let cachedToken: { token: string; expiresAtMs: number } | null = null;

async function getC6AccessToken(env: C6Env) {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - now > 30_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.clientId,
    client_secret: env.clientSecret
  });

  const { response, text } = await c6Fetch(env, "/v1/auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`C6 auth falhou: ${response.status} ${text}`);
  }

  const json = JSON.parse(text) as { access_token: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error("C6 auth retornou access_token vazio");
  }

  const expiresInSec = typeof json.expires_in === "number" ? json.expires_in : 3600;
  cachedToken = {
    token: json.access_token,
    expiresAtMs: Date.now() + Math.max(60, expiresInSec - 60) * 1000
  };

  return json.access_token;
}

export async function c6CreateCobrancaImediata(input: {
  txid: string;
  amount: number;
  solicitacaoPagador?: string;
  expiracaoSegundos?: number;
  devedor?: { cpf: string; nome: string };
}) {
  const env = readC6Env();
  const token = await getC6AccessToken(env);

  const payload = {
    calendario: { expiracao: input.expiracaoSegundos ?? 180 },
    valor: { original: input.amount.toFixed(2) },
    chave: env.pixKey,
    ...(input.solicitacaoPagador ? { solicitacaoPagador: input.solicitacaoPagador } : {}),
    ...(input.devedor ? { devedor: input.devedor } : {})
  };

  const { response, text } = await c6Fetch(env, `/v2/pix/cob/${encodeURIComponent(input.txid)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`C6 PIX cob falhou: ${response.status} ${text}`);
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

export async function c6GetCobrancaImediata(txid: string) {
  const env = readC6Env();
  const token = await getC6AccessToken(env);

  const { response, text } = await c6Fetch(env, `/v2/pix/cob/${encodeURIComponent(txid)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`C6 PIX consulta cob falhou: ${response.status} ${text}`);
  }

  return JSON.parse(text) as {
    txid?: string;
    valor?: { original?: string };
    solicitacaoPagador?: string;
    [key: string]: unknown;
  };
}
