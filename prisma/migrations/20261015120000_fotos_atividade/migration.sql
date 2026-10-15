-- Fotos das atividades (issue #74): tabela nova, nada existente muda.
-- CreateTable
CREATE TABLE "fotos_atividade" (
    "id" TEXT NOT NULL,
    "manejoPastoId" TEXT,
    "manejoRebanhoId" TEXT,
    "url" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fotos_atividade_pkey" PRIMARY KEY ("id")
);

-- A foto pertence a exatamente um manejo: de pastagem ou de rebanho, nunca os
-- dois nem nenhum. O Prisma não declara CHECK, então ele mora só aqui.
ALTER TABLE "fotos_atividade" ADD CONSTRAINT "fotos_atividade_um_manejo_check"
    CHECK (("manejoPastoId" IS NULL) <> ("manejoRebanhoId" IS NULL));

-- CreateIndex
CREATE INDEX "fotos_atividade_manejoPastoId_idx" ON "fotos_atividade"("manejoPastoId");

-- CreateIndex
CREATE INDEX "fotos_atividade_manejoRebanhoId_idx" ON "fotos_atividade"("manejoRebanhoId");

-- CreateIndex
CREATE INDEX "fotos_atividade_updatedAt_idx" ON "fotos_atividade"("updatedAt");

-- AddForeignKey
ALTER TABLE "fotos_atividade" ADD CONSTRAINT "fotos_atividade_manejoPastoId_fkey" FOREIGN KEY ("manejoPastoId") REFERENCES "manejo_pastos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_atividade" ADD CONSTRAINT "fotos_atividade_manejoRebanhoId_fkey" FOREIGN KEY ("manejoRebanhoId") REFERENCES "manejo_rebanhos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
