-- Issue #67: o estoque só muda por entrada ou saída, sempre com motivo. O tipo
-- `Ajuste` (contagem com quantidade assinada) deixa de existir e os lançamentos
-- já gravados são convertidos sem mudar o saldo de ninguém: ajuste positivo
-- vira entrada, negativo vira saída (com a quantidade em módulo). A origem
-- continua `AjusteContagem` — legado só de leitura, que segue valendo como
-- marco da projeção dos regimes (era uma conferência física do estoque).
-- `updatedAt` avança para a leitura por diferença levar a conversão ao app.

-- Ajuste sem quantidade não mexia no saldo: só sai do ledger (exclusão lógica,
-- igual ao desfazer, para a leitura por diferença reportar). O tipo também é
-- trocado, para nenhum `Ajuste` sobrar no banco.
UPDATE "movimentacoes_insumo"
SET "ativo" = false,
    "tipo" = 'Entrada',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "tipo" = 'Ajuste' AND "quantidade" = 0;

-- Ajuste com quantidade: o sinal decide o tipo.
UPDATE "movimentacoes_insumo"
SET "tipo" = CASE WHEN "quantidade" > 0 THEN 'Entrada' ELSE 'Saida' END,
    "quantidade" = ABS("quantidade"),
    "origem" = 'AjusteContagem',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "tipo" = 'Ajuste' AND "quantidade" <> 0;
