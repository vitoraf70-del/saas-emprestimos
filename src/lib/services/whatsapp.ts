type SendWhatsAppInput = {
  phone: string;
  message: string;
};

export async function sendWhatsAppMessage(input: SendWhatsAppInput) {
  const provider = (process.env.WHATSAPP_PROVIDER ?? "evolution").toLowerCase();
  const normalizedInput = {
    ...input,
    phone: normalizePhone(input.phone)
  };

  if (provider === "zapi") {
    return sendByZapi(normalizedInput);
  }
  if (provider === "evolution") {
    return sendByEvolution(normalizedInput);
  }
  throw new Error(`WHATSAPP_PROVIDER inválido: ${provider}`);
}

async function sendByEvolution({ phone, message }: SendWhatsAppInput) {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!baseUrl || !apiKey || !instance) {
    throw new Error("Evolution API não configurada");
  }

  const number = await resolveEvolutionDestination(baseUrl, apiKey, instance, phone);

  const response = await fetch(`${baseUrl}/message/sendText/${instance}`, {
    method: "POST",
    headers: evolutionHeaders(apiKey),
    body: JSON.stringify({ number, text: message })
  });

  const body = await safeResponseText(response);
  const parsed = safeParseJson(body);

  if (!response.ok) {
    if (parsed?.exists === false || parsed?.response?.message?.[0]?.exists === false) {
      throw new Error(`Número não encontrado no WhatsApp: ${parsed?.number ?? phone}`);
    }
    throw new Error(`Falha ao enviar WhatsApp (Evolution): ${response.status} ${body}`);
  }

  if (String(parsed?.status ?? "").toUpperCase() === "ERROR") {
    throw new Error("WhatsApp recusou o envio da mensagem.");
  }
}

function evolutionHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    apikey: apiKey
  };
}

/**
 * Conversas novas no WhatsApp usam LID (`123@lid`) no lugar do número.
 * Enviar só o telefone (`5567...@s.whatsapp.net`) a API aceita (PENDING)
 * e depois marca ERROR — a tela mostra sucesso, o cliente não recebe.
 */
async function resolveEvolutionDestination(
  baseUrl: string,
  apiKey: string,
  instance: string,
  phone: string
) {
  const checkResponse = await fetch(`${baseUrl}/chat/whatsappNumbers/${instance}`, {
    method: "POST",
    headers: evolutionHeaders(apiKey),
    body: JSON.stringify({ numbers: [phone] })
  });
  const checkBody = await safeResponseText(checkResponse);
  const checkParsed = safeParseJson(checkBody);
  const row = Array.isArray(checkParsed) ? checkParsed[0] : checkParsed;

  if (row?.exists === false) {
    throw new Error(`Número não encontrado no WhatsApp: ${row?.number ?? phone}`);
  }

  const jid = String(row?.jid ?? `${phone}@s.whatsapp.net`);
  const pn = jid.replace(/@s\.whatsapp\.net$/i, "").replace(/\D/g, "") || phone;
  const lidFromCheck = typeof row?.lid === "string" ? row.lid : "";
  if (lidFromCheck.includes("@lid")) {
    return lidFromCheck;
  }
  if (/^\d+$/.test(lidFromCheck) && lidFromCheck !== "lid") {
    return `${lidFromCheck}@lid`;
  }

  const lidFromChat = await findLidForPhone(baseUrl, apiKey, instance, pn);
  return lidFromChat ?? pn;
}

async function findLidForPhone(
  baseUrl: string,
  apiKey: string,
  instance: string,
  pn: string
) {
  const alts = [`${pn}@s.whatsapp.net`];
  if (pn.length === 12 && pn.startsWith("55")) {
    alts.push(`${pn.slice(0, 4)}9${pn.slice(4)}@s.whatsapp.net`);
  }

  for (const alt of alts) {
    const response = await fetch(`${baseUrl}/chat/findMessages/${instance}`, {
      method: "POST",
      headers: evolutionHeaders(apiKey),
      body: JSON.stringify({
        where: { key: { remoteJidAlt: alt } },
        limit: 1
      })
    });
    const parsed = safeParseJson(await safeResponseText(response));
    const records = parsed?.messages?.records;
    if (!Array.isArray(records)) continue;
    for (const rec of records) {
      const remoteJid = rec?.key?.remoteJid;
      if (typeof remoteJid === "string" && remoteJid.endsWith("@lid")) {
        return remoteJid;
      }
    }
  }
  return null;
}

async function sendByZapi({ phone, message }: SendWhatsAppInput) {
  const instance = process.env.ZAPI_INSTANCE;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instance || !token || !clientToken) {
    throw new Error("Z-API não configurada");
  }

  const response = await fetch(
    `https://api.z-api.io/instances/${instance}/token/${token}/send-text`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken
      },
      body: JSON.stringify({ phone, message })
    }
  );

  if (!response.ok) {
    const body = await safeResponseText(response);
    throw new Error(`Falha ao enviar WhatsApp (Z-API): ${response.status} ${body}`);
  }
}

export function normalizeWhatsAppDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) {
    throw new Error("Telefone WhatsApp inválido");
  }
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

/**
 * Chave de comparação BR: ignora o 9º dígito mobile após o DDD
 * (ex.: 5567982115296 e 556782115296 batem).
 */
export function whatsappMatchKey(phone: string) {
  let d = normalizeWhatsAppDigits(phone);
  // 55 + DDD(2) + 9 + 8 dígitos = 13
  if (d.length === 13 && d[4] === "9") {
    return d.slice(0, 4) + d.slice(5);
  }
  return d;
}

function normalizePhone(phone: string) {
  return normalizeWhatsAppDigits(phone);
}

async function safeResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
