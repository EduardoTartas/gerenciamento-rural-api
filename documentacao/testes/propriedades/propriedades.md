# /propriedades

Controller `PropriedadeController` · Service `PropriedadeService` · Repository `PropriedadeRepository` ·
Schemas `PropriedadeCreateSchema`, `PropriedadeUpdateSchema`, `PropriedadeQuerySchema`,
`PropriedadeIdSchema` · Regras: `documentacao/rotas/rotas_pastolivre.md` § 2

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth. Nenhuma rota de
`/propriedades` usa `AdminMiddleware` — não há categoria 403 admin aqui.

## POST /propriedades

Arquivo: `test/endpoints/propriedades/post-propriedades.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| PROP-POST-01 | cria com `nome` apenas (campos opcionais ausentes) | — | 201 | envelope; `data.id` (UUID gerado pelo Prisma); `data.usuario.id` = A; `data.ativo` = `true` |
| PROP-POST-02 | cria com `localizacao` e `areaTotalHa` válidos | — | 201 | `data.localizacao` presente; `data.areaTotalHa` presente |
| PROP-POST-03 | `localizacao` "vilhena,ro" é normalizada | — | 201 | `data.localizacao` = `"Vilhena,RO"` (ver `formatLocalizacao` em `PropriedadeSchema.js:10`) |
| PROP-POST-04 | aceita `id` gerado pelo cliente (offline-first) | — | 201 | `data.id` igual ao UUID enviado no corpo |
| PROP-POST-05 | corpo vazio (`{}`) | — | 400 | `tipo` = `validationError`; `errors[0].path` = `body`; `message` = "Forneça os dados da propriedade." |
| PROP-POST-06 | sem `nome` (obrigatório) | — | 400 | issue Zod com `path` = `nome` |
| PROP-POST-07 | `nome` com 1 caractere (abaixo do mínimo de 2) | — | 400 | issue `nome`, mensagem "pelo menos 2 caracteres" |
| PROP-POST-08 | `nome` com mais de 150 caracteres | — | 400 | issue `nome`, mensagem "no máximo 150 caracteres" |
| PROP-POST-09 | campo extra no corpo (`.strict()`) | — | 400 | issue Zod `unrecognized_keys` no campo extra |
| PROP-POST-10 | `localizacao` fora do formato "Cidade,UF" | — | 400 | issue `localizacao` com a mensagem do regex |
| PROP-POST-11 | `areaTotalHa` negativo ou zero | — | 400 | issue `areaTotalHa`, mensagem "deve ser um número positivo" |
| PROP-POST-12 | `id` enviado não é UUID válido | — | 400 | issue `id`, mensagem "deve ser um UUID válido" |
| PROP-POST-13 | sem header de autenticação | — | 401 | `tipo` = `unauthorized` |
| PROP-POST-14 | token inválido/expirado | — | 401 | `tipo` = `unauthorized`; `message` = "Sessão inválida ou expirada. Faça login novamente." |
| PROP-POST-15 | nome duplicado: já existe propriedade **ativa** com o mesmo nome para o mesmo usuário (case-insensitive) | usuário A já tem propriedade "Fazenda X" ativa | 409 | `tipo` = `conflict`; `errors[0].path` = `nome`; `message` = "Já existe uma propriedade com este nome para este usuário." |
| PROP-POST-16 | mesmo nome de uma propriedade **inativa** (arquivada) do mesmo usuário | A tem "Fazenda X" com `ativo: false` | 201 | cria normalmente — `PropriedadeRepository.findByNome` só considera `ativo: true` |
| PROP-POST-17 | mesmo nome, usuários diferentes (A e B) | — | 201 para ambos | unicidade de nome é escopada por `usuarioId`, não global |

## GET /propriedades

Arquivo: `test/endpoints/propriedades/get-propriedades.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| PROP-GET-01 | usuário sem nenhuma propriedade cadastrada | — | 200 | `message` = "Nenhuma propriedade cadastrada."; `data.docs` = `[]`; `data.totalDocs` = 0 |
| PROP-GET-02 | lista propriedades do usuário autenticado | A tem 2 propriedades ativas | 200 | `data.docs.length` = 2; ordenado por `nome` asc; `message` = "2 propriedade(s) encontrada(s)." |
| PROP-GET-03 | filtro `nome` (substring, case-insensitive) | A tem "Fazenda Boa Vista" e "Sítio Alegre" | 200 | `?nome=boa` devolve só "Fazenda Boa Vista" |
| PROP-GET-04 | filtro `localizacao` (substring, case-insensitive) | — | 200 | filtra pelo texto de `localizacao` |
| PROP-GET-05 | filtros sem nenhum resultado | — | 200 | `message` = "Nenhuma propriedade encontrada com os filtros informados." |
| PROP-GET-06 | paginação `page=2` | A tem 15 propriedades, `limit` padrão 10 | 200 | `data.docs.length` = 5; `data.page` = 2; `data.totalPages` = 2 |
| PROP-GET-07 | `limit` acima de 100 — **divergência**: `PropriedadeQuerySchema` já rejeita antes de chegar ao truncamento do service | — | 400 | issue Zod `limit`, "Too big"; `PropriedadeService.list` teria truncado para 100 (`Math.min(...,100)`), mas o código nunca chega lá; ver `## Divergências` |
| PROP-GET-08 | `?ativo=false` lista só as propriedades inativas | A tem propriedades ativas e inativas | 200 | `data.docs` contém só as com `ativo: false` |
| PROP-GET-08b | `?ativo=true` lista só as propriedades ativas | A tem propriedades ativas e inativas | 200 | `data.docs` contém só as com `ativo: true` |
| PROP-GET-09 | multi-tenancy: B não vê propriedades de A | A e B com propriedades próprias | 200 | `data.docs` de B não contém nenhuma propriedade de A |
| PROP-GET-10 | leitura por diferença: `atualizadoDesde` traz também as inativas | A tem propriedade excluída (soft-delete) após a marca de tempo | 200 | `data.docs` inclui a propriedade com `ativo: false` e `updatedAt` mais recente que `atualizadoDesde` |
| PROP-GET-11 | `limit` ou `page` inválidos (ex.: `page=0`, `limit=-1`) | — | 400 | issue Zod no campo correspondente |
| PROP-GET-12 | `atualizadoDesde` fora do formato ISO 8601 | — | 400 | issue `atualizadoDesde` |
| PROP-GET-13 | sem token | — | 401 | `tipo` = `unauthorized` |

