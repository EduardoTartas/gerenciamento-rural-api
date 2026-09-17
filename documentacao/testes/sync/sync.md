# /sync

Controller `SyncController` · Service `SyncService` · Schema `SyncLoteSchema` (envelope) ·
Peças auxiliares: `src/service/sync/grafoDeDependencia.js` (ordenação/ciclo), `src/service/sync/
validacao.js` (`SCHEMAS_DE_MUTACAO`, valida `dados` com o mesmo schema Zod do REST equivalente),
`src/service/sync/despacho.js` (`DESPACHO`, liga `entidade:acao` ao service de domínio),
`src/repository/MutacaoAplicadaRepository.js` (idempotência) ·
Regras: `rotas_pastolivre.md` § 11, `documentacao/sincronizacao.md` (visão de conjunto) ·
Absorve o e2e `test/e2e/lote.e2e.js`.

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth. `POST /sync` é a única rota
desta suíte cujo status HTTP de sucesso (200) não reflete o resultado de cada item — cada mutação do
lote tem sua própria `situacao` (`aceito`, `recusado`, `bloqueado`) dentro de `data.resultados`. Os
cenários abaixo por isso descrevem, além do status HTTP da requisição, a `situacao` esperada por
mutação.

Cada mutação, quando aceita, roda dentro de `prisma.$transaction` e delega ao service de domínio já
existente (`PropriedadeService`, `PastoService`, `RebanhoService`, `ManejoPastoService`,
`ManejoRebanhoService`, `MovimentacaoService`, `InsumoService`, `MovimentacaoInsumoService`,
`RegimeConsumoInsumoService`) — o `SyncService` não reimplementa regra de negócio de domínio; a
tabela "Despacho por entidade/ação" cobre que o roteamento e a validação por schema funcionam para
cada combinação suportada, não a regra de negócio interna de cada service (essa já está nos `.md`
das rotas REST correspondentes — `propriedades.md`, `pastagens.md`, `rebanhos.md`,
`rebanhos-manejos.md`, `pastagens-manejos.md`, `rebanhos-movimentacoes.md`, `insumos.md`,
`insumos-movimentacoes.md`, `rebanhos-regimes-consumo.md`).

## POST /sync

Suíte dividida em vários arquivos, um por sub-seção abaixo — o volume de cenários (76) não
caberia com folga num arquivo só.

### Envelope

