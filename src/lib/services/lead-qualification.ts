import { prisma } from "@/lib/prisma";
import { diasAtraso } from "@/lib/finance";
import type { LeadExtraido } from "@/lib/services/ai-chat";

/** A partir de quantos dias de atraso consideramos "dívida grave" (bloqueia o lead). */
const DIAS_ATRASO_DIVIDA_GRAVE = 15;

export type Qualificacao = {
  qualificado: boolean;
  score: number;
  maxScore: number;
  motivos: string[];
  pendencias: string[];
  cpfComDividaGrave: boolean;
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

/** Validação de CPF (formato + dígitos verificadores). */
export function cpfValido(cpfRaw: string): boolean {
  const cpf = onlyDigits(cpfRaw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigito = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (pesoInicial - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calcDigito(cpf.slice(0, 9), 10);
  const d2 = calcDigito(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

function formatCpfDisplay(cpfRaw: string) {
  const d = onlyDigits(cpfRaw);
  if (d.length !== 11) return cpfRaw;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Verifica se o CPF já pertence a um cliente com dívida grave (atraso alto).
 * Retorna também se o CPF já existe como cliente.
 */
export async function checarDividaPorCpf(cpfRaw: string): Promise<{
  jaCliente: boolean;
  dividaGrave: boolean;
  diasAtrasoMax: number;
}> {
  const cpf = formatCpfDisplay(cpfRaw);
  const cliente = await prisma.cliente.findUnique({
    where: { cpf },
    select: {
      emprestimos: {
        select: {
          parcelas: {
            where: { status: { in: ["pendente", "vencida"] } },
            select: { vencimento: true }
          }
        }
      }
    }
  });

  if (!cliente) return { jaCliente: false, dividaGrave: false, diasAtrasoMax: 0 };

  const hoje = new Date();
  let diasAtrasoMax = 0;
  for (const e of cliente.emprestimos) {
    for (const p of e.parcelas) {
      diasAtrasoMax = Math.max(diasAtrasoMax, diasAtraso(p.vencimento, hoje));
    }
  }

  return {
    jaCliente: true,
    dividaGrave: diasAtrasoMax >= DIAS_ATRASO_DIVIDA_GRAVE,
    diasAtrasoMax
  };
}

/**
 * Motor de qualificação (regras + banco). A IA não decide aqui.
 * Critérios definidos com o dono:
 *  - Cadastro completo (nome, CPF válido, endereço)
 *  - CPF sem dívida grave no sistema
 *  - Intenção real de crédito
 */
export async function qualificarLead(input: {
  extraido: LeadExtraido;
  querCredito: boolean;
}): Promise<Qualificacao> {
  const { extraido, querCredito } = input;
  const motivos: string[] = [];
  const pendencias: string[] = [];

  const temNome = Boolean(extraido.nome && extraido.nome.trim().length >= 3);
  const temEndereco = Boolean(extraido.endereco && extraido.endereco.trim().length >= 8);
  const cpfOk = Boolean(extraido.cpf && cpfValido(extraido.cpf));

  const cadastroCompleto = temNome && temEndereco && cpfOk;

  if (!temNome) pendencias.push("nome completo");
  if (!cpfOk) pendencias.push("CPF válido");
  if (!temEndereco) pendencias.push("endereço completo");

  let cpfComDividaGrave = false;
  if (cpfOk) {
    const divida = await checarDividaPorCpf(extraido.cpf!);
    cpfComDividaGrave = divida.dividaGrave;
  }

  let score = 0;
  const maxScore = 3;

  if (cadastroCompleto) {
    score++;
    motivos.push("Cadastro completo (nome, CPF, endereço)");
  }
  if (cpfOk && !cpfComDividaGrave) {
    score++;
    motivos.push("CPF sem dívida grave no sistema");
  } else if (cpfComDividaGrave) {
    pendencias.push("CPF com dívida grave (atraso alto)");
  }
  if (querCredito) {
    score++;
    motivos.push("Intenção real de crédito");
  } else {
    pendencias.push("intenção de crédito não confirmada");
  }

  const qualificado = cadastroCompleto && cpfOk && !cpfComDividaGrave && querCredito;

  return { qualificado, score, maxScore, motivos, pendencias, cpfComDividaGrave };
}