## GET /propriedades/:id

Arquivo: `test/endpoints/propriedades/get-propriedades-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| PROP-GET-ID-01 | retorna propriedade existente do usuário autenticado | — | 200 | `message` = "Propriedade encontrada com sucesso."; `data` inclui `usuario.{id,name,email}` |
| PROP-GET-ID-02 | propriedade inativa (soft-deleted) do próprio dono ainda pode ser lida por id | propriedade de A com `ativo: false` | 200 | `data.ativo` = `false` (leitura por id não filtra `ativo`) |
| PROP-GET-ID-03 | id inexistente (UUID válido, sem registro) | — | 404 | `tipo` = `resourceNotFound`; `message` = "Recurso não encontrado em Propriedade." |
| PROP-GET-ID-04 | multi-tenancy: B tenta ler propriedade de A | — | 404 | mesma resposta do cenário anterior — `findById` filtra por `usuarioId` |
| PROP-GET-ID-05 | `:id` não é UUID válido | — | 400 | `tipo` = `validationError`; mensagem "ID de propriedade inválido. Deve ser um UUID válido." |
| PROP-GET-ID-06 | sem token | — | 401 | `tipo` = `unauthorized` |
| PROP-GET-ID-07 | token inválido | — | 401 | `tipo` = `unauthorized` |

## PATCH /propriedades/:id

Arquivo: `test/endpoints/propriedades/patch-propriedades-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| PROP-PATCH-ID-01 | atualiza `nome` | — | 200 | `data.nome` atualizado; persistido no banco |
| PROP-PATCH-ID-02 | atualiza `localizacao` (normalizada) | — | 200 | `data.localizacao` no formato "Cidade,UF" |
| PROP-PATCH-ID-03 | atualiza `areaTotalHa` | — | 200 | `data.areaTotalHa` atualizado |
| PROP-PATCH-ID-04 | corpo vazio (`{}`) | — | 400 | `errors[0].path` = `body`; `message` = "Forneça pelo menos um campo para atualizar." |
| PROP-PATCH-ID-05 | campo extra no corpo (`.strict()`) | — | 400 | issue `unrecognized_keys` |
| PROP-PATCH-ID-06 | id inexistente | — | 404 | `tipo` = `resourceNotFound` |
| PROP-PATCH-ID-07 | multi-tenancy: B tenta editar propriedade de A | — | 404 | mesma resposta do cenário anterior |
| PROP-PATCH-ID-08 | `nome` já usado por outra propriedade ativa do mesmo usuário | A tem "Fazenda X" e "Fazenda Y" ativas | 409 | `tipo` = `conflict`; `errors[0].path` = `nome` |
| PROP-PATCH-ID-09 | reenviar o próprio `nome` atual (sem mudar) | — | 200 | não gera 409 — `validateUniqueNome` exclui o próprio id (`excludeId`) |
| PROP-PATCH-ID-10 | `ativo: false` com rebanhos ativos vinculados (via pasto) | propriedade de A tem pasto com rebanho ativo | 400 | `tipo` = `validationError`; `errors[0].path` = `ativo`; `message` = "A propriedade ainda possui rebanhos vinculados a ela." |
| PROP-PATCH-ID-11 | `ativo: false` sem rebanhos ativos | — | 200 | `data.ativo` = `false`; persistido |
| PROP-PATCH-ID-12 | reativa (`ativo: true`) uma propriedade inativa | — | 200 | `data.ativo` = `true` |
| PROP-PATCH-ID-13 | `:id` não é UUID válido | — | 400 | issue de `PropriedadeIdSchema` |
| PROP-PATCH-ID-14 | sem token | — | 401 | `tipo` = `unauthorized` |

