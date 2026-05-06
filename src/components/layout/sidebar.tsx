import Link from "next/link";

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
    </aside>
  );
}
