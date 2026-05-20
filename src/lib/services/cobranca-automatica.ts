import { prisma } from "@/lib/prisma";
import { syncEmprestimoStatus } from "@/lib/emprestimo-status";
import { calcularParcelaAtualizada, diasAtraso, diasParaVencer, isSameCalendarDayBR } from "@/lib/finance";
import { isDomingo } from "@/lib/parcel-schedule";
import { formatDateBR } from "@/lib/date";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";
import { buildPagarLink, formatLinkPagamentoWhatsApp } from "@/lib/app-url";
import { toCurrency } from "@/lib/utils";

const MAX_AVISOS_ANTECIPADOS = 2;
const MAX_AVISOS_VENCIMENTO = 3;
const DIAS_ANTECEDENCIA = 2;

export type CobrancaAutomaticaResult = {
  processadas: number;
  enviadas: number;
  ignoradas: number;
  erros: number;
  detalhes: { parcelaId: string; fase: string; motivo?: string }[];
};

type FaseCobranca = "antecipado" | "vencimento" | "atraso" | null;

function buildPaymentLink() {
  return buildPagarLink();
}

function detectarFase(
  diasParaVencerValor: number,
  diasAtrasoValor: number,
  avisosAntecipados: number,
  avisosVencimento: number,
  ultimoAviso: Date | null,
  hoje: Date
): { fase: FaseCobranca; motivo?: string } {
  if (diasAtrasoValor > 0) {
    if (ultimoAviso && isSameCalendarDayBR(ultimoAviso, hoje)) {
      return { fase: null, motivo: "atraso: já avisado hoje" };
    }
    return { fase: "atraso" };
  }

  if (isDomingo(hoje)) {
    return { fase: null, motivo: "domingo: cobrança só em atraso (multa/juros continuam)" };
  }

  if (diasParaVencerValor === DIAS_ANTECEDENCIA) {
    if (avisosAntecipados >= MAX_AVISOS_ANTECIPADOS) {
      return { fase: null, motivo: "antecipado: limite de avisos atingido" };
    }
    return { fase: "antecipado" };
  }

  if (diasParaVencerValor === 0) {
    if (avisosVencimento >= MAX_AVISOS_VENCIMENTO) {
      return { fase: null, motivo: "vencimento: limite de avisos atingido" };
    }
    return { fase: "vencimento" };
  }

  return { fase: null, motivo: "fora da janela de cobrança" };
}

function montarMensagem(input: {
  nome: string;
  numeroParcela: number;
  vencimento: Date;
  valorAtualizado: number;
  linkPagamento: string;
  fase: NonNullable<FaseCobranca>;
  diasAtrasoValor: number;
  avisoNumero: number;
  maxAvisos: number;
}) {
  const { nome, numeroParcela, vencimento, valorAtualizado, linkPagamento, fase } = input;
  const valor = toCurrency(valorAtualizado);
  const dataVenc = formatDateBR(vencimento);
  const rodape = formatLinkPagamentoWhatsApp(linkPagamento);

  if (fase === "antecipado") {
    return `Olá ${nome}! Lembrete ${input.avisoNumero}/${input.maxAvisos}: sua parcela ${numeroParcela} vence em 2 dias (${dataVenc}). Valor: ${valor}.${rodape}`;
  }

  if (fase === "vencimento") {
    return `Olá ${nome}! Aviso ${input.avisoNumero}/${input.maxAvisos}: sua parcela ${numeroParcela} vence HOJE (${dataVenc}). Valor: ${valor}.${rodape}`;
  }

  return `Olá ${nome}! Sua parcela ${numeroParcela} está em atraso há ${input.diasAtrasoValor} dia(s) (venc. ${dataVenc}). Valor atualizado com multa e juros: ${valor}.${rodape}`;
}

export async function processarCobrancaAutomatica(): Promise<CobrancaAutomaticaResult> {
  const hoje = new Date();
  const resultado: CobrancaAutomaticaResult = {
    processadas: 0,
    enviadas: 0,
    ignoradas: 0,
    erros: 0,
    detalhes: []
  };

  const parcelas = await prisma.parcela.findMany({
    where: { status: { in: ["pendente", "vencida"] } },
    include: { emprestimo: { include: { cliente: true } } },
    orderBy: { vencimento: "asc" }
  });

  for (const parcela of parcelas) {
    resultado.processadas++;
    const diasAtrasoValor = diasAtraso(parcela.vencimento, hoje);
    const diasParaVencerValor = diasParaVencer(parcela.vencimento, hoje);
    const calc = calcularParcelaAtualizada(Number(parcela.valor_original), diasAtrasoValor);

    await prisma.parcela.update({
      where: { id: parcela.id },
      data: {
        dias_atraso: calc.diasAtraso,
        multa_valor: calc.multaValor,
        juros_valor: calc.jurosValor,
        valor_atualizado: calc.valorAtualizado,
        status: diasAtrasoValor > 0 ? "vencida" : "pendente"
      }
    });
    await syncEmprestimoStatus(parcela.emprestimo_id);

    const { fase, motivo } = detectarFase(
      diasParaVencerValor,
      diasAtrasoValor,
      parcela.avisos_antecipados,
      parcela.avisos_vencimento,
      parcela.ultimo_aviso_em,
      hoje
    );

    if (!fase) {
      resultado.ignoradas++;
      resultado.detalhes.push({ parcelaId: parcela.id, fase: "nenhuma", motivo });
      continue;
    }

    const cliente = parcela.emprestimo.cliente;
    const linkPagamento = buildPaymentLink();

    let avisoNumero = 1;
    let maxAvisos = 1;
    const updateCounters: {
      avisos_antecipados?: number;
      avisos_vencimento?: number;
      avisos_atraso?: number;
      ultimo_aviso_em: Date;
    } = { ultimo_aviso_em: hoje };

    if (fase === "antecipado") {
      avisoNumero = parcela.avisos_antecipados + 1;
      maxAvisos = MAX_AVISOS_ANTECIPADOS;
      updateCounters.avisos_antecipados = avisoNumero;
    } else if (fase === "vencimento") {
      avisoNumero = parcela.avisos_vencimento + 1;
      maxAvisos = MAX_AVISOS_VENCIMENTO;
      updateCounters.avisos_vencimento = avisoNumero;
    } else {
      avisoNumero = parcela.avisos_atraso + 1;
      maxAvisos = avisoNumero;
      updateCounters.avisos_atraso = avisoNumero;
    }

    const message = montarMensagem({
      nome: cliente.nome,
      numeroParcela: parcela.numero_parcela,
      vencimento: parcela.vencimento,
      valorAtualizado: calc.valorAtualizado,
      linkPagamento,
      fase,
      diasAtrasoValor,
      avisoNumero,
      maxAvisos
    });

    try {
      await sendWhatsAppMessage({ phone: cliente.whatsapp, message });
      await prisma.parcela.update({
        where: { id: parcela.id },
        data: updateCounters
      });
      resultado.enviadas++;
      resultado.detalhes.push({ parcelaId: parcela.id, fase });
    } catch (error) {
      resultado.erros++;
      const msg = error instanceof Error ? error.message : "erro ao enviar";
      resultado.detalhes.push({ parcelaId: parcela.id, fase, motivo: msg });
    }
  }

  return resultado;
}
