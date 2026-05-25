/* eslint-disable no-console */
/**
 * Cria ou atualiza um usuário admin (você ou sócio).
 *
 * Uso:
 *   node scripts/create-user.js socio@email.com "Nome do Socio" "SenhaForte123"
 *
 * Variável opcional: SEED_ADMIN_PASSWORD (se omitir senha no comando)
 */
const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const name = (process.argv[3] ?? "Usuário").trim();
  const password = process.argv[4] ?? process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Uso: node scripts/create-user.js email@exemplo.com "Nome" "Senha"');
    process.exit(1);
  }

  const passwordHash = await hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { email, name, passwordHash, totpEnabled: false, totpSecret: null }
  });

  console.log("Usuário pronto:", user.email);
  console.log("No primeiro login ele configura o 2FA no celular (QR Code).");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
