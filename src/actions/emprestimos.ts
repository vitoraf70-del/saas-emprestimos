"use server";

import { addMonths } from "date-fns";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { syncEmprestimoStatus } from "@/lib/emprestimo-status";
import { recalculateParcela } from "@/actions/parcelas";
import {
  anchorVencimentoCampoGrande,
  extractCalendarDayKey,
  normalizeVencimento,
  weekdayFromCalendarDayKey
} from "@/lib/finance";
import { LoanAmount, LoanInstallments, getInstallmentValue } from "@/lib/loan-plans";
import { parseDateFromInput } from "@/lib/date";
import {
  buildInstallmentDueDatesFromDayKey,
  type FrequenciaParcela
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
        data_inicio: parseDateFromInput(input.dataInicio) ?? new Date(),
        vencimento_dia: input.vencimentoDia
      }
    });

    const dataInicio =
      parseDateFromInput(input.dataInicio) ?? anchorVencimentoCampoGrande(new Date(input.dataInicio));

    await tx.parcela.createMany({
      data: Array.from({ length: input.numeroParcelas }, (_, i) => ({
        emprestimo_id: emprestimo.id,
        numero_parcela: i + 1,
        valor_original: valorParcela,
        valor_atualizado: valorParcela,
        vencimento: normalizeVencimento(addMonths(dataInicio, i + 1))
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

function resolvePrimeiroVencimentoDayKey(value: string) {
  const primeiroDayKey = extractCalendarDayKey(value);
  if (!primeiroDayKey || !/^\d{4}-\d{2}-\d{2}$/.test(primeiroDayKey)) {
    return null;
  }
  return primeiroDayKey;
}

export async function createEmprestimoSimples(input: CreateEmprestimoSimplesInput) {
  const primeiroDayKey = resolvePrimeiroVencimentoDayKey(input.primeiroVencimento);
  if (!primeiroDayKey) {
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
        vencimento_dia: weekdayFromCalendarDayKey(primeiroDayKey)
      }
    });

    const vencimentos = buildInstallmentDueDatesFromDayKey(
      primeiroDayKey,
      input.numeroParcelas,
      "semanal"
    );

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
  const primeiroDayKey = resolvePrimeiroVencimentoDayKey(input.primeiroVencimento);
  if (!primeiroDayKey) {
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
        vencimento_dia: weekdayFromCalendarDayKey(primeiroDayKey),
        multa_percentual: 0,
        juros_dia_percentual: 0
      }
    });

    const vencimentos = buildInstallmentDueDatesFromDayKey(
      primeiroDayKey,
      input.numeroParcelas,
      input.frequencia
    );

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

export type UpdateEmprestimoParcelaInput = {
  id: string;
  valorOriginal: number;
  vencimento: string;
};

export type UpdateEmprestimoInput = {
  valorEmprestado?: number;
  valorParcela?: number;
  parcelas?: UpdateEmprestimoParcelaInput[];
};

export async function updateEmprestimo(emprestimoId: string, input: UpdateEmprestimoInput) {
  const emprestimo = await prisma.emprestimo.findUnique({
    where: { id: emprestimoId },
    include: { parcelas: { orderBy: { numero_parcela: "asc" } } }
  });
  if (!emprestimo) throw new Error("Empréstimo não encontrado.");

  if (input.valorEmprestado != null && input.valorEmprestado <= 0) {
    throw new Error("Valor emprestado deve ser maior que zero.");
  }

  const parcelasPayload = input.parcelas ?? [];
  for (const p of parcelasPayload) {
    const parcela = emprestimo.parcelas.find((item) => item.id === p.id);
    if (!parcela) throw new Error("Parcela não encontrada neste empréstimo.");
    if (parcela.status === "paga") {
      throw new Error(`Parcela ${parcela.numero_parcela} já está paga e não pode ser alterada.`);
    }
    if (p.valorOriginal <= 0) throw new Error("Valor da parcela deve ser maior que zero.");
    if (!parseDateFromInput(p.vencimento)) {
      throw new Error(`Vencimento inválido na parcela ${parcela.numero_parcela}. Use DD/MM/AAAA.`);
    }
  }

  await prisma.$transaction(async (tx) => {
    if (input.valorEmprestado != null) {
      await tx.emprestimo.update({
        where: { id: emprestimoId },
        data: { valor_emprestado: input.valorEmprestado }
      });
    }

    if (input.valorParcela != null && input.valorParcela > 0) {
      await tx.emprestimo.update({
        where: { id: emprestimoId },
        data: { valor_parcela: input.valorParcela }
      });
    }

    for (const p of parcelasPayload) {
      const vencimento = normalizeVencimento(parseDateFromInput(p.vencimento)!);
      await tx.parcela.update({
        where: { id: p.id },
        data: {
          valor_original: p.valorOriginal,
          valor_atualizado: p.valorOriginal,
          vencimento,
          dias_atraso: 0,
          multa_valor: 0,
          juros_valor: 0,
          status: "pendente"
        }
      });
    }

    await syncEmprestimoStatus(emprestimoId, tx);
  });

  const abertas = await prisma.parcela.findMany({
    where: { emprestimo_id: emprestimoId, status: { in: ["pendente", "vencida"] } },
    select: { id: true }
  });
  for (const { id } of abertas) {
    await recalculateParcela(id);
  }

  revalidateEmprestimoViews();
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
