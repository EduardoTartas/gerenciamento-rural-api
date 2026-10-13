-- Caixa de notificações por usuário (issue #62): tabela nova, nada existente muda.
-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "propriedadeId" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "rota" TEXT,
    "chaveAtiva" TEXT,
    "resolvidaEm" TIMESTAMP(3),
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "lidaEm" TIMESTAMP(3),
    "pushStatus" TEXT NOT NULL DEFAULT 'pendente',
    "pushTentativas" INTEGER NOT NULL DEFAULT 0,
    "pushEnviadoEm" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notificacoes_chaveAtiva_key" ON "notificacoes"("chaveAtiva");

-- CreateIndex
CREATE INDEX "notificacoes_usuarioId_updatedAt_idx" ON "notificacoes"("usuarioId", "updatedAt");

-- CreateIndex
CREATE INDEX "notificacoes_usuarioId_lida_idx" ON "notificacoes"("usuarioId", "lida");

-- CreateIndex
CREATE INDEX "notificacoes_pushStatus_idx" ON "notificacoes"("pushStatus");

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
