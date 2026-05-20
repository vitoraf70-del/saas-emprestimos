/**
 * Cadastra o webhook PIX no Inter via API do app (usa mTLS do servidor / .env local).
 *
 * Uso:
 *   node scripts/register-inter-webhook.js
 *   node scripts/register-inter-webhook.js --status
 *   node scripts/register-inter-webhook.js --delete
 *
 * Variáveis: NEXT_PUBLIC_APP_URL (produção), CRON_SECRET (se definido na Vercel).
 * Para rodar contra produção a partir do PC:
 *   set NEXT_PUBLIC_APP_URL=https://saas-emprestimos-jlri.vercel.app
 *   set CRON_SECRET=seu_secret
 */
/* eslint-disable no-console */

async function main() {
  const args = process.argv.slice(2);
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET?.trim();
  const qs = secret ? `?secret=${encodeURIComponent(secret)}` : "";

  let path = "/api/webhooks/pix/inter/register";
  let method = "POST";
  if (args.includes("--status")) {
    method = "GET";
  } else if (args.includes("--delete")) {
    method = "POST";
    path += `${qs ? `${qs}&` : "?"}action=delete`;
  }

  const url = `${base}${path}${path.includes("?") ? "" : qs}`;
  console.log(method, url);

  const response = await fetch(url, { method, headers: { Accept: "application/json" } });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  console.log(response.status, JSON.stringify(data, null, 2));
  if (!response.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
