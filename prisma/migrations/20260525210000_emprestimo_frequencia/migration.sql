-- CreateEnum
CREATE TYPE "FrequenciaParcela" AS ENUM ('diario', 'semanal');

-- AlterTable
ALTER TABLE "Emprestimo" ADD COLUMN "frequencia_parcela" "FrequenciaParcela" NOT NULL DEFAULT 'semanal';
