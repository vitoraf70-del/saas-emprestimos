/* eslint-disable no-console */
const os = require("node:os");

function getLanIpv4() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        candidates.push({ name, address: net.address });
      }
    }
  }

  return candidates;
}

const port = process.env.PORT || "3000";
const ips = getLanIpv4();

console.log("\n=== Link para abrir no CELULAR (mesma rede Wi‑Fi) ===\n");

if (ips.length === 0) {
  console.log("Nenhum IP de rede local encontrado. Conecte o PC ao Wi‑Fi e rode de novo.\n");
  process.exit(1);
}

for (const { name, address } of ips) {
  console.log(`  ${name}: http://${address}:${port}`);
}

const main = ips[0];
console.log("\nColoque no arquivo .env:\n");
console.log(`NEXT_PUBLIC_APP_URL="http://${main.address}:${port}"`);
console.log("\nDepois reinicie o servidor com: npm run dev:lan\n");
