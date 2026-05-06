import { prisma } from "@/lib/prisma";
import { toCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateBR } from "@/lib/date";

export default async function ParcelasPage({
  searchParams
}: {
  searchParams: { nome?: string; cpf?: string; status?: string };
}) {
  const parcelas = await prisma.parcela.findMany({
    where: {
      status: searchParams.status as "pendente" | "paga" | "vencida" | undefined,
      emprestimo: {
        cliente: {
          nome: searchParams.nome ? { contains: searchParams.nome, mode: "insensitive" } : undefined,
          cpf: searchParams.cpf ? { contains: searchParams.cpf } : undefined
        }
      }
    },
    include: { emprestimo: { include: { cliente: true } } },
    orderBy: { vencimento: "asc" }
  });

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Parcelas</h2>
      <Card>
        <CardContent className="p-4">
          <form className="mb-4 grid gap-2 md:grid-cols-4">
            <input name="nome" placeholder="Buscar por nome" className="rounded-md border p-2" />
            <input name="cpf" placeholder="CPF" className="rounded-md border p-2" />
            <select name="status" className="rounded-md border p-2">
              <option value="">Status</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="paga">Paga</option>
            </select>
            <button className="rounded-md bg-primary p-2 text-primary-foreground">Filtrar</button>
          </form>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="p-3">Cliente</th>
                <th className="p-3">Parcela</th>
                <th className="p-3">Vencimento</th>
                <th className="p-3">Valor atualizado</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.map((parcela) => (
                <tr key={parcela.id} className="border-b">
                  <td className="p-3">{parcela.emprestimo.cliente.nome}</td>
                  <td className="p-3">{parcela.numero_parcela}</td>
                  <td className="p-3">{formatDateBR(new Date(parcela.vencimento))}</td>
                  <td className="p-3">{toCurrency(Number(parcela.valor_atualizado || parcela.valor_original))}</td>
                  <td className="p-3 capitalize">{parcela.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
