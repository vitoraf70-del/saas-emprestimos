const DAILY_MS = 1000 * 60 * 60 * 24;

export function diasAtraso(vencimento: Date, hoje = new Date()) {
  const diff = hoje.getTime() - vencimento.getTime();
  return Math.max(0, Math.floor(diff / DAILY_MS));
}

export function calcularParcelaAtualizada(
  valorOriginal: number,
  dias: number
) {
  if (dias <= 0) {
    return {
      diasAtraso: 0,
      multaValor: 0,
      jurosValor: 0,
      valorAtualizado: valorOriginal
    };
  }

  const multaValor = 50;
  const jurosValor = 20 * dias;
  const valorAtualizado = valorOriginal + multaValor + jurosValor;

  return {
    diasAtraso: dias,
    multaValor,
    jurosValor,
    valorAtualizado
  };
}
