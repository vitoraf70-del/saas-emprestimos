import { revalidatePath } from "next/cache";

/** Atualiza cache das páginas que dependem de parcelas e pagamentos. */
export function revalidateAppAfterPayment() {
  revalidatePath("/");
  revalidatePath("/parcelas");
  revalidatePath("/emprestimos");
  revalidatePath("/relatorios");
  revalidatePath("/clientes", "layout");
}
