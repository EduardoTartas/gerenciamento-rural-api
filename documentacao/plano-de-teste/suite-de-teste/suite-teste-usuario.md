# Plano de Teste para Endpoints de Usuário

Rota de gestão de conta de usuário (perfil, foto, exclusão), com listagem restrita a admin e
regra "ação própria" nos demais métodos. Fonte técnica: `documentacao/testes/usuarios/usuarios.md`.
Suíte automatizada: `test/endpoints/usuarios/`.

## GET /v1/usuarios

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/usuarios | [USR-GET-01] admin lista usuários | admin; ao menos 2 usuários cadastrados | HTTP 200, envelope; `data.docs` array com `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt` (sem campos sensíveis, ex. sem hash de senha); `message` = "N usuário(s) encontrado(s)." |
| GET /v1/usuarios | [USR-GET-02] filtra por `name` (contém, case-insensitive) | admin; usuário "Eduardo" cadastrado | HTTP 200, `docs` só traz quem contém o filtro |
| GET /v1/usuarios | [USR-GET-03] filtra por `email` (contém, case-insensitive) | admin | HTTP 200, `docs` só traz quem casa o filtro |
| GET /v1/usuarios | [USR-GET-04] pagina com `page`/`limit` | admin; ≥ 11 usuários | HTTP 200, `data.page`, `data.limit`, `data.totalPages` coerentes |
| GET /v1/usuarios | [USR-GET-05] `limit` acima de 100 é rejeitado pelo schema | admin; query `limit=101` | HTTP 400, `UserQuerySchema.max(100)` recusa |
| GET /v1/usuarios | [USR-GET-06] campo de query não reconhecido (`.strict()`) | admin; `?foo=bar` | HTTP 400, `tipo` `validationError` |
| GET /v1/usuarios | [USR-GET-07] 401 sem token | sem header `Authorization` | HTTP 401, `tipo` `unauthorized` |
| GET /v1/usuarios | [USR-GET-08] 403 usuário comum (não admin) | usuário A autenticado, não admin | HTTP 403, `tipo` `forbidden`; mensagem "Esta ação exige perfil administrativo."; `AdminMiddleware` recusa antes do controller |

## GET /v1/usuarios/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/usuarios/:id | [USR-GET-ID-01] usuário consulta o próprio ID | A autenticado, `id` = A | HTTP 200, envelope; `data.id === A.id`; mensagem "Usuário encontrado com sucesso." **(bug conhecido — ver Divergências)** |
| GET /v1/usuarios/:id | [USR-GET-ID-02] admin consulta ID de outro usuário | admin autenticado, `id` = A | HTTP 200, `data.id === A.id` — admin tem bypass de `ensureSelfAction` **(bug conhecido — ver Divergências)** |
| GET /v1/usuarios/:id | [USR-GET-ID-03] usuário comum tenta consultar outro usuário | A autenticado, `id` = B | HTTP 403, `tipo` `forbidden`; mensagem "Você não tem permissão para consultar os dados de outro usuário." **(bug conhecido — ver Divergências)** |
| GET /v1/usuarios/:id | [USR-GET-ID-04] ID em formato inválido (não UUID) | A; `/usuarios/abc` | HTTP 400, `tipo` `validationError` (Zod, via `UserIdSchema`) |
| GET /v1/usuarios/:id | [USR-GET-ID-05] UUID válido mas inexistente | A; UUID aleatório | HTTP 404, `tipo` `resourceNotFound` — checagem de existência roda antes da checagem de posse (mesmo B pedindo o próprio ID inexistente cairia aqui) |
| GET /v1/usuarios/:id | [USR-GET-ID-06] 401 sem token | sem header `Authorization` | HTTP 401, `tipo` `unauthorized` |