Arquivo: `test/endpoints/sync/post-sync-envelope.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SYNC-POST-01 | lote bem formado com uma mutação | A autenticado; 1 mutação `pastos:CREATE` válida | 200 | envelope; `data.resultados` com 1 item, `situacao: aceito` |
| SYNC-POST-02 | `mutacoes` vazio | A; `{ mutacoes: [] }` | 400 | mensagem "Envie ao menos uma mutação."; `tipo` `validationError`; `errors[0].path` = `mutacoes` |
| SYNC-POST-03 | mais de 100 mutações no lote | A; 101 mutações | 400 | mensagem cita o teto de `MAXIMO_DE_MUTACOES` (100) |
| SYNC-POST-04 | `acao` fora de `CREATE`/`UPDATE`/`DELETE` | A; mutação com `acao: "UPSERT"` | 400 | mensagem "A ação deve ser CREATE, UPDATE ou DELETE." |
| SYNC-POST-05 | `id` da mutação não é UUID | A; mutação com `id: "abc"` | 400 | mensagem "O id da mutação deve ser um UUID válido." |
| SYNC-POST-06 | `entidadeId` não é UUID | A; mutação com `entidadeId: "abc"` | 400 | mensagem "O id da entidade deve ser um UUID válido." |
| SYNC-POST-07 | campo extra na mutação (`.strict()`) | A; mutação com campo desconhecido no nível raiz | 400 | `tipo` `validationError` |
| SYNC-POST-08 | corpo vazio (`{}`) | A; `{}` | 400 | Zod recusa por `mutacoes` ausente/obrigatório |
| SYNC-POST-09 | `CREATE` sem `dados` | A; mutação `CREATE` sem o campo `dados` | 400 | mensagem "CREATE e UPDATE exigem o campo dados." |
| SYNC-POST-10 | `UPDATE` sem `dados` | A; mutação `UPDATE` sem o campo `dados` | 400 | mesma mensagem de SYNC-POST-09 |
| SYNC-POST-11 | `DELETE` sem `dados` é aceito pelo envelope | A; mutação `DELETE` sem `dados` | 200 | envelope válido passa a fase de schema (a mutação em si ainda pode ser recusada por regra de domínio) |
| SYNC-POST-12 | `id` dentro de `dados` é recusado | A; mutação `CREATE`/`UPDATE` com `dados.id` presente | 400 | mensagem "O identificador vem em entidadeId; não repita `id` dentro de dados." |
| SYNC-POST-13 | `dependeDe` com formato inválido (não UUID, não nulo) | A; mutação com `dependeDe: "abc"` | 400 | erro de validação Zod aponta `dependeDe` |
| SYNC-POST-14 | falha de envelope recusa a requisição inteira (nenhuma mutação é tentada) | A; lote com 2 mutações, uma delas com erro de schema | 400 | nenhuma das mutações — nem a válida — aparece em `mutacaoAplicada` no banco; `SyncLoteSchema.parse` roda no controller, antes do service |

### Ordenação e dependência (grafo)

Arquivo: `test/endpoints/sync/post-sync-dependencias.test.js` (cobre também a sub-seção
"Resultados por mutação — bloqueio em cascata" abaixo, que depende do mesmo grafo)

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SYNC-POST-15 | mutações independentes mantêm a ordem de envio na resposta | A; 3 mutações sem `dependeDe` | 200 | `data.resultados` na mesma ordem em que foram enviadas (não na ordem de execução) |
| SYNC-POST-16 | dependente é aplicado depois do predecessor mesmo enviado antes dele | A; mutação de rebanho enviada **antes** da mutação do pasto do qual depende (`dependeDe`) | 200 | pasto é criado no banco antes do rebanho (ordenação topológica reordena a execução); ambos `aceito`; resposta preserva a ordem de envio, não a de execução |
| SYNC-POST-17 | cadeia de três níveis é resolvida (pasto → rebanho → manejo) | A; manejo depende do rebanho, que depende do pasto, enviados fora de ordem | 200 | os três `aceito`; registros no banco existem com as referências corretas |
| SYNC-POST-18 | `dependeDe` aponta para fora do lote | A; mutação com `dependeDe` de um UUID que não está entre as mutações enviadas | 400 | lote inteiro recusado; mensagem cita a mutação e o id ausente; nenhuma mutação chega a ser tentada (nenhum registro em `mutacaoAplicada`) |
| SYNC-POST-19 | ciclo direto de dependência (A depende de B, B depende de A) | A; 2 mutações que se referenciam mutuamente | 400 | mensagem cita "ciclo"; nenhuma mutação tentada |
| SYNC-POST-20 | ciclo indireto de três mutações | A; A depende de B, B depende de C, C depende de A | 400 | mesma recusa de lote inteiro |

### Resultados por mutação — bloqueio em cascata

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SYNC-POST-21 | mutação recusada bloqueia quem depende dela | A; pasto com nome duplicado (recusa por conflito) e rebanho que `dependeDe` esse pasto | 200 | pasto `situacao: recusado`, `erro.tipo: conflict`; rebanho `situacao: bloqueado`, `bloqueadoPor` = id da mutação do pasto; rebanho **não é criado** no banco |
| SYNC-POST-22 | bloqueio se propaga em cadeia (recusa no nível 1 bloqueia níveis 2 e 3) | A; pasto recusado, rebanho depende do pasto, manejo depende do rebanho | 200 | pasto `recusado`; rebanho e manejo ambos `bloqueado`, ambos com `bloqueadoPor` apontando (direta ou indiretamente) para a causa raiz |
| SYNC-POST-23 | mutação independente entra mesmo com outra recusada no mesmo lote | A; duas mutações `pastos:CREATE` sem relação entre si, uma delas recusada | 200 | a recusada sai `recusado`; a outra sai `aceito` e existe no banco |

### Idempotência

Arquivo: `test/endpoints/sync/post-sync-idempotencia.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SYNC-POST-24 | reenvio do mesmo `id` de mutação já aceita devolve o resultado gravado, sem duplicar | A; enviar o mesmo lote (mesmo `id` de mutação) duas vezes seguidas | 200 (nas duas chamadas) | segunda resposta tem `situacao: aceito` idêntica à primeira; no banco, só existe **um** registro da entidade criada (sem duplicata); a mutação não é reexecutada no segundo envio (efeito colateral não se repete — ex.: contagem/soma que dobraria se reaplicada) |
| SYNC-POST-25 | idempotência é escopada por usuário | A cria mutação com `id` = X; B envia uma mutação com o mesmo `id` X (colisão) | 200 | resultado de B não reaproveita o registro de idempotência de A — a mutação de B é processada como nova (`buscarPorIds` filtra por `usuarioId`) |
| SYNC-POST-26 | registro de idempotência expira após a janela de retenção | A; mutação aplicada há mais de 30 dias (inserir diretamente via Prisma com `aplicadaEm` antigo) e reenviada com o mesmo `id` | 200 | a limpeza (`limparAntigas`, chamada a cada `POST /sync`) remove o registro antigo antes da checagem; reenvio é tratado como mutação nova, não como idempotente |

