# Plano de Teste para Comportamentos Transversais

Comportamento comum à API inteira, independente de rota de domínio: health check, rota
inexistente, corpo JSON inválido, ordem de registro de rotas específicas vs. `/:id`, e resposta a
token inválido. Fonte técnica: `documentacao/testes/transversal/transversal.md`. Suíte
automatizada: `test/endpoints/transversal/app.test.js` (todos os cenários vivem num único
arquivo, pois nenhum é uma rota de domínio própria).

## GET /health

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /health | [APP-GET-01] banco de dados conectado, sem autenticação | sem header `Authorization` (rota pública) | HTTP 200, `data.status` = "healthy"; `data.database` = "connected"; `data.timestamp` e `data.uptime` presentes — nota: a resposta de `/health` não usa o envelope `CommonResponse` (`{message,data,errors}`), é um JSON próprio |

## Rota inexistente

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/rota-que-nao-existe | [APP-GET-02] rota não cadastrada | — | HTTP 404, envelope de erro; `tipo` = `resourceNotFound`; `recuperavel` = false; `errors[0].message` = "Rota não encontrada."; `message` do envelope é literalmente "Recurso não encontrado em null." **(ver Bugs conhecidos)** |
| PUT /v1/propriedades | [APP-GET-03] método não suportado numa rota existente | — | HTTP 404, mesma resposta do cenário anterior — Express 5 não distingue "rota existe, método não" de "rota não existe" aqui, pois não há roteamento por método nesse nível |

## JSON inválido

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/propriedades | [APP-POST-01] corpo malformado (ex.: `{nome:}`) com `Content-Type: application/json` | usuário autenticado | HTTP 400, `tipo` = `validationError`; `errors[0].path` = `body`; `message` do envelope = "Formato JSON inválido."; `errors[0].message` = "JSON inválido. Verifique a sintaxe do corpo da requisição." — o erro de parsing do `express.json()` é interceptado pelo `errorHandler` antes de chegar ao controller |

## Ordem de rotas — específicas antes de `/:id`

Cobre a armadilha de rotas com segmento fixo (ex.: `/pastagens/manejos`) precisarem estar
registradas antes da rota genérica `/pastagens/:id`, senão o segmento fixo é interpretado como
valor de `:id`.

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/pastagens/manejos | [APP-GET-04] segmento fixo não cai em `/pastagens/:id` | autenticado, sem query | HTTP 200, resposta do `ManejoPastoController.list` (envelope com `data.docs`); não é o erro "ID de pastagem inválido. Deve ser um UUID válido." que `PastoController` devolveria se `id` = "manejos" |
| GET /v1/rebanhos/manejos | [APP-GET-05] segmento fixo não cai em `/rebanhos/:id` | autenticado | HTTP 200, idem, não cai em `/rebanhos/:id` |
| GET /v1/rebanhos/movimentacoes | [APP-GET-06] segmento fixo não cai em `/rebanhos/:id` | autenticado | HTTP 200, idem |
| GET /v1/rebanhos/regimes-consumo | [APP-GET-07] segmento fixo não cai em `/rebanhos/:id` | autenticado | HTTP 200, idem — `regimeConsumoRoutes` precisa vir antes de `rebanhoRoutes` |
| GET /v1/insumos/movimentacoes | [APP-GET-08] segmento fixo não cai em `/insumos/:id` | autenticado; query `?atualizadoDesde=1970-01-01T00:00:00.000Z` (necessária porque `MovimentacaoInsumoService.list` recusa listar sem `insumoId` ou `atualizadoDesde`) | HTTP 200, idem, não cai em `/insumos/:id` — se caísse, o erro seria "ID de insumo inválido. Deve ser um UUID válido." (400 de formato), não o 200 de listagem real nem o 400 de "informe o insumo" |

## 401 com token inválido

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| GET /v1/propriedades | [APP-GET-09] sem header `Authorization` e sem cookie de sessão | rota protegida | HTTP 401, `tipo` = `unauthorized`; `recuperavel` = true; `message` = "Sessão inválida ou expirada. Faça login novamente." |
| GET /v1/propriedades | [APP-GET-10] `Authorization: Bearer token-invalido` | rota protegida | HTTP 401, mesma resposta do cenário anterior — `AuthMiddleware` chama `auth.api.getSession`, que devolve sessão nula para token não reconhecido pelo BetterAuth |
| GET /v1/propriedades | [APP-GET-11] bearer token de uma sessão revogada | sessão de A removida diretamente via Prisma (`session.deleteMany`) antes da requisição | HTTP 401, mesma resposta — qualquer rota autenticada reage igual, pois a checagem é feita pelo `AuthMiddleware` comum a todas; não há endpoint de revogação de sessão na API, então o teste apaga a sessão direto no banco para reproduzir "token que já foi válido, mas não é mais" |

## Bugs conhecidos

- Mensagem de rota inexistente: o middleware 404 chama `CommonResponse.error(res, 404, 'resourceNotFound', null, [{ message: 'Rota não encontrada.' }])` sem passar `customMessage`. Como o campo `field` é `null`, o template de mensagem produz `message` = "Recurso não encontrado em null." no envelope — o texto legível ("Rota não encontrada.") só existe em `errors[0].message`. Um teste de endpoint deve asserir sobre `errors[0].message`, não sobre `message`, para não ficar acoplado a esse texto acidental (não é um `it.fails`, é uma orientação de como testar).
- `GET /health` não segue o envelope `CommonResponse` — é a única rota do projeto que responde um JSON com forma própria (`{status, database, timestamp, uptime}`), sem `{message, data, errors}`. Comportamento intencional, não um bug.
