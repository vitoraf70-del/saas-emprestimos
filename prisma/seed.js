/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");

const prisma = new PrismaClient();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Agiota70Afonso@67";

async function main() {
  const passwordHash = await hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@loanerp.com" },
    update: {
      passwordHash
    },
    create: {
      email: "admin@loanerp.com",
      name: "Administrador",
      passwordHash
    }
  });
  console.log("Admin seed:", admin.email);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
