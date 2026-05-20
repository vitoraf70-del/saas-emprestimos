import { recalculateOpenParcelas } from "@/actions/parcelas";
import { prisma } from "@/lib/prisma";
import { toCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateBR } from "@/lib/date";
import Link from "next/link";

const parcelaStatusLabel: Record<string, string> = {
  pendente: "Pendente",
  vencida: "Vencida",
  paga: "Paga"
};

export default async function ParcelasPage({
  searchParams
}: {
  searchParams: { nome?: string; cpf?: string; status?: string };
}) {
  await recalculateOpenParcelas();

  const nome = searchParams.nome?.trim();
  const cpf = searchParams.cpf?.trim();
  const status = searchParams.status as "pendente" | "paga" | "vencida" | undefined;

  const parcelas = await prisma.parcela.findMany({
    where: {
      status: status || undefined,
      emprestimo: {
        cliente: {
          nome: nome ? { contains: nome, mode: "insensitive" } : undefined,
          cpf: cpf ? { contains: cpf } : undefined
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
          <form className="mb-4 grid gap-2 md:grid-cols-4" method="get">
            <input
              name="nome"
              placeholder="Buscar por nome"
              defaultValue={nome ?? ""}
              className="rounded-md border p-2"
            />
            <input
              name="cpf"
              placeholder="CPF"
              defaultValue={cpf ?? ""}
              className="rounded-md border p-2"
            />
            <select name="status" defaultValue={status ?? ""} className="rounded-md border p-2">
              <option value="">Status</option>
              <option value="pendente">Pendente</option>
              <option value="vencida">Vencida</option>
              <option value="paga">Paga</option>
            </select>
            <button type="submit" className="rounded-md bg-primary p-2 text-primary-foreground">
              Filtrar
            </button>
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
              {parcelas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Nenhuma parcela encontrada com os filtros informados.
                  </td>
                </tr>
              ) : (
                parcelas.map((parcela) => (
                  <tr key={parcela.id} className="border-b">
                    <td className="p-3">
                      <Link
                        className="text-primary underline-offset-2 hover:underline"
                        href={`/clientes/${parcela.emprestimo.cliente_id}`}
                      >
                        {parcela.emprestimo.cliente.nome}
                      </Link>
                    </td>
                    <td className="p-3">{parcela.numero_parcela}</td>
                    <td className="p-3">{formatDateBR(new Date(parcela.vencimento))}</td>
                    <td className="p-3">
                      {toCurrency(Number(parcela.valor_atualizado || parcela.valor_original))}
                    </td>
                    <td className="p-3">{parcelaStatusLabel[parcela.status] ?? parcela.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
