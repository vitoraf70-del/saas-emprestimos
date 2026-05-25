import { NextResponse } from "next/server";
import { createLoginChallengeToken, createTotpSetupToken } from "@/lib/auth-tokens";
import { validateUserPassword } from "@/lib/auth-password";
import { buildTotpQrDataUrl, generateTotpSecret } from "@/lib/totp";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");

    const user = await validateUserPassword(email, password);
    if (!user) {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }

    if (!user.totpEnabled || !user.totpSecret) {
      if (!user.email) {
        return NextResponse.json({ error: "Usuário sem e-mail válido." }, { status: 400 });
      }
      const totpSecret = generateTotpSecret();
      const setupToken = createTotpSetupToken(user.id, totpSecret);
      const qrDataUrl = await buildTotpQrDataUrl(user.email, totpSecret);

      return NextResponse.json({
        step: "setup",
        setupToken,
        qrDataUrl,
        manualKey: totpSecret,
        email: user.email
      });
    }

    const challengeToken = createLoginChallengeToken(user.id);
    return NextResponse.json({
      step: "2fa",
      challengeToken,
      email: user.email
    });
  } catch (error) {
    console.error("[login-step1]", error);
    return NextResponse.json({ error: "Não foi possível validar o login." }, { status: 500 });
  }
}