## PATCH /v1/usuarios/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| PATCH /v1/usuarios/:id | [USR-PATCH-01] usuário atualiza o próprio `name` | A autenticado, `id` = A | HTTP 200, `data.name` atualizado; mensagem "Usuário atualizado com sucesso." **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id | [USR-PATCH-02] usuário atualiza o próprio `email` para um e-mail livre | A autenticado, `id` = A | HTTP 200, `data.email` atualizado **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id | [USR-PATCH-03] usuário atualiza `image` para uma URL | A autenticado, `id` = A; `{ image: "https://..." }` | HTTP 200, `data.image` atualizado **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id | [USR-PATCH-04] usuário limpa `image` (`null`) | A autenticado, `id` = A; `{ image: null }` | HTTP 200, `data.image === null` — schema aceita `.nullable()` **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id | [USR-PATCH-05] corpo vazio | A; `id` = A; `{}` | HTTP 400, mensagem "Por favor, informe pelo menos um campo para atualizar." **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id | [USR-PATCH-06] campo extra no corpo (`.strict()`) | A; `id` = A; `{ name: "X", admin: true }` | HTTP 400, `tipo` `validationError` — confirma que `admin` não pode ser autopromovido via este endpoint |
| PATCH /v1/usuarios/:id | [USR-PATCH-07] `email` em formato inválido | A; `id` = A; `{ email: "não-é-email" }` | HTTP 400, mensagem "Formato de e-mail inválido." **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id | [USR-PATCH-08] `image` que não é URL válida | A; `id` = A; `{ image: "not-a-url" }` | HTTP 400, mensagem "A imagem deve ser uma URL válida." **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id | [USR-PATCH-09] `email` já em uso por outro usuário | A; `id` = A; envia e-mail de B | HTTP 409, `tipo` `conflict`; mensagem "E-mail já cadastrado." **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id | [USR-PATCH-10] usuário comum tenta atualizar outro usuário | A autenticado, `id` = B | HTTP 403, `tipo` `forbidden`; mensagem "Você não tem permissão para atualizar o perfil de outro usuário." **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id | [USR-PATCH-11] admin tenta atualizar outro usuário (sem bypass) | admin autenticado, `id` = A | HTTP 403, `tipo` `forbidden` — `UserService.update` não isenta admin de `ensureSelfAction` **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id | [USR-PATCH-12] ID em formato inválido | A; `/usuarios/abc` | HTTP 400, `tipo` `validationError` |
| PATCH /v1/usuarios/:id | [USR-PATCH-13] UUID válido mas inexistente | A; UUID aleatório | HTTP 404, `tipo` `resourceNotFound` |
| PATCH /v1/usuarios/:id | [USR-PATCH-14] 401 sem token | sem header `Authorization` | HTTP 401, `tipo` `unauthorized` |

## PATCH /v1/usuarios/:id/foto

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-01] usuário registra a própria foto | A autenticado, `id` = A; URL dentro do bucket configurado | HTTP 200, `data.image === url`; mensagem "Foto de perfil atualizada com sucesso."; no banco, `user.image` atualizado **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-02] substituição descarta avatar antigo em segundo plano | A; `id` = A; A já tinha `image` anterior | HTTP 200, `data.image === novaUrl`; `deletarImagem` chamado para a URL antiga (mock de `getGarageClient`/`removeObject`, chamado de forma assíncrona) **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-03] primeira foto (sem avatar anterior) não tenta descartar nada | A; `id` = A; `user.image` é `null` | HTTP 200, nenhuma chamada de remoção ao storage **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-04] corpo vazio / sem `url` | A; `id` = A; `{}` | HTTP 400, erro de validação Zod aponta `url` (campo obrigatório) **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-05] `url` em formato inválido | A; `id` = A; `{ url: "não-é-url" }` | HTTP 400, mensagem "A URL da imagem é inválida." **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-06] campo extra no corpo (`.strict()`) | A; `id` = A; `{ url: "...", nome: "x" }` | HTTP 400, `tipo` `validationError` |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-07] URL fora do bucket configurado | A; `id` = A; `{ url: "https://evil.example.com/foto.jpg" }` | HTTP 400, mensagem "A URL informada não corresponde a uma imagem enviada pelo sistema."; nenhuma chamada ao storage **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-08] rollback: falha ao gravar no banco desfaz o upload | A; `id` = A; simular `repository.update` (ou constraint) falhando após a URL passar na validação de bucket | 5xx/4xx conforme o erro original propagado, a imagem recém-enviada é removida do bucket (`deletarImagem` com a nova URL); erro original repropagado ao cliente, não mascarado **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-09] rollback que também falha não derruba a requisição | A; `id` = A; update falha e a remoção no storage também falha | mesmo status do erro original, resposta ainda reflete o erro original (rollback é fire-and-forget/best effort, com log, não trava a resposta) **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-10] usuário comum tenta registrar foto de outro usuário | A autenticado, `id` = B | HTTP 403, `tipo` `forbidden`; mensagem "Você não tem permissão para atualizar a foto de outro usuário."; nenhuma chamada ao storage **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-11] admin tenta registrar foto de outro usuário (sem bypass) | admin autenticado, `id` = A | HTTP 403, `tipo` `forbidden` **(bug conhecido — ver Divergências)** |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-12] ID em formato inválido | A; `/usuarios/abc/foto` | HTTP 400, `tipo` `validationError` |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-13] UUID válido mas inexistente | A; UUID aleatório | HTTP 404, `tipo` `resourceNotFound` |
| PATCH /v1/usuarios/:id/foto | [USR-PATCH-FOTO-14] 401 sem token | sem header `Authorization` | HTTP 401, `tipo` `unauthorized` |

