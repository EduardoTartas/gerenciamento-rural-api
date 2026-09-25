# Transversal

Comportamento comum à API inteira, independente de rota de domínio: health check, rota
inexistente, corpo JSON inválido, ordem de registro de rotas específicas vs. `/:id`, e
resposta a token inválido. Fontes: `src/app.js`, `src/routes/index.js`,
`src/middlewares/AuthMiddleware.js`, `src/utils/helpers/errorHandler.js`,
`src/utils/helpers/CommonResponse.js`, `src/utils/helpers/messages.js`.

Esta suíte substitui `test/ordemDeRotas.test.js` (que testava a ordem de registro lendo o
texto-fonte de `src/routes/index.js`) por uma verificação de comportamento real via HTTP.

Exceção à convenção de um arquivo por endpoint: todos os cenários APP-* abaixo (health, rota
inexistente, JSON inválido, ordem de rotas, 401) vivem num único arquivo,
`test/endpoints/transversal/app.test.js`, porque nenhum é uma rota de domínio própria — são
comportamentos do `app.js`/middlewares compartilhados por toda a API.

## GET /health

Arquivo: `test/endpoints/transversal/app.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| APP-GET-01 | banco de dados conectado, sem autenticação | — | 200 | rota pública (sem `AuthMiddleware`); `data.status` = `"healthy"`; `data.database` = `"connected"`; `data.timestamp` e `data.uptime` presentes |

**Exceção intencional**: `/health` é a única rota do projeto que não usa o envelope
`CommonResponse` (`{message, data, errors}`) — responde um JSON próprio
(`{status, database, timestamp, uptime}`, `src/routes/index.js:59-74`). É health check de
infraestrutura (usado por orquestrador/monitoramento), não um endpoint de negócio; o contrato
`CommonResponse` não se aplica aqui por decisão de projeto, não por bug.

## Rota inexistente

Arquivo: `test/endpoints/transversal/app.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| APP-GET-02 | `GET /v1/rota-que-nao-existe` | — | 404 | envelope de erro; `tipo` = `resourceNotFound`; `recuperavel` = `false`; `message` do envelope e `errors[0].message` = "Rota não encontrada." |
| APP-GET-03 | método não suportado numa rota existente (ex.: `PUT /v1/propriedades`) | — | 404 | mesma resposta do cenário anterior — Express 5 não distingue "rota existe, método não" de "rota não existe" aqui, pois não há roteamento por método nesse nível |

## JSON inválido

Arquivo: `test/endpoints/transversal/app.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| APP-POST-01 | `POST /v1/propriedades` com `Content-Type: application/json` e corpo malformado (ex.: `{nome:}`) | usuário autenticado | 400 | `tipo` = `validationError`; `errors[0].path` = `body`; `message` do envelope = "Formato JSON inválido."; `errors[0].message` = "JSON inválido. Verifique a sintaxe do corpo da requisição." — o erro de parsing do `express.json()` é interceptado pelo `errorHandler` antes de chegar ao controller |

## Ordem de rotas — específicas antes de `/:id`

Arquivo: `test/endpoints/transversal/app.test.js`

Cobre a armadilha documentada em `src/routes/index.js:76-83`: rotas com segmento fixo (ex.:
`/pastagens/manejos`) precisam estar registradas **antes** da rota genérica `/pastagens/:id`,
senão o segmento fixo é interpretado como valor de `:id`.

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| APP-GET-04 | `GET /v1/pastagens/manejos` (autenticado, sem query) | — | 200 | resposta do `ManejoPastoController.list` (envelope com `data.docs`); **não** é o erro "ID de pastagem inválido. Deve ser um UUID válido." que `PastoController` devolveria se `id` = `"manejos"` |
| APP-GET-05 | `GET /v1/rebanhos/manejos` | — | 200 | idem, não cai em `/rebanhos/:id` |
| APP-GET-06 | `GET /v1/rebanhos/movimentacoes` | — | 200 | idem |
| APP-GET-07 | `GET /v1/rebanhos/regimes-consumo` | — | 200 | idem — `regimeConsumoRoutes` precisa vir antes de `rebanhoRoutes` |
| APP-GET-08 | `GET /v1/insumos/movimentacoes?atualizadoDesde=1970-01-01T00:00:00.000Z` | — | 200 | idem, não cai em `/insumos/:id` — query obrigatória, ver nota abaixo |

**Nota sobre APP-GET-08**: `MovimentacaoInsumoService.list` recusa listar sem `insumoId` OU
`atualizadoDesde` (400 `validationError`, "Informe o insumo, ou use atualizadoDesde para a
leitura por diferença."), então `GET /v1/insumos/movimentacoes` sem query nenhuma não
retorna 200. O teste usa `?atualizadoDesde=1970-01-01T00:00:00.000Z` (leitura por diferença,
sem depender de um insumo existir) só para satisfazer essa validação — o que a linha
continua provando é a ordem de rotas: se `/insumos/movimentacoes` caísse em `/insumos/:id`,
o erro seria "ID de insumo inválido. Deve ser um UUID válido." (400 de formato), não o 400 de
"informe o insumo" nem um 200 de listagem real.

## 401 com token inválido

Arquivo: `test/endpoints/transversal/app.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| APP-GET-09 | requisição a rota protegida (`GET /v1/propriedades`) sem header `Authorization` e sem cookie de sessão | — | 401 | `tipo` = `unauthorized`; `recuperavel` = `true`; `message` = "Sessão inválida ou expirada. Faça login novamente." |
| APP-GET-10 | requisição a rota protegida com `Authorization: Bearer token-invalido` | — | 401 | mesma resposta do cenário anterior — `AuthMiddleware` chama `auth.api.getSession`, que devolve sessão nula para token não reconhecido pelo BetterAuth |
| APP-GET-11 | requisição a rota protegida com bearer token de uma sessão revogada | sessão de A removida diretamente via Prisma (`session.deleteMany({ where: { userId } })`) antes da requisição | 401 | mesma resposta — qualquer rota autenticada (não só `/propriedades`) reage igual, pois a checagem é feita pelo `AuthMiddleware` comum a todas. Não há endpoint de revogação de sessão na API para simular isso via HTTP puro, então o teste apaga a sessão direto no banco para reproduzir "token que já foi válido, mas não é mais" |
