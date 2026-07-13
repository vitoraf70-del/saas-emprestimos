import { Prisma, TipoOcupacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { diasAtraso } from "@/lib/finance";
import { toCurrency } from "@/lib/utils";
import {
  analisarLeadComIA,
  isAiEnabled,
  mergeExtraido,
  type AiMessage,
  type LeadExtraido
} from "@/lib/services/ai-chat";
import { qualificarLead } from "@/lib/services/lead-qualification";
import {
  notificarContatoInadimplente,
  notificarLeadQualificado
} from "@/lib/services/notificar-lead";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";

const ETAPA_IA = "ia_pre_analise";
const MAX_HISTORICO = 20;

type DadosIa = {
  lead?: LeadExtraido;
  historico?: AiMessage[];
  quer_credito?: boolean;
  lead_qualificado?: boolean;
  lead_notificado?: boolean;
  inadimplente_notificado_em?: string;
};

function parseDadosIa(raw: Prisma.JsonValue): DadosIa {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DadosIa;
}

function trimHistorico(historico: AiMessage[]) {
  return historico.slice(-MAX_HISTORICO);
}

async function salvarConversaIa(telefone: string, dados: DadosIa) {
  await prisma.whatsappConversa.upsert({
    where: { telefone },
    create: { telefone, etapa: ETAPA_IA, dados },
    update: { etapa: ETAPA_IA, dados }
  });
}

function mapearOcupacao(texto?: string): { tipo: TipoOcupacao; detalhe?: string } {
  const t = (texto ?? "").toLowerCase();
  if (/comerciante|loja|comércio|comercio/.test(t)) return { tipo: "comerciante" };
  if (/motorista|uber|99|app/.test(t)) return { tipo: "motorista_app" };
  if (/autônomo|autonomo|freela/.test(t)) return { tipo: "autonomo" };
  if (/clt|funcionário|funcionario|emprego/.test(t)) return { tipo: "funcionario_clt" };
  return { tipo: "outro", detalhe: texto?.trim() || undefined };
}

/** Pré-análise com IA para leads novos. Retorna true se tratou a mensagem. */
export async function processarLeadComIA(
  telefone: string,
  texto: string,
  pushName?: string
): Promise<boolean> {
  if (!isAiEnabled()) return false;

  const conversa = await prisma.whatsappConversa.findUnique({ where: { telefone } });
  const dados = parseDadosIa(conversa?.dados ?? {});

  if (dados.lead_qualificado) {
    await sendWhatsAppMessage({
      phone: telefone,
      message:
        "Seu cadastro já foi encaminhado para análise. Em breve entraremos em contato!\n\nDigite *menu* se precisar."
    });
    return true;
  }

  const historico: AiMessage[] = dados.historico ?? [];
  if (historico.length === 0) {
    historico.push({
      role: "user",
      content: pushName
        ? `Cliente (${pushName}) disse: ${texto}`
        : texto
    });
  } else {
    historico.push({ role: "user", content: texto });
  }

  const resultado = await analisarLeadComIA(historico);
  if (!resultado) return false;

  historico.push({ role: "assistant", content: resultado.resposta });
  const lead = mergeExtraido(dados.lead ?? {}, resultado.extraido);
  const querCredito = dados.quer_credito ?? resultado.querCredito;

  const qualificacao = await qualificarLead({ extraido: lead, querCredito });

  let respostaCliente = resultado.resposta;
  let leadQualificado = false;
  let leadNotificado = dados.lead_notificado ?? false;

  if (qualificacao.qualificado && !leadNotificado) {
    leadQualificado = true;
    leadNotificado = await notificarLeadQualificado({
      telefone,
      extraido: lead,
      qualificacao
    });
    respostaCliente = [
      resultado.resposta,
      "",
      "Recebi seus dados! Nossa equipe vai analisar e retornar em breve. Obrigado!"
    ].join("\n");
  } else if (resultado.encerrar && !qualificacao.qualificado) {
    respostaCliente = [
      resultado.resposta,
      "",
      "Se mudar de ideia, é só mandar mensagem aqui. Até mais!"
    ].join("\n");
  }

  await salvarConversaIa(telefone, {
    lead,
    historico: trimHistorico(historico),
    quer_credito: querCredito,
    lead_qualificado: leadQualificado || dados.lead_qualificado,
    lead_notificado: leadNotificado
  });

  await sendWhatsAppMessage({ phone: telefone, message: respostaCliente });
  return true;
}

type ClienteComParcelas = {
  nome: string;
  emprestimos: {
    parcelas: { status: string; vencimento: Date; valor_atualizado: unknown; valor_original: unknown }[];
  }[];
};

/** Avisa o dono quando cliente inadimplente entra em contato (1x por dia). */
export async function avisarInadimplenteSeNecessario(
  telefone: string,
  cliente: ClienteComParcelas
) {
  const hoje = new Date();
  const hojeKey = hoje.toISOString().slice(0, 10);

  const conversa = await prisma.whatsappConversa.findUnique({ where: { telefone } });
  const dados = parseDadosIa(conversa?.dados ?? {});
  if (dados.inadimplente_notificado_em === hojeKey) return;

  const parcelas = cliente.emprestimos.flatMap((e) => e.parcelas);
  const abertas = parcelas.filter((p) => p.status !== "paga");
  if (abertas.length === 0) return;

  let diasAtrasoMax = 0;
  let saldo = 0;
  for (const p of abertas) {
    const dias = diasAtraso(p.vencimento, hoje);
    diasAtrasoMax = Math.max(diasAtrasoMax, dias);
    saldo += Number(p.valor_atualizado || p.valor_original);
  }

  if (diasAtrasoMax <= 0) return;

  const enviado = await notificarContatoInadimplente({
    nome: cliente.nome,
    telefone,
    saldo,
    diasAtrasoMax
  });

  if (enviado) {
    await prisma.whatsappConversa.upsert({
      where: { telefone },
      create: {
        telefone,
        etapa: "cliente",
        dados: { inadimplente_notificado_em: hojeKey }
      },
      update: {
        dados: { ...dados, inadimplente_notificado_em: hojeKey }
      }
    });
  }
}

export { ETAPA_IA, mapearOcupacao };
