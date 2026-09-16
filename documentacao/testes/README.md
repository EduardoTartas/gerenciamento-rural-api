# Testes de endpoint por rota

Suíte de testes de integração HTTP da API Pasto Livre: cada rota tem seu `.md` de cenários
(esta pasta) e seus arquivos `test/endpoints/<rota>/<metodo>-<caminho>.test.js` correspondentes.
Os testes rodam contra um PostgreSQL real, com usuários BetterAuth reais (A, B e um admin).

Exceção à convenção de um arquivo por endpoint: `transversal.md` não descreve uma rota de
domínio, e sim comportamento comum a toda a API (health check, 404, JSON inválido, ordem de
rotas, 401) — todos os cenários `APP-*` vivem num único arquivo,
`test/endpoints/transversal/app.test.js`.

## Como rodar

```bash
docker compose -f docker-compose.dev.yml up -d postgresql
npm run test:endpoints
```

`npm test` roda tudo; `npm run test:endpoints` roda só esta suíte e `npm run test:unidade` só os
testes unitários restantes (lógica pura, sem rota equivalente).

O banco de teste é `pasto_livre_teste` — separado do banco de desenvolvimento, criado e migrado
pelo `globalSetup` e truncado antes de cada teste. Rodando pelo host, a suíte usa o PostgreSQL do
compose em `localhost:5433`; dentro do container da API, o host do compose. Para apontar para
outra instância, defina a variável de ambiente opcional:

```bash
DATABASE_URL_TESTE=postgresql://usuario:senha@host:5432/pasto_livre_teste npm run test:endpoints
```

## Envelope de resposta

Todo endpoint responde através de `CommonResponse` (`src/utils/helpers/CommonResponse.js`).
Os testes devem asserir só sobre estas chaves — `CustomError.errorType`/`.field` são internos
ao backend e **nunca** são serializados na resposta HTTP.

Sucesso:

```json
{ "message": "3 pastagem(ns) encontrada(s).", "data": { }, "errors": [] }
```

Erro:

```json
{
  "message": "Erro de validação. 1 campo(s) inválido(s).",
  "data": null,
  "errors": [{ "path": "nome", "message": "O campo nome é obrigatório." }],
  "tipo": "validationError",
  "recuperavel": false
}
```

- `tipo` e `recuperavel` vêm de `descreverErro(errorType)` (`src/utils/helpers/tiposDeErro.js`) —
  é o valor de `tipo` que a tabela abaixo mostra, não o `errorType` interno passado a
  `CustomError`/`CommonResponse.error` (eles coincidem para todo tipo listado na tabela; um
  `errorType` desconhecido cai no fallback `serverError`).
- Informação de campo só existe via `errors[0].path` (ou de outro índice, se houver mais de um
  problema) — e só quando o erro carrega `details` com `path` (issues do Zod, ou `CustomError`
  com `details: [{ path, message }]`). Vários erros de domínio (ex.: recurso "não encontrado"
  via `ensure*Exists`) lançam `details: []` — nesse caso não há `errors[].path` para asserir,
  só `tipo` e `message`.
- A rota síncrona (`sync.md`) é a exceção: dentro de `data.resultados[].erro`, o formato é
  `{ tipo, campo, mensagem, recuperavel }` (chaves em português, `campo` em vez de `path`) —
  esse formato é próprio do lote, não do envelope de erro HTTP acima.

### Tabela `errorType` (interno) → `tipo`/`recuperavel` (no envelope)

| `errorType` interno | HTTP | `tipo` no envelope | `recuperavel` |
| :--- | :--- | :--- | :--- |
| `validationError` | 400 | `validationError` | `false` |
| `unauthorized` | 401 | `unauthorized` | `true` |
| `forbidden` | 403 | `forbidden` | `false` |
| `notFound` | 404 | `notFound` | `false` |
| `resourceNotFound` | 404 | `resourceNotFound` | `false` |
| `conflict` | 409 | `conflict` | `false` |
| `rateLimit` | 429 | `rateLimit` | `true` |
| `serverError` | 500 | `serverError` | `true` |
| `uniqueConstraintViolation` (Prisma P2002) | 409 | `uniqueConstraintViolation` | `false` |
| `foreignKeyViolation` (Prisma P2003) | 409 | `foreignKeyViolation` | `false` |
| `recordNotFound` (Prisma P2025) | 404 | `recordNotFound` | `false` |
| `databaseError` (Prisma — conexão/inicialização) | 500 | `databaseError` | `true` |
| `tokenExpired` | 401 | `tokenExpired` | `true` |
| `authError` (fallback do BetterAuth) | 401 | `authError` | `true` |
| `operationalError` (fallback do `errorHandler`) | 500 | `operationalError` | `true` |
| `storageError` (Garage/MinIO) | 503 | `storageError` | `true` |
| qualquer `errorType` não listado acima | — | `serverError` (fallback) | `true` |

`descreverErro` trata ainda os códigos brutos do Prisma que `CustomError.fromPrisma` não
mapeia para um nome próprio: viram `prisma:P20xx` e caem em `tipo: validationError`, exceto
`P2024`/`P2028`/`P2034` (pool esgotado, erro de transação, conflito de escrita), que caem em
`tipo: databaseError` — ver comentários em `src/utils/helpers/tiposDeErro.js`.

