import { prisma } from "@/lib/prisma";
import { syncEmprestimoStatus } from "@/lib/emprestimo-status";
import { runWithConcurrency } from "@/lib/async-pool";
import {
  BR_TIMEZONE,
  calcularParcelaComIsencao,
  calendarDayKeyBR,
  dateFromCalendarDayKey,
  diasAtraso,
  diasParaVencer,
  isSameCalendarDayBR,
  shiftCalendarDayKey
} from "@/lib/finance";
import { type FrequenciaParcela, isDomingo } from "@/lib/parcel-schedule";
import { formatDateBR } from "@/lib/date";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";
import { buildPagarLink, formatLinkPagamentoWhatsApp } from "@/lib/app-url";
import { toCurrency } from "@/lib/utils";

const MAX_AVISOS_VENCIMENTO = 4;
const VENCIMENTO_JANELA_DIAS_ANTES = 5;
const VENCIMENTO_JANELA_DIAS_ATRASO = 120;

export type CobrancaAutomaticaResult = {
  processadas: number;
  enviadas: number;
  ignoradas: number;
  erros: number;
  pendentes: number;
  detalhes: { parcelaId: string; fase: string; motivo?: string }[];
};

export type ProcessarCobrancaOptions = {
  deadlineMs?: number;
  concurrency?: number;
};

type FaseCobranca = "antecipado" | "vencimento" | "atraso";

type ParcelaCobranca = Awaited<ReturnType<typeof carregarParcelasAbertas>>[number];

type SendJob = {
  parcela: ParcelaCobranca;
  fase: FaseCobranca;
  diasParaVencerValor: number;
  diasAtrasoValor: number;
  valorAtualizado: number;
  avisoNumero: number;
  maxAvisos: number;
  updateCounters: {
    avisos_antecipados?: number;
    avisos_vencimento?: number;
    avisos_atraso?: number;
    ultimo_aviso_em: Date;
  };
};

function getConcurrency() {
  const raw = Number(process.env.COBRANCA_CONCURRENCY ?? "12");
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 20) : 12;
}

function getDeadlineMs(override?: number) {
  const raw = override ?? Number(process.env.COBRANCA_DEADLINE_MS ?? "55000");
  return Number.isFinite(raw) && raw > 5000 ? Math.min(Math.floor(raw), 55000) : 55000;
}

const FASE_PRIORITY: Record<FaseCobranca, number> = {
  vencimento: 0,
  antecipado: 1,
  atraso: 2
};

/** Quem está há mais tempo sem aviso vai primeiro; ninguém fica sempre no fim da fila. */
function sortSendJobsPorPrioridade(jobs: SendJob[]) {
  jobs.sort((a, b) => {
    const faseDiff = FASE_PRIORITY[a.fase] - FASE_PRIORITY[b.fase];
    if (faseDiff !== 0) return faseDiff;

    const au = a.parcela.ultimo_aviso_em?.getTime() ?? 0;
    const bu = b.parcela.ultimo_aviso_em?.getTime() ?? 0;
    if (au !== bu) return au - bu;

    if (a.fase === "atraso" && b.fase === "atraso") {
      return a.diasAtrasoValor - b.diasAtrasoValor;
    }

    return a.parcela.vencimento.getTime() - b.parcela.vencimento.getTime();
  });
}

function buildPaymentLink() {
  return buildPagarLink();
}

function getCampoGrandeClock(hoje: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BR_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false
  }).formatToParts(hoje);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { hour, minute };
}

function isJanelaAntecipado(hoje: Date) {
  return getCampoGrandeClock(hoje).hour === 19;
}

/** Índice da janela de cobrança do dia: 14h=0, 17h=1, 20h=2, 23h40=3. null fora delas. */
function avisoWindowIndex(hoje: Date): number | null {
  const { hour, minute } = getCampoGrandeClock(hoje);
  if (hour === 14) return 0;
  if (hour === 17) return 1;
  if (hour === 20) return 2;
  if (hour === 23 && minute >= 35) return 3;
  return null;
}

