/**
 * Agente de pré-análise (GPT mini) para leads no WhatsApp.
 *
 * A IA APENAS conversa e extrai dados. Ela NÃO decide aprovação e NÃO promete
 * valores — a qualificação final é feita por regras + banco (lead-qualification.ts).
 */

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

export type LeadExtraido = {
  nome?: string;
  cpf?: string;
  endereco?: string;
  ocupacao?: string;
  valor_desejado?: number;
  motivo?: string;
};

export type AiLeadResult = {
  resposta: string;
  extraido: LeadExtraido;
  querCredito: boolean;
  encerrar: boolean;
};

export function isAiEnabled() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function getModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

const SYSTEM_PROMPT = [
  "Você é o assistente virtual de um crediário (empréstimos pessoais) no Brasil, atendendo pelo WhatsApp.",
  "Fale em português do Brasil, de forma simpática, breve e objetiva (mensagens curtas, no máximo 3 frases).",
  "",
  "Seu objetivo é fazer a PRÉ-ANÁLISE de novos interessados (leads):",
  "1. Entender se a pessoa realmente quer um empréstimo/crediário (intenção real).",
  "2. Coletar, de forma natural na conversa: nome completo, CPF, endereço completo, ocupação/renda e o valor desejado.",
  "3. Peça UM dado por vez; não faça um formulário robótico.",
  "",
  "REGRAS IMPORTANTES:",
  "- NUNCA prometa aprovação, limite ou valores. Diga que o responsável fará a análise e retornará.",
  "- NUNCA invente saldos, taxas ou números. Se perguntarem valores exatos, diga que o responsável confirma.",
  "- Se a pessoa claramente não quer crédito (só curiosidade, engano, spam), seja educado e encerre.",
  "- Não repita perguntas de dados que já foram informados.",
  "",
  "Responda SEMPRE em JSON válido, sem texto fora do JSON, no formato:",
  "{",
  '  "resposta": "mensagem para enviar ao cliente",',
  '  "extraido": { "nome": "", "cpf": "", "endereco": "", "ocupacao": "", "valor_desejado": 0, "motivo": "" },',
  '  "quer_credito": true,',
  '  "encerrar": false',
  "}",
  "Em 'extraido', preencha apenas o que já souber (deixe vazio ou omita o resto). 'valor_desejado' é número em reais.",
  "'quer_credito' = true quando houver intenção real de contratar. 'encerrar' = true quando não há mais o que fazer."
].join("\n");

function parseValor(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function limpar(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Chama o modelo mini da OpenAI. Retorna null se a IA não estiver configurada
 * ou se a chamada falhar (o chamador deve ter um fallback).
 */
export async function analisarLeadComIA(historico: AiMessage[]): Promise<AiLeadResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: getModel(),
        temperature: 0.4,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...historico]
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("[ai-chat] OpenAI erro", response.status, body.slice(0, 300));
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      resposta?: string;
      extraido?: Record<string, unknown>;
      quer_credito?: boolean;
      encerrar?: boolean;
    };

    const ex = parsed.extraido ?? {};
    return {
      resposta: limpar(parsed.resposta) ?? "Certo! Pode me contar um pouco mais?",
      extraido: {
        nome: limpar(ex.nome),
        cpf: limpar(ex.cpf),
        endereco: limpar(ex.endereco),
        ocupacao: limpar(ex.ocupacao),
        valor_desejado: parseValor(ex.valor_desejado),
        motivo: limpar(ex.motivo)
      },
      querCredito: parsed.quer_credito !== false,
      encerrar: parsed.encerrar === true
    };
  } catch (error) {
    console.error("[ai-chat] falha ao chamar IA", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Junta o que já foi extraído com o novo, sem perder dados anteriores. */
export function mergeExtraido(anterior: LeadExtraido, novo: LeadExtraido): LeadExtraido {
  return {
    nome: novo.nome ?? anterior.nome,
    cpf: novo.cpf ?? anterior.cpf,
    endereco: novo.endereco ?? anterior.endereco,
    ocupacao: novo.ocupacao ?? anterior.ocupacao,
    valor_desejado: novo.valor_desejado ?? anterior.valor_desejado,
    motivo: novo.motivo ?? anterior.motivo
  };
}
