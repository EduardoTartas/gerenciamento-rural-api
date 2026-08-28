# Feature de Insumos — Design

Data: 2026-08-28
Repositórios: `gerenciamento-rural-api` (contrato) + `gerenciamento-rural-mobile` (consumo)

## Objetivo

Permitir ao produtor cadastrar insumos da propriedade (ração, sal mineral, vacina,
medicamento, fertilizante, semente, defensivo), controlar estoque por um ledger de
movimentações, registrar consumo diário recorrente do rebanho com projeção de saldo, e
vincular insumos usados às atividades de manejo de pasto e de rebanho.

Contexto: sistema offline-first para pecuaristas de pequeno/médio porte. Toda decisão
prioriza operação sem internet.

## Decisões de projeto

| Tema | Decisão |
| :--- | :--- |
| Relação insumo × pasto/rebanho | Insumo pertence à **propriedade**, com campo `destino` (`Pasto`/`Rebanho`/`Ambos`). Estoque único por insumo. Movimentações registram opcionalmente qual pasto/rebanho consumiu. |
| Consumo diário do rebanho | **Regime recorrente** (`quantidadeDia`, `dataInicio`, `dataFim?`). Saldo projetado é **calculado na leitura**, não materializado em movimentações. |
| Modelo de estoque | **Ledger** (`movimentacaoInsumo`), evento imutável. Saldo = soma. Sem coluna de saldo. |
| Tipo/categoria | **Catálogo global novo** `tipoInsumo`, mesmo padrão de `raca`/`tipoManejoPasto`. |
| Unidade de medida | Enum fixo validado na aplicação: `kg`, `g`, `L`, `mL`, `dose`, `saco`, `unidade`. |
| Uso em manejo | **Vários itens por manejo**. Cada item é uma `movimentacaoInsumo` de saída apontando o `manejoXId`. Sem tabela de junção. |
| Regimes simultâneos | Vários por rebanho, **um ativo por par (rebanho, insumo)**. Novo regime pro mesmo par encerra o anterior na mesma transação. |
| Alerta de estoque baixo | Campo `estoqueMinimo` opcional. App destaca (chip vermelho) quando `saldoProjetado <= estoqueMinimo`. |

## Modelo de dados (Prisma)

### `tipoInsumo` — catálogo global (sem `propriedadeId`)

```
id        String   @id @default(uuid())
nome      String   @unique
ativo     Boolean  @default(true)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
insumos   insumo[]
@@map("tipos_insumo")
```

Seed: `Ração`, `Sal mineral`, `Vacina`, `Medicamento`, `Fertilizante`, `Semente`,
`Defensivo`, `Outro`. Gerenciado via `/catalogos/:entidade`.

### `insumo` — escopo propriedade

```
id            String   @id @default(uuid())
propriedadeId String
propriedade   propriedade @relation(fields: [propriedadeId], references: [id], onDelete: Cascade)
tipoInsumoId  String
tipoInsumo    tipoInsumo  @relation(fields: [tipoInsumoId], references: [id])
nome          String
destino       String   // enum aplicação: Pasto | Rebanho | Ambos
unidadeMedida String   // enum aplicação: kg | g | L | mL | dose | saco | unidade
estoqueMinimo Decimal?
ativo         Boolean  @default(true)
createdAt     DateTime @default(now())
updatedAt     DateTime @updatedAt
movimentacoes  movimentacaoInsumo[]
regimesConsumo regimeConsumoInsumo[]
@@index([propriedadeId])
@@index([propriedadeId, updatedAt])
@@index([tipoInsumoId])
@@map("insumos")
```

Índice único **parcial** `(propriedadeId, lower(nome)) WHERE ativo = true`, criado por
migration e **não** declarado como `@@unique` no schema — mesma limitação e ressalva de
`pasto`/`rebanho`. Rodar `prisma migrate dev --create-only` e conferir o SQL antes de
aplicar.

Soft-delete via `ativo = false`. `DELETE /insumos/:id` delega ao update de `ativo`.

### `movimentacaoInsumo` — ledger (evento, exclusão real)

