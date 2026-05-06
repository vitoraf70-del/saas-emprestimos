"use server";

import { addMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { LoanAmount, LoanInstallments, getInstallmentValue } from "@/lib/loan-plans";
import { parseDateFromInput } from "@/lib/date";
import { buildWeeklyInstallmentDueDates, toLocalCalendarDate } from "@/lib/parcel-schedule";

type CreateEmprestimoInput = {
  clienteId: string;
  valorEmprestado: number;
  taxaJurosPercentual: number;
  numeroParcelas: number;
  dataInicio: string;
  vencimentoDia: number;
};

export async function createEmprestimo(input: CreateEmprestimoInput) {
  const valorParcela = (input.valorEmprestado * (1 + input.taxaJurosPercentual / 100)) / input.numeroParcelas;

  return prisma.$transaction(async (tx) => {
    const emprestimo = await tx.emprestimo.create({
      data: {
        cliente_id: input.clienteId,
        valor_emprestado: input.valorEmprestado,
        taxa_juros_percentual: input.taxaJurosPercentual,
        numero_parcelas: input.numeroParcelas,
        valor_parcela: valorParcela,
        data_inicio: new Date(input.dataInicio),
        vencimento_dia: input.vencimentoDia
      }
    });

    await tx.parcela.createMany({
      data: Array.from({ length: input.numeroParcelas }, (_, i) => ({
        emprestimo_id: emprestimo.id,
        numero_parcela: i + 1,
        valor_original: valorParcela,
        valor_atualizado: valorParcela,
        vencimento: addMonths(new Date(input.dataInicio), i + 1)
      }))
    });

    return emprestimo;
  });
}

type CreateEmprestimoSimplesInput = {
  clienteId: string;
  valor: LoanAmount;
  numeroParcelas: LoanInstallments;
  primeiroVencimento: string;
  parcelasVencimentos?: string[];
};

export async function createEmprestimoSimples(input: CreateEmprestimoSimplesInput) {
  const primeiroVencimentoDate = parseDateFromInput(input.primeiroVencimento);
  if (!primeiroVencimentoDate) {
    throw new Error("Data de vencimento inválida. Use DD/MM/AAAA.");
  }
  const valorParcela = getInstallmentValue(input.valor, input.numeroParcelas);

  return prisma.$transaction(async (tx) => {
    const emprestimo = await tx.emprestimo.create({
      data: {
        cliente_id: input.clienteId,
        valor_emprestado: input.valor,
        taxa_juros_percentual: 0,
        numero_parcelas: input.numeroParcelas,
        valor_parcela: valorParcela,
        data_inicio: new Date(),
        vencimento_dia: toLocalCalendarDate(primeiroVencimentoDate).getDay()
      }
    });

    const vencimentosInformados = (input.parcelasVencimentos ?? [])
      .map((item) => parseDateFromInput(item))
      .filter((item): item is Date => item !== null);
    const vencimentos =
      vencimentosInformados.length === input.numeroParcelas
        ? vencimentosInformados
        : buildWeeklyInstallmentDueDates(primeiroVencimentoDate, input.numeroParcelas);

    await tx.parcela.createMany({
      data: vencimentos.map((vencimento, i) => ({
        emprestimo_id: emprestimo.id,
        numero_parcela: i + 1,
        valor_original: valorParcela,
        valor_atualizado: valorParcela,
        vencimento
      }))
    });

    return emprestimo;
  });
}
