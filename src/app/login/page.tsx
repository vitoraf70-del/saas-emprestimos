"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
      callbackUrl: "/"
    });

    setLoading(false);

    if (!result || result.error) {
      setError("E-mail ou senha inválidos.");
      return;
    }

    router.push(result.url ?? "/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form className="w-full max-w-sm space-y-3 rounded-xl border bg-white p-6" onSubmit={onSubmit}>
        <h1 className="text-xl font-semibold">Entrar</h1>
        <input required name="email" type="email" placeholder="E-mail" className="w-full rounded-md border p-2" />
        <input required name="password" type="password" placeholder="Senha" className="w-full rounded-md border p-2" />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-70"
        >
          {loading ? "Entrando..." : "Acessar"}
        </button>
      </form>
    </div>
  );
}

