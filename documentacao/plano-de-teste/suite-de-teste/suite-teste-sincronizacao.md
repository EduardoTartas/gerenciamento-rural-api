# Plano de Teste para Endpoints de Sincronização

Rota única de sincronização em lote (`POST /sync`) usada pelo app offline-first: recebe um lote de
mutações, resolve dependências entre elas, valida cada uma com o schema Zod do REST equivalente,
despacha ao service de domínio dentro de uma transação e garante idempotência por `id` de mutação.
Fonte técnica: `documentacao/testes/sync/sync.md`. Suíte automatizada: `test/endpoints/sync/`
(dividida em vários arquivos, um por subseção abaixo).

## POST /v1/sync

`POST /sync` é a única rota cujo status HTTP de sucesso (200) não reflete o resultado de cada
item — cada mutação do lote tem sua própria `situacao` (`aceito`, `recusado`, `bloqueado`) dentro
de `data.resultados`. As tabelas abaixo descrevem, além do status HTTP da requisição, a
`situacao` esperada por mutação.

### Envelope

Arquivo: `test/endpoints/sync/post-sync-envelope.test.js`

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/sync | [SYNC-POST-01] lote bem formado com uma mutação | A autenticado; 1 mutação `pastos:CREATE` válida | HTTP 200, envelope; `data.resultados` com 1 item, `situacao: aceito` |
| POST /v1/sync | [SYNC-POST-02] `mutacoes` vazio | A; `{ mutacoes: [] }` | HTTP 400, mensagem "Envie ao menos uma mutação."; `tipo` `validationError`; `errors[0].path` = `mutacoes` |
| POST /v1/sync | [SYNC-POST-03] mais de 100 mutações no lote | A; 101 mutações | HTTP 400, mensagem cita o teto de `MAXIMO_DE_MUTACOES` (100) |
| POST /v1/sync | [SYNC-POST-04] `acao` fora de `CREATE`/`UPDATE`/`DELETE` | A; mutação com `acao: "UPSERT"` | HTTP 400, mensagem "A ação deve ser CREATE, UPDATE ou DELETE." |
| POST /v1/sync | [SYNC-POST-05] `id` da mutação não é UUID | A; mutação com `id: "abc"` | HTTP 400, mensagem "O id da mutação deve ser um UUID válido." |
| POST /v1/sync | [SYNC-POST-06] `entidadeId` não é UUID | A; mutação com `entidadeId: "abc"` | HTTP 400, mensagem "O id da entidade deve ser um UUID válido." |
| POST /v1/sync | [SYNC-POST-07] campo extra na mutação (`.strict()`) | A; mutação com campo desconhecido no nível raiz | HTTP 400, `tipo` `validationError` |
| POST /v1/sync | [SYNC-POST-08] corpo vazio (`{}`) | A; `{}` | HTTP 400, Zod recusa por `mutacoes` ausente/obrigatório |
| POST /v1/sync | [SYNC-POST-09] `CREATE` sem `dados` | A; mutação `CREATE` sem o campo `dados` | HTTP 400, mensagem "CREATE e UPDATE exigem o campo dados." |
| POST /v1/sync | [SYNC-POST-10] `UPDATE` sem `dados` | A; mutação `UPDATE` sem o campo `dados` | HTTP 400, mesma mensagem de SYNC-POST-09 |
| POST /v1/sync | [SYNC-POST-11] `DELETE` sem `dados` é aceito pelo envelope | A; mutação `DELETE` sem `dados` | HTTP 200, envelope válido passa a fase de schema (a mutação em si ainda pode ser recusada por regra de domínio) |
| POST /v1/sync | [SYNC-POST-12] `id` dentro de `dados` é recusado | A; mutação `CREATE`/`UPDATE` com `dados.id` presente | HTTP 400, mensagem "O identificador vem em entidadeId; não repita `id` dentro de dados." |
| POST /v1/sync | [SYNC-POST-13] `dependeDe` com formato inválido (não UUID, não nulo) | A; mutação com `dependeDe: "abc"` | HTTP 400, erro de validação Zod aponta `dependeDe` |
| POST /v1/sync | [SYNC-POST-14] falha de envelope recusa a requisição inteira | A; lote com 2 mutações, uma delas com erro de schema | HTTP 400, nenhuma das mutações — nem a válida — aparece em `mutacaoAplicada` no banco; `SyncLoteSchema.parse` roda no controller, antes do service |

