-- CreateIndex
CREATE INDEX "Emprestimo_created_at_idx" ON "Emprestimo"("created_at");

-- CreateIndex
CREATE INDEX "Emprestimo_status_created_at_idx" ON "Emprestimo"("status", "created_at");