```
id              String   @id @default(uuid())
insumoId        String
insumo          insumo   @relation(fields: [insumoId], references: [id], onDelete: Cascade)
tipo            String   // enum aplicação: Entrada | Saida | Ajuste
quantidade      Decimal  // positiva em Entrada/Saida; assinada (+/-) em Ajuste
data            DateTime
origem          String   // enum aplicação: Compra | CadastroInicial | ManejoRebanho
                          //                | ManejoPasto | ConsumoRebanho | AjusteContagem | Perda
manejoRebanhoId String?
manejoRebanho   manejoRebanho? @relation(fields: [manejoRebanhoId], references: [id], onDelete: Cascade)
manejoPastoId   String?
manejoPasto     manejoPasto?   @relation(fields: [manejoPastoId], references: [id], onDelete: Cascade)
rebanhoId       String?
rebanho         rebanho? @relation(fields: [rebanhoId], references: [id], onDelete: SetNull)
pastoId         String?
pasto           pasto?   @relation(fields: [pastoId], references: [id], onDelete: SetNull)
observacoes     String?
createdAt       DateTime @default(now())
updatedAt       DateTime @updatedAt
@@index([insumoId])
@@index([insumoId, data])
@@index([manejoRebanhoId])
@@index([manejoPastoId])
@@map("movimentacoes_insumo")
```

Sem update (evento). Cada item de insumo de um manejo é uma linha de `Saida` com o
`manejoXId` preenchido. Leitura de um manejo agrupa movimentações por `manejoXId`.

Regra de saldo: `saldoReal = Σ(Entrada) − Σ(Saida) + Σ(Ajuste com sinal)`.

### `regimeConsumoInsumo` — consumo recorrente do rebanho

```
id            String   @id @default(uuid())
rebanhoId     String
rebanho       rebanho  @relation(fields: [rebanhoId], references: [id], onDelete: Cascade)
insumoId      String
insumo        insumo   @relation(fields: [insumoId], references: [id], onDelete: Cascade)
quantidadeDia Decimal  // na unidade do insumo, > 0
dataInicio    DateTime
dataFim       DateTime?
ativo         Boolean  @default(true)
createdAt     DateTime @default(now())
updatedAt     DateTime @updatedAt
@@index([rebanhoId])
@@index([insumoId])
@@map("regimes_consumo_insumo")
```

Índice único **parcial** `(rebanhoId, insumoId) WHERE ativo = true AND dataFim IS NULL`.
Criar novo regime pro mesmo par encerra o anterior (`dataFim = now`, `ativo = false`) na
mesma transação.

## Cálculo de saldo e projeção

Exibidos dois números:

- **`saldoReal`** — soma do ledger. Número de registro.
- **`saldoProjetado(hoje)`** = `saldoReal − consumoProjetadoNaoLancado`, onde:
  - `consumoProjetadoNaoLancado` = Σ, sobre regimes do insumo:
    `quantidadeDia × dias( interseção( [marco, hoje], [dataInicio, dataFim ?? hoje] ) )`
  - `marco` = data da última `movimentacaoInsumo` de origem `AjusteContagem` desse insumo;
    se nunca houve, usa o `dataInicio` do regime.
  - Quando o produtor faz contagem física e lança um `Ajuste` (origem `AjusteContagem`), a
    projeção **zera a partir daquela data** — evita descontar duas vezes.
- **`previsaoTermino`** = `hoje + saldoProjetado / consumoDiaTotal`, se `consumoDiaTotal > 0`.
  Se `saldoProjetado <= 0`: "esgotado há N dias".
- `consumoDiaTotal` = Σ `quantidadeDia` dos regimes ativos do insumo.

O regime **nunca escreve no ledger**. Consumo real entra no ledger só via `Saida` manual,
`Perda`, ou itens de manejo.

Cálculo feito na API na leitura de `insumo` e replicado no cliente (repositório) a partir
do ledger e dos regimes locais, para funcionar offline.

## Integração com manejo (pasto e rebanho)

- `POST` de `manejoRebanho` e `manejoPasto` aceita `itens: [{ insumoId, quantidade, observacoes? }]`.
- Service, na mesma transação: cria o manejo + uma `movimentacaoInsumo` `Saida` por item
  (origem `ManejoRebanho`/`ManejoPasto`, com `manejoXId` e `rebanhoId`/`pastoId`).
- Dropdown de insumo no app filtra por `destino` compatível: `Rebanho`/`Ambos` no manejo de
  rebanho; `Pasto`/`Ambos` no de pasto.
- Saldo insuficiente **avisa, não bloqueia** — offline não tem saldo confiável. Saldo pode
  ficar negativo e sinaliza "sem estoque".
- Campo legado `manejoRebanho.medicamentoVacina` permanece (retrocompat de dados), marcado
  como legado na documentação de rotas. App novo usa itens de insumo.

## Suporte offline-first

- Todos os schemas de criação aceitam `id` opcional (UUID gerado no cliente).
- Novas entidades sincronizáveis e ordem de dependência no endpoint de lote `/v1/sync`:
  `tipoInsumo` (catálogo) → `insumo` → (`movimentacaoInsumo`, `regimeConsumoInsumo`).
  Itens de insumo de um manejo sincronizam junto do próprio manejo (mesma `PendingMutation`).
