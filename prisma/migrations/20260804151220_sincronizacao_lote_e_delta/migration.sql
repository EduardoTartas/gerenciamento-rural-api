/*
  Warnings:

  - Added the required column `updatedAt` to the `historico_movimentacoes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "historico_movimentacoes" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "historico_movimentacoes" SET "updatedAt" = "createdAt";
ALTER TABLE "historico_movimentacoes" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "manejo_pastos" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "manejo_rebanhos" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "mutacoes_aplicadas" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "resultado" JSONB NOT NULL,
    "aplicadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutacoes_aplicadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mutacoes_aplicadas_usuarioId_aplicadaEm_idx" ON "mutacoes_aplicadas"("usuarioId", "aplicadaEm");

-- CreateIndex
CREATE INDEX "historico_movimentacoes_rebanhoId_updatedAt_idx" ON "historico_movimentacoes"("rebanhoId", "updatedAt");

-- CreateIndex
CREATE INDEX "manejo_pastos_pastoId_updatedAt_idx" ON "manejo_pastos"("pastoId", "updatedAt");

-- CreateIndex
CREATE INDEX "manejo_rebanhos_rebanhoId_updatedAt_idx" ON "manejo_rebanhos"("rebanhoId", "updatedAt");

-- CreateIndex
CREATE INDEX "pastos_propriedadeId_updatedAt_idx" ON "pastos"("propriedadeId", "updatedAt");

-- CreateIndex
CREATE INDEX "propriedades_usuarioId_updatedAt_idx" ON "propriedades"("usuarioId", "updatedAt");

-- CreateIndex
CREATE INDEX "rebanhos_propriedadeId_updatedAt_idx" ON "rebanhos"("propriedadeId", "updatedAt");
