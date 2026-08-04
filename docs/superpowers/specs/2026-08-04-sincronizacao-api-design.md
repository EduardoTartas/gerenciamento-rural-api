# Sincronização offline-first — lado servidor

**Data:** 4 de agosto de 2026
**Escopo:** `gerenciamento-rural-api`
**Contexto:** primeira de três specs da refatoração de sincronização. As outras duas —
núcleo de sincronização no aplicativo e migração das features — vêm depois e consomem o
que está definido aqui.

---

## 1. Problema

A API foi desenhada como REST por recurso. O aplicativo é offline-first e acumula
mutações enquanto o produtor está sem sinal. Essa combinação produz três defeitos, todos
observados em uso real.

**Uma requisição por mutação.** Um produtor que passou o dia offline sincroniza dezenas de
lançamentos de uma vez. O rate limit da API é de 100 requisições por 15 minutos, e foi
atingido em uso normal no dia 3 de agosto.

**O cliente adivinha o destino da mutação.** A resposta de erro não diz se vale tentar de
novo, então o aplicativo decide pelo código HTTP. A regra era `statusCode >= 500`, o que
classificava 429 e 408 como recusa definitiva — exatamente os dois casos em que insistir é
a resposta certa. E a mensagem exibida ao produtor é extraída do corpo cru com expressão
regular, porque não há campo pronto para ler.

**A leitura baixa tudo, toda vez.** Cada abertura de tela pede a coleção inteira. É o outro
gerador de tráfego contra o mesmo rate limit.

Há ainda um defeito de modelo que só aparece quando se tenta sincronizar por diferença:
`manejoPasto` e `manejoRebanho` são excluídos com *hard delete*. A linha some do banco sem
deixar rastro, e o aplicativo mantém o registro para sempre — o produtor vê no histórico um
manejo que não existe mais.

## 2. Decisões

Tomadas em conversa, registradas aqui porque cada uma exclui alternativas razoáveis.

| # | Decisão | Alternativa descartada e por quê |
|---|---|---|
| D1 | Falha **por item, respeitando dependência** | *Tudo ou nada* travaria a fila inteira por causa de um cadastro inválido. *Por item sem dependência* devolveria 404 em cascata, escondendo a causa real |
| D2 | Idempotência por **id da mutação** | Confiar no UUID da entidade cobre `CREATE`, mas reaplicaria movimentação em reenvio |
| D3 | Delta entra **nesta spec** | Só a escrita deixaria metade do tráfego intacta |
| D4 | **Soft delete uniforme** nas entidades sincronizadas | Tombstones criariam uma segunda fonte de verdade sobre exclusão |
| D5 | Movimentação: **desfazer só a última** | Excluir do meio da cadeia deixa o histórico incoerente e não tem resposta correta |
| D6 | Regra duplicada nos dois lados, com **teste de equivalência** | Gerar Dart a partir do Zod não cobre regra que consulta o banco, que são justamente as que faltam |
| D7 | **Vitest** como runner | Jest exige flag experimental e `unstable_mockModule` em ESM puro |

Duas premissas do contexto: **o banco pode ser recriado do zero** (sem restrição de
migração retrocompatível) e **os endpoints REST por recurso continuam existindo** — o
aplicativo migra numa spec seguinte, e nada quebra no intervalo.

## 3. Arquitetura

```
POST /v1/sync
      │
      ▼
SyncController ──► SyncSchema (Zod)     valida o envelope, não o conteúdo
      │
      ▼
SyncService
      │  1. separa mutações já aplicadas          (idempotência)
      │  2. ordena por dependência do próprio lote (topológica)
      │  3. para cada mutação, em transação própria:
      │        despacha ao service de domínio existente
      │        grava o id em mutacaoAplicada
      │  4. marca dependentes de quem falhou como bloqueados
      ▼
resultado por item
```

O `SyncService` **não conhece regra de negócio**. Ele resolve ordem, dependência e
idempotência, e delega cada mutação ao service que já existe — `PastoService.create`,
`RebanhoService.update`, `MovimentacaoService.create`. Multi-tenancy, lotação conjunta e
ciclo de descanso continuam com dono único.

