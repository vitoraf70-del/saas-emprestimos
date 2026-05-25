import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function validateUserPassword(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) return null;

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      totpEnabled: true,
      totpSecret: true
    }
  });

  if (!user?.passwordHash || !user.email) return null;

  const hash = user.passwordHash;
  const passwordOk = hash.startsWith("$2") ? await compare(password, hash) : password === hash;
  if (!passwordOk) return null;
  if (!user.email) return null;

  return user;
}
