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
  /** Dono digitou no chat — IA para de responder neste número. */
  humano_assumiu?: boolean;
  ultima_resposta_bot?: string;
  ultima_resposta_bot_em?: string;
};

function parseDadosIa(raw: Prisma.JsonValue): DadosIa {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DadosIa;
}

function trimHistorico(historico: AiMessage[]) {
  return historico.slice(-MAX_HISTORICO);
}

function normMsg(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

/** Echo do próprio bot via Evolution (fromMe) — não pausar a IA. */
function isEchoDoBot(dados: DadosIa, texto: string) {
  const ultima = dados.ultima_resposta_bot;
  if (!ultima) return false;
  const enviadoEm = dados.ultima_resposta_bot_em
    ? new Date(dados.ultima_resposta_bot_em).getTime()
    : 0;
  if (Date.now() - enviadoEm > 120_000) return false;
  const a = normMsg(texto);
  const b = normMsg(ultima);
  return a === b || (a.length > 20 && (b.startsWith(a) || a.startsWith(b.slice(0, 40))));
}

async function salvarConversaIa(telefone: string, dados: DadosIa, etapa = ETAPA_IA) {
  await prisma.whatsappConversa.upsert({
    where: { telefone },
    create: { telefone, etapa, dados },
    update: { etapa, dados }
  });
}

/**
 * Dono escreveu no WhatsApp: assume o chat e a IA para de responder.
 * Ignora eco das mensagens que a própria IA acabou de enviar.
 */
export async function assumirConversaPorHumano(telefone: string, texto: string) {
  const conversa = await prisma.whatsappConversa.findUnique({ where: { telefone } });
  const dados = parseDadosIa(conversa?.dados ?? {});
  if (isEchoDoBot(dados, texto)) return false;

  await prisma.whatsappConversa.upsert({
    where: { telefone },
    create: {
      telefone,
      etapa: "humano",
      dados: { ...dados, humano_assumiu: true }
    },
    update: {
      etapa: "humano",
      dados: { ...dados, humano_assumiu: true }
    }
  });
  return true;
}

export function conversaAssumidaPorHumano(dados: DadosIa, etapa?: string) {
  return dados.humano_assumiu === true || etapa === "humano";
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

  // Dono já assumiu o chat — silêncio total.
  if (conversaAssumidaPorHumano(dados, conversa?.etapa)) {
    return true;
  }

  // Já qualificado: uma confirmação basta; não fica repetindo.
  if (dados.lead_qualificado) {
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

  const agora = new Date().toISOString();
  await salvarConversaIa(telefone, {
    lead,
    historico: trimHistorico(historico),
    quer_credito: querCredito,
    lead_qualificado: leadQualificado || dados.lead_qualificado,
    lead_notificado: leadNotificado,
    ultima_resposta_bot: respostaCliente,
    ultima_resposta_bot_em: agora
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
