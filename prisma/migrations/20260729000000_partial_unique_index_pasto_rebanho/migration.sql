-- Traz para o banco a unicidade de nome (case-insensitive, entre ativos) que hoje só
-- é validada na aplicação (check-then-act) em PastoService e RebanhoService.
-- Segue o mesmo padrão do índice parcial de propriedades (migration 20260701120000).

CREATE UNIQUE INDEX "pastos_propriedadeId_nome_ci_key"
    ON "pastos" ("propriedadeId", lower("nome"))
    WHERE ativo = true;

CREATE UNIQUE INDEX "rebanhos_propriedadeId_nomeRebanho_ci_key"
    ON "rebanhos" ("propriedadeId", lower("nomeRebanho"))
    WHERE ativo = true;
