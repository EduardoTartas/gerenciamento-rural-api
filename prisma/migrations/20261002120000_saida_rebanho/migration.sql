-- CreateTable
CREATE TABLE "saidas_rebanho" (
    "id" TEXT NOT NULL,
    "rebanhoId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "quantidadeCabecas" INTEGER NOT NULL,
    "dataSaida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizouRebanho" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saidas_rebanho_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saidas_rebanho_rebanhoId_idx" ON "saidas_rebanho"("rebanhoId");

-- CreateIndex
CREATE INDEX "saidas_rebanho_rebanhoId_updatedAt_idx" ON "saidas_rebanho"("rebanhoId", "updatedAt");

-- AddForeignKey
ALTER TABLE "saidas_rebanho" ADD CONSTRAINT "saidas_rebanho_rebanhoId_fkey" FOREIGN KEY ("rebanhoId") REFERENCES "rebanhos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
