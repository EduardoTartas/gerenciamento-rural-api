# /pastagens/manejos/:id/fotos, /rebanhos/manejos/:id/fotos e /manejos/fotos

Controller `FotoAtividadeController` · Service `FotoAtividadeService` (usa `UploadService` com o
perfil `atividade`) · Repository `FotoAtividadeRepository` · Schemas `FotoAtividadeCreateSchema`,
`FotoAtividadeQuerySchema`, `FotoAtividadeIdSchema` · Regras: rotas_pastolivre.md § 15

Pré-condições comuns: usuário A autenticado via BetterAuth, com uma propriedade, um pasto, um
rebanho, um manejo de pastagem e um manejo de rebanho (`criarCenario` em
`test/endpoints/manejos-fotos/apoio-local.js`). Usuário B criado quando o cenário pede.

**Mock de storage:** igual à suíte de `/uploads` — `getGarageClient` (`src/config/garageConnect.js`)
é trocado por um client falso com `putObject`/`removeObject` espiáveis; `baseUrlPublica` e
`ensureGarageEnv` continuam reais. A remoção do arquivo na exclusão não é aguardada pela resposta
(melhor esforço), então o teste espera a chamada com `vi.waitFor`.

Arquivos: `test/endpoints/manejos-fotos/`.

## POST /pastagens/manejos/:id/fotos

Arquivo: `post-pastagens-manejos-id-fotos.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| FOTO-PAS-POST-01 | envia foto com id do aparelho | JPEG válido, campo `id` | 201 | `data` = `{ id, manejoPastoId, manejoRebanhoId: null, url, ativo, createdAt, updatedAt }`; `url` = `GARAGE_PUBLIC_URL/atividades/<id>.jpeg`; `putObject` com bucket de fotos, chave `atividades/<id>.jpeg`, `Content-Type: image/jpeg`; linha ativa no banco |
| FOTO-PAS-POST-02 | sem id gera um no servidor | PNG válido, sem `id` | 201 | `data.id` é UUID; chave usa esse id |
| FOTO-PAS-POST-03 | reduz o lado maior a 1600 sem cortar | imagem 4000x2000 | 201 | buffer enviado é JPEG 1600x800 |
| FOTO-PAS-POST-04 | imagem pequena não é ampliada | imagem 300x200 | 201 | buffer enviado mantém 300x200 |
| FOTO-PAS-POST-05 | reenvio do mesmo id no mesmo manejo | primeira chamada já 201 | 200 | mensagem "Foto já enviada."; mesma `url`; `putObject` chamado uma vez só; uma linha no banco |
| FOTO-PAS-POST-06 | reenvio idempotente com o manejo cheio | 3 fotos ativas, uma delas com o `id` enviado | 200 | devolve a foto existente, sem 400 de limite |
| FOTO-PAS-POST-07 | id já usado em outro manejo | foto com o `id` no manejo de rebanho | 409 | `tipo` `conflict`; storage não chamado |
| FOTO-PAS-POST-08 | limite de 3 fotos ativas | 3 fotos ativas no manejo | 400 | `tipo` `validationError`; mensagem "Esta atividade já tem 3 fotos."; storage não chamado |
| FOTO-PAS-POST-09 | foto excluída libera a vaga | 2 ativas + 1 excluída | 201 | — |
| FOTO-PAS-POST-10 | manejo inexistente | UUID aleatório | 404 | `tipo` `resourceNotFound`; storage não chamado |
| FOTO-PAS-POST-11 | multi-tenancy | B envia no manejo de A | 404 | `tipo` `resourceNotFound`; storage não chamado |
| FOTO-PAS-POST-12 | manejo excluído | manejo com `ativo: false` | 400 | `tipo` `validationError`; storage não chamado |
| FOTO-PAS-POST-13 | sem arquivo | só o campo `id` | 400 | mensagem "Nenhum arquivo enviado." |
| FOTO-PAS-POST-14 | extensão fora da whitelist | `.gif` | 400 | mensagem cita `.gif` e `jpg, jpeg, png` |
| FOTO-PAS-POST-15 | arquivo acima de 10MB | 11MB | 400 | mensagem "Arquivo excede o tamanho máximo de 10MB."; storage não chamado |
| FOTO-PAS-POST-16 | id do corpo não é UUID | `id=nao-e-uuid` | 400 | `errors[0].message` "O id da foto deve ser um UUID válido." |
| FOTO-PAS-POST-17 | campo extra no corpo | campo `legenda` | 400 | `tipo` `validationError` (`.strict()`) |
| FOTO-PAS-POST-18 | :id não é UUID | `nao-e-uuid` | 400 | mensagem do `ManejoPastoIdSchema` |
| FOTO-PAS-POST-19 | falha do storage | `putObject` rejeita | 503 | `tipo` `storageError`; nenhuma linha gravada |
| FOTO-PAS-POST-20 | sem token | sem `Authorization` | 401 | `tipo` `unauthorized` |

## POST /rebanhos/manejos/:id/fotos

Arquivo: `post-rebanhos-manejos-id-fotos.test.js` — mesma regra, outro FK.

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| FOTO-REB-POST-01 | envia foto do manejo de rebanho | JPEG válido, campo `id` | 201 | `manejoRebanhoId` preenchido, `manejoPastoId` nulo; chave `atividades/<id>.jpeg` |
| FOTO-REB-POST-02 | reenvio do mesmo id | foto já gravada no manejo | 200 | devolve a existente; storage não chamado |
| FOTO-REB-POST-03 | id já usado em manejo de pastagem | foto com o `id` no manejo de pastagem | 409 | `tipo` `conflict` |
| FOTO-REB-POST-04 | limite de 3 fotos ativas | 3 ativas no manejo | 400 | "Esta atividade já tem 3 fotos." |
| FOTO-REB-POST-05 | limite conta só o próprio manejo | 3 ativas no manejo de pastagem | 201 | — |
| FOTO-REB-POST-06 | multi-tenancy | B envia no manejo de A | 404 | `tipo` `resourceNotFound` |
| FOTO-REB-POST-07 | manejo excluído | `ativo: false` | 400 | `tipo` `validationError` |
| FOTO-REB-POST-08 | id de manejo de pastagem na rota de rebanho | — | 404 | — |
| FOTO-REB-POST-09 | :id não é UUID | — | 400 | — |
| FOTO-REB-POST-10 | sem token | — | 401 | — |

## GET /manejos/fotos

Arquivo: `get-manejos-fotos.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| FOTO-GET-01 | lista as ativas das duas atividades | 1 foto em cada manejo + 1 excluída | 200 | 2 itens; envelope paginado (`docs`, `totalDocs`, `page`, `limit`, `totalPages`); campos do item |
| FOTO-GET-02 | sem fotos | — | 200 | mensagem "Nenhuma foto encontrada."; `docs` vazio |
| FOTO-GET-03 | ordem por createdAt crescente | 2 fotos com `createdAt` invertido em relação à criação | 200 | a mais antiga primeiro |
| FOTO-GET-04 | filtro por manejoPastoId / manejoRebanhoId | 1 foto em cada | 200 | só a do manejo filtrado |
| FOTO-GET-05 | filtro por pastoId / rebanhoId / propriedadeId | fotos em duas propriedades | 200 | só as do pasto, do rebanho ou da propriedade |
| FOTO-GET-06 | leitura por diferença | viva e excluída depois da marca, outra antes | 200 | as duas depois da marca; a excluída com `ativo: false` |
| FOTO-GET-07 | ativo=false | 1 viva, 1 excluída | 200 | só a excluída |
| FOTO-GET-08 | multi-tenancy | fotos de A; B lista com e sem `manejoPastoId` de A | 200 | `docs` vazio nos dois |
| FOTO-GET-09 | paginação | 3 fotos, `page=2&limit=2` | 200 | `totalPages` 2, 1 item |
| FOTO-GET-10 | limit acima de 100 | `limit=101` | 400 | `tipo` `validationError` |
| FOTO-GET-11 | filtro desconhecido | `qualquer=x` | 400 | `.strict()` |
| FOTO-GET-12 | atualizadoDesde inválido | `ontem` | 400 | "atualizadoDesde deve ser uma data ISO 8601 em UTC." |
| FOTO-GET-13 | sem token | — | 401 | `tipo` `unauthorized` |

