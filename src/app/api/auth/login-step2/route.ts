import { NextResponse } from "next/server";
import {
  createLoginCompleteToken,
  parseLoginChallengeToken,
  parseTotpSetupToken
} from "@/lib/auth-tokens";
import { prisma } from "@/lib/prisma";
import { verifyTotpCode } from "@/lib/totp";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code ?? "").trim();
    const setupToken = String(body.setupToken ?? "").trim();
    const challengeToken = String(body.challengeToken ?? "").trim();

    if (!code) {
      return NextResponse.json({ error: "Informe o código de 6 dígitos." }, { status: 400 });
    }

    if (setupToken) {
      const setup = parseTotpSetupToken(setupToken);
      if (!setup) {
        return NextResponse.json({ error: "Sessão expirada. Faça login de novo." }, { status: 400 });
      }
      if (!(await verifyTotpCode(code, setup.totpSecret))) {
        return NextResponse.json({ error: "Código inválido. Tente outro no app." }, { status: 401 });
      }

      await prisma.user.update({
        where: { id: setup.userId },
        data: { totpSecret: setup.totpSecret, totpEnabled: true }
      });

      const loginToken = createLoginCompleteToken(setup.userId);
      return NextResponse.json({ loginToken });
    }

    if (challengeToken) {
      const userId = parseLoginChallengeToken(challengeToken);
      if (!userId) {
        return NextResponse.json({ error: "Sessão expirada. Faça login de novo." }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { totpSecret: true, totpEnabled: true }
      });

      if (!user?.totpEnabled || !user.totpSecret) {
        return NextResponse.json({ error: "2FA não configurado. Refaça o login." }, { status: 400 });
      }

      if (!(await verifyTotpCode(code, user.totpSecret))) {
        return NextResponse.json({ error: "Código inválido." }, { status: 401 });
      }

      const loginToken = createLoginCompleteToken(userId);
      return NextResponse.json({ loginToken });
    }

    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  } catch (error) {
    console.error("[login-step2]", error);
    return NextResponse.json({ error: "Não foi possível validar o código." }, { status: 500 });
  }
}