### Ordenação e dependência (grafo)

Arquivo: `test/endpoints/sync/post-sync-dependencias.test.js`

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/sync | [SYNC-POST-15] mutações independentes mantêm a ordem de envio na resposta | A; 3 mutações sem `dependeDe` | HTTP 200, `data.resultados` na mesma ordem em que foram enviadas (não na ordem de execução) |
| POST /v1/sync | [SYNC-POST-16] dependente é aplicado depois do predecessor mesmo enviado antes dele | A; mutação de rebanho enviada antes da mutação do pasto do qual depende (`dependeDe`) | HTTP 200, pasto é criado no banco antes do rebanho (ordenação topológica reordena a execução); ambos `aceito`; resposta preserva a ordem de envio, não a de execução |
| POST /v1/sync | [SYNC-POST-17] cadeia de três níveis é resolvida (pasto → rebanho → manejo) | A; manejo depende do rebanho, que depende do pasto, enviados fora de ordem | HTTP 200, os três `aceito`; registros no banco existem com as referências corretas |
| POST /v1/sync | [SYNC-POST-18] `dependeDe` aponta para fora do lote | A; mutação com `dependeDe` de um UUID que não está entre as mutações enviadas | HTTP 400, lote inteiro recusado; mensagem cita a mutação e o id ausente; nenhuma mutação chega a ser tentada (nenhum registro em `mutacaoAplicada`) |
| POST /v1/sync | [SYNC-POST-19] ciclo direto de dependência (A depende de B, B depende de A) | A; 2 mutações que se referenciam mutuamente | HTTP 400, mensagem cita "ciclo"; nenhuma mutação tentada |
| POST /v1/sync | [SYNC-POST-20] ciclo indireto de três mutações | A; A depende de B, B depende de C, C depende de A | HTTP 400, mesma recusa de lote inteiro |

### Resultados por mutação — bloqueio em cascata

Arquivo: `test/endpoints/sync/post-sync-dependencias.test.js`

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/sync | [SYNC-POST-21] mutação recusada bloqueia quem depende dela | A; pasto com nome duplicado (recusa por conflito) e rebanho que `dependeDe` esse pasto | HTTP 200, pasto `situacao: recusado`, `data.resultados[].erro.tipo: conflict`; rebanho `situacao: bloqueado`, `bloqueadoPor` = id da mutação do pasto; rebanho não é criado no banco |
| POST /v1/sync | [SYNC-POST-22] bloqueio se propaga em cadeia (recusa no nível 1 bloqueia níveis 2 e 3) | A; pasto recusado, rebanho depende do pasto, manejo depende do rebanho | HTTP 200, pasto `recusado`; rebanho e manejo ambos `bloqueado`, ambos com `bloqueadoPor` apontando (direta ou indiretamente) para a causa raiz |
| POST /v1/sync | [SYNC-POST-23] mutação independente entra mesmo com outra recusada no mesmo lote | A; duas mutações `pastos:CREATE` sem relação entre si, uma delas recusada | HTTP 200, a recusada sai `recusado`; a outra sai `aceito` e existe no banco |

### Idempotência

Arquivo: `test/endpoints/sync/post-sync-idempotencia.test.js`

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/sync | [SYNC-POST-24] reenvio do mesmo `id` de mutação já aceita devolve o resultado gravado, sem duplicar | A; enviar o mesmo lote (mesmo `id` de mutação) duas vezes seguidas | HTTP 200 (nas duas chamadas), segunda resposta tem `situacao: aceito` idêntica à primeira; no banco, só existe um registro da entidade criada (sem duplicata); a mutação não é reexecutada no segundo envio (efeito colateral não se repete) |
| POST /v1/sync | [SYNC-POST-25] idempotência é escopada por usuário | A cria mutação com `id` = X; B envia uma mutação com o mesmo `id` X (colisão) | HTTP 200, resultado de B deveria ser processado como nova mutação, sem reaproveitar o registro de idempotência de A **(bug conhecido — ver Divergências)** |
| POST /v1/sync | [SYNC-POST-26] registro de idempotência expira após a janela de retenção | A; mutação aplicada há mais de 30 dias (inserir diretamente via Prisma com `aplicadaEm` antigo) e reenviada com o mesmo `id` | HTTP 200, a limpeza (`limparAntigas`) deveria remover o registro antigo antes da checagem, tratando o reenvio como mutação nova, não idempotente **(bug conhecido — ver Divergências)** |

