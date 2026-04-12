-- CreateTable
CREATE TABLE "propriedades" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "localizacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "propriedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pastos" (
    "id" TEXT NOT NULL,
    "propriedadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "extensaoHa" DECIMAL(65,30),
    "tipoPastagem" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Vazio',
    "dataUltimaSaida" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pastos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rebanhos" (
    "id" TEXT NOT NULL,
    "propriedadeId" TEXT NOT NULL,
    "pastoAtualId" TEXT,
    "nomeRebanho" TEXT NOT NULL,
    "quantidadeCabecas" INTEGER,
    "categoria" TEXT,
    "raca" TEXT,
    "pesoMedioAtual" DECIMAL(65,30),
    "dataEntradaPastoAtual" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rebanhos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_movimentacoes" (
    "id" TEXT NOT NULL,
    "rebanhoId" TEXT NOT NULL,
    "pastoOrigemId" TEXT,
    "pastoDestinoId" TEXT,
    "dataMovimentacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacoes" TEXT,

    CONSTRAINT "historico_movimentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manejo_rebanhos" (
    "id" TEXT NOT NULL,
    "rebanhoId" TEXT NOT NULL,
    "tipoManejo" TEXT NOT NULL,
    "medicamentoVacina" TEXT,
    "pesoRegistrado" DECIMAL(65,30),
    "dataAtividade" TIMESTAMP(3) NOT NULL,
    "observacoes" TEXT,

    CONSTRAINT "manejo_rebanhos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manejo_pastos" (
    "id" TEXT NOT NULL,
    "pastoId" TEXT NOT NULL,
    "tipoManejo" TEXT NOT NULL,
    "dataAtividade" TIMESTAMP(3) NOT NULL,
    "observacoes" TEXT,

    CONSTRAINT "manejo_pastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "propriedades_usuarioId_nome_key" ON "propriedades"("usuarioId", "nome");

-- AddForeignKey
ALTER TABLE "propriedades" ADD CONSTRAINT "propriedades_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pastos" ADD CONSTRAINT "pastos_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "propriedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebanhos" ADD CONSTRAINT "rebanhos_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "propriedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebanhos" ADD CONSTRAINT "rebanhos_pastoAtualId_fkey" FOREIGN KEY ("pastoAtualId") REFERENCES "pastos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_movimentacoes" ADD CONSTRAINT "historico_movimentacoes_rebanhoId_fkey" FOREIGN KEY ("rebanhoId") REFERENCES "rebanhos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_movimentacoes" ADD CONSTRAINT "historico_movimentacoes_pastoOrigemId_fkey" FOREIGN KEY ("pastoOrigemId") REFERENCES "pastos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_movimentacoes" ADD CONSTRAINT "historico_movimentacoes_pastoDestinoId_fkey" FOREIGN KEY ("pastoDestinoId") REFERENCES "pastos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manejo_rebanhos" ADD CONSTRAINT "manejo_rebanhos_rebanhoId_fkey" FOREIGN KEY ("rebanhoId") REFERENCES "rebanhos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manejo_pastos" ADD CONSTRAINT "manejo_pastos_pastoId_fkey" FOREIGN KEY ("pastoId") REFERENCES "pastos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
