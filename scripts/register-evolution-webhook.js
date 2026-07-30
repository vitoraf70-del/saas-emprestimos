/* eslint-disable no-console */
/**
 * Cadastra webhook de mensagens recebidas na Evolution API.
 * Uso: node scripts/register-evolution-webhook.js
 *      node scripts/register-evolution-webhook.js --status
 */
const fs = require("fs");

for (const file of [".env.vercel.production", ".env.local", ".env"]) {
  try {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
      }
    }
  } catch {
    /* ignore */
  }
}

const base = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
const apiKey = process.env.EVOLUTION_API_KEY;
const instance = process.env.EVOLUTION_INSTANCE;
const secret = process.env.WHATSAPP_WEBHOOK_SECRET?.trim();
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://crediarioms.com").replace(/\/$/, "");
const webhookUrl = secret
  ? `${appUrl}/api/webhooks/whatsapp?secret=${encodeURIComponent(secret)}`
  : `${appUrl}/api/webhooks/whatsapp`;

async function evolutionFetch(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  if (!base || !apiKey || !instance) {
    console.error("Faltam EVOLUTION_API_URL, EVOLUTION_API_KEY ou EVOLUTION_INSTANCE no .env");
    process.exit(1);
  }

  const statusOnly = process.argv.includes("--status");

  console.log("Instance:", instance);
  console.log("Evolution:", base);
  console.log("Webhook alvo:", webhookUrl);

  const conn = await evolutionFetch(`/instance/connectionState/${encodeURIComponent(instance)}`);
  console.log("\nConnection state:", conn.status, JSON.stringify(conn.json));

  const find = await evolutionFetch(`/webhook/find/${encodeURIComponent(instance)}`);
  console.log("\nWebhook atual:", find.status, JSON.stringify(find.json, null, 2));

  if (statusOnly) return;

  if (conn.json?.instance?.state === "close") {
    const reconnect = await evolutionFetch(`/instance/connect/${encodeURIComponent(instance)}`);
    console.log("\nTentativa reconnect:", reconnect.status, JSON.stringify(reconnect.json)?.slice(0, 500));
  }

  const body = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
    }
  };

  const set = await evolutionFetch(`/webhook/set/${encodeURIComponent(instance)}`, {
    method: "POST",
    body: JSON.stringify(body)
  });
  console.log("\nWebhook set:", set.status, JSON.stringify(set.json, null, 2));

  const verify = await evolutionFetch(`/webhook/find/${encodeURIComponent(instance)}`);
  console.log("\nWebhook após set:", verify.status, JSON.stringify(verify.json, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