### Validação por entidade (schema do REST reaproveitado)

Arquivo: `test/endpoints/sync/post-sync-validacao.test.js`

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/sync | [SYNC-POST-27] `pastos:UPDATE` com `propriedadeId` no corpo é recusado | A; mutação `UPDATE` de um pasto de A, `dados.propriedadeId` de outra propriedade | HTTP 200 (mutação `recusado`), `data.resultados[].erro.tipo: validationError`; `erro.campo` cita `propriedadeId`; `erro.recuperavel === false`; no banco, o pasto não muda de propriedade |
| POST /v1/sync | [SYNC-POST-28] `rebanhos:UPDATE` com `propriedadeId` é recusado | A; mesmo padrão de SYNC-POST-27 para rebanho | HTTP 200 (`recusado`), mesma forma de erro |
| POST /v1/sync | [SYNC-POST-29] `manejo_pastos:UPDATE` com `pastoId` é recusado | A | HTTP 200 (`recusado`), mesma forma de erro |
| POST /v1/sync | [SYNC-POST-30] `manejo_rebanhos:UPDATE` com `rebanhoId` é recusado | A | HTTP 200 (`recusado`), mesma forma de erro |
| POST /v1/sync | [SYNC-POST-31] campo desconhecido gera mensagem em português, sem termos do Zod | A; qualquer mutação com campo fora do schema | HTTP 200 (`recusado`), `erro.mensagem` no formato "Campo não aceito em `<entidade>`: `<campos>`."; não contém "Unrecognized" nem "key(s)" |
| POST /v1/sync | [SYNC-POST-32] dado é coagido igual ao REST (string ISO → Date) | A; `manejo_rebanhos:CREATE` com `dataAtividade` como string ISO | HTTP 200 (`aceito`), no banco, `dataAtividade` é armazenado como data válida (não como string crua) |
| POST /v1/sync | [SYNC-POST-33] corpo inválido recusa só o item, não o lote | A; lote com 2 mutações `pastos:CREATE`, uma sem `propriedadeId` (campo obrigatório) | HTTP 200, a inválida sai `recusado`/`validationError`; a outra sai `aceito` e existe no banco |
| POST /v1/sync | [SYNC-POST-34] `DELETE` não exige `dados` e não passa por validação de schema | A; mutação `DELETE` de um pasto existente de A | HTTP 200 (`aceito`), pasto marcado `ativo: false` no banco (soft-delete, igual ao REST) |
| POST /v1/sync | [SYNC-POST-35] combinação `entidade:acao` não suportada | A; mutação com `entidade: "coisas"`, `acao: "CREATE"` | HTTP 200 (`recusado`), `erro.tipo: validationError`; mensagem "Combinação não suportada: coisas com ação CREATE." |
| POST /v1/sync | [SYNC-POST-36] `historico_movimentacoes:UPDATE` não é suportado (movimentação é evento imutável) | A; mutação `UPDATE` para `historico_movimentacoes` | HTTP 200 (`recusado`), mesma recusa de combinação não suportada de SYNC-POST-35 |
| POST /v1/sync | [SYNC-POST-37] `movimentacoes_insumo:UPDATE` não é suportado | A; mutação `UPDATE` para `movimentacoes_insumo` | HTTP 200 (`recusado`), mesma recusa de combinação não suportada |

### Despacho por entidade/ação — matriz de suporte

