"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/clientes", label: "Clientes" },
  { href: "/emprestimos", label: "Empréstimos" },
  { href: "/parcelas", label: "Parcelas" },
  { href: "/relatorios", label: "Relatórios" }
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-white p-4">
      <h1 className="mb-6 text-lg font-bold">LoanERP SaaS</h1>
      <nav className="space-y-2">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">
            {item.label}
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="mt-6 w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
      >
        Sair
      </button>
    </aside>
  );
}