### Validação por entidade (schema do REST reaproveitado)

Arquivo: `test/endpoints/sync/post-sync-validacao.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SYNC-POST-27 | `pastos:UPDATE` com `propriedadeId` no corpo é recusado | A; mutação `UPDATE` de um pasto de A, `dados.propriedadeId` de outra propriedade | 200 (mutação `recusado`) | `situacao: recusado`; `erro.tipo: validationError`; `erro.campo` cita `propriedadeId`; `erro.recuperavel === false`; no banco, o pasto **não muda de propriedade** |
| SYNC-POST-28 | `rebanhos:UPDATE` com `propriedadeId` é recusado | A; mesmo padrão de SYNC-POST-27 para rebanho | 200 (`recusado`) | mesma forma de erro |
| SYNC-POST-29 | `manejo_pastos:UPDATE` com `pastoId` é recusado | A | 200 (`recusado`) | mesma forma de erro |
| SYNC-POST-30 | `manejo_rebanhos:UPDATE` com `rebanhoId` é recusado | A | 200 (`recusado`) | mesma forma de erro |
| SYNC-POST-31 | campo desconhecido gera mensagem em português, sem termos do Zod | A; qualquer mutação com campo fora do schema | 200 (`recusado`) | `erro.mensagem` no formato "Campo não aceito em `<entidade>`: `<campos>`."; não contém "Unrecognized" nem "key(s)" |
| SYNC-POST-32 | dado é coagido igual ao REST (string ISO → Date) | A; `manejo_rebanhos:CREATE` com `dataAtividade` como string ISO | 200 (`aceito`) | no banco, `dataAtividade` é armazenado como data válida (não como string crua) |
| SYNC-POST-33 | corpo inválido recusa só o item, não o lote | A; lote com 2 mutações `pastos:CREATE`, uma sem `propriedadeId` (campo obrigatório) | 200 | a inválida sai `recusado`/`validationError`; a outra sai `aceito` e existe no banco |
| SYNC-POST-34 | `DELETE` não exige `dados` e não passa por validação de schema | A; mutação `DELETE` de um pasto existente de A | 200 (`aceito`) | pasto marcado `ativo: false` no banco (soft-delete, igual ao REST) |
| SYNC-POST-35 | combinação `entidade:acao` não suportada | A; mutação com `entidade: "coisas"`, `acao: "CREATE"` | 200 (`recusado`) | `erro.tipo: validationError`; mensagem "Combinação não suportada: coisas com ação CREATE." |
| SYNC-POST-36 | `historico_movimentacoes:UPDATE` não é suportado (movimentação é evento imutável) | A; mutação `UPDATE` para `historico_movimentacoes` | 200 (`recusado`) | mesma recusa de combinação não suportada de SYNC-POST-35 |
| SYNC-POST-37 | `movimentacoes_insumo:UPDATE` não é suportado | A; mutação `UPDATE` para `movimentacoes_insumo` | 200 (`recusado`) | mesma recusa de combinação não suportada |

### Despacho por entidade/ação — matriz de suporte

Cada linha confirma que a combinação é roteada, validada e persistida corretamente (regra de negócio
específica de cada entidade já é coberta no `.md` da rota REST correspondente — aqui só confirma que o
caminho do lote chega lá e grava).

Arquivo: `test/endpoints/sync/post-sync-despacho.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SYNC-POST-38 | `propriedades:CREATE` | A; dados mínimos válidos, `entidadeId` gerado pelo cliente | 200 (`aceito`) | propriedade existe no banco com o `id` = `entidadeId` enviado (offline-first) e `usuarioId` = A |
| SYNC-POST-39 | `propriedades:UPDATE` | A; propriedade existente de A | 200 (`aceito`) | campo atualizado no banco |
| SYNC-POST-40 | `propriedades:DELETE` | A; propriedade existente de A, sem pastos vinculados | 200 (`aceito`) | `ativo: false` no banco |
| SYNC-POST-41 | `pastos:CREATE` | A; propriedade existente de A | 200 (`aceito`) | pasto no banco com `id` = `entidadeId` |
| SYNC-POST-42 | `pastos:UPDATE` | A; pasto existente de A | 200 (`aceito`) | campo atualizado |
| SYNC-POST-43 | `pastos:DELETE` | A; pasto existente de A, sem rebanho ativo | 200 (`aceito`) | `ativo: false` |
| SYNC-POST-44 | `rebanhos:CREATE` | A; pasto existente de A | 200 (`aceito`) | rebanho no banco |
| SYNC-POST-45 | `rebanhos:UPDATE` | A; rebanho existente de A | 200 (`aceito`) | campo atualizado |
| SYNC-POST-46 | `rebanhos:DELETE` | A; rebanho existente de A | 200 (`aceito`) | `ativo: false` |
| SYNC-POST-47 | `manejo_pastos:CREATE` | A; pasto e tipo de manejo existentes | 200 (`aceito`) | manejo no banco |
| SYNC-POST-48 | `manejo_pastos:UPDATE` | A; manejo de pasto existente | 200 (`aceito`) | campo atualizado |
| SYNC-POST-49 | `manejo_pastos:DELETE` | A; manejo de pasto existente | 200 (`aceito`) | `ativo: false` no banco (soft-delete — ver `## Divergências`) |
| SYNC-POST-50 | `manejo_rebanhos:CREATE` | A; rebanho e tipo de manejo existentes | 200 (`aceito`) | manejo no banco |
| SYNC-POST-51 | `manejo_rebanhos:UPDATE` | A; manejo de rebanho existente | 200 (`aceito`) | campo atualizado |
| SYNC-POST-52 | `manejo_rebanhos:DELETE` | A; manejo de rebanho existente | 200 (`aceito`) | `ativo: false` no banco (soft-delete — ver `## Divergências`) |
| SYNC-POST-53 | `historico_movimentacoes:CREATE` | A; rebanho e pasto destino existentes | 200 (`aceito`) | movimentação no banco; efeitos colaterais aplicados (pasto atual do rebanho, status dos pastos) |
| SYNC-POST-54 | `historico_movimentacoes:DELETE` (desfazer última movimentação) | A; movimentação é a última do rebanho | 200 (`aceito`) | movimentação marcada `ativo: false`; efeitos revertidos |
| SYNC-POST-55 | `insumos:CREATE` | A; propriedade existente | 200 (`aceito`) | insumo no banco |
| SYNC-POST-56 | `insumos:UPDATE` | A; insumo existente | 200 (`aceito`) | campo atualizado |
| SYNC-POST-57 | `insumos:DELETE` | A; insumo existente sem vínculo | 200 (`aceito`) | `ativo: false` |
| SYNC-POST-58 | `movimentacoes_insumo:CREATE` | A; insumo existente | 200 (`aceito`) | movimentação de insumo no banco |
| SYNC-POST-59 | `movimentacoes_insumo:DELETE` | A; movimentação de insumo existente | 200 (`aceito`) | removida/soft-delete conforme regra do domínio (ver `insumos-movimentacoes.md`) |
| SYNC-POST-60 | `regimes_consumo_insumo:CREATE` | A; rebanho e insumo existentes | 200 (`aceito`) | regime no banco |
| SYNC-POST-61 | `regimes_consumo_insumo:UPDATE` | A; regime existente | 200 (`aceito`) | campo atualizado |
| SYNC-POST-62 | `regimes_consumo_insumo:DELETE` | A; regime existente | 200 (`aceito`) | removido conforme regra do domínio |