Arquivo: `test/endpoints/sync/post-sync-despacho.test.js` — cada linha confirma que a combinação
é roteada, validada e persistida corretamente (a regra de negócio específica de cada entidade já
é coberta no `.md` da rota REST correspondente).

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/sync | [SYNC-POST-38] `propriedades:CREATE` | A; dados mínimos válidos, `entidadeId` gerado pelo cliente | HTTP 200 (`aceito`), propriedade existe no banco com o `id` = `entidadeId` enviado (offline-first) e `usuarioId` = A |
| POST /v1/sync | [SYNC-POST-39] `propriedades:UPDATE` | A; propriedade existente de A | HTTP 200 (`aceito`), campo atualizado no banco |
| POST /v1/sync | [SYNC-POST-40] `propriedades:DELETE` | A; propriedade existente de A, sem pastos vinculados | HTTP 200 (`aceito`), `ativo: false` no banco |
| POST /v1/sync | [SYNC-POST-41] `pastos:CREATE` | A; propriedade existente de A | HTTP 200 (`aceito`), pasto no banco com `id` = `entidadeId` |
| POST /v1/sync | [SYNC-POST-42] `pastos:UPDATE` | A; pasto existente de A | HTTP 200 (`aceito`), campo atualizado |
| POST /v1/sync | [SYNC-POST-43] `pastos:DELETE` | A; pasto existente de A, sem rebanho ativo | HTTP 200 (`aceito`), `ativo: false` |
| POST /v1/sync | [SYNC-POST-44] `rebanhos:CREATE` | A; pasto existente de A | HTTP 200 (`aceito`), rebanho no banco |
| POST /v1/sync | [SYNC-POST-45] `rebanhos:UPDATE` | A; rebanho existente de A | HTTP 200 (`aceito`), campo atualizado |
| POST /v1/sync | [SYNC-POST-46] `rebanhos:DELETE` | A; rebanho existente de A | HTTP 200 (`aceito`), `ativo: false` no banco **(bug conhecido — ver Divergências)** |
| POST /v1/sync | [SYNC-POST-47] `manejo_pastos:CREATE` | A; pasto e tipo de manejo existentes | HTTP 200 (`aceito`), manejo no banco |
| POST /v1/sync | [SYNC-POST-48] `manejo_pastos:UPDATE` | A; manejo de pasto existente | HTTP 200 (`aceito`), campo atualizado |
| POST /v1/sync | [SYNC-POST-49] `manejo_pastos:DELETE` | A; manejo de pasto existente | HTTP 200 (`aceito`), `ativo: false` no banco (soft-delete) |
| POST /v1/sync | [SYNC-POST-50] `manejo_rebanhos:CREATE` | A; rebanho e tipo de manejo existentes | HTTP 200 (`aceito`), manejo no banco |
| POST /v1/sync | [SYNC-POST-51] `manejo_rebanhos:UPDATE` | A; manejo de rebanho existente | HTTP 200 (`aceito`), campo atualizado |
| POST /v1/sync | [SYNC-POST-52] `manejo_rebanhos:DELETE` | A; manejo de rebanho existente | HTTP 200 (`aceito`), `ativo: false` no banco (soft-delete) |
| POST /v1/sync | [SYNC-POST-53] `historico_movimentacoes:CREATE` | A; rebanho e pasto destino existentes | HTTP 200 (`aceito`), movimentação no banco; efeitos colaterais aplicados (pasto atual do rebanho, status dos pastos) |
| POST /v1/sync | [SYNC-POST-54] `historico_movimentacoes:DELETE` (desfazer última movimentação) | A; movimentação é a última do rebanho | HTTP 200 (`aceito`), movimentação marcada `ativo: false`; efeitos revertidos |
| POST /v1/sync | [SYNC-POST-55] `insumos:CREATE` | A; propriedade existente | HTTP 200 (`aceito`), insumo no banco |
| POST /v1/sync | [SYNC-POST-56] `insumos:UPDATE` | A; insumo existente | HTTP 200 (`aceito`), campo atualizado |
| POST /v1/sync | [SYNC-POST-57] `insumos:DELETE` | A; insumo existente sem vínculo | HTTP 200 (`aceito`), `ativo: false` |
| POST /v1/sync | [SYNC-POST-58] `movimentacoes_insumo:CREATE` | A; insumo existente | HTTP 200 (`aceito`), movimentação de insumo no banco |
| POST /v1/sync | [SYNC-POST-59] `movimentacoes_insumo:DELETE` | A; movimentação de insumo existente | HTTP 200 (`aceito`), removida/soft-delete conforme regra do domínio |
| POST /v1/sync | [SYNC-POST-60] `regimes_consumo_insumo:CREATE` | A; rebanho e insumo existentes | HTTP 200 (`aceito`), regime no banco |
| POST /v1/sync | [SYNC-POST-61] `regimes_consumo_insumo:UPDATE` | A; regime existente | HTTP 200 (`aceito`), campo atualizado |
| POST /v1/sync | [SYNC-POST-62] `regimes_consumo_insumo:DELETE` | A; regime existente | HTTP 200 (`aceito`), removido conforme regra do domínio |

