"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/clientes", label: "Clientes" },
  { href: "/emprestimos", label: "Empréstimos" },
  { href: "/parcelas", label: "Parcelas" },
  { href: "/despesas", label: "Despesas" },
  { href: "/relatorios", label: "Relatórios" }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground">
      <div className="mb-8">
        <Logo size="sm" />
      </div>
      <nav className="flex-1 space-y-1">
        {items.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-l-2 border-sidebar-accent bg-white/10 text-sidebar-accent"
                  : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="mt-6 w-full rounded-lg border border-white/15 px-3 py-2.5 text-left text-sm text-sidebar-foreground/80 transition-colors hover:border-sidebar-accent/40 hover:bg-white/5 hover:text-sidebar-foreground"
      >
        Sair
      </button>
    </aside>
  );
}
