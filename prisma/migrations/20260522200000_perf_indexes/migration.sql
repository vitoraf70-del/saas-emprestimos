-- CreateIndex
CREATE INDEX "Parcela_status_idx" ON "Parcela"("status");

-- CreateIndex
CREATE INDEX "Parcela_vencimento_idx" ON "Parcela"("vencimento");

-- CreateIndex
CREATE INDEX "Parcela_status_vencimento_idx" ON "Parcela"("status", "vencimento");

-- CreateIndex
CREATE INDEX "Parcela_emprestimo_id_status_idx" ON "Parcela"("emprestimo_id", "status");

-- CreateIndex
CREATE INDEX "Pagamento_status_idx" ON "Pagamento"("status");