### Contrato de erro tipado (`tipo`/`recuperavel` por mutação)

Arquivo: `test/endpoints/sync/post-sync-erros.test.js`

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/sync | [SYNC-POST-63] recusa por regra de negócio do domínio (`resourceNotFound`) vem com `recuperavel: false` | A; mutação `UPDATE` de um pasto inexistente | HTTP 200 (`recusado`), `erro.tipo: resourceNotFound`; `erro.recuperavel === false`; mensagem do próprio service de domínio (ex.: "Pastagem não encontrada...") |
| POST /v1/sync | [SYNC-POST-64] recusa por conflito (nome duplicado) vem com `tipo: conflict`, `recuperavel: false` | A; `pastos:CREATE` com nome já usado na mesma propriedade | HTTP 200 (`recusado`), `erro.tipo: conflict`; `erro.recuperavel === false` |
| POST /v1/sync | [SYNC-POST-65] erro inesperado (sem `errorType`, ex. violação de not-null do Postgres) vira `serverError` recuperável, sem vazar detalhe técnico | A; forçar violação de constraint que não passa pelo `CustomError` | HTTP 200 (`recusado`), `erro.tipo: serverError`; `erro.recuperavel === true`; `erro.mensagem` não contém nome de coluna/tabela nem "constraint" |
| POST /v1/sync | [SYNC-POST-66] resposta HTTP é sempre 200 mesmo com todas as mutações recusadas | A; lote só com mutações inválidas de negócio (ex.: todas duplicadas) | HTTP 200, `data.resultados` todos `recusado`; mensagem "0 de N mutações aplicadas." |
| POST /v1/sync | [SYNC-POST-67] mensagem do lote conta só os aceitos | A; lote misto (2 aceitos, 1 recusado, 1 bloqueado, de um total de 4) | HTTP 200, mensagem "2 de 4 mutações aplicadas." |

### Transação

Arquivo: `test/endpoints/sync/post-sync-erros.test.js`

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/sync | [SYNC-POST-68] mutação e registro de idempotência entram juntos (ou nenhum dos dois) | A; mutação `CREATE` bem-sucedida | HTTP 200 (`aceito`), no banco, existe tanto a entidade criada quanto a linha em `mutacaoAplicada` com o mesmo `id` da mutação |
| POST /v1/sync | [SYNC-POST-69] falha dentro da transação não deixa a entidade "meio-criada" | A; mutação cujo despacho falha após alguma escrita parcial (ex.: violação de unicidade detectada só no fim) | HTTP 200 (`recusado`), no banco, nenhuma linha órfã da entidade em questão; nenhuma linha em `mutacaoAplicada` para essa mutação |
| POST /v1/sync | [SYNC-POST-70] mutação de um item não afeta a transação de outro item do mesmo lote | A; 2 mutações independentes, uma forçada a falhar dentro da transação | HTTP 200, a que falha não reverte nem impede o commit da outra (transações são por item, não compartilhadas) |

### Multi-tenancy dentro das mutações

