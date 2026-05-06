/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@loanerp.com" },
    update: {},
    create: {
      email: "admin@loanerp.com",
      name: "Administrador",
      passwordHash: "123456"
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
