# Sincronização offline-first — como funciona

O Pasto Livre atende pecuaristas em regiões de conectividade intermitente. O
aplicativo opera **offline-first**: todo cadastro, edição e exclusão acontece
primeiro no aparelho, sem depender de sinal. Este documento explica como a API
sustenta esse modelo — não é referência de endpoint (isso está em
`rotas/rotas_pastolivre.md`, seção 10), é a visão de conjunto de por que cada
peça existe e como elas se encaixam.

---

## O problema

Antes desta implementação, cada ação do produtor virava uma requisição HTTP
imediata. Um dia inteiro offline significava dezenas de requisições
acumuladas para disparar de uma vez ao reconectar — e o rate limit da API
(100 requisições / 15 minutos) foi atingido em uso normal. Além disso:

- Toda tela aberta pedia a coleção inteira de novo, mesmo sem nada ter mudado.
- Excluir um manejo apagava a linha do banco — o aplicativo nunca ficava
  sabendo, e o produtor via no histórico local um lançamento que já não existe
  no servidor.
- O cliente decidia se valia a pena tentar de novo só pelo código HTTP
  (`>= 500`), regra que classificava `429` (rate limit) e `408` (timeout) como
  recusa definitiva — exatamente os dois casos em que insistir é a resposta
  certa.

A solução tem quatro peças, cada uma resolvendo um desses pontos.

---

## 1. Contrato de erro tipado

Toda resposta de erro da API — não só do lote — carrega dois campos novos
além da mensagem:

```json
{ "message": "...", "data": null, "errors": [...], "tipo": "conflict", "recuperavel": false }
```

`recuperavel` responde a uma pergunta só: **vale a pena tentar de novo?** O
servidor declara; o cliente obedece, em vez de adivinhar pelo status HTTP.

| `tipo`                       | HTTP | `recuperavel` |
|-------------------------------|------|----------------|
| `validationError`              | 400  | não            |
| `unauthorized`                 | 401  | **sim** (sessão expirada não é culpa do dado) |
| `tokenExpired`                 | 401  | sim            |
| `authError`                    | 401  | sim            |
| `forbidden`                    | 403  | não            |
| `notFound` / `resourceNotFound`| 404  | não            |
| `recordNotFound` (Prisma)      | 404  | não            |
| `conflict`                     | 409  | não            |
| `uniqueConstraintViolation`    | 409  | não            |
| `foreignKeyViolation`          | 409  | não            |
| `rateLimit`                    | 429  | **sim**        |
| `databaseError`                | 500  | **sim**        |
| `operationalError`             | 500  | sim            |
| `serverError` (padrão)         | 500  | sim            |

Fonte: `src/utils/helpers/tiposDeErro.js`. Um detalhe que já causou bug real:
falhas do Prisma que não são erro de dado — conflito de escrita (`P2034`),
esgotamento do pool de conexão (`P2024`) — são tratadas como `databaseError`
(recuperável), não como `validationError`. Toda mutação do lote roda dentro de
`$transaction`, exatamente onde esse tipo de falha transitória aparece; se
fosse classificada como definitiva, o cliente **descartaria** um lançamento
válido em vez de reenviá-lo.

---

## 2. Leitura por diferença (delta)

Toda listagem aceita `?atualizadoDesde=<ISO 8601>`. Em vez de pedir a coleção
inteira, o app pede só o que mudou desde a última sincronização.

A regra decisiva: **com `atualizadoDesde` presente, o filtro de `ativo` sai**.
Sem isso, um registro excluído (soft-delete) nunca apareceria na resposta, e o
app nunca saberia que precisa apagar a cópia local — voltaria a mostrar um
lançamento fantasma, o mesmo problema de antes, só que mascarado.

```
GET /pastagens?propriedadeId=<id>&atualizadoDesde=2026-08-04T20:00:00.000Z
```

Isso só funciona porque, para o delta fazer sentido, **toda mudança precisa
deixar rastro**:

- `pastos`, `propriedades`, `rebanhos`, `manejo_pastos`, `manejo_rebanhos` e
  `historico_movimentacoes` ganharam `updatedAt` e `ativo` onde faltava
  (índices `(chave_de_posse, updatedAt)` para a consulta não varrer a tabela
  inteira).
- `DELETE` em manejo e movimentação virou exclusão lógica (`ativo: false`),
  nunca `DELETE` de verdade — a linha continua existindo para o delta poder
  reportá-la.