Arquivo: `test/endpoints/sync/post-sync-multitenancy.test.js`

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/sync | [SYNC-POST-71] `UPDATE` em recurso de outro usuário é recusado como não encontrado | B autenticado; mutação `pastos:UPDATE` com `entidadeId` de um pasto de A | HTTP 200 (`recusado`), `erro.tipo: resourceNotFound` (o service de domínio escopa a busca por `usuarioId`, então o recurso de A "não existe" para B); pasto de A não é alterado |
| POST /v1/sync | [SYNC-POST-72] `DELETE` em recurso de outro usuário é recusado como não encontrado | B; mutação `pastos:DELETE` com `entidadeId` de um pasto de A | HTTP 200 (`recusado`), `erro.tipo: resourceNotFound`; pasto de A continua `ativo: true` |
| POST /v1/sync | [SYNC-POST-73] `CREATE` com `propriedadeId` de outro usuário é recusado | B; mutação `pastos:CREATE` com `dados.propriedadeId` apontando para propriedade de A | HTTP 200 (`recusado`), recusa vinda do service de domínio (posse validada lá, não no `SyncService`); nenhum pasto criado sob a propriedade de A |
| POST /v1/sync | [SYNC-POST-74] mutações de A e B no "mesmo lote" (chamadas separadas, uma por usuário) não se enxergam | A envia um lote; B envia outro lote referenciando `entidadeId`s de A | HTTP 200 (ambos), resultado de B não reflete nem altera o de A; idempotência de B não reaproveita registros de A (reforça SYNC-POST-25) |

### Autenticação

Arquivo: `test/endpoints/sync/post-sync-multitenancy.test.js`

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/sync | [SYNC-POST-75] 401 sem token | sem header `Authorization`; lote bem formado | HTTP 401, `tipo: unauthorized`; nenhuma mutação é tentada (nenhum registro em `mutacaoAplicada`) |
| POST /v1/sync | [SYNC-POST-76] 401 com token inválido/expirado | header `Authorization` com token quebrado ou revogado | HTTP 401, `tipo: unauthorized` |

## Bugs conhecidos

- SYNC-POST-49 e SYNC-POST-52 usam soft-delete (`ativo: false`) para `manejo_pastos`/`manejo_rebanhos`, não exclusão real como uma redação anterior sugeria — os models têm coluna `ativo` e os repositories fazem `update`, não `delete` (consistente com o que `pastagens-manejos.md` e `rebanhos-manejos.md` já documentam).
- Limitação conhecida e aceita (não é bug a corrigir): a escrita da entidade e o registro de idempotência não compartilham de fato a mesma conexão de transação — cada service de domínio decide se usa o `tx` recebido do `SyncService` ou abre outro. Numa janela estreita entre a escrita da entidade e o registro de `mutacaoAplicada`, um reenvio pode reexecutar a mutação. SYNC-POST-68/69/70 testam o caminho feliz da transação por item, não essa janela de corrida.
- **Bug real — `SYNC-POST-46` (`rebanhos:DELETE`) nunca é aceito.** O despacho chama `RebanhoService.remove` → `_inativar`, onde `comTransacao(this.prisma, executor, ...)` usa uma variável `executor` que não existe no escopo do método. O `ReferenceError` é capturado por item pelo lote e a mutação volta como `recusado` com `tipo: serverError`. É o mesmo bug que derruba `DELETE /rebanhos/:id` no REST. Cenário marcado `it.fails` com a expectativa correta (`aceito` + `ativo: false`).
- **Bug real — `SYNC-POST-25`, idempotência escapa do escopo do usuário na gravação.** A leitura filtra por `usuarioId`, mas `mutacaoAplicada.id` é chave primária global, sem `usuarioId` na chave. Se dois usuários colidirem no mesmo id gerado pelo cliente, o `create` do segundo viola a PK e a mutação dele é recusada — o dado de A não vaza para B, mas B é impedido de sincronizar por causa de um id alheio. A chave deveria ser composta (`@@id([id, usuarioId])`). Cenário marcado `it.fails`.
- **Bug real — `SYNC-POST-26`, a janela de retenção só vale no request seguinte.** `limparAntigas` roda no fim do lote, depois de `buscarPorIds`. Um registro com mais de 30 dias ainda curto-circuita o reenvio no mesmo request, devolvendo o resultado antigo; só a partir da próxima sincronização ele deixa de existir. Cenário marcado `it.fails` com a expectativa documentada (reenvio tratado como mutação nova).
