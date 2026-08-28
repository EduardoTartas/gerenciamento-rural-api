-- CreateTable
CREATE TABLE "tipos_insumo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumos" (
    "id" TEXT NOT NULL,
    "propriedadeId" TEXT NOT NULL,
    "tipoInsumoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "unidadeMedida" TEXT NOT NULL,
    "estoqueMinimo" DECIMAL(65,30),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_insumo" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" DECIMAL(65,30) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "origem" TEXT NOT NULL,
    "manejoRebanhoId" TEXT,
    "manejoPastoId" TEXT,
    "rebanhoId" TEXT,
    "pastoId" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movimentacoes_insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regimes_consumo_insumo" (
    "id" TEXT NOT NULL,
    "rebanhoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "quantidadeDia" DECIMAL(65,30) NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regimes_consumo_insumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_insumo_nome_key" ON "tipos_insumo"("nome");

-- CreateIndex
CREATE INDEX "insumos_propriedadeId_idx" ON "insumos"("propriedadeId");

-- CreateIndex
CREATE INDEX "insumos_propriedadeId_updatedAt_idx" ON "insumos"("propriedadeId", "updatedAt");

-- CreateIndex
CREATE INDEX "insumos_tipoInsumoId_idx" ON "insumos"("tipoInsumoId");

-- CreateIndex
CREATE INDEX "movimentacoes_insumo_insumoId_idx" ON "movimentacoes_insumo"("insumoId");

-- CreateIndex
CREATE INDEX "movimentacoes_insumo_insumoId_data_idx" ON "movimentacoes_insumo"("insumoId", "data");

-- CreateIndex
CREATE INDEX "movimentacoes_insumo_insumoId_updatedAt_idx" ON "movimentacoes_insumo"("insumoId", "updatedAt");

-- CreateIndex
CREATE INDEX "movimentacoes_insumo_manejoRebanhoId_idx" ON "movimentacoes_insumo"("manejoRebanhoId");

-- CreateIndex
CREATE INDEX "movimentacoes_insumo_manejoPastoId_idx" ON "movimentacoes_insumo"("manejoPastoId");

-- CreateIndex
CREATE INDEX "regimes_consumo_insumo_rebanhoId_idx" ON "regimes_consumo_insumo"("rebanhoId");

-- CreateIndex
CREATE INDEX "regimes_consumo_insumo_insumoId_idx" ON "regimes_consumo_insumo"("insumoId");

-- AddForeignKey
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "propriedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insumos" ADD CONSTRAINT "insumos_tipoInsumoId_fkey" FOREIGN KEY ("tipoInsumoId") REFERENCES "tipos_insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_insumo" ADD CONSTRAINT "movimentacoes_insumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_insumo" ADD CONSTRAINT "movimentacoes_insumo_manejoRebanhoId_fkey" FOREIGN KEY ("manejoRebanhoId") REFERENCES "manejo_rebanhos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_insumo" ADD CONSTRAINT "movimentacoes_insumo_manejoPastoId_fkey" FOREIGN KEY ("manejoPastoId") REFERENCES "manejo_pastos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_insumo" ADD CONSTRAINT "movimentacoes_insumo_rebanhoId_fkey" FOREIGN KEY ("rebanhoId") REFERENCES "rebanhos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_insumo" ADD CONSTRAINT "movimentacoes_insumo_pastoId_fkey" FOREIGN KEY ("pastoId") REFERENCES "pastos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regimes_consumo_insumo" ADD CONSTRAINT "regimes_consumo_insumo_rebanhoId_fkey" FOREIGN KEY ("rebanhoId") REFERENCES "rebanhos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regimes_consumo_insumo" ADD CONSTRAINT "regimes_consumo_insumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "insumos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unicidade de nome de insumo por propriedade, case-insensitive, só entre ativos.
-- Mesmo padrão dos índices parciais de pastos/rebanhos (migration 20260729000000).
CREATE UNIQUE INDEX "insumos_propriedadeId_nome_ci_key"
    ON "insumos" ("propriedadeId", lower("nome"))
    WHERE ativo = true;

-- Um regime de consumo em aberto por par (rebanho, insumo).
CREATE UNIQUE INDEX "regimes_consumo_insumo_rebanhoId_insumoId_aberto_key"
    ON "regimes_consumo_insumo" ("rebanhoId", "insumoId")
    WHERE ativo = true AND "dataFim" IS NULL;
