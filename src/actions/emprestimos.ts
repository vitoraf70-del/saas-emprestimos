"use server";

import { addMonths } from "date-fns";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncEmprestimoStatus } from "@/lib/emprestimo-status";
import { LoanAmount, LoanInstallments, getInstallmentValue } from "@/lib/loan-plans";
import { parseDateFromInput } from "@/lib/date";
import {
  buildInstallmentDueDates,
  buildWeeklyInstallmentDueDates,
  type FrequenciaParcela,
  toLocalCalendarDate
} from "@/lib/parcel-schedule";

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

    await syncEmprestimoStatus(emprestimo.id, tx);
    revalidateEmprestimoViews();
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

    await syncEmprestimoStatus(emprestimo.id, tx);
    revalidateEmprestimoViews();
    return emprestimo;
  });
}

type CreateEmprestimoPersonalizadoInput = {
  clienteId: string;
  valorEmprestado: number;
  numeroParcelas: number;
  valorParcela: number;
  frequencia: FrequenciaParcela;
  primeiroVencimento: string;
  parcelasVencimentos?: string[];
};

export async function createEmprestimoPersonalizado(input: CreateEmprestimoPersonalizadoInput) {
  const primeiroVencimentoDate = parseDateFromInput(input.primeiroVencimento);
  if (!primeiroVencimentoDate) {
    throw new Error("Data de vencimento inválida. Use DD/MM/AAAA.");
  }
  if (input.numeroParcelas < 1 || input.numeroParcelas > 120) {
    throw new Error("Número de parcelas inválido (use entre 1 e 120).");
  }
  if (input.valorEmprestado <= 0) {
    throw new Error("Valor emprestado deve ser maior que zero.");
  }
  if (input.valorParcela <= 0) {
    throw new Error("Valor da parcela deve ser maior que zero.");
  }

  const valorEmprestado = Number(input.valorEmprestado.toFixed(2));

  return prisma.$transaction(async (tx) => {
    const emprestimo = await tx.emprestimo.create({
      data: {
        cliente_id: input.clienteId,
        valor_emprestado: valorEmprestado,
        taxa_juros_percentual: 0,
        numero_parcelas: input.numeroParcelas,
        valor_parcela: input.valorParcela,
        data_inicio: new Date(),
        vencimento_dia: toLocalCalendarDate(primeiroVencimentoDate).getDay(),
        multa_percentual: 0,
        juros_dia_percentual: 0
      }
    });

    const vencimentosInformados = (input.parcelasVencimentos ?? [])
      .map((item) => parseDateFromInput(item))
      .filter((item): item is Date => item !== null);
    const vencimentos =
      vencimentosInformados.length === input.numeroParcelas
        ? vencimentosInformados
        : buildInstallmentDueDates(primeiroVencimentoDate, input.numeroParcelas, input.frequencia);

    await tx.parcela.createMany({
      data: vencimentos.map((vencimento, i) => ({
        emprestimo_id: emprestimo.id,
        numero_parcela: i + 1,
        valor_original: input.valorParcela,
        valor_atualizado: input.valorParcela,
        vencimento
      }))
    });

    await syncEmprestimoStatus(emprestimo.id, tx);
    revalidateEmprestimoViews();
    return emprestimo;
  });
}

function revalidateEmprestimoViews() {
  revalidatePath("/");
  revalidatePath("/emprestimos");
  revalidatePath("/parcelas");
  revalidatePath("/clientes", "layout");
}

export async function deleteEmprestimo(emprestimoId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.pagamento.deleteMany({
      where: { parcela: { emprestimo_id: emprestimoId } }
    });
    await tx.emprestimo.delete({ where: { id: emprestimoId } });
  });
  revalidateEmprestimoViews();
}