- Mobile: escrita grava no SQLite e enfileira `PendingMutation` no outbox na mesma
  transação; `dependsOn`: `insumo` → `propriedade`; `movimentacaoInsumo`/`regimeConsumoInsumo`
  → `insumo`; movimentação de manejo → `manejo`.

## Validações

- `insumo.nome` único por propriedade entre ativos; `destino` e `unidadeMedida` no enum.
- `movimentacaoInsumo.quantidade > 0` para `Entrada`/`Saida`; `Ajuste` aceita valor negativo.
- `regimeConsumoInsumo.quantidadeDia > 0`; `dataInicio <= dataFim` quando `dataFim` presente.
- Multi-tenancy: toda query escopada a `usuarioId` via
  `propriedade.usuarioId` / `insumo.propriedade.usuarioId` /
  `rebanho.propriedade.usuarioId`.

## Divisão em issues

### Issue API — `feat: insumos, estoque por ledger e consumo por regime`

- schema Prisma: `tipoInsumo`, `insumo`, `movimentacaoInsumo`, `regimeConsumoInsumo`;
  relações em `manejoRebanho`, `manejoPasto`, `rebanho`, `pasto`, `propriedade`.
- migrations com os dois índices únicos parciais (conferir SQL antes de aplicar).
- seed de `tipoInsumo`.
- `tipoInsumo` incluído no CRUD de catálogos existente.
- 6 camadas de `insumo`: CRUD + soft-delete; leitura devolve `saldoReal`, `saldoProjetado`,
  `consumoDiaTotal`, `previsaoTermino`.
- 6 camadas de `movimentacaoInsumo`: create (`Entrada`/`Saida`/`Ajuste`) + list por insumo;
  sem update.
- 6 camadas de `regimeConsumoInsumo`: create (encerra o anterior do par) + list por rebanho
  + encerrar.
- `itens[]` no create de `manejoRebanho` e `manejoPasto`; movimentações criadas na
  transação; contagens dentro da transação.
- multi-tenancy em toda query.
- `id` opcional nos schemas Zod; registrar as entidades e a ordem de dependência no
  endpoint de lote `/v1/sync`.
- Swagger: `src/docs/paths/` + `src/docs/schemas/` + `documentacao/rotas/rotas_pastolivre.md`
  na mesma mudança.
- validações listadas acima; mensagens de erro em português claro.

### Issue Mobile — `feat: insumos, estoque e consumo diário do rebanho`

- schema local sqflite: `insumo`, `movimentacao_insumo`, `regime_consumo_insumo`,
  `tipo_insumo`.
- models (entity Equatable + model fromJson/toJson) das 4 entidades.
- repositories interface + `_impl` com `AppResult`: lê SQLite e devolve na hora; pull da API
  em paralelo com upsert por `updatedAt`, pulando entidades com mutação pendente.
- `_local_datasource` (SQLite) + `_remote_datasource` (Dio) de cada.
- sync: registrar `SyncEntity` em `sync_entity_registry.dart` (nome na API, rota de leitura,
  tabela local, ordem de dependência); `PendingMutation` para create/update/delete;
  `dependsOn` conforme acima.
- cálculo de `saldoProjetado` / `previsaoTermino` no repositório, a partir do ledger e dos
  regimes locais.
- `InsumoListPage`: substituir placeholder. Cards com tipo, chip de `destino`, saldo
  projetado, chip vermelho quando `<= estoqueMinimo`; `AppSearchField` no topo.
- `InsumoFormPage`: nome, tipo (`AppDropdownFormField` do catálogo), destino, unidade,
  estoque mínimo, quantidade inicial (gera `movimentacaoInsumo` origem `CadastroInicial`).
- `InsumoDetailPage`: saldo real vs projetado, previsão de término, histórico de
  movimentações, regimes ativos; ações: registrar entrada, registrar saída/perda, registrar
  contagem (`Ajuste`), novo regime.
- `MovimentacaoFormPage`, `RegimeConsumoFormPage`.
- forms de `manejoRebanho` e `manejoPasto`: seção "Insumos utilizados" com lista dinâmica de
  `{ insumo (dropdown filtrado por destino), quantidade }`; itens vão na `PendingMutation`
  do manejo; exibir itens no detalhe/card do manejo.
- tela do rebanho: seção "Consumo diário" com regimes ativos + atalho para novo regime.
- componentes padronizados de `lib/shared/widgets/`; `SyncBadge` nas telas principais novas.
- datas em UTC; listas paginadas com `limit` explícito.
- atualizar `PROJETO.md` (schema local, navegação, entidades de sync).

## Dependência entre issues

Contrato da API primeiro. Mobile consome. Podem andar em paralelo depois do schema e das
rotas acordados.
