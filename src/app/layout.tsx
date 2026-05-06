import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "LoanERP SaaS",
  description: "Gestão de empréstimos, cobranças no WhatsApp e PIX."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