## DELETE /propriedades/:id

Arquivo: `test/endpoints/propriedades/delete-propriedades-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| PROP-DELETE-ID-01 | exclui (soft-delete) propriedade sem rebanhos ativos | — | 200 | DB: `ativo` = `false`; `message` = "Propriedade excluída com sucesso." |
| PROP-DELETE-ID-02 | recusa exclusão com rebanhos ativos na propriedade | mesma trava do PATCH (`remove` delega para `update({ativo:false})`) | 400 | `tipo` = `validationError`; `errors[0].path` = `ativo` |
| PROP-DELETE-ID-03 | id inexistente | — | 404 | `tipo` = `resourceNotFound` |
| PROP-DELETE-ID-04 | multi-tenancy: B tenta excluir propriedade de A | — | 404 | mesma resposta do cenário anterior |
| PROP-DELETE-ID-05 | `:id` não é UUID válido | — | 400 | issue de `PropriedadeIdSchema` |
| PROP-DELETE-ID-06 | excluir propriedade já inativa | propriedade de A com `ativo: false` | 200 | idempotente — continua `ativo: false`, sem erro |
| PROP-DELETE-ID-07 | sem token | — | 401 | `tipo` = `unauthorized` |

## Divergências

- `GET /propriedades?limit=500` responde 400 em vez de truncar para 100.
  `PropriedadeQuerySchema` (`src/utils/validators/schemas/zod/querys/PropriedadeQuerySchema.js:28`)
  valida `limit` com `.max(100)`, então valores acima de 100 são rejeitados pelo Zod antes de
  chegar ao service. O truncamento `Math.min(parseInt(limit,10) || 10, 100)` em
  `PropriedadeService.list` (`src/service/PropriedadeService.js:38`) é código morto — nunca
  recebe um valor maior que 100, pois o controller já teria lançado `ZodError`. Coberto por
  `PROP-GET-07`.
