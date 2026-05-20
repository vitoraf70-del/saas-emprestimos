/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const { compare } = require("bcryptjs");

const prisma = new PrismaClient();
const email = "admin@loanerp.com";
const passwords = ["Agiota70Afonso67", "Agiota70Afonso@67"];

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log("ERRO: usuario admin@loanerp.com NAO existe no banco.");
    return;
  }

  console.log("Usuario encontrado:", user.email);
  console.log("Hash comeca com $2 (bcrypt)?", user.passwordHash?.startsWith("$2"));
  console.log("Hash (inicio):", user.passwordHash?.slice(0, 20) + "...");

  for (const pwd of passwords) {
    const ok = user.passwordHash?.startsWith("$2")
      ? await compare(pwd, user.passwordHash)
      : pwd === user.passwordHash;
    console.log(`Senha "${pwd}":`, ok ? "OK" : "falhou");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
