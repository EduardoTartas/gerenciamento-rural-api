-- Issue #67: o estoque só muda por entrada ou saída, sempre com motivo. A
-- contagem (`tipo = 'Ajuste'`, `origem = 'AjusteContagem'`) deixa de existir e
-- os lançamentos já gravados são convertidos sem mudar o saldo de ninguém:
-- ajuste positivo vira entrada "Outro", negativo vira saída "Outro" (com a
-- quantidade em módulo), e o motivo fica registrado na observação.
-- `updatedAt` avança para a leitura por diferença levar a conversão ao app.

-- Ajuste sem quantidade não mexia no saldo: só sai do ledger (exclusão lógica,
-- igual ao desfazer, para a leitura por diferença reportar). Tipo e motivo
-- também são trocados, para nenhum `Ajuste` sobrar no banco.
UPDATE "movimentacoes_insumo"
SET "ativo" = false,
    "tipo" = 'Entrada',
    "origem" = 'Outro',
    "observacoes" = 'Ajuste de contagem (convertido)' || COALESCE(' — ' || "observacoes", ''),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "tipo" = 'Ajuste' AND "quantidade" = 0;

-- Ajuste com quantidade: o sinal decide o tipo.
UPDATE "movimentacoes_insumo"
SET "tipo" = CASE WHEN "quantidade" > 0 THEN 'Entrada' ELSE 'Saida' END,
    "quantidade" = ABS("quantidade"),
    "origem" = 'Outro',
    "observacoes" = 'Ajuste de contagem (convertido)' || COALESCE(' — ' || "observacoes", ''),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "tipo" = 'Ajuste' AND "quantidade" <> 0;

-- Contagem já registrada como entrada ou saída: só troca o motivo.
UPDATE "movimentacoes_insumo"
SET "origem" = 'Outro',
    "observacoes" = 'Ajuste de contagem (convertido)' || COALESCE(' — ' || "observacoes", ''),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "origem" = 'AjusteContagem' AND "tipo" IN ('Entrada', 'Saida');