Uma mutação, uma transação. O lote **não** é atômico entre itens: é o que permite o
segundo pasto entrar mesmo com o primeiro recusado.

### 3.1 Despacho

Um mapa declarativo liga `(entidade, ação)` ao método do service:

Assinatura única — `({ entidadeId, dados, req })` — para o laço não precisar saber a ação:

```js
// src/service/sync/despacho.js
export const DESPACHO = {
  'pastos:CREATE': ({ entidadeId, dados, req }) =>
      pastoService.create({ ...dados, id: entidadeId }, req),
  'pastos:UPDATE': ({ entidadeId, dados, req }) =>
      pastoService.update(entidadeId, dados, req),
  'pastos:DELETE': ({ entidadeId, req }) =>
      pastoService.remove(entidadeId, req),
  // uma linha por par (entidade, ação)
};
```

Pares previstos: `propriedades`, `pastos`, `rebanhos`, `manejo_pastos`, `manejo_rebanhos`
com `CREATE`/`UPDATE`/`DELETE`, e `historico_movimentacoes` com `CREATE`/`DELETE` — não há
`UPDATE` de movimentação, pela mesma razão da seção 7.

Par fora do mapa: mutação recusada com `tipo: 'validationError'` e mensagem nomeando o par.
Acrescentar uma entidade é acrescentar linhas aqui, não escrever um handler.

## 4. Contrato

### 4.1 Requisição

```jsonc
POST /v1/sync
{
  "mutacoes": [
    {
      "id": "f1a2b3c4-...",      // uuid do item na fila; chave de idempotência
      "entidade": "pastos",
      "acao": "CREATE",           // CREATE | UPDATE | DELETE
      "entidadeId": "aa11...",    // uuid da entidade, gerado no aparelho
      "dependeDe": null,          // id de OUTRA mutação deste mesmo lote
      "dados": { "propriedadeId": "...", "nome": "Piquete Fundo", "extensaoHa": 8.5 }
    }
  ]
}
```

- **`id` é da mutação, não da entidade.** É o que torna o reenvio seguro: duas edições do
  mesmo pasto são mutações distintas e ambas devem ser aplicadas.
- **`dependeDe` referencia uma mutação do lote.** O servidor monta o grafo dentro do
  próprio payload, sem consultar o banco nem adivinhar. A fila do aplicativo já tem o campo
  equivalente (`dependsOnEntityId`).
- **`dados` é o mesmo corpo que o endpoint REST individual aceita.** Nenhum schema novo por
  entidade: o Zod que já existe valida.

Regras de preenchimento por ação, para não sobrar interpretação:

| Ação | `entidadeId` | `dados` |
|---|---|---|
| `CREATE` | obrigatório — é o uuid gerado no aparelho | obrigatório, **sem** o campo `id`: quem manda é `entidadeId` |
| `UPDATE` | obrigatório — identifica o alvo | obrigatório, só os campos alterados |
| `DELETE` | obrigatório | **ausente**; se vier, é ignorado |

`entidadeId` é a fonte única do identificador. O `id` dentro de `dados` é rejeitado no
`CREATE` para não existirem dois lugares dizendo a mesma coisa — que é a origem de
divergência silenciosa quando eles discordam.

Limite de **100 mutações por lote**, alinhado ao teto de paginação. Acima disso, `400`.

### 4.2 Resposta

Sempre `200`, mesmo com recusas. O status HTTP fala do lote, não das mutações.

```jsonc
{
  "message": "3 de 4 mutações aplicadas.",
  "data": {
    "resultados": [
      { "id": "f1a2...", "situacao": "aceito", "entidade": "pastos", "entidadeId": "aa11...",
        "dados": { /* registro como ficou no servidor */ } },

      { "id": "b2c3...", "situacao": "recusado", "entidade": "pastos", "entidadeId": "bb22...",
        "erro": { "tipo": "conflict", "campo": "nome",
                  "mensagem": "Já existe uma pastagem com este nome nesta propriedade.",
                  "recuperavel": false } },

      { "id": "c3d4...", "situacao": "bloqueado", "entidade": "rebanhos", "entidadeId": "cc33...",
        "bloqueadoPor": "b2c3..." }
    ]
  },
  "errors": []
}
```

