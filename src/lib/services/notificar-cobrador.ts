import { prisma } from "@/lib/prisma";
import { calcularParcelaComIsencao, diasAtraso } from "@/lib/finance";
import { formatDateBR } from "@/lib/date";
import { toCurrency } from "@/lib/utils";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";
import { getPublicAppUrl } from "@/lib/app-url";

/** A partir de quantos dias de atraso o dono é avisado para acionar o cobrador. */
const DIAS_ATRASO_COBRADOR = 3;

export type NotificarCobradorResult = {
  enviadas: number;
  clientes: number;
  erros: number;
  ignorado?: string;
};

/** Número (WhatsApp) que recebe o resumo para repassar ao cobrador. */
function getNotificacaoWhatsApp() {
  return (
    process.env.NOTIFICACAO_WHATSAPP?.trim() ||
    process.env.COBRADOR_WHATSAPP?.trim() ||
    ""
  );
}

function montarMensagem(input: {
  nome: string;
  telefone: string;
  endereco: string;
  numeros: number[];
  diasAtrasoMax: number;
  totalDevido: number;
}) {
  const ordenados = [...input.numeros].sort((a, b) => a - b);
  const parcelasTxt =
    ordenados.length === 1
      ? `1 (nº ${ordenados[0]})`
      : `${ordenados.length} (nº ${ordenados.join(", ")})`;

  const digits = input.telefone.replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  const linkCliente = `https://wa.me/${full}`;
  const linkPagar = `${getPublicAppUrl()}/pagar`;

  return [
    `*Cobrança — cliente com ${input.diasAtrasoMax} dias de atraso*`,
    `Encaminhe ao cobrador:`,
    ``,
    `*Cliente:* ${input.nome}`,
    `*Telefone:* ${input.telefone}`,
    `*Endereço:* ${input.endereco}`,
    `*Parcelas em atraso:* ${parcelasTxt}`,
    `*Total devido:* ${toCurrency(input.totalDevido)}`,
    ``,
    `WhatsApp do cliente: ${linkCliente}`,
    `Link de pagamento: ${linkPagar}`
  ].join("\n");
}

/**
 * Avisa o dono (no WhatsApp) sobre clientes que passaram de 3 dias de atraso,
 * para repassar ao cobrador. Cada parcela dispara o aviso uma única vez
 * (marca `aviso_cobrador_em`), então não fica repetindo todo dia.
 */
export async function notificarCobrador(): Promise<NotificarCobradorResult> {
  const destino = getNotificacaoWhatsApp();
  if (!destino) {
    return { enviadas: 0, clientes: 0, erros: 0, ignorado: "NOTIFICACAO_WHATSAPP não configurado" };
  }

  const hoje = new Date();

  const parcelas = await prisma.parcela.findMany({
    where: {
      status: { in: ["pendente", "vencida"] },
      aviso_cobrador_em: null
    },
    select: {
      id: true,
      numero_parcela: true,
      valor_original: true,
      vencimento: true,
      encargos_isentos: true,
      juros_isentos: true,
      emprestimo: {
        select: {
          frequencia_parcela: true,
          cliente: { select: { id: true, nome: true, endereco: true, whatsapp: true } }
        }
      }
    }
  });

  type Agg = {
    nome: string;
    endereco: string;
    whatsapp: string;
    numeros: number[];
    parcelaIds: string[];
    diasAtrasoMax: number;
    totalDevido: number;
  };

  const porCliente = new Map<string, Agg>();

  for (const p of parcelas) {
    const dias = diasAtraso(p.vencimento, hoje);
    if (dias < DIAS_ATRASO_COBRADOR) continue;

    const calc = calcularParcelaComIsencao(
      Number(p.valor_original),
      dias,
      p.emprestimo.frequencia_parcela,
      p.encargos_isentos,
      p.juros_isentos
    );

    const cliente = p.emprestimo.cliente;
    const atual = porCliente.get(cliente.id) ?? {
      nome: cliente.nome,
      endereco: cliente.endereco,
      whatsapp: cliente.whatsapp,
      numeros: [],
      parcelaIds: [],
      diasAtrasoMax: 0,
      totalDevido: 0
    };
    atual.numeros.push(p.numero_parcela);
    atual.parcelaIds.push(p.id);
    atual.diasAtrasoMax = Math.max(atual.diasAtrasoMax, dias);
    atual.totalDevido += calc.valorAtualizado;
    porCliente.set(cliente.id, atual);
  }

  const result: NotificarCobradorResult = { enviadas: 0, clientes: 0, erros: 0 };

  for (const cliente of porCliente.values()) {
    result.clientes++;
    const message = montarMensagem({
      nome: cliente.nome,
      telefone: cliente.whatsapp,
      endereco: cliente.endereco,
      numeros: cliente.numeros,
      diasAtrasoMax: cliente.diasAtrasoMax,
      totalDevido: cliente.totalDevido
    });

    try {
      await sendWhatsAppMessage({ phone: destino, message });
      await prisma.parcela.updateMany({
        where: { id: { in: cliente.parcelaIds } },
        data: { aviso_cobrador_em: hoje }
      });
      result.enviadas++;
    } catch {
      result.erros++;
    }
  }

  return result;
}
