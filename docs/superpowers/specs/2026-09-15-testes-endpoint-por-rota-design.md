# Suíte de testes de endpoint por rota — design

Issue: #41 · Branch: `41-test-endpoints-por-rota`

## Objetivo

Substituir a suíte atual (unitária, com mocks) por testes **de endpoint**, via HTTP, cobrindo todos
os cenários de cada rota, com documentação dos testes existentes em `documentacao/testes/`.

## Decisões

| Tema | Decisão |
| :--- | :--- |
| Alvo | `supertest` sobre `src/app.js`, contra **Postgres real** (`pasto_livre_teste`) |
| Auth | BetterAuth real: `POST /api/auth/sign-up/email` → token bearer. Admin promovido via Prisma (`admin` tem `input: false`) |
| Documentação | **Um `.md` por rota** (recurso), **uma tabela por método HTTP** |
| Código | Pasta por recurso, **um `.test.js` por endpoint** |
| Rate limit | `authRateLimit` e `strictRateLimit` pulados quando `NODE_ENV === 'test'` |
| Garage | Env vars fictícias no `preparo.js`; `getGarageClient` mockado nos testes de upload |
| Unitários atuais | Apagados quando cobertos por cenário de endpoint; mantidos os sem equivalente HTTP |

## Estrutura

```
documentacao/testes/
  README.md                    # como rodar, convenções, índice
  propriedades.md              # uma tabela por método: POST, GET, GET /:id, PATCH /:id, DELETE /:id
  pastagens.md
  pastagens-manejos.md
  rebanhos.md
  rebanhos-manejos.md
  rebanhos-movimentacoes.md
  rebanhos-regimes-consumo.md
  insumos.md
  insumos-movimentacoes.md
  catalogos.md
  usuarios.md
  uploads.md
  sync.md
test/
  apoio/                       # app, banco (limpeza), auth, fábricas
  endpoints/
    propriedades/
      post-propriedades.test.js
      get-propriedades.test.js
      get-propriedades-id.test.js
      patch-propriedades-id.test.js
      delete-propriedades-id.test.js
    ...
```

## Formato do documento de rota

Cabeçalho com controller, service, schemas Zod e referência à seção de `documentacao/rotas/rotas_pastolivre.md`
(regras de negócio não são repetidas). Depois, uma seção por método com tabela:

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| PROP-POST-01 | cria com dados válidos | usuário A autenticado | 201 | envelope, `data.id` |

- ID estável `<RECURSO>-<MÉTODO>[-ID]-NN`; o teste começa com o ID: `it('PROP-POST-01 cria com dados válidos')`.
- Categorias por método: sucesso, validação (body/query/params), autenticação (401) e autorização (403),
  multi-tenancy (usuário B não enxerga nem altera dado de A), inexistente (404), regras de negócio.

## Infraestrutura

- `vitest.config.js` com dois projetos: `unidade` (`test/unidade/**` e remanescentes, paralelo) e
  `endpoints` (`test/endpoints/**`, `fileParallelism: false`, `globalSetup` e `setupFiles` próprios).
- `globalSetup`: `prisma migrate deploy` em `DATABASE_URL_TESTE`.
- `beforeEach`: `TRUNCATE ... RESTART IDENTITY CASCADE` em todas as tabelas exceto `_prisma_migrations`.
- Scripts: `test` (tudo), `test:unidade`, `test:endpoints`.

## Fases

1. Documentação de todas as rotas (`documentacao/testes/`).
2. Infraestrutura (apoio, config, `supertest`, skip de rate limit).
3. Testes por recurso, um commit por recurso.
4. Remoção dos unitários cobertos; `ordemDeRotas` e `lote.e2e.js` absorvidos pelas suítes de rota.
5. Atualização de `CLAUDE.md`/`README.md` (seção de testes).

## Fora de escopo

Mudança de comportamento de endpoint. Divergência encontrada entre código e documentação vira
anotação no `.md` da rota e item na issue, não correção nesta branch.
