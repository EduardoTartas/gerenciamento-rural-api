-- PostgreSQL não cria índice automaticamente em coluna de chave estrangeira.
-- Toda consulta do app que filtra por relação (multi-tenancy, listagens aninhadas)
-- fazia seq scan. Índices abaixo espelham os @@index() adicionados ao schema.prisma.

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "propriedades_usuarioId_idx" ON "propriedades"("usuarioId");

-- CreateIndex
CREATE INDEX "pastos_propriedadeId_idx" ON "pastos"("propriedadeId");

-- CreateIndex
CREATE INDEX "rebanhos_propriedadeId_idx" ON "rebanhos"("propriedadeId");

-- CreateIndex
CREATE INDEX "rebanhos_pastoAtualId_idx" ON "rebanhos"("pastoAtualId");

-- CreateIndex
CREATE INDEX "rebanhos_racaId_idx" ON "rebanhos"("racaId");

-- CreateIndex
CREATE INDEX "rebanhos_sistemaProducaoId_idx" ON "rebanhos"("sistemaProducaoId");

-- CreateIndex
CREATE INDEX "rebanhos_regimeAlimentarId_idx" ON "rebanhos"("regimeAlimentarId");

-- CreateIndex
CREATE INDEX "historico_movimentacoes_rebanhoId_idx" ON "historico_movimentacoes"("rebanhoId");

-- CreateIndex
CREATE INDEX "historico_movimentacoes_pastoOrigemId_idx" ON "historico_movimentacoes"("pastoOrigemId");

-- CreateIndex
CREATE INDEX "historico_movimentacoes_pastoDestinoId_idx" ON "historico_movimentacoes"("pastoDestinoId");

-- CreateIndex
CREATE INDEX "manejo_rebanhos_rebanhoId_idx" ON "manejo_rebanhos"("rebanhoId");

-- CreateIndex
CREATE INDEX "manejo_rebanhos_tipoManejoId_idx" ON "manejo_rebanhos"("tipoManejoId");

-- CreateIndex
CREATE INDEX "manejo_pastos_pastoId_idx" ON "manejo_pastos"("pastoId");

-- CreateIndex
CREATE INDEX "manejo_pastos_tipoManejoId_idx" ON "manejo_pastos"("tipoManejoId");
