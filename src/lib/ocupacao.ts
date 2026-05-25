import { TipoOcupacao } from "@prisma/client";

export const OCUPACAO_OPCOES: { value: TipoOcupacao; label: string; keywords: string[] }[] = [
  { value: "comerciante", label: "Comerciante", keywords: ["1", "comerciante", "comercio", "loja"] },
  {
    value: "motorista_app",
    label: "Motorista de app",
    keywords: ["2", "motorista", "uber", "99", "app"]
  },
  { value: "autonomo", label: "Autônomo", keywords: ["3", "autonomo", "autônomo", "freela"] },
  { value: "funcionario_clt", label: "Funcionário CLT", keywords: ["4", "clt", "funcionario", "funcionário"] },
  { value: "outro", label: "Outro", keywords: ["5", "outro", "outra"] }
];

export function labelOcupacao(tipo: TipoOcupacao | null | undefined, detalhe?: string | null) {
  if (!tipo) return "—";
  const base = OCUPACAO_OPCOES.find((o) => o.value === tipo)?.label ?? tipo;
  if (tipo === "outro" && detalhe?.trim()) return `${base} (${detalhe.trim()})`;
  return base;
}

export function parseOcupacaoResposta(texto: string): TipoOcupacao | null {
  const t = texto.trim().toLowerCase();
  for (const opcao of OCUPACAO_OPCOES) {
    if (opcao.keywords.some((k) => t === k || t.includes(k))) {
      return opcao.value;
    }
  }
  return null;
}

export function mensagemMenuOcupacao() {
  return [
    "Qual sua ocupação? Responda com o *número* ou escreva a opção:",
    "",
    "1 - Comerciante (loja, comércio)",
    "2 - Motorista de app (Uber, 99, etc.)",
    "3 - Autônomo",
    "4 - Funcionário CLT",
    "5 - Outro"
  ].join("\n");
}