function detectarFase(
  diasParaVencerValor: number,
  diasAtrasoValor: number,
  avisosAntecipados: number,
  avisosVencimento: number,
  ultimoAviso: Date | null,
  hoje: Date,
  frequenciaParcela: FrequenciaParcela
): { fase: FaseCobranca | null; motivo?: string } {
  if (diasAtrasoValor > 0) {
    const janela = avisoWindowIndex(hoje);
    if (janela === null) {
      return { fase: null, motivo: "atraso: fora do horário (14:00, 17:00, 20:00 ou 23:40)" };
    }
    if (
      ultimoAviso &&
      isSameCalendarDayBR(ultimoAviso, hoje) &&
      avisoWindowIndex(ultimoAviso) === janela
    ) {
      return { fase: null, motivo: "atraso: já avisado nesta janela" };
    }
    return { fase: "atraso" };
  }

  if (isDomingo(hoje)) {
    return { fase: null, motivo: "domingo: cobrança só em atraso (multa/juros continuam)" };
  }

  if (diasParaVencerValor === 2 || diasParaVencerValor === 1) {
    if (frequenciaParcela === "diario") {
      return { fase: null, motivo: "diário: sem aviso antecipado (só no dia do vencimento)" };
    }
  }

  if (diasParaVencerValor === 2) {
    if (!isJanelaAntecipado(hoje)) {
      return { fase: null, motivo: "antecipado 2d: fora do horário (19:00)" };
    }
    if (avisosAntecipados >= 1) {
      return { fase: null, motivo: "antecipado 2d: lembrete já enviado" };
    }
    return { fase: "antecipado" };
  }

  if (diasParaVencerValor === 1) {
    if (!isJanelaAntecipado(hoje)) {
      return { fase: null, motivo: "antecipado 1d: fora do horário (19:00)" };
    }
    if (avisosAntecipados >= 2) {
      return { fase: null, motivo: "antecipado 1d: lembrete já enviado" };
    }
    return { fase: "antecipado" };
  }

  if (diasParaVencerValor === 0) {
    const janela = avisoWindowIndex(hoje);
    if (janela === null) {
      return { fase: null, motivo: "vencimento: fora do horário (14:00, 17:00, 20:00 ou 23:40)" };
    }
    if (
      ultimoAviso &&
      isSameCalendarDayBR(ultimoAviso, hoje) &&
      avisoWindowIndex(ultimoAviso) === janela
    ) {
      return { fase: null, motivo: "vencimento: já avisado nesta janela" };
    }
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
  fase: FaseCobranca;
  diasAtrasoValor: number;
  diasParaVencerValor: number;
  avisoNumero: number;
  maxAvisos: number;
}) {
  const { nome, numeroParcela, vencimento, valorAtualizado, linkPagamento, fase } = input;
  const valor = toCurrency(valorAtualizado);
  const dataVenc = formatDateBR(vencimento);
  const rodape = formatLinkPagamentoWhatsApp(linkPagamento);

  if (fase === "antecipado") {
    const prazo =
      input.diasParaVencerValor === 1
        ? `vence amanhã (${dataVenc})`
        : `vence em 2 dias (${dataVenc})`;
    return `Olá ${nome}! Lembrete: sua parcela ${numeroParcela} ${prazo}. Valor: ${valor}.${rodape}`;
  }

  if (fase === "vencimento") {
    return `Olá ${nome}! Aviso ${input.avisoNumero}/${input.maxAvisos}: sua parcela ${numeroParcela} vence HOJE (${dataVenc}). Valor: ${valor}.${rodape}`;
  }

  return `Olá ${nome}! Sua parcela ${numeroParcela} está em atraso há ${input.diasAtrasoValor} dia(s) (venc. ${dataVenc}). Valor atualizado com multa e juros: ${valor}.${rodape}`;
}

function vencimentoRangeBR(hoje: Date) {
  const hojeKey = calendarDayKeyBR(hoje);
  const minKey = shiftCalendarDayKey(hojeKey, -VENCIMENTO_JANELA_DIAS_ATRASO);
  const maxKey = shiftCalendarDayKey(hojeKey, VENCIMENTO_JANELA_DIAS_ANTES);
  return {
    gte: dateFromCalendarDayKey(minKey)!,
    lte: dateFromCalendarDayKey(maxKey)!
  };
}

async function carregarParcelasAbertas(hoje: Date) {
  return prisma.parcela.findMany({
    where: {
      status: { in: ["pendente", "vencida"] },
      vencimento: vencimentoRangeBR(hoje)
    },
    include: {
      emprestimo: {
        select: {
          frequencia_parcela: true,
          cliente: true
        }
      }
    },
    orderBy: { vencimento: "asc" }
  });
}

function buildSendJob(
  parcela: ParcelaCobranca,
  fase: FaseCobranca,
  diasParaVencerValor: number,
  diasAtrasoValor: number,
  valorAtualizado: number,
  hoje: Date
): SendJob {
  const updateCounters: SendJob["updateCounters"] = { ultimo_aviso_em: hoje };
  let avisoNumero = 1;
  let maxAvisos = 1;

  if (fase === "antecipado") {
    updateCounters.avisos_antecipados = diasParaVencerValor === 2 ? 1 : 2;
    avisoNumero = updateCounters.avisos_antecipados;
    maxAvisos = 2;
  } else if (fase === "vencimento") {
    avisoNumero = parcela.avisos_vencimento + 1;
    maxAvisos = MAX_AVISOS_VENCIMENTO;
    updateCounters.avisos_vencimento = avisoNumero;
  } else {
    avisoNumero = parcela.avisos_atraso + 1;
    maxAvisos = avisoNumero;
    updateCounters.avisos_atraso = avisoNumero;
  }

  return {
    parcela,
    fase,
    diasParaVencerValor,
    diasAtrasoValor,
    valorAtualizado,
    avisoNumero,
    maxAvisos,
    updateCounters
  };
}

