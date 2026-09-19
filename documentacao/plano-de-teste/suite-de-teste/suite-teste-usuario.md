# /usuarios

Controller `UserController` · Service `UserService` · Repository `UserRepository` ·
Schemas `UserUpdateSchema`, `UserFotoSchema`, `UserQuerySchema`, `UserIdSchema` ·
Regras: `rotas_pastolivre.md` § 9

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth; usuário admin autenticado
(`admin: true` setado via Prisma — o campo tem `input: false` no BetterAuth, não dá para criar já
admin pelo fluxo normal de sign-up).

`GET /usuarios` (listagem) é restrito a admin pela rota (`AdminMiddleware`, antes do controller).
`GET/PATCH/DELETE /usuarios/:id` e `PATCH /usuarios/:id/foto` distinguem "ação própria" de
"outro usuário" dentro do `UserService` — admin tem bypass de `ensureSelfAction` em todos eles,
de forma uniforme: pode consultar, atualizar, excluir e trocar a foto de qualquer usuário.

`:id` aceita tanto o formato de id gerado pelo BetterAuth (string alfanumérica de 32 caracteres,
sem hífens) quanto UUID (usado no `id` opcional do fluxo offline-first e nos testes com
`randomUUID()`) — ver `UserIdSchema`.

## GET /usuarios

Arquivo: `test/endpoints/usuarios/get-usuarios.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| USR-GET-01 | admin lista usuários | admin; ao menos 2 usuários cadastrados | 200 | envelope; `data.docs` array com `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt` (sem campos sensíveis, ex. sem hash de senha); mensagem `"N usuário(s) encontrado(s)."` |
| USR-GET-02 | filtra por `name` (contém, case-insensitive) | admin; usuário "Eduardo" cadastrado | 200 | `docs` só traz quem contém o filtro |
| USR-GET-03 | filtra por `email` (contém, case-insensitive) | admin | 200 | `docs` só traz quem casa o filtro |
| USR-GET-04 | pagina com `page`/`limit` | admin; ≥ 11 usuários | 200 | `data.page`, `data.limit`, `data.totalPages` coerentes |
| USR-GET-05 | `limit` acima de 100 é rejeitado pelo schema | admin | 400 | `UserQuerySchema.max(100)` recusa |
| USR-GET-06 | campo de query não reconhecido (`.strict()`) | admin; `?foo=bar` | 400 | `tipo` `validationError` |
| USR-GET-07 | 401 sem token | sem header `Authorization` | 401 | `tipo` `unauthorized` |
| USR-GET-08 | 403 usuário comum (não admin) | usuário A autenticado, não admin | 403 | `tipo` `forbidden`; mensagem "Esta ação exige perfil administrativo."; `AdminMiddleware` recusa antes do controller |

## GET /usuarios/:id

Arquivo: `test/endpoints/usuarios/get-usuarios-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| USR-GET-ID-01 | usuário consulta o próprio ID | A autenticado, `id` = A | 200 | envelope; `data.id === A.id`; mensagem "Usuário encontrado com sucesso." |
| USR-GET-ID-02 | admin consulta ID de outro usuário | admin autenticado, `id` = A | 200 | `data.id === A.id` — admin tem bypass de `ensureSelfAction` |
| USR-GET-ID-03 | usuário comum tenta consultar outro usuário | A autenticado, `id` = B | 403 | `tipo` `forbidden`; mensagem "Você não tem permissão para consultar os dados de outro usuário." |
| USR-GET-ID-04 | ID em formato inválido (curto demais) | A; `/usuarios/abc` | 400 | `tipo` `validationError` (Zod, via `UserIdSchema`) |
| USR-GET-ID-05 | ID válido mas inexistente | A; UUID aleatório | 404 | `tipo` `resourceNotFound` — checagem de existência roda **antes** da checagem de posse (mesmo B pedindo o próprio ID inexistente cairia aqui) |
| USR-GET-ID-06 | 401 sem token | sem header `Authorization` | 401 | `tipo` `unauthorized` |

