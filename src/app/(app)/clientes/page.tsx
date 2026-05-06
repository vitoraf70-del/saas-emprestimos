import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { NovoClienteModal } from "@/components/clientes/novo-cliente-modal";

export default async function ClientesPage() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { created_at: "desc" }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Clientes</h2>
        <NovoClienteModal />
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-3">Nome</th>
                <th className="p-3">CPF</th>
                <th className="p-3">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id} className="border-b">
                  <td className="p-3">
                    <Link className="text-primary underline-offset-2 hover:underline" href={`/clientes/${cliente.id}`}>
                      {cliente.nome}
                    </Link>
                  </td>
                  <td className="p-3">{cliente.cpf}</td>
                  <td className="p-3">{cliente.whatsapp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
