import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaDirect?: PrismaClient;
};

function createPrismaClient(databaseUrl?: string) {
  return new PrismaClient({
    log: ["error", "warn"],
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {})
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

/** Conexão direta para transações interativas (evita erro com PgBouncer). */
export function getTransactionPrisma() {
  const directUrl = process.env.DIRECT_URL;
  if (!directUrl) return prisma;

  if (!globalForPrisma.prismaDirect) {
    globalForPrisma.prismaDirect = createPrismaClient(directUrl);
  }
  return globalForPrisma.prismaDirect;
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