## DELETE /v1/usuarios/:id

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| DELETE /v1/usuarios/:id | [USR-DELETE-01] usuário exclui a própria conta | A autenticado, `id` = A; A com ao menos uma sessão ativa | HTTP 200, envelope com `data.id`, `data.name`, `data.email`; mensagem "Usuário removido com sucesso."; no banco, o registro em `user` não existe mais **(bug conhecido — ver Divergências)** |
| DELETE /v1/usuarios/:id | [USR-DELETE-02] sessões do usuário são revogadas antes da exclusão | A autenticado, `id` = A; A com sessão ativa (token da própria requisição) | HTTP 200, após a chamada uma requisição autenticada com o token revogado retorna 401 (ou a tabela `session` não tem mais linhas para `userId = A.id`) **(bug conhecido — ver Divergências)** |
| DELETE /v1/usuarios/:id | [USR-DELETE-03] exclusão em cascata remove dados do domínio do usuário | A com ao menos uma propriedade cadastrada | HTTP 200, no banco, propriedades/pastos/rebanhos/históricos de A não existem mais (cascade do schema Prisma) **(bug conhecido — ver Divergências)** |
| DELETE /v1/usuarios/:id | [USR-DELETE-04] usuário comum tenta excluir outro usuário | A autenticado, `id` = B | HTTP 403, `tipo` `forbidden`; mensagem "Você não tem permissão para excluir a conta de outro usuário."; no banco, B continua existindo **(bug conhecido — ver Divergências)** |
| DELETE /v1/usuarios/:id | [USR-DELETE-05] admin tenta excluir outro usuário (sem bypass) | admin autenticado, `id` = A | HTTP 403, `tipo` `forbidden` — não há exclusão administrativa de conta alheia neste endpoint **(bug conhecido — ver Divergências)** |
| DELETE /v1/usuarios/:id | [USR-DELETE-06] ID em formato inválido | A; `/usuarios/abc` | HTTP 400, `tipo` `validationError` |
| DELETE /v1/usuarios/:id | [USR-DELETE-07] UUID válido mas inexistente | A; UUID aleatório | HTTP 404, `tipo` `resourceNotFound` |
| DELETE /v1/usuarios/:id | [USR-DELETE-08] 401 sem token | sem header `Authorization` | HTTP 401, `tipo` `unauthorized` |

## Bugs conhecidos

- Assimetria de autorização entre métodos: `GET /usuarios/:id` permite que admin consulte qualquer usuário (`UserService.list` checa `req.user.admin`), mas `PATCH /usuarios/:id`, `DELETE /usuarios/:id` e `PATCH /usuarios/:id/foto` não têm o mesmo bypass — `ensureSelfAction` é chamado incondicionalmente, mesmo para admin. A documentação de rotas só descreve "Ação Própria" sem exceção para admin, então o código está alinhado à spec; a divergência é só em relação à expectativa intuitiva de "admin pode tudo" (cenários USR-PATCH-11, USR-PATCH-FOTO-11, USR-DELETE-05 travam esse comportamento explicitamente — não são `it.fails`).
- **Bug real (severo):** `UserIdSchema` valida `:id` com `.uuid()`, mas o `id` real de um usuário é gerado pelo BetterAuth (`generateId`) como string alfanumérica de 32 caracteres sem hífens — nunca um UUID. Como os controllers chamam `UserIdSchema.parse(id)` antes de qualquer outra checagem, **toda** requisição para `GET/PATCH/DELETE /usuarios/:id` e `PATCH /usuarios/:id/foto` usando o ID de um usuário de verdade cai em 400 `validationError` ("Formato de ID de usuário inválido. Deve ser um UUID válido.") antes de alcançar qualquer lógica de negócio. Isso é inconsistente com o resto da API, que aceita `id` como UUID opcional gerado pelo cliente no fluxo offline-first — o `id` do BetterAuth nunca segue esse formato. Os 28 cenários marcados acima com **(bug conhecido — ver Divergências)** — USR-GET-ID-01/02/03, USR-PATCH-01 a 05 e 07 a 11, USR-PATCH-FOTO-01 a 05 e 07 a 11, USR-DELETE-01 a 05 — estão implementados como `it.fails`, com a asserção do comportamento documentado (o que deveria acontecer), não o que o código faz hoje. USR-PATCH-06 e USR-PATCH-FOTO-06 (campo extra) continuam como `it` normal por coincidirem em status/tipo com o bug, mas isso não prova exercício real do `.strict()` do corpo.