## DELETE /manejos/fotos/:id

Arquivo: `delete-manejos-fotos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| FOTO-DELETE-01 | exclui a foto e remove o arquivo | foto ativa de manejo de pastagem | 200 | mensagem "Foto excluída com sucesso."; `ativo: false` na resposta e no banco; `updatedAt` avança; `removeObject(bucket, 'atividades/<id>.jpeg')` |
| FOTO-DELETE-02 | foto de manejo de rebanho | foto ativa | 200 | `ativo: false` |
| FOTO-DELETE-03 | falha ao remover o arquivo | `removeObject` rejeita | 200 | linha excluída mesmo assim |
| FOTO-DELETE-04 | foto já excluída | `ativo: false` | 200 | registro como está; storage não chamado |
| FOTO-DELETE-05 | id inexistente | UUID aleatório | 404 | `tipo` `resourceNotFound` |
| FOTO-DELETE-06 | multi-tenancy | B exclui foto de A | 404 | foto de A segue ativa; storage não chamado |
| FOTO-DELETE-07 | :id não é UUID | — | 400 | "ID de foto inválido. Deve ser um UUID válido." |
| FOTO-DELETE-08 | sem token | — | 401 | `tipo` `unauthorized` |

## Exclusão do manejo

Arquivo: `delete-manejos-fotos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| FOTO-MANEJO-01 | DELETE /pastagens/manejos/:id desativa as fotos | foto no manejo de pastagem e outra no de rebanho | 200 | só a foto do manejo excluído fica `ativo: false` |
| FOTO-MANEJO-02 | DELETE /rebanhos/manejos/:id desativa as fotos | foto no manejo de rebanho | 200 | foto `ativo: false` |
| FOTO-MANEJO-03 | CHECK de exatamente um manejo | insert direto sem FK e com os dois | — | o banco recusa os dois |

## POST /sync — fotos_atividade

Arquivo: `delete-manejos-fotos-id.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| FOTO-SYNC-01 | `fotos_atividade:DELETE` | foto ativa | 200 | `situacao` `aceito`; foto `ativo: false`; arquivo removido |
| FOTO-SYNC-02 | foto inexistente ou já excluída | — | 200 | as duas mutações `aceito` |
| FOTO-SYNC-03 | multi-tenancy | B envia DELETE da foto de A | 200 | foto de A segue ativa; storage não chamado |
| FOTO-SYNC-04 | `fotos_atividade:CREATE` | — | 200 | `situacao` `recusado`, `erro.tipo` `validationError` (combinação não suportada) |

## Divergências

Nenhuma conhecida.
