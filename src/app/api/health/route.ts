import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Diagnóstico rápido (produção): banco + admin. Remover ou proteger depois se quiser. */
export async function GET() {
  try {
    const admin = await prisma.user.findUnique({
      where: { email: "admin@loanerp.com" },
      select: { id: true, email: true, passwordHash: true }
    });

    const senhaTeste = "Agiota70Afonso67";
    const senhaOk =
      admin?.passwordHash?.startsWith("$2") && admin.passwordHash
        ? await compare(senhaTeste, admin.passwordHash)
        : false;

    return NextResponse.json({
      ok: true,
      database: "conectado",
      adminExiste: Boolean(admin),
      senhaBcrypt: admin?.passwordHash?.startsWith("$2") ?? false,
      senhaTesteOk: senhaOk,
      nextauthSecretDefinido: Boolean(process.env.NEXTAUTH_SECRET?.trim()),
      nextauthUrl: process.env.NEXTAUTH_URL ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    return NextResponse.json(
      {
        ok: false,
        database: "falhou",
        erro: message,
        nextauthSecretDefinido: Boolean(process.env.NEXTAUTH_SECRET?.trim()),
        nextauthUrl: process.env.NEXTAUTH_URL ?? null
      },
      { status: 500 }
    );
  }
}