### Contrato de erro tipado (`tipo`/`recuperavel` por mutação)

Arquivo: `test/endpoints/sync/post-sync-erros.test.js` (cobre também a sub-seção "Transação" abaixo)

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SYNC-POST-63 | recusa por regra de negócio do domínio (`resourceNotFound`) vem com `recuperavel: false` | A; mutação `UPDATE` de um pasto inexistente | 200 (`recusado`) | `erro.tipo: resourceNotFound`; `erro.recuperavel === false`; mensagem do próprio service de domínio (ex.: "Pastagem não encontrada...") |
| SYNC-POST-64 | recusa por conflito (nome duplicado) vem com `tipo: conflict`, `recuperavel: false` | A; `pastos:CREATE` com nome já usado na mesma propriedade | 200 (`recusado`) | `erro.tipo: conflict`; `erro.recuperavel === false` |
| SYNC-POST-65 | erro inesperado (sem `errorType`, ex. violação de not-null do Postgres) vira `serverError` recuperável, sem vazar detalhe técnico | A; forçar uma violação de constraint que não passa pelo `CustomError` (ex.: campo obrigatório do banco não coberto pelo schema Zod, se existir algum caso real; senão simular via dado que o Prisma rejeita) | 200 (`recusado`) | `erro.tipo: serverError`; `erro.recuperavel === true`; `erro.mensagem` não contém nome de coluna/tabela nem "constraint" |
| SYNC-POST-66 | resposta HTTP é sempre 200 mesmo com todas as mutações recusadas | A; lote só com mutações inválidas de negócio (ex.: todas duplicadas) | 200 | `data.resultados` todos `recusado`; mensagem "0 de N mutações aplicadas." |
| SYNC-POST-67 | mensagem do lote conta só os aceitos | A; lote misto (2 aceitos, 1 recusado, 1 bloqueado, de um total de 4) | 200 | mensagem "2 de 4 mutações aplicadas." |

