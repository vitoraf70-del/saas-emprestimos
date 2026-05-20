import { calcularParcelaAtualizada, diasAtraso } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { toCurrency } from "@/lib/utils";
import { PixCopyButton } from "@/components/pagar/pix-copy-button";
import { PixSettlementButton } from "@/components/pagar/pix-settlement-button";
import { CpfSearchForm } from "@/components/pagar/cpf-search-form";
import { formatDateBR } from "@/lib/date";

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 11) return value;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export default async function PagarPage({
  searchParams
}: {
  searchParams: { cpf?: string; paid?: string };
}) {
  const cpf = String(searchParams.cpf ?? "").trim();
  const normalizedCpf = cpf.replace(/\D/g, "");
  const formattedCpf = formatCpf(cpf);

  const cliente = cpf
    ? await prisma.cliente.findFirst({
        where: {
          OR: [{ cpf }, { cpf: normalizedCpf }, { cpf: formattedCpf }]
        },
        include: {
          emprestimos: {
            include: {
              parcelas: {
                where: { status: { in: ["pendente", "vencida"] } },
                orderBy: { vencimento: "asc" }
              }
            }
          }
        }
      })
    : null;

  const parcelas = (cliente?.emprestimos ?? [])
    .flatMap((e) => e.parcelas)
    .map((p) => {
      const atraso = diasAtraso(new Date(p.vencimento), new Date());
      const calc = calcularParcelaAtualizada(Number(p.valor_original), atraso);
      return { parcela: p, calc };
    });
  const totalQuitacao = parcelas.reduce((acc, item) => acc + item.calc.valorAtualizado, 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-white px-4 py-6">
      <h1 className="mb-2 text-xl font-semibold">Pagar parcela</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Digite seu CPF para ver todas as parcelas pendentes.
      </p>

      <CpfSearchForm initialCpf={cpf} />

      {searchParams.paid === "1" ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Pagamento confirmado! Suas parcelas foram baixadas automaticamente no sistema.
        </p>
      ) : null}

      {cpf && !cliente ? <p className="text-sm text-red-600">CPF não encontrado.</p> : null}

      {cliente ? (
        <section className="space-y-3">
          <div className="rounded-lg border p-3">
            <p className="text-sm font-semibold">{cliente.nome}</p>
            <p className="text-xs text-muted-foreground">CPF: {cliente.cpf}</p>
          </div>
          {parcelas.length > 0 ? (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">Total para quitar pendentes: {toCurrency(totalQuitacao)}</p>
              <p className="text-xs text-muted-foreground">{parcelas.length} parcela(s) em aberto</p>
            </div>
          ) : null}
          {parcelas.length > 0 ? (
            <PixSettlementButton parcelaIds={parcelas.map(({ parcela }) => parcela.id)} cpf={cliente.cpf} />
          ) : null}

          {parcelas.length === 0 ? (
            <p className="rounded-lg border p-3 text-sm">Você não possui parcelas pendentes no momento.</p>
          ) : (
            parcelas.map(({ parcela, calc }) => (
              <article key={parcela.id} className="rounded-lg border p-3 shadow-sm">
                <p className="text-sm font-medium">Parcela {parcela.numero_parcela}</p>
                <p className="text-xs text-muted-foreground">
                  Vencimento: {formatDateBR(new Date(parcela.vencimento))}
                </p>
                <div className="my-2 space-y-1 text-sm">
                  <p>Valor original: {toCurrency(Number(parcela.valor_original))}</p>
                  <p>Multa: {toCurrency(calc.multaValor)}</p>
                  <p>Mora diária: {toCurrency(calc.jurosValor)}</p>
                  <p className="font-semibold">Total atualizado: {toCurrency(calc.valorAtualizado)}</p>
                </div>
                <PixCopyButton parcelaId={parcela.id} cpf={cliente.cpf} />
              </article>
            ))
          )}
        </section>
      ) : null}
    </main>
  );
}
