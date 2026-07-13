import { Prisma, TipoOcupacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildPagarLink, formatLinkPagamentoWhatsApp } from "@/lib/app-url";
import { labelOcupacao, mensagemMenuOcupacao, parseOcupacaoResposta } from "@/lib/ocupacao";
import { formatBrazilPhone, toCurrency } from "@/lib/utils";
import { isAiEnabled } from "@/lib/services/ai-chat";
import { sendWhatsAppMessage, normalizeWhatsAppDigits, whatsappMatchKey } from "@/lib/services/whatsapp";
import {
  assumirConversaPorHumano,
  avisarInadimplenteSeNecessario,
  conversaAssumidaPorHumano,
  ETAPA_IA,
  processarLeadComIA
} from "@/lib/services/whatsapp-ia-lead";
import type { InboundWhatsAppMessage } from "@/lib/services/whatsapp-inbound";

function parseDadosConversa(raw: Prisma.JsonValue) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as { humano_assumiu?: boolean; lead_qualificado?: boolean };
}

type CadastroDados = {
  nome?: string;
  cpf?: string;
  endereco?: string;
  tipo_ocupacao?: TipoOcupacao;
  ocupacao_detalhe?: string;
};

const ETAPAS = {
  nome: "nome",
  cpf: "cpf",
  endereco: "endereco",
  ocupacao: "ocupacao",
  ocupacao_detalhe: "ocupacao_detalhe"
} as const;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpfDisplay(cpf: string) {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function parseDados(raw: Prisma.JsonValue): CadastroDados {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as CadastroDados;
}

async function findClienteByTelefone(telefone: string) {
  const alvo = whatsappMatchKey(telefone);
  const clientes = await prisma.cliente.findMany({
    select: {
      id: true,
      nome: true,
      cpf: true,
      whatsapp: true,
      tipo_ocupacao: true,
      ocupacao_detalhe: true,
      emprestimos: {
        select: {
          parcelas: {
            select: {
              status: true,
              vencimento: true,
              valor_atualizado: true,
              valor_original: true,
              numero_parcela: true
            }
          }
        }
      }
    }
  });

  return (
    clientes.find((c) => {
      try {
        return whatsappMatchKey(c.whatsapp) === alvo;
      } catch {
        return false;
      }
    }) ?? null
  );
}

async function resumoClienteExistente(cliente: NonNullable<Awaited<ReturnType<typeof findClienteByTelefone>>>) {
  const parcelas = cliente.emprestimos.flatMap((e) => e.parcelas);
  const abertas = parcelas.filter((p) => p.status !== "paga");
  const saldo = abertas.reduce(
    (acc, p) => acc + Number(p.valor_atualizado || p.valor_original),
    0
  );
  const proxima = abertas
    .map((p) => p.vencimento)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  const linhas = [
    `Olá, *${cliente.nome}*!`,
    `Ocupação: ${labelOcupacao(cliente.tipo_ocupacao, cliente.ocupacao_detalhe)}`,
    `Saldo em aberto: *${toCurrency(saldo)}*`,
    proxima
      ? `Próximo vencimento: ${proxima.toLocaleDateString("pt-BR")}`
      : "Nenhuma parcela em aberto.",
    "",
    "Comandos:",
    "• *pagar* — link de pagamento",
    "• *saldo* — valor em aberto",
    "• *cadastro* — atualizar dados (novo cadastro)",
    "• *menu* — ver opções"
  ];

  return linhas.join("\n");
}

async function iniciarCadastro(telefone: string, pushName?: string) {
  await prisma.whatsappConversa.upsert({
    where: { telefone },
    create: {
      telefone,
      etapa: ETAPAS.nome,
      dados: pushName ? { nome: pushName } : {}
    },
    update: {
      etapa: ETAPAS.nome,
      dados: pushName ? { nome: pushName } : {}
    }
  });

  return [
    "Vamos fazer seu cadastro para análise de crédito.",
    "Digite *cancelar* a qualquer momento para parar.",
    "",
    "Qual seu *nome completo*?"
  ].join("\n");
}

async function fluxoCadastro(
  conversa: { telefone: string; etapa: string; dados: Prisma.JsonValue },
  texto: string
) {
  const dados = parseDados(conversa.dados);
  const t = texto.trim();

  if (conversa.etapa === ETAPAS.nome) {
    if (t.length < 3) return "Informe seu nome completo (mínimo 3 letras).";
    dados.nome = t;
    await prisma.whatsappConversa.update({
      where: { telefone: conversa.telefone },
      data: { etapa: ETAPAS.cpf, dados }
    });
    return `Obrigado, *${dados.nome}*!\n\nAgora envie seu *CPF* (somente números).`;
  }

  if (conversa.etapa === ETAPAS.cpf) {
    const cpf = onlyDigits(t);
    if (cpf.length !== 11) return "CPF inválido. Envie os 11 números do CPF.";
    const existe = await prisma.cliente.findUnique({ where: { cpf: formatCpfDisplay(cpf) } });
    if (existe) {
      return "Este CPF já está cadastrado. Se for você, digite *menu* para consultar saldo ou *pagar*.";
    }
    dados.cpf = formatCpfDisplay(cpf);
    await prisma.whatsappConversa.update({
      where: { telefone: conversa.telefone },
      data: { etapa: ETAPAS.endereco, dados }
    });
    return "Qual seu *endereço completo*? (rua, número, bairro, cidade)";
  }

  if (conversa.etapa === ETAPAS.endereco) {
    if (t.length < 8) return "Endereço muito curto. Envie rua, número e cidade.";
    dados.endereco = t;
    await prisma.whatsappConversa.update({
      where: { telefone: conversa.telefone },
      data: { etapa: ETAPAS.ocupacao, dados }
    });
    return mensagemMenuOcupacao();
  }

  if (conversa.etapa === ETAPAS.ocupacao) {
    const tipo = parseOcupacaoResposta(t);
    if (!tipo) {
      return `${mensagemMenuOcupacao()}\n\nNão entendi. Responda com o número (1 a 5).`;
    }
    dados.tipo_ocupacao = tipo;
    if (tipo === "outro") {
      await prisma.whatsappConversa.update({
        where: { telefone: conversa.telefone },
        data: { etapa: ETAPAS.ocupacao_detalhe, dados }
      });
      return "Descreva sua ocupação (ex.: pedreiro, manicure, vendedor ambulante):";
    }

    return await finalizarCadastro(conversa.telefone, dados);
  }

  if (conversa.etapa === ETAPAS.ocupacao_detalhe) {
    if (t.length < 2) return "Descreva brevemente sua ocupação.";
    dados.ocupacao_detalhe = t;
    return await finalizarCadastro(conversa.telefone, dados);
  }

  return await iniciarCadastro(conversa.telefone);
}

async function finalizarCadastro(telefone: string, dados: CadastroDados) {
  if (!dados.nome || !dados.cpf || !dados.endereco || !dados.tipo_ocupacao) {
    await prisma.whatsappConversa.delete({ where: { telefone } }).catch(() => {});
    return "Cadastro incompleto. Digite *cadastro* para começar de novo.";
  }

  const whatsappFormatado = formatBrazilPhone(telefone.slice(2));

  await prisma.cliente.create({
    data: {
      nome: dados.nome,
      cpf: dados.cpf,
      endereco: dados.endereco,
      whatsapp: whatsappFormatado,
      tipo_ocupacao: dados.tipo_ocupacao,
      ocupacao_detalhe: dados.ocupacao_detalhe ?? null,
      origem_cadastro: "whatsapp"
    }
  });

  await prisma.whatsappConversa.delete({ where: { telefone } }).catch(() => {});

  return [
    "Cadastro concluído com sucesso!",
    "",
    `Nome: ${dados.nome}`,
    `CPF: ${dados.cpf}`,
    `Ocupação: ${labelOcupacao(dados.tipo_ocupacao, dados.ocupacao_detalhe)}`,
    "",
    "Em breve entraremos em contato sobre crédito.",
    "Digite *menu* quando quiser consultar saldo ou pagar."
  ].join("\n");
}

function menuInicial() {
  if (isAiEnabled()) {
    return [
      "Olá! Sou o assistente do crediário.",
      "",
      "Posso ajudar com análise de crédito, saldo e pagamento.",
      "Me conte o que você precisa ou digite:",
      "• *pagar* — link de pagamento (clientes)",
      "• *saldo* — valor em aberto",
      "• *menu* — ver opções"
    ].join("\n");
  }
  return [
    "Olá! Sou o assistente do crediário.",
    "",
    "• *cadastro* — fazer cadastro (nome, CPF, ocupação…)",
    "• *pagar* — link para pagar parcela",
    "• *saldo* — valor em aberto",
    "• *menu* — ver opções",
    "",
    "Para começar, digite *cadastro*."
  ].join("\n");
}

export async function processarMensagemWhatsApp(msg: InboundWhatsAppMessage) {
  const telefone = normalizeWhatsAppDigits(msg.telefone);
  const texto = msg.texto.trim();

  // Você digitou no chat → IA para neste número (só você responde).
  if (msg.fromMe) {
    await assumirConversaPorHumano(telefone, texto);
    return;
  }

  const cmd = texto.toLowerCase();

  if (cmd === "cancelar") {
    await prisma.whatsappConversa.delete({ where: { telefone } }).catch(() => {});
    await sendWhatsAppMessage({
      phone: telefone,
      message: "Cadastro cancelado. Digite *menu* quando quiser."
    });
    return;
  }

  const conversa = await prisma.whatsappConversa.findUnique({ where: { telefone } });
  const dados = parseDadosConversa(conversa?.dados ?? {});

  if (conversaAssumidaPorHumano(dados, conversa?.etapa)) {
    return;
  }

  const cliente = await findClienteByTelefone(telefone);

  // Cliente já cadastrado: dono atende — bot NÃO responde (nem IA, nem menu).
  if (cliente) {
    if (conversa?.etapa === ETAPA_IA) {
      await prisma.whatsappConversa.delete({ where: { telefone } }).catch(() => {});
    }
    await avisarInadimplenteSeNecessario(telefone, cliente);
    return;
  }

  const emCadastroManual =
    conversa && conversa.etapa !== "concluido" && conversa.etapa !== ETAPA_IA && conversa.etapa !== "cliente";

  if (emCadastroManual) {
    const resposta = await fluxoCadastro(conversa, texto);
    await sendWhatsAppMessage({ phone: telefone, message: resposta });
    return;
  }

  if (cmd === "cadastro" || cmd === "quero cadastrar" || cmd === "novo cadastro") {
    const resposta = await iniciarCadastro(telefone, msg.pushName);
    await sendWhatsAppMessage({ phone: telefone, message: resposta });
    return;
  }

  if (cmd === "menu" || cmd === "oi" || cmd === "olá" || cmd === "ola" || cmd === "ajuda") {
    await sendWhatsAppMessage({ phone: telefone, message: menuInicial() });
    return;
  }

  if (isAiEnabled()) {
    const tratou = await processarLeadComIA(telefone, texto, msg.pushName);
    if (tratou) return;
  }

  const resposta = await iniciarCadastro(telefone, msg.pushName);
  await sendWhatsAppMessage({ phone: telefone, message: resposta });
}