### Transação

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SYNC-POST-68 | mutação e registro de idempotência entram juntos (ou nenhum dos dois) | A; mutação `CREATE` bem-sucedida | 200 (`aceito`) | no banco, existe tanto a entidade criada quanto a linha em `mutacaoAplicada` com o mesmo `id` da mutação |
| SYNC-POST-69 | falha dentro da transação não deixa a entidade "meio-criada" | A; mutação cujo despacho falha após alguma escrita parcial (ex.: violação de unicidade que o Prisma detecta só no fim) | 200 (`recusado`) | no banco, nenhuma linha órfã da entidade em questão; nenhuma linha em `mutacaoAplicada` para essa mutação |
| SYNC-POST-70 | mutação de um item não afeta a transação de outro item do mesmo lote | A; 2 mutações independentes, uma forçada a falhar dentro da transação | 200 | a que falha não reverte nem impede o commit da outra (transações são por item, não compartilhadas) |

### Multi-tenancy dentro das mutações

Arquivo: `test/endpoints/sync/post-sync-multitenancy.test.js` (cobre também a sub-seção
"Autenticação" abaixo)

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SYNC-POST-71 | `UPDATE` em recurso de outro usuário é recusado como não encontrado | B autenticado; mutação `pastos:UPDATE` com `entidadeId` de um pasto de A | 200 (`recusado`) | `erro.tipo: resourceNotFound` (o service de domínio escopa a busca por `usuarioId`, então o recurso de A "não existe" para B); pasto de A não é alterado |
| SYNC-POST-72 | `DELETE` em recurso de outro usuário é recusado como não encontrado | B; mutação `pastos:DELETE` com `entidadeId` de um pasto de A | 200 (`recusado`) | `erro.tipo: resourceNotFound`; pasto de A continua `ativo: true` |
| SYNC-POST-73 | `CREATE` com `propriedadeId` de outro usuário é recusado | B; mutação `pastos:CREATE` com `dados.propriedadeId` apontando para propriedade de A | 200 (`recusado`) | recusa vinda do service de domínio (posse validada lá, não no `SyncService`); nenhum pasto criado sob a propriedade de A |
| SYNC-POST-74 | mutações de A e B no "mesmo lote" (chamadas separadas, uma por usuário) não se enxergam | A envia um lote; B envia outro lote referenciando `entidadeId`s de A | 200 (ambos) | resultado de B não reflete nem altera o de A; idempotência de B não reaproveita registros de A (reforça SYNC-POST-25) |

