"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type Step = "credentials" | "setup" | "2fa";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [manualKey, setManualKey] = useState("");

  async function finishLogin(loginToken: string) {
    const result = await signIn("credentials", {
      loginToken,
      redirect: false,
      callbackUrl: "/"
    });

    if (!result || result.error) {
      setError("Não foi possível entrar. Tente de novo.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function onCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const emailValue = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setEmail(emailValue);

    try {
      const response = await fetch("/api/auth/login-step1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue, password })
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        step?: "setup" | "2fa";
        setupToken?: string;
        challengeToken?: string;
        qrDataUrl?: string;
        manualKey?: string;
      } | null;

      if (!response.ok) {
        setError(data?.error ?? "E-mail ou senha inválidos.");
        return;
      }

      if (data?.step === "setup") {
        setSetupToken(data.setupToken ?? "");
        setQrDataUrl(data.qrDataUrl ?? "");
        setManualKey(data.manualKey ?? "");
        setStep("setup");
        return;
      }

      setChallengeToken(data?.challengeToken ?? "");
      setStep("2fa");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function onCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").trim();

    try {
      const response = await fetch("/api/auth/login-step2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          setupToken: step === "setup" ? setupToken : undefined,
          challengeToken: step === "2fa" ? challengeToken : undefined
        })
      });

      const data = (await response.json().catch(() => null)) as { error?: string; loginToken?: string } | null;

      if (!response.ok || !data?.loginToken) {
        setError(data?.error ?? "Código inválido.");
        return;
      }

      await finishLogin(data.loginToken);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function backToCredentials() {
    setStep("credentials");
    setError("");
    setChallengeToken("");
    setSetupToken("");
    setQrDataUrl("");
    setManualKey("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-3 rounded-xl border bg-white p-6">
        {step === "credentials" ? (
          <form className="space-y-3" onSubmit={onCredentialsSubmit}>
            <h1 className="text-xl font-semibold">Entrar</h1>
            <p className="text-sm text-muted-foreground">E-mail e senha. Depois o código do celular (2FA).</p>
            <input
              required
              name="email"
              type="email"
              placeholder="E-mail"
              className="w-full rounded-md border p-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input required name="password" type="password" placeholder="Senha" className="w-full rounded-md border p-2" />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-70"
            >
              {loading ? "Verificando..." : "Continuar"}
            </button>
          </form>
        ) : null}

        {step === "setup" ? (
          <form className="space-y-3" onSubmit={onCodeSubmit}>
            <h1 className="text-xl font-semibold">Configurar 2FA</h1>
            <p className="text-sm text-muted-foreground">
              Escaneie no <strong>Google Authenticator</strong> (ou Authy). Cada pessoa usa o próprio celular.
            </p>
            {qrDataUrl ? (
              <div className="flex justify-center">
                <Image src={qrDataUrl} alt="QR Code 2FA" width={180} height={180} unoptimized />
              </div>
            ) : null}
            {manualKey ? (
              <p className="break-all rounded-md bg-muted p-2 text-xs">
                Chave manual: <span className="font-mono">{manualKey}</span>
              </p>
            ) : null}
            <input
              required
              name="code"
              inputMode="numeric"
              maxLength={6}
              placeholder="Código de 6 dígitos"
              className="w-full rounded-md border p-2 text-center tracking-widest"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-70"
            >
              {loading ? "Ativando..." : "Ativar e entrar"}
            </button>
            <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={backToCredentials}>
              Voltar
            </button>
          </form>
        ) : null}

        {step === "2fa" ? (
          <form className="space-y-3" onSubmit={onCodeSubmit}>
            <h1 className="text-xl font-semibold">Código de segurança</h1>
            <p className="text-sm text-muted-foreground">
              Abra o app Authenticator e digite o código de <strong>{email}</strong>.
            </p>
            <input
              required
              name="code"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              placeholder="000000"
              className="w-full rounded-md border p-2 text-center text-lg tracking-widest"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-70"
            >
              {loading ? "Entrando..." : "Acessar"}
            </button>
            <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={backToCredentials}>
              Voltar
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