Se o lote voltasse `4xx`, o interceptor do Dio trataria como falha de transporte e o
aplicativo descartaria o resultado dos itens que **entraram**. Resultado por item é dado
útil, não erro.

| `situacao` | Significado | O que o aplicativo faz |
|---|---|---|
| `aceito` | Aplicado, ou já estava por idempotência | remove da fila |
| `recusado` | O servidor não aceita este dado | move para a folha de pendências, com campo e mensagem |
| `bloqueado` | Não foi tentado; depende de algo que falhou | **permanece na fila**, sem gastar tentativa |

`bloqueado` é o que evita o ruído de 404 em cascata.

### 4.3 Envelope inválido

`400` quando o problema é de construção do cliente, não de dado: mais de 100 mutações,
`dependeDe` apontando para mutação ausente do lote, ciclo de dependência, ou `entidade`
desconhecida.

## 5. Idempotência

```prisma
model mutacaoAplicada {
  id          String   @id            // uuid da mutação, vindo do aplicativo
  usuarioId   String
  entidade    String
  entidadeId  String
  resultado   Json                    // o que foi devolvido na primeira vez
  aplicadaEm  DateTime @default(now())

  @@index([usuarioId, aplicadaEm])
}
```

O registro é gravado **dentro da mesma transação** da mutação. É isso que torna a garantia
real: ou os dois entram, ou nenhum. Num reenvio, o servidor devolve `resultado` sem
reexecutar, e a resposta é idêntica à primeira.

Retenção de **30 dias**. A limpeza roda no próprio `POST /v1/sync`, apagando o que passou
da janela para o usuário da requisição — sem agendador, sem processo à parte. A tabela só
cresce quando há sincronização, então a limpeza acontece exatamente quando precisa. A
janela real de reenvio é de minutos; 30 dias é folga confortável.

`usuarioId` fica como coluna indexada sem relação declarada, seguindo o que `session` e
`account` já fazem no schema — a tabela é operacional, não de domínio, e não deve
participar de cascata de exclusão do usuário.

## 6. Delta

`?atualizadoDesde=<ISO 8601>` nas listagens, com `@@index([propriedadeId, updatedAt])`.

O delta só funciona se **toda mudança deixar rastro**. Hoje não deixa:

| Tabela | `updatedAt` | Exclusão | Situação |
|---|---|---|---|
| `propriedade`, `pasto`, `rebanho` | sim | soft (`ativo`) | funciona |
| `manejoPasto`, `manejoRebanho` | sim | **hard delete** | quebrado |
| `historicoMovimentacao` | **não** | não havia exclusão | sem carimbo; ganha exclusão na seção 7 |

### 6.1 Mudanças de modelo

1. **`ativo` em `manejoPasto` e `manejoRebanho`.** Exclusão vira soft delete, e o delta
   devolve o registro com `ativo: false` para o aplicativo remover localmente. Nenhum
   mecanismo novo: é o que propriedade, pasto e rebanho já fazem.
2. **`ativo` e `updatedAt` em `historicoMovimentacao`.** Ver seção 7.
3. **`@@index([propriedadeId, updatedAt])`** nas entidades de propriedade, e
   `@@index([updatedAt])` nos catálogos globais.

Com isso o motor de delta fica **uniforme**: nenhuma entidade precisa de tratamento
especial em nenhum dos dois lados.

Alternativa descartada: **tabela de tombstones**. Mais genérica e não exige tocar nas
tabelas de domínio, mas cria um segundo lugar onde a exclusão mora, e o aplicativo teria
que reconciliar duas fontes.

### 6.2 Carimbo por entidade

O aplicativo guarda um carimbo **por coleção**, não um global, e só avança quando a página
inteira foi persistida. Um carimbo global avançaria mesmo com uma coleção falhando, e os
registros daquela janela nunca mais seriam pedidos.

Isso é regra do lado do aplicativo, registrada aqui porque é o que dá sentido ao parâmetro.