async function atualizarCalculoParcela(
  parcela: ParcelaCobranca,
  hoje: Date,
  diasAtrasoValor: number,
  calc: ReturnType<typeof calcularParcelaComIsencao>
) {
  await prisma.parcela.updateMany({
    where: { id: parcela.id, status: { in: ["pendente", "vencida"] } },
    data: {
      dias_atraso: calc.diasAtraso,
      multa_valor: calc.multaValor,
      juros_valor: calc.jurosValor,
      valor_atualizado: calc.valorAtualizado,
      status: diasAtrasoValor > 0 ? "vencida" : "pendente"
    }
  });
  await syncEmprestimoStatus(parcela.emprestimo_id);
}

async function executarEnvio(job: SendJob, hoje: Date, linkPagamento: string) {
  const { parcela, fase } = job;
  const calc = calcularParcelaComIsencao(
    Number(parcela.valor_original),
    job.diasAtrasoValor,
    parcela.emprestimo.frequencia_parcela,
    parcela.encargos_isentos,
    parcela.juros_isentos
  );
  await atualizarCalculoParcela(parcela, hoje, job.diasAtrasoValor, calc);

  const cliente = parcela.emprestimo.cliente;
  const message = montarMensagem({
    nome: cliente.nome,
    numeroParcela: parcela.numero_parcela,
    vencimento: parcela.vencimento,
    valorAtualizado: calc.valorAtualizado,
    linkPagamento,
    fase,
    diasAtrasoValor: job.diasAtrasoValor,
    diasParaVencerValor: job.diasParaVencerValor,
    avisoNumero: job.avisoNumero,
    maxAvisos: job.maxAvisos
  });

  await sendWhatsAppMessage({ phone: cliente.whatsapp, message });
  await prisma.parcela.update({
    where: { id: parcela.id },
    data: job.updateCounters
  });
}

export async function processarCobrancaAutomatica(
  options: ProcessarCobrancaOptions = {}
): Promise<CobrancaAutomaticaResult> {
  const hoje = new Date();
  const deadlineMs = getDeadlineMs(options.deadlineMs);
  const concurrency = options.concurrency ?? getConcurrency();
  const deadlineAt = Date.now() + deadlineMs;
  const resultado: CobrancaAutomaticaResult = {
    processadas: 0,
    enviadas: 0,
    ignoradas: 0,
    erros: 0,
    pendentes: 0,
    detalhes: []
  };

  const parcelas = await carregarParcelasAbertas(hoje);
  const sendJobs: SendJob[] = [];
  const linkPagamento = buildPaymentLink();

  for (const parcela of parcelas) {
    resultado.processadas++;
    const diasAtrasoValor = diasAtraso(parcela.vencimento, hoje);
    const diasParaVencerValor = diasParaVencer(parcela.vencimento, hoje);
    const calc = calcularParcelaComIsencao(
      Number(parcela.valor_original),
      diasAtrasoValor,
      parcela.emprestimo.frequencia_parcela,
      parcela.encargos_isentos,
      parcela.juros_isentos
    );

    const { fase, motivo } = detectarFase(
      diasParaVencerValor,
      diasAtrasoValor,
      parcela.avisos_antecipados,
      parcela.avisos_vencimento,
      parcela.ultimo_aviso_em,
      hoje,
      parcela.emprestimo.frequencia_parcela
    );

    if (!fase) {
      resultado.ignoradas++;
      resultado.detalhes.push({ parcelaId: parcela.id, fase: "nenhuma", motivo });
      continue;
    }

    sendJobs.push(
      buildSendJob(parcela, fase, diasParaVencerValor, diasAtrasoValor, calc.valorAtualizado, hoje)
    );
  }

  sortSendJobsPorPrioridade(sendJobs);

  let jobsStarted = 0;

  await runWithConcurrency(
    sendJobs,
    concurrency,
    async (job) => {
      jobsStarted++;
      try {
        await executarEnvio(job, hoje, linkPagamento);
        resultado.enviadas++;
        resultado.detalhes.push({ parcelaId: job.parcela.id, fase: job.fase });
      } catch (error) {
        resultado.erros++;
        const msg = error instanceof Error ? error.message : "erro ao enviar";
        resultado.detalhes.push({ parcelaId: job.parcela.id, fase: job.fase, motivo: msg });
      }
    },
    () => Date.now() >= deadlineAt
  );

  resultado.pendentes = Math.max(0, sendJobs.length - jobsStarted);
  return resultado;
}

/** Conta quantas parcelas ainda precisariam de envio (para encadear continuação). */
export async function contarCobrancasPendentes(): Promise<number> {
  const hoje = new Date();
  const parcelas = await carregarParcelasAbertas(hoje);
  let pendentes = 0;

  for (const parcela of parcelas) {
    const diasAtrasoValor = diasAtraso(parcela.vencimento, hoje);
    const diasParaVencerValor = diasParaVencer(parcela.vencimento, hoje);
    const { fase } = detectarFase(
      diasParaVencerValor,
      diasAtrasoValor,
      parcela.avisos_antecipados,
      parcela.avisos_vencimento,
      parcela.ultimo_aviso_em,
      hoje,
      parcela.emprestimo.frequencia_parcela
    );
    if (fase) pendentes++;
  }

  return pendentes;
}
