"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/layout/logo";

type Step = "credentials" | "setup" | "2fa";

const inputClassName =
  "w-full rounded-lg border border-white/15 bg-white/10 p-2.5 text-white placeholder:text-white/45 focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]";

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
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Logo size="lg" showLink={false} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-md">
          {step === "credentials" ? (
            <form className="space-y-4" onSubmit={onCredentialsSubmit}>
              <div>
                <h1 className="text-xl font-semibold text-white">Entrar</h1>
                <p className="mt-1 text-sm text-white/60">E-mail e senha. Depois o código do celular (2FA).</p>
              </div>
              <input
                required
                name="email"
                type="email"
                placeholder="E-mail"
                className={inputClassName}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input required name="password" type="password" placeholder="Senha" className={inputClassName} />
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <button type="submit" disabled={loading} className="btn-gold w-full rounded-lg p-2.5 font-medium disabled:opacity-70">
                {loading ? "Verificando..." : "Continuar"}
              </button>
            </form>
          ) : null}

          {step === "setup" ? (
            <form className="space-y-4" onSubmit={onCodeSubmit}>
              <div>
                <h1 className="text-xl font-semibold text-white">Configurar 2FA</h1>
                <p className="mt-1 text-sm text-white/60">
                  Escaneie no <strong className="text-white/80">Google Authenticator</strong> (ou Authy). Cada pessoa usa o
                  próprio celular.
                </p>
              </div>
              {qrDataUrl ? (
                <div className="flex justify-center rounded-lg bg-white p-3">
                  <Image src={qrDataUrl} alt="QR Code 2FA" width={180} height={180} unoptimized />
                </div>
              ) : null}
              {manualKey ? (
                <p className="break-all rounded-lg bg-white/10 p-3 text-xs text-white/70">
                  Chave manual: <span className="font-mono text-white">{manualKey}</span>
                </p>
              ) : null}
              <input
                required
                name="code"
                inputMode="numeric"
                maxLength={6}
                placeholder="Código de 6 dígitos"
                className={`${inputClassName} text-center tracking-widest`}
              />
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <button type="submit" disabled={loading} className="btn-gold w-full rounded-lg p-2.5 font-medium disabled:opacity-70">
                {loading ? "Ativando..." : "Ativar e entrar"}
              </button>
              <button type="button" className="w-full text-sm text-white/50 underline hover:text-white/70" onClick={backToCredentials}>
                Voltar
              </button>
            </form>
          ) : null}

          {step === "2fa" ? (
            <form className="space-y-4" onSubmit={onCodeSubmit}>
              <div>
                <h1 className="text-xl font-semibold text-white">Código de segurança</h1>
                <p className="mt-1 text-sm text-white/60">
                  Abra o app Authenticator e digite o código de <strong className="text-white/80">{email}</strong>.
                </p>
              </div>
              <input
                required
                name="code"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                placeholder="000000"
                className={`${inputClassName} text-center text-lg tracking-widest`}
              />
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              <button type="submit" disabled={loading} className="btn-gold w-full rounded-lg p-2.5 font-medium disabled:opacity-70">
                {loading ? "Entrando..." : "Acessar"}
              </button>
              <button type="button" className="w-full text-sm text-white/50 underline hover:text-white/70" onClick={backToCredentials}>
                Voltar
              </button>
            </form>
          ) : null}
        </div>

        <p className="text-center text-xs text-white/40">Crédito rápido e seguro</p>
      </div>
    </div>
  );
}
