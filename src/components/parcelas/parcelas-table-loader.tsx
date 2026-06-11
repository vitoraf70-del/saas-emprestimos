import { ParcelasListClient } from "@/components/parcelas/parcelas-list-client";
import { formatDateWithWeekdayBR } from "@/lib/date";
import { dateFromCalendarDayKey } from "@/lib/finance";
import {
  getParcelasResumoList,
  getReceberHojeResumo,
  type ParcelasResumoStatusFilter
} from "@/lib/queries/parcelas-resumo-list";
import { toCurrency } from "@/lib/utils";

export async function ParcelasTableLoader({
  nome,
  cpf,
  status,
  page
}: {
  nome?: string;
  cpf?: string;
  status?: ParcelasResumoStatusFilter;
  page: number;
}) {
  const effectiveStatus = status ?? "aberto";
  const [list, receberHoje] = await Promise.all([
    getParcelasResumoList({ nome, cpf, status: effectiveStatus, page }),
    getReceberHojeResumo()
  ]);
  const hojeLabel = formatDateWithWeekdayBR(dateFromCalendarDayKey(receberHoje.data)!);

  return (
    <>
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm text-muted-foreground">A receber hoje — {hojeLabel}</p>
        <p className="text-2xl font-bold text-primary">{toCurrency(receberHoje.total)}</p>
        <p className="text-sm text-muted-foreground">
          {receberHoje.quantidade} parcela(s) com vencimento hoje
        </p>
      </div>

      <ParcelasListClient
        rows={list.rows}
        total={list.total}
        currentPage={list.page}
        totalPages={list.totalPages}
        filters={{ nome, cpf, status: effectiveStatus }}
      />
    </>
  );
}