Pré-condição comum a toda a suíte: usuário **A**, usuário **B** e um usuário **admin**
autenticados via BetterAuth antes de cada bateria de testes. Salvo indicação em contrário,
"o usuário" nos cenários é o usuário A; B aparece só nos cenários de multi-tenancy.

## Convenção de ID de cenário

```
<SIGLA>-<MÉTODO>-NN          para rotas de coleção (POST /x, GET /x)
<SIGLA>-<MÉTODO>-ID-NN       para rotas de item (GET/PATCH/DELETE /x/:id)
```

- `SIGLA`: identifica a rota (tabela abaixo).
- `MÉTODO`: `POST`, `GET`, `PATCH` ou `DELETE`.
- `ID`: literal, presente só quando o caminho tem `:id`.
- `NN`: dois dígitos, sequencial dentro da seção (`01`, `02`, ...).

Exemplos: `PROP-GET-01` (primeiro cenário de `GET /propriedades`), `PROP-GET-ID-03` (terceiro
cenário de `GET /propriedades/:id`), `MPAS-PATCH-ID-05`.

## Categorias obrigatórias por método (quando aplicáveis)

Cada seção de método+caminho deve cobrir, na medida em que fizer sentido para aquele
endpoint:

- **Sucesso** — caminho feliz, incluindo variações de campos opcionais.
- **Validação de body/query/params** — inclusive `.strict()` (campo extra rejeitado) e corpo
  vazio.
- **401** — sem token e com token inválido/expirado.
- **403 admin** — só existe linha de cenário 403 nas rotas efetivamente protegidas por
  `AdminMiddleware` (`GET /usuarios` e as escritas de `/catalogos/:entidade` — ver
  `usuarios.md`, `catalogos.md`). Nas demais rotas, um usuário `admin: true` não tem bypass de
  multi-tenancy: ele é testado como um usuário comum não-dono, recebendo 404 ao mexer em
  recurso de outro usuário (ver cenários "admin (não dono)" em `rebanhos.md` e afins) — não
  gera uma categoria 403 própria.
- **Multi-tenancy** — usuário B recebe 404 ao ler/alterar/remover recurso de A; B não vê
  recursos de A na listagem; B não consegue criar um filho apontando para um pai (propriedade,
  pasto, rebanho, insumo...) que pertence a A.
- **404** — recurso inexistente (UUID válido, mas sem registro).
- **Regras de negócio** — unicidade de nome, travas de integridade (ex.: não inativar com
  filhos ativos), transações multi-tabela, `id` opcional do cliente (offline-first), leitura
  por diferença (`atualizadoDesde`), paginação e limite máximo de 100 itens por página.

Cada arquivo `.md` fecha com uma seção `## Divergências` listando onde o comportamento atual
do código diverge de `documentacao/rotas/rotas_pastolivre.md` ou é claramente um bug —
citando `arquivo:linha`. Essas divergências são para o teste registrar o comportamento real,
não para corrigir o código.

## Índice de rotas

| Rota | Arquivo | Sigla |
| :--- | :--- | :--- |
| `/propriedades` | [propriedades.md](./propriedades/propriedades.md) | PROP |
| `/pastagens` | [pastagens.md](./pastagens/pastagens.md) | PAST |
| `/pastagens/manejos` | [pastagens-manejos.md](./pastagens-manejos/pastagens-manejos.md) | MPAS |
| `/rebanhos` | [rebanhos.md](./rebanhos/rebanhos.md) | REB |
| `/rebanhos/manejos` | [rebanhos-manejos.md](./rebanhos-manejos/rebanhos-manejos.md) | MREB |
| `/rebanhos/movimentacoes` | [rebanhos-movimentacoes.md](./rebanhos-movimentacoes/rebanhos-movimentacoes.md) | MOV |
| `/rebanhos/regimes-consumo` | [rebanhos-regimes-consumo.md](./rebanhos-regimes-consumo/rebanhos-regimes-consumo.md) | REG |
| `/insumos` | [insumos.md](./insumos/insumos.md) | INS |
| `/insumos/movimentacoes` | [insumos-movimentacoes.md](./insumos-movimentacoes/insumos-movimentacoes.md) | MINS |
| `/catalogos/:entidade` | [catalogos.md](./catalogos/catalogos.md) | CAT |
| `/usuarios` | [usuarios.md](./usuarios/usuarios.md) | USR |
| `/uploads` | [uploads.md](./uploads/uploads.md) | UPL |
| `/sync` | [sync.md](./sync/sync.md) | SYNC |
| Transversal (`/health`, 404, JSON inválido, ordem de rotas, 401) | [transversal.md](./transversal/transversal.md) | APP |

## Sigla por rota

| Sigla | Rota |
| :--- | :--- |
| PROP | `/propriedades` |
| PAST | `/pastagens` |
| MPAS | `/pastagens/manejos` |
| REB | `/rebanhos` |
| MREB | `/rebanhos/manejos` |
| MOV | `/rebanhos/movimentacoes` |
| REG | `/rebanhos/regimes-consumo` |
| INS | `/insumos` |
| MINS | `/insumos/movimentacoes` |
| CAT | `/catalogos` |
| USR | `/usuarios` |
| UPL | `/uploads` |
| SYNC | `/sync` |
| APP | transversal (`/health`, 404, JSON inválido, ordem de rotas, 401 genérico) |