### Autenticação

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SYNC-POST-75 | 401 sem token | sem header `Authorization`; lote bem formado | 401 | `tipo: unauthorized`; nenhuma mutação é tentada (nenhum registro em `mutacaoAplicada`) |
| SYNC-POST-76 | 401 com token inválido/expirado | header `Authorization` com token quebrado ou revogado | 401 | `tipo: unauthorized` |

## Divergências

- **SYNC-POST-49 e SYNC-POST-52 (corrigidas nesta task)**: a redação original dizia "exclusão real
  (manejos não têm dependentes; sem `ativo`)" para `manejo_pastos:DELETE`/`manejo_rebanhos:DELETE`. Não
  procede: os models `manejoPasto` e `manejoRebanho` (`prisma/schema.prisma`) têm coluna `ativo`, e
  `ManejoPastoRepository.remove`/`ManejoRebanhoRepository.remove` fazem `update({ data: { ativo: false
  } })`, não `delete`. É soft-delete, igual ao que `pastagens-manejos.md` (MPAS-DELETE-ID-01) e
  `rebanhos-manejos.md` (MREB-DELETE-ID-01) já documentam como divergência própria (a linha do CLAUDE.md
  "manejos são excluídos de verdade" está desatualizada). Linhas do `.md` corrigidas para refletir o
  comportamento real.
- **Limitação conhecida, documentada em `documentacao/sincronizacao.md` ("Limitação conhecida")**: a
  escrita da entidade (dentro do service de domínio) e o registro de idempotência não compartilham de
  fato a mesma conexão de transação — os services de domínio usam sua própria conexão Prisma e não
  recebem o `tx` que o `SyncService` abre (`src/service/SyncService.js:108-130` abre `$transaction` e
  passa `tx` ao `DESPACHO`, mas cada service de domínio, via `comTransacao`/`ondeEscrever` em
  `src/utils/helpers/transacao.js`, decide se usa o `tx` recebido ou abre outro). Numa janela estreita
  entre a escrita da entidade e o registro de `mutacaoAplicada`, um reenvio pode reexecutar a mutação.
  Não é um bug a corrigir nesta task — é risco aceito e documentado; os cenários SYNC-POST-68/69/70
  testam o caminho feliz da transação por item, não essa janela de corrida (que exigiria controle fino
  de timing fora do escopo de teste de endpoint via HTTP).
- **Bug real — `SYNC-POST-46` (`rebanhos:DELETE`) nunca é aceito.** O despacho
  (`src/service/sync/despacho.js:49`) chama `RebanhoService.remove`, que delega a `_inativar`
  (`src/service/RebanhoService.js:184-215`), onde `comTransacao(this.prisma, executor, ...)` usa uma
  variável `executor` que não existe no escopo do método. O `ReferenceError` é capturado por item pelo
  lote e a mutação volta como `recusado` com `tipo: serverError`. É o mesmo bug que derruba
  `DELETE /rebanhos/:id` no REST (ver `rebanhos.md`). Cenário marcado `it.fails` com a expectativa
  correta (`aceito` + `ativo: false`).
- **Bug real — `SYNC-POST-25`, idempotência escapa do escopo do usuário na gravação.** A leitura filtra
  por `usuarioId` (`MutacaoAplicadaRepository.buscarPorIds`), mas `mutacaoAplicada.id` é chave primária
  global (`prisma/schema.prisma:408-418`), sem `usuarioId` na chave. Como o id da mutação é gerado pelo
  cliente, se dois usuários colidirem no mesmo id o `create` do segundo viola a PK e a mutação dele é
  recusada — o dado de A não vaza para B, mas B é impedido de sincronizar por causa de um id alheio.
  A chave deveria ser composta (`@@id([id, usuarioId])`). Cenário marcado `it.fails`.
- Fora esses três pontos, `SyncService`, `grafoDeDependencia.js`, `validacao.js` e `despacho.js`
  implementam o que `documentacao/sincronizacao.md` descreve.