## PATCH /usuarios/:id

Arquivo: `test/endpoints/usuarios/patch-usuarios-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| USR-PATCH-01 | usuário atualiza o próprio `name` | A autenticado, `id` = A | 200 | `data.name` atualizado; mensagem "Usuário atualizado com sucesso." |
| USR-PATCH-02 | usuário atualiza o próprio `email` para um e-mail livre | A autenticado, `id` = A | 200 | `data.email` atualizado |
| USR-PATCH-03 | usuário atualiza `image` para uma URL | A autenticado, `id` = A; `{ image: "https://..." }` | 200 | `data.image` atualizado |
| USR-PATCH-04 | usuário limpa `image` (`null`) | A autenticado, `id` = A; `{ image: null }` | 200 | `data.image === null` — schema aceita `.nullable()` |
| USR-PATCH-05 | corpo vazio | A; `id` = A; `{}` | 400 | mensagem "Por favor, informe pelo menos um campo para atualizar." |
| USR-PATCH-06 | campo extra no corpo (`.strict()`) | A; `id` = A; `{ name: "X", admin: true }` | 400 | `tipo` `validationError` — confirma que `admin` não pode ser autopromovido via este endpoint |
| USR-PATCH-07 | `email` em formato inválido | A; `id` = A; `{ email: "não-é-email" }` | 400 | mensagem "Formato de e-mail inválido." |
| USR-PATCH-08 | `image` que não é URL válida | A; `id` = A; `{ image: "not-a-url" }` | 400 | mensagem "A imagem deve ser uma URL válida." |
| USR-PATCH-09 | `email` já em uso por outro usuário | A; `id` = A; envia e-mail de B | 409 | `tipo` `conflict`; mensagem "E-mail já cadastrado." |
| USR-PATCH-10 | usuário comum tenta atualizar outro usuário | A autenticado, `id` = B | 403 | `tipo` `forbidden`; mensagem "Você não tem permissão para atualizar o perfil de outro usuário." |
| USR-PATCH-11 | admin atualiza outro usuário (bypass) | admin autenticado, `id` = A | 200 | `data.name` reflete a alteração — `UserService.update` isenta admin de `ensureSelfAction` |
| USR-PATCH-12 | ID em formato inválido | A; `/usuarios/abc` | 400 | `tipo` `validationError` |
| USR-PATCH-13 | ID válido mas inexistente | A; UUID aleatório | 404 | `tipo` `resourceNotFound` |
| USR-PATCH-14 | 401 sem token | sem header `Authorization` | 401 | `tipo` `unauthorized` |

## PATCH /usuarios/:id/foto

Arquivo: `test/endpoints/usuarios/patch-usuarios-id-foto.test.js`

Pré-condição de todo cenário de sucesso: uma URL já existente no bucket (ex.: devolvida por
`POST /uploads/imagens`, com o mock de storage descrito em `uploads.md`) ou, para os cenários que não
dependem do upload real, uma URL sintética `${GARAGE_PUBLIC_URL}/<uuid>.jpeg`.

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| USR-PATCH-FOTO-01 | usuário registra a própria foto | A autenticado, `id` = A; URL dentro do bucket configurado | 200 | `data.image === url`; mensagem "Foto de perfil atualizada com sucesso."; no banco, `user.image` atualizado |
| USR-PATCH-FOTO-02 | substituição descarta avatar antigo em segundo plano | A; `id` = A; A já tinha `image` anterior | 200 | `data.image === novaUrl`; `deletarImagem` chamado para a URL antiga (observável via mock do `getGarageClient`/`removeObject`, chamado de forma assíncrona — aguardar um tick) |
| USR-PATCH-FOTO-03 | primeira foto (sem avatar anterior) não tenta descartar nada | A; `id` = A; `user.image` é `null` | 200 | nenhuma chamada de remoção ao storage |
| USR-PATCH-FOTO-04 | corpo vazio / sem `url` | A; `id` = A; `{}` | 400 | erro de validação Zod aponta `url` (campo obrigatório) |
| USR-PATCH-FOTO-05 | `url` em formato inválido | A; `id` = A; `{ url: "não-é-url" }` | 400 | mensagem "A URL da imagem é inválida." |
| USR-PATCH-FOTO-06 | campo extra no corpo (`.strict()`) | A; `id` = A; `{ url: "...", nome: "x" }` | 400 | `tipo` `validationError` |
| USR-PATCH-FOTO-07 | URL fora do bucket configurado | A; `id` = A; `{ url: "https://evil.example.com/foto.jpg" }` | 400 | mensagem "A URL informada não corresponde a uma imagem enviada pelo sistema."; nenhuma chamada ao storage |
| USR-PATCH-FOTO-08 | rollback: falha ao gravar no banco desfaz o upload | A; `id` = A; simular `repository.update` (ou uma constraint) falhando após a URL passar na validação de bucket | 5xx/4xx conforme o erro original propagado | a imagem recém-enviada é removida do bucket (chamada de `deletarImagem` com a nova URL); erro original repropagado ao cliente, não mascarado |
| USR-PATCH-FOTO-09 | rollback que também falha não derruba a requisição | A; `id` = A; update falha **e** a remoção no storage também falha | mesmo status do erro original | resposta ainda reflete o erro original (rollback é fire-and-forget/best effort, com log, não trava a resposta) |
| USR-PATCH-FOTO-10 | usuário comum tenta registrar foto de outro usuário | A autenticado, `id` = B | 403 | `tipo` `forbidden`; mensagem "Você não tem permissão para atualizar a foto de outro usuário."; nenhuma chamada ao storage |
| USR-PATCH-FOTO-11 | admin registra foto de outro usuário (bypass) | admin autenticado, `id` = A | 200 | `data.image` reflete a nova URL |
| USR-PATCH-FOTO-12 | ID em formato inválido | A; `/usuarios/abc/foto` | 400 | `tipo` `validationError` |
| USR-PATCH-FOTO-13 | ID válido mas inexistente | A; UUID aleatório | 404 | `tipo` `resourceNotFound` |
| USR-PATCH-FOTO-14 | 401 sem token | sem header `Authorization` | 401 | `tipo` `unauthorized` |

## DELETE /usuarios/:id

Arquivo: `test/endpoints/usuarios/delete-usuarios-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| USR-DELETE-01 | usuário exclui a própria conta | A autenticado, `id` = A; A com ao menos uma sessão ativa | 200 | envelope com `data.id`, `data.name`, `data.email`; mensagem "Usuário removido com sucesso."; no banco, o registro em `user` não existe mais |
| USR-DELETE-02 | sessões do usuário são revogadas antes da exclusão | A autenticado, `id` = A; A com sessão ativa (token da própria requisição) | 200 | após a chamada, uma requisição autenticada com o token revogado retorna 401 (ou a tabela `session` não tem mais linhas para `userId = A.id`, já que o usuário some por cascata) |
| USR-DELETE-03 | exclusão em cascata remove dados do domínio do usuário | A com ao menos uma propriedade cadastrada | 200 | no banco, propriedades/pastos/rebanhos/históricos de A não existem mais (cascade do schema Prisma) |
| USR-DELETE-04 | usuário comum tenta excluir outro usuário | A autenticado, `id` = B | 403 | `tipo` `forbidden`; mensagem "Você não tem permissão para excluir a conta de outro usuário."; no banco, B continua existindo |
| USR-DELETE-05 | admin exclui outro usuário (bypass) | admin autenticado, `id` = A | 200 | no banco, A não existe mais — exclusão administrativa de conta alheia é permitida |
| USR-DELETE-06 | ID em formato inválido | A; `/usuarios/abc` | 400 | `tipo` `validationError` |
| USR-DELETE-07 | ID válido mas inexistente | A; UUID aleatório | 404 | `tipo` `resourceNotFound` |
| USR-DELETE-08 | 401 sem token | sem header `Authorization` | 401 | `tipo` `unauthorized` |

