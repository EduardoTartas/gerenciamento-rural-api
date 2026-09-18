-- Traz para o banco a unicidade de nome (case-insensitive, entre ativos) que hoje só
-- é validada na aplicação (check-then-act) em CatalogoService. O `@unique` incondicional
-- barrava reciclar o nome de um item arquivado; o índice parcial segue o mesmo padrão de
-- propriedades/pastos/rebanhos (migrations 20260701120000 e 20260729000000).

DROP INDEX "racas_nome_key";
CREATE UNIQUE INDEX "racas_nome_ci_key" ON "racas" (lower("nome")) WHERE ativo = true;

DROP INDEX "sistemas_producao_nome_key";
CREATE UNIQUE INDEX "sistemas_producao_nome_ci_key" ON "sistemas_producao" (lower("nome")) WHERE ativo = true;

DROP INDEX "regimes_alimentares_nome_key";
CREATE UNIQUE INDEX "regimes_alimentares_nome_ci_key" ON "regimes_alimentares" (lower("nome")) WHERE ativo = true;

DROP INDEX "tipos_manejo_rebanho_nome_key";
CREATE UNIQUE INDEX "tipos_manejo_rebanho_nome_ci_key" ON "tipos_manejo_rebanho" (lower("nome")) WHERE ativo = true;

DROP INDEX "tipos_manejo_pasto_nome_key";
CREATE UNIQUE INDEX "tipos_manejo_pasto_nome_ci_key" ON "tipos_manejo_pasto" (lower("nome")) WHERE ativo = true;

DROP INDEX "tipos_insumo_nome_key";
CREATE UNIQUE INDEX "tipos_insumo_nome_ci_key" ON "tipos_insumo" (lower("nome")) WHERE ativo = true;