- O `select` de cada listagem inclui `ativo` e `updatedAt` no retorno — sem
  isso o cliente recebe a linha mas não consegue distinguir "ainda existe" de
  "foi excluída", e acaba ressuscitando localmente algo que devia estar
  apagado. (Esse foi um bug real, pego só na revisão final do plano inteiro,
  não em nenhuma revisão de task isolada.)

---

## 3. Desfazer a última movimentação

Movimentação não é cadastro — é evento que produziu efeito: mudou
`rebanho.pastoAtualId`, o `status` dos dois pastos e `dataUltimaSaida`. Apagar
a linha não desfaz nada disso, então `DELETE /rebanhos/movimentacoes/:id`
existe como operação própria, com duas travas:

- **Só a última movimentação do rebanho pode ser desfeita.** Desfazer uma do
  meio deixaria o histórico dizendo que o lote saiu de A para B e depois
  apareceu em C sem nunca ter ido para lá. Essa checagem é refeita **dentro**
  da transação de reversão (não só antes dela) — um `DELETE` que chegasse ao
  mesmo tempo que uma movimentação nova para o mesmo rebanho não pode reverter
  em cima de um estado que já mudou debaixo dele.
- **O status do pasto é recalculado contando rebanhos ativos, nunca lendo o
  campo `status` em si.** Esse campo é cache e já esteve comprovadamente
  defasado em produção — usá-lo para decidir teria reintroduzido o mesmo bug.

---

## 4. O endpoint de lote — `POST /sync`

É aqui que as três peças acima se juntam. Em vez de uma requisição por
mutação, o app manda até 100 de uma vez:

```json
{
  "mutacoes": [
    { "id": "<uuid-da-mutação>", "entidade": "pastos", "acao": "CREATE",
      "entidadeId": "<uuid-do-pasto>", "dados": { "nome": "Piquete Novo" } },
    { "id": "<uuid-da-mutação>", "entidade": "rebanhos", "acao": "CREATE",
      "entidadeId": "<uuid-do-rebanho>", "dependeDe": "<id-da-mutação-do-pasto>",
      "dados": { "pastoAtualId": "<uuid-do-pasto>", "nomeRebanho": "Lote 4" } }
  ]
}
```

### Ordem por dependência

`dependeDe` referencia **outra mutação do mesmo lote**, nunca uma entidade do
banco — o grafo de dependência inteiro vem no payload, o servidor não
consulta nada para descobrir relação. Antes de aplicar, o servidor faz uma
ordenação topológica (`src/service/sync/grafoDeDependencia.js`) para garantir
que o pasto entre antes do rebanho que aponta para ele, não importa a ordem em
que o app mandou. Ciclo ou dependência para fora do lote derruba a requisição
inteira com `400` — nesse caso nenhuma mutação chega a ser tentada, porque é
erro de construção do lote, não de dado.

### Falha por item, não por lote

Cada mutação roda na sua própria transação. **O lote não é atômico entre
itens** — de propósito: se a primeira mutação falhar (nome duplicado, por
exemplo), as independentes ainda entram. Travar a fila inteira por causa de um
cadastro inválido seria pior do que aplicar o que dá certo.

Quando uma mutação é recusada, toda mutação que dependia dela — direta ou
indiretamente — sai como `bloqueado`, não como recusada nem tentada:

```json
{ "id": "...", "situacao": "bloqueado", "entidade": "rebanhos", "bloqueadoPor": "<id-da-mutação-do-pasto>" }
```

Isso existe porque o rebanho aponta para um pasto que não chegou a existir —
tentá-lo devolveria um 404 confuso, escondendo a causa real (o pasto recusado)
atrás de um erro sem relação aparente. `bloqueado` não é falha permanente: o
app reenvia essas mutações depois, quando o produtor corrigir o que causou a
recusa original.

### Validação por entidade

`dados` **não** é um corpo livre. Antes do despacho, cada mutação é validada
contra o mesmo schema Zod que a rota REST equivalente usa (`pastos:UPDATE` →
o schema de `PATCH /pastagens/:id`), com a mesma rejeição de campos fora do
schema e a mesma coerção de tipos. Isso existe porque a alternativa —
repassar `dados` direto ao Prisma — permitiria, por exemplo, um
`pastos:UPDATE` carregando `propriedadeId` e movendo o pasto para a fazenda de
outro usuário: o service só valida a posse do recurso *atual*, não os campos
sendo escritos. A validação por schema fecha esse buraco sem duplicar regra
de negócio — reaproveita o schema que já existe.

### Idempotência

