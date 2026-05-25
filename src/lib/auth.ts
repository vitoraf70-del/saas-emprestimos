import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { parseLoginCompleteToken } from "@/lib/auth-tokens";
import { validateUserPassword } from "@/lib/auth-password";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/totp";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        loginToken: { label: "Login token", type: "text" },
        totpCode: { label: "Código 2FA", type: "text" }
      },
      async authorize(credentials) {
        const loginToken = credentials?.loginToken?.trim();
        if (loginToken) {
          const userId = parseLoginCompleteToken(loginToken);
          if (!userId) return null;
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, totpEnabled: true }
          });
          if (!user?.email || !user.totpEnabled) return null;
          return { id: user.id, name: user.name, email: user.email };
        }

        const email = credentials?.email?.trim().toLowerCase() ?? "";
        const password = credentials?.password ?? "";
        const totpCode = credentials?.totpCode?.trim() ?? "";
        if (!email || !password) return null;

        try {
          const user = await validateUserPassword(email, password);
          if (!user) return null;

          if (user.totpEnabled && user.totpSecret) {
            if (!totpCode || !(await verifyTotpCode(totpCode, user.totpSecret))) return null;
          } else {
            return null;
          }

          return { id: user.id, name: user.name, email: user.email };
        } catch (error) {
          console.error("[auth] falha ao validar login:", error);
          return null;
        }
      }
    })
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login"
  }
};
