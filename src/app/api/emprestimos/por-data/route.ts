import { NextResponse } from "next/server";
import { getConsultaPorData, resolveConsultaPorDataDayKey } from "@/lib/queries/emprestimos-por-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dayKey = resolveConsultaPorDataDayKey(searchParams.get("data"));

  if (!dayKey) {
    return NextResponse.json({ error: "Data inválida. Use yyyy-MM-dd ou DD/MM/AAAA." }, { status: 400 });
  }

  const result = await getConsultaPorData(dayKey);
  return NextResponse.json(result);
}
