import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });
        if (!user?.passwordHash) return null;

        const hash = user.passwordHash;
        const passwordOk = hash.startsWith("$2")
          ? await compare(credentials.password, hash)
          : credentials.password === hash;

        if (!passwordOk) return null;
        return { id: user.id, name: user.name, email: user.email };
      }
    })
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login"
  }
};
