# Medição — índices em chaves estrangeiras (C7)

Referente ao item C7 do `REPORT.md`: PostgreSQL não cria índice automaticamente em coluna de
chave estrangeira. Migration `20260729000100_indices_chaves_estrangeiras` adiciona `@@index`
em todas as FKs do schema.

## Metodologia

- PostgreSQL 17 (imagem `postgres:17-alpine`), container local via `docker-compose.dev.yml`.
- Massa de dados sintética: 1 usuário, 500 propriedades, 2.500 pastos, 2.500 rebanhos,
  25.000 registros de histórico de movimentação, 25.000 manejos de rebanho, 25.000 manejos
  de pasto — volume comparável a alguns meses de uso real por poucos produtores.
- Medição com `EXPLAIN (ANALYZE, BUFFERS)`, comparando o mesmo conjunto de consultas antes
  (índices novos ausentes) e depois (índices aplicados), com `ANALYZE` rodado entre as duas
  medições para atualizar as estatísticas do planejador.
- Consultas escolhidas espelham os repositories reais (`RebanhoRepository.list`,
  `MovimentacaoRepository.list`, `ManejoRebanhoRepository.list`, `ManejoPastoRepository.list`).

## Resultados

| Consulta | Antes (sem índice) | Depois (com índice) | Ganho |
| :--- | :--- | :--- | :--- |
| Rebanhos por propriedade | Seq Scan, 0,536 ms, 89 buffers | Bitmap Index Scan, 0,188 ms, 9 buffers | ~2,9× mais rápido, 90% menos I/O |
| Histórico de movimentação por rebanho | Seq Scan, 3,280 ms, 615 buffers | Bitmap Index Scan, 0,271 ms, 17 buffers | ~12× mais rápido |
| Manejo de rebanho por rebanho | Seq Scan, 3,249 ms, 558 buffers | Bitmap Index Scan, 0,130 ms, 5 buffers | ~25× mais rápido |
| Manejo de pasto por pasto | Seq Scan, 2,922 ms, 534 buffers | Bitmap Index Scan, 0,117 ms, 5 buffers | ~25× mais rápido |
| Pastos por propriedade | já usava o índice único parcial existente (`pastos_propriedadeId_nome_ci_key`) — sem mudança relevante | | |
| Propriedades por usuário / join multi-tenant completo | tabela pequena (500 linhas) — planner manteve Seq Scan por ser mais barato nesse volume | | esperado: ganho aparece em escala maior |

Antes das mudanças, toda consulta que filtra por relação (o padrão dominante do app — tudo é
escopado por `usuarioId` → `propriedadeId` → ...) fazia varredura sequencial completa da
tabela filha, descartando quase todas as linhas (`Rows Removed by Filter` de até 24.990 em
25.000). O ganho cresce com o volume de dados: quanto mais lançamentos o produtor acumular,
maior a distância entre os dois cenários.

## Como reproduzir

```bash
docker compose -f docker-compose.dev.yml up -d postgresql
docker compose -f docker-compose.dev.yml up -d --build api   # aplica as migrations
# popular massa de dados sintética (ver script de bench, não versionado)
# EXPLAIN (ANALYZE, BUFFERS) nas consultas de interesse
docker compose -f docker-compose.dev.yml down -v             # limpa tudo ao final
```