O app reenvia o lote quando a resposta se perde — cenário comum em sinal
ruim, o caso de uso central do sistema. Sem tratamento, isso aplicaria a
mesma movimentação duas vezes.

A chave é o **id da mutação**, não o da entidade — duas edições do mesmo
pasto são mutações distintas e ambas devem ser aplicadas; confiar no id da
entidade cobriria `UPDATE` mas deixaria uma `CREATE` reenviada ser tentada de
novo. O registro (`mutacaoAplicada`) é gravado na mesma transação da
mutação: ou os dois entram, ou nenhum. Registros com mais de 30 dias são
limpos automaticamente a cada chamada do endpoint — sem agendador, sem
processo à parte.

### Resposta

**Sempre HTTP 200**, mesmo com recusas — o status HTTP fala do transporte do
lote, não do resultado de cada item. Um `4xx` faria o interceptor do app
descartar o resultado das mutações que *entraram* junto com as que falharam.

```json
{
  "message": "1 de 2 mutações aplicadas.",
  "data": { "resultados": [
    { "id": "...", "situacao": "aceito", "entidade": "pastos", "entidadeId": "...", "dados": { "...": "..." } },
    { "id": "...", "situacao": "bloqueado", "entidade": "rebanhos", "entidadeId": "...", "bloqueadoPor": "..." }
  ] },
  "errors": []
}
```

`resultados` vem na mesma ordem em que o app enviou (não na ordem de
execução), um item por mutação, com `situacao` sendo `aceito`, `recusado` ou
`bloqueado`.

### Quem decide o quê

O `SyncService` (`src/service/SyncService.js`) **não reimplementa nenhuma
regra de negócio**. O trabalho dele é só: ordenar, checar idempotência,
validar o envelope, montar a cascata de bloqueio e despachar. Cada mutação é
delegada ao service de domínio que já existia antes deste plano
(`PastoService`, `RebanhoService` etc., via `src/service/sync/despacho.js`) —
multi-tenancy, unicidade de nome, lotação conjunta e toda regra específica de
cada entidade continuam com dono único, sem duplicação.

---

## Limitação conhecida

A escrita da entidade (dentro do service de domínio) e o registro de
idempotência não compartilham a mesma conexão de transação de fato — os
services de domínio usam sua própria conexão Prisma, não recebem a `tx` que o
`SyncService` abre. Numa janela muito estreita (queda exatamente entre a
escrita da entidade e o registro), um reenvio pode reexecutar a mutação. Na
prática o risco é baixo: `CREATE` com id gerado pelo cliente falha por
violação de unicidade no reenvio (rejeição visível, não corrupção
silenciosa); `UPDATE`/`DELETE` já são idempotentes por natureza. Aceito como
limitação conhecida para o escopo deste projeto.

---

## Entidades e ações suportadas

| Entidade                  | CREATE | UPDATE | DELETE |
|----------------------------|:---:|:---:|:---:|
| `propriedades`             | ✅  | ✅  | ✅  |
| `pastos`                   | ✅  | ✅  | ✅  |
| `rebanhos`                 | ✅  | ✅  | ✅  |
| `manejo_pastos`            | ✅  | ✅  | ✅  |
| `manejo_rebanhos`          | ✅  | ✅  | ✅  |
| `historico_movimentacoes`  | ✅  | ❌  | ✅  |

`historico_movimentacoes` não aceita `UPDATE`: movimentação é evento que já
produziu efeito, corrigir significa desfazer a última (`DELETE`) ou lançar
outra, nunca editar a que já aconteceu.

---

## Onde ler o código

| Peça | Arquivo |
|---|---|
| Contrato de erro | `src/utils/helpers/tiposDeErro.js` |
| Grafo de dependência | `src/service/sync/grafoDeDependencia.js` |
| Despacho por entidade | `src/service/sync/despacho.js` |
| Validação por entidade | `src/service/sync/validacao.js` |
| Laço do lote | `src/service/SyncService.js` |
| Registro de idempotência | `src/repository/MutacaoAplicadaRepository.js` |
| Envelope da requisição | `src/utils/validators/schemas/zod/SyncSchema.js` |
| Rota | `src/controllers/SyncController.js`, `src/routes/syncRoutes.js` |
| Referência de endpoint | `rotas/rotas_pastolivre.md`, seção 10 |
| Casos de regra compartilhados com o app | `contrato/casos_de_regra.json` |
| Verificação ponta a ponta | `test/e2e/lote.e2e.js` (`npm run test:e2e`, API em Docker) |
