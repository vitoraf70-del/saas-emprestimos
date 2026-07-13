import { getPublicAppUrl } from "@/lib/app-url";
import { toCurrency } from "@/lib/utils";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";
import type { LeadExtraido } from "@/lib/services/ai-chat";
import type { Qualificacao } from "@/lib/services/lead-qualification";

/** WhatsApp do dono (mesmo usado para avisar sobre cobrança). */
function getDonoWhatsApp() {
  return (
    process.env.NOTIFICACAO_WHATSAPP?.trim() ||
    process.env.COBRADOR_WHATSAPP?.trim() ||
    ""
  );
}

function linkWhatsAppCliente(telefone: string) {
  const digits = telefone.replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
}

/** Avisa o dono sobre um lead qualificado pela pré-análise da IA. */
export async function notificarLeadQualificado(input: {
  telefone: string;
  extraido: LeadExtraido;
  qualificacao: Qualificacao;
}): Promise<boolean> {
  const destino = getDonoWhatsApp();
  if (!destino) return false;

  const { extraido, qualificacao } = input;
  const linhas = [
    `*Lead qualificado (${qualificacao.score}/${qualificacao.maxScore})*`,
    `Pré-análise da IA no WhatsApp`,
    ``,
    `*Nome:* ${extraido.nome ?? "—"}`,
    `*CPF:* ${extraido.cpf ?? "—"}`,
    `*Endereço:* ${extraido.endereco ?? "—"}`,
    `*Ocupação:* ${extraido.ocupacao ?? "—"}`,
    extraido.valor_desejado ? `*Quer:* ${toCurrency(extraido.valor_desejado)}` : `*Quer:* —`,
    extraido.motivo ? `*Motivo:* ${extraido.motivo}` : ``,
    ``,
    `WhatsApp do cliente: ${linkWhatsAppCliente(input.telefone)}`
  ].filter(Boolean);

  try {
    await sendWhatsAppMessage({ phone: destino, message: linhas.join("\n") });
    return true;
  } catch {
    return false;
  }
}

/** Avisa o dono que um cliente inadimplente entrou em contato pelo WhatsApp. */
export async function notificarContatoInadimplente(input: {
  nome: string;
  telefone: string;
  saldo: number;
  diasAtrasoMax: number;
}): Promise<boolean> {
  const destino = getDonoWhatsApp();
  if (!destino) return false;

  const message = [
    `*Cliente inadimplente entrou em contato*`,
    ``,
    `*Cliente:* ${input.nome}`,
    `*Atraso máx.:* ${input.diasAtrasoMax} dia(s)`,
    `*Saldo em aberto:* ${toCurrency(input.saldo)}`,
    ``,
    `WhatsApp do cliente: ${linkWhatsAppCliente(input.telefone)}`,
    `Painel: ${getPublicAppUrl()}`
  ].join("\n");

  try {
    await sendWhatsAppMessage({ phone: destino, message });
    return true;
  } catch {
    return false;
  }
}
