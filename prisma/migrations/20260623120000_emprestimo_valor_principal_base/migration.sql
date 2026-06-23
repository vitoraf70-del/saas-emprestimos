ALTER TABLE "Emprestimo" ADD COLUMN "valor_principal_base" DECIMAL(12, 2);

UPDATE "Emprestimo" SET "valor_principal_base" = "valor_emprestado" WHERE "valor_principal_base" IS NULL;