## 7. Desfazer a última movimentação

Movimentação não é cadastro: é evento que **produziu efeito**. Ao ser criada, alterou
`rebanho.pastoAtualId`, o `status` dos pastos de origem e destino, e `dataUltimaSaida`.
Apagar a linha não desfaz nada disso, e apagar uma do meio da cadeia deixa o histórico
incoerente — o lote apareceria num pasto onde nunca entrou.

```
DELETE /v1/rebanhos/movimentacoes/:id
```

Só aceita se for a **última** daquele rebanho. Em transação:

1. marca `ativo: false`;
2. devolve `rebanho.pastoAtualId` ao pasto de origem da movimentação desfeita;
3. recalcula o `status` dos dois pastos **contando rebanhos ativos**, não lendo o campo
   `status` — que é cache e já esteve comprovadamente defasado (lição do G11);
4. restaura `dataUltimaSaida` conforme o estado anterior.

Não sendo a última: `409` com `tipo: 'conflict'` e mensagem indicando qual é. A mesma trava
existe no aplicativo e entra no conjunto de casos de equivalência.

## 8. Contrato de erro

Duas mudanças no envelope, que hoje tem `errorType`, `field`, `details[]` e
`customMessage`.

**Valores fechados para `tipo`.** Hoje `validationError` cobre validação, conflito e rate
limit, e o cliente não distingue.

| `tipo` | HTTP | Significado | `recuperavel` |
|---|---|---|---|
| `validationError` | 400 | Dado malformado | `false` |
| `conflict` | 409 | Viola unicidade ou estado | `false` |
| `notFound` | 404 | Referência não existe | `false` |
| `forbidden` | 403 | Não é dono do recurso | `false` |
| `unauthorized` | 401 | Sessão inválida | **`true`** |
| `rateLimit` | 429 | Volume | **`true`** |
| `serverError` | 5xx | Falha do servidor | **`true`** |

**`recuperavel` explícito.** É o campo que elimina a heurística. O aplicativo decidia o
destino da mutação pelo `statusCode`, e foi assim que 429 e 408 viraram falha permanente.
Com o servidor declarando, o cliente obedece em vez de adivinhar.

`unauthorized` é `true` de propósito: sessão expirada não é culpa do dado. Isso também
remove a primeira das quatro armadilhas mapeadas para o rollback (G13) — um 401 tratado
como permanente reverteria o trabalho do produtor a cada sessão vencida.

O campo `mensagem` passa a ser o texto pronto para exibir. Hoje o aplicativo guarda
`response.data.toString()` e extrai a frase com expressão regular.

## 9. Validação em duas camadas

Recusa do servidor deve ser **exceção, não caminho normal**. Se o aplicativo tem os dados
localmente, ele valida antes de enfileirar — o produtor vê o erro na hora, offline, com o
formulário ainda aberto.

| Regra | Hoje |
|---|---|
| Nome único de pasto e de rebanho por propriedade | só no servidor — **falta no app** |
| Propriedade inativa não recebe pasto | só no servidor — **falta no app** |
| Rebanho inativo não recebe manejo | só no servidor — **falta no app** |
| Desfazer só a última movimentação | regra nova — os dois lados |
| Pasto com rebanho não pode ser excluído | já nos dois (G9) |
| Lotação conjunta exige confirmação | já nos dois (G11) |
| Formato `"Cidade,UF"` | já nos dois |

O servidor continua validando tudo — não por redundância, mas porque enxerga o que o
aparelho não pode: dois aparelhos offline criando o mesmo nome, cache local desatualizado,
estado global.

**A duplicação é decisão, não defeito** — e por isso é verificada. Um arquivo de casos
alimenta as duas implementações:

```jsonc
// contrato/casos_de_regra.json  (na raiz do monorepo, lido pelos dois repositórios)
{
  "nomeUnicoPasto": [
    { "descricao": "nome já usado na mesma propriedade",
      "existentes": [{ "nome": "Piquete Norte", "propriedadeId": "p1", "ativo": true }],
      "entrada":    { "nome": "Piquete Norte", "propriedadeId": "p1" },
      "esperado":   "recusa" },
    { "descricao": "mesmo nome em outra propriedade é permitido",
      "existentes": [{ "nome": "Piquete Norte", "propriedadeId": "p1", "ativo": true }],
      "entrada":    { "nome": "Piquete Norte", "propriedadeId": "p2" },
      "esperado":   "aceita" },
    { "descricao": "nome de pasto inativo pode ser reaproveitado",
      "existentes": [{ "nome": "Piquete Norte", "propriedadeId": "p1", "ativo": false }],
      "entrada":    { "nome": "Piquete Norte", "propriedadeId": "p1" },
      "esperado":   "aceita" }
  ]
}
```

Divergiu entre Zod e Dart, um dos dois runners quebra.

## 10. Testes

Runner: **Vitest**, com `@vitest/coverage-v8`. ESM nativo, sem flag experimental. Fecha o
**C10a**, último item crítico aberto do relatório de auditoria.

| Camada | O que prova |
|---|---|
| Casos de regra compartilhados | Mesmo veredito em Zod e em Dart |
| `SyncService` | Ordem topológica; cascata de bloqueio; ciclo recusado; entidade desconhecida; lote acima de 100 |
| Idempotência | Mesmo lote duas vezes produz um efeito e duas respostas idênticas |
| Contrato de erro | Cada `tipo` sai com o HTTP e o `recuperavel` corretos |
| Delta | Alterado aparece; `ativo: false` aparece; nada fora da janela |
| Desfazer movimentação | Última desfaz e restaura estado derivado; do meio recusa com 409 |
| Services de domínio | Multi-tenancy, transação, conflito, reativação — o que a issue #13 pedia |
| Ponta a ponta | `POST /v1/sync` contra a API em Docker com Postgres real, via `fetch`, como as 37 asserções do fluxo de rebanho |

## 11. O que esta spec deliberadamente não faz

- **Não implementa rollback (G13).** Reverter a alteração local quando o servidor recusa em
  definitivo é problema do lado do aplicativo e tem quatro armadilhas mapeadas. Esta spec
  resolve uma delas (`unauthorized` recuperável) e deixa o resto para depois.
- **Não torna o lote assíncrono.** Nada de `202 Accepted` com polling: o aplicativo passaria
  a ter duas filas para reconciliar e o produtor esperaria mais para ver o resultado.
- **Não mexe no modelo de dados além do necessário para o delta.** `ativo` e `updatedAt`
  onde faltam, índices, e a tabela de idempotência. Nada mais.
- **Não remove os endpoints REST por recurso.** Eles continuam sendo a via individual, e o
  aplicativo migra numa spec seguinte.
- **Não implementa o módulo de estoque, dieta e autonomia (RF06-08).** Escopo à parte.

## 12. Rastreabilidade com o relatório de auditoria

| Item | Como esta spec o trata |
|---|---|
| **C10a / C17** | API ganha suíte de testes — fecha o último crítico aberto |
| **I2 / G15** | Lote e delta atacam o rate limit pelos dois lados |
| **I28** | `tipo` com valores fechados |
| **G13** (parcial) | `unauthorized` recuperável remove a primeira armadilha |
| **G16** | Casos de regra compartilhados são a forma verificável de replicar as travas |
| **D5** | As decisões da seção 2 são o material para a monografia |

## 13. Critério de aceite

1. `POST /v1/sync` aplica um lote misto e devolve `aceito`, `recusado` e `bloqueado`
   corretamente, com a cascata de bloqueio funcionando.
2. O mesmo lote enviado duas vezes produz um efeito e duas respostas idênticas.
3. `?atualizadoDesde=` devolve o que mudou, incluindo `ativo: false`, e nada fora da janela.
4. Desfazer a última movimentação restaura `pastoAtualId`, `status` dos dois pastos e
   `dataUltimaSaida`; desfazer uma do meio devolve `409`.
5. Todo erro sai com `tipo` fechado e `recuperavel` coerente.
6. Os casos de `casos_de_regra.json` passam no runner da API.
7. `npm test` verde, com relatório de cobertura.
8. A API em Docker responde ao fluxo completo de um lote real.
