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
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!baseUrl || !apiKey || !instance) {
    throw new Error("Evolution API não configurada");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey
    },
    body: JSON.stringify({ number: phone, text: message })
  });

  if (!response.ok) {
    const body = await safeResponseText(response);
    const parsed = safeParseJson(body);
    if (parsed?.exists === false) {
      throw new Error(`Número não encontrado no WhatsApp: ${parsed.number ?? phone}`);
    }
    throw new Error(`Falha ao enviar WhatsApp (Evolution): ${response.status} ${body}`);
  }
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
