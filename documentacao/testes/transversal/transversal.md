# Transversal

Comportamento comum à API inteira, independente de rota de domínio: health check, rota
inexistente, corpo JSON inválido, ordem de registro de rotas específicas vs. `/:id`, e
resposta a token inválido. Fontes: `src/app.js`, `src/routes/index.js`,
`src/middlewares/AuthMiddleware.js`, `src/utils/helpers/errorHandler.js`,
`src/utils/helpers/CommonResponse.js`, `src/utils/helpers/messages.js`.

Esta suíte substitui `test/ordemDeRotas.test.js` (que testava a ordem de registro lendo o
texto-fonte de `src/routes/index.js`) por uma verificação de comportamento real via HTTP.

## GET /health

Arquivo: `test/endpoints/transversal/get-health.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| APP-GET-01 | banco de dados conectado, sem autenticação | — | 200 | rota pública (sem `AuthMiddleware`); `data.status` = `"healthy"`; `data.database` = `"connected"`; `data.timestamp` e `data.uptime` presentes — nota: a resposta de `/health` **não** usa o envelope `CommonResponse` (`{message,data,errors}`); é um JSON próprio (`src/routes/index.js:59-74`) |

## Rota inexistente

Arquivo: `test/endpoints/transversal/rota-inexistente.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| APP-GET-02 | `GET /v1/rota-que-nao-existe` | — | 404 | envelope de erro; `tipo` = `resourceNotFound`; `recuperavel` = `false`; `errors[0].message` = "Rota não encontrada."; `message` do envelope é literalmente `"Recurso não encontrado em null."` (ver `## Divergências`) |
| APP-GET-03 | método não suportado numa rota existente (ex.: `PUT /v1/propriedades`) | — | 404 | mesma resposta do cenário anterior — Express 5 não distingue "rota existe, método não" de "rota não existe" aqui, pois não há roteamento por método nesse nível |

## JSON inválido

Arquivo: `test/endpoints/transversal/json-invalido.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| APP-POST-01 | `POST /v1/propriedades` com `Content-Type: application/json` e corpo malformado (ex.: `{nome:}`) | usuário autenticado | 400 | `tipo` = `validationError`; `errors[0].path` = `body`; `message` do envelope = "Formato JSON inválido."; `errors[0].message` = "JSON inválido. Verifique a sintaxe do corpo da requisição." — o erro de parsing do `express.json()` é interceptado pelo `errorHandler` antes de chegar ao controller |

## Ordem de rotas — específicas antes de `/:id`

Arquivo: `test/endpoints/transversal/ordem-de-rotas.test.js`

Cobre a armadilha documentada em `src/routes/index.js:76-83`: rotas com segmento fixo (ex.:
`/pastagens/manejos`) precisam estar registradas **antes** da rota genérica `/pastagens/:id`,
senão o segmento fixo é interpretado como valor de `:id`.

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| APP-GET-04 | `GET /v1/pastagens/manejos` (autenticado, sem query) | — | 200 | resposta do `ManejoPastoController.list` (envelope com `data.docs`); **não** é o erro "ID de pastagem inválido. Deve ser um UUID válido." que `PastoController` devolveria se `id` = `"manejos"` |
| APP-GET-05 | `GET /v1/rebanhos/manejos` | — | 200 | idem, não cai em `/rebanhos/:id` |
| APP-GET-06 | `GET /v1/rebanhos/movimentacoes` | — | 200 | idem |
| APP-GET-07 | `GET /v1/rebanhos/regimes-consumo` | — | 200 | idem — `regimeConsumoRoutes` precisa vir antes de `rebanhoRoutes` |
| APP-GET-08 | `GET /v1/insumos/movimentacoes` | — | 200 | idem, não cai em `/insumos/:id` |

## 401 com token inválido

Arquivo: `test/endpoints/transversal/token-invalido.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| APP-GET-09 | requisição a rota protegida (`GET /v1/propriedades`) sem header `Authorization` e sem cookie de sessão | — | 401 | `tipo` = `unauthorized`; `recuperavel` = `true`; `message` = "Sessão inválida ou expirada. Faça login novamente." |
| APP-GET-10 | requisição a rota protegida com `Authorization: Bearer token-invalido` | — | 401 | mesma resposta do cenário anterior — `AuthMiddleware` chama `auth.api.getSession`, que devolve sessão nula para token não reconhecido pelo BetterAuth |
| APP-GET-11 | requisição a rota protegida com cookie de sessão expirado/revogado | sessão de A expirada ou removida | 401 | mesma resposta — qualquer rota autenticada (não só `/propriedades`) reage igual, pois a checagem é feita pelo `AuthMiddleware` comum a todas |

## Divergências

- Mensagem de rota inexistente: o middleware 404 em `src/app.js:95-105` chama
  `CommonResponse.error(res, 404, 'resourceNotFound', null, [{ message: 'Rota não encontrada.' }])`
  **sem** passar `customMessage`. Como o 4º argumento (`field`) é `null`,
  `StatusService.getErrorMessage('resourceNotFound', null)` invoca
  `messages.error.resourceNotFound(null)` (`src/utils/helpers/messages.js:30`), cujo template
  é `` `Recurso não encontrado em ${fieldName}.` `` — com `fieldName = null`, o campo
  `message` do envelope sai literalmente como `"Recurso não encontrado em null."`. O texto
  legível ("Rota não encontrada.") só existe dentro de `errors[0].message`. Um teste de
  endpoint deve asserir sobre `errors[0].message`, não sobre `message`, para não ficar
  acoplado a esse texto acidental.
- `GET /health` não segue o envelope `CommonResponse` — é a única rota do projeto que
  responde um JSON com forma própria (`{status, database, timestamp, uptime}`), sem
  `{message, data, errors}`.
