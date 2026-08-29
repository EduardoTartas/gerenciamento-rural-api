# Feature de Insumos (API) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à API o cadastro de insumos da propriedade, controle de estoque por ledger de movimentações, consumo diário recorrente do rebanho com saldo projetado calculado na leitura, e vínculo de insumos usados nas atividades de manejo de pasto e de rebanho.

**Architecture:** Segue a arquitetura em camadas do repositório (`routes → controllers → service → repository → Prisma`). Três recursos novos (`insumo`, `movimentacaoInsumo`, `regimeConsumoInsumo`) espelhando o padrão de `manejoPasto`. Um catálogo global novo (`tipoInsumo`) plugado no CRUD de catálogos existente. Um módulo puro de cálculo de saldo/projeção, testado isoladamente. Itens de insumo de um manejo são `movimentacaoInsumo` de saída apontando o `manejoXId` — sem tabela de junção. Tudo escopado ao usuário autenticado e integrado ao endpoint de lote `/v1/sync`.

**Tech Stack:** Node 20 ESM, Express 5, Prisma 7 (`@prisma/adapter-pg`) sobre PostgreSQL 16, Zod 4 (`zod/v4`), Vitest, Winston, Swagger (`swagger-jsdoc`).

## Global Constraints

- ES Modules em todo arquivo — `import`, nunca `require`.
- Toda resposta HTTP via `CommonResponse`; erros sempre `throw new CustomError({ statusCode, errorType, field, details, customMessage })`, nunca `res.status().json()` em service/controller.
- Um schema Zod por operação, em `src/utils/validators/schemas/zod/`, todos com `.strict()`. Query params em `querys/`. O controller atribui o parse a `req._parsedQuery` (o service lê `req._parsedQuery ?? req.query`).
- Multi-tenancy obrigatória: toda consulta de dado rural escopada por `usuarioId`. Padrões: `where: { id, propriedade: { usuarioId } }`, `where: { id, rebanho: { propriedade: { usuarioId } } }`.
- Suporte offline-first: todo schema de criação aceita `id` opcional (UUID). Ao criar, repassar `parsedData` inteiro ao repository (preservar o `id`), nunca montar campo a campo.
- Repositories são singletons exportados por `src/repository/index.js`; services os recebem no construtor (ou usam o barrel).
- Métodos de escrita de repository aceitam `tx` opcional (`ondeEscrever(tx, this.prisma)` para escrita simples, `comTransacao(this.prisma, tx, cb)` para multi-tabela) — o lote passa a transação em vigor, o REST não passa nada.
- Soft-delete via `ativo: false` para `insumo`, `movimentacaoInsumo`, `regimeConsumoInsumo` (a linha precisa persistir para o delta reportá-la). `DELETE /:recurso/:id` delega ao update de `ativo`.
- Prisma não suporta índice único parcial no schema — criar via SQL na migration, rodar `prisma migrate dev --create-only` e conferir o SQL antes de aplicar (não derrubar os índices parciais já existentes de `propriedades`, `pastos`, `rebanhos`).
- Índices de catálogo global: sem `propriedadeId`, `nome @unique`, compartilhado entre todos os usuários.
- Enums são validados na aplicação (Zod), não no banco — colunas são `String`.
- Datas: o servidor interpreta ISO sem offset como horário local dele; o cliente manda UTC.
- Listagens paginadas, `limit` padrão 10, teto 100.
- Mensagens de erro voltam para o produtor rural na tela do celular — português claro, sem jargão.
- Commits: Conventional Commits em português, **sem escopo**, sem emoji, sem co-autoria de IA. Ex.: `feat: adiciona recurso de insumo`.
- Testes: `npm run test` (vitest). Testes de lógica pura importam o módulo direto; testes de service mockam `../../src/config/dbConnect.js` e injetam repos falsos (ver `test/services/pastoService.test.js`).
- Ao alterar comportamento de endpoint, atualizar `src/docs/paths/` **e** `documentacao/rotas/rotas_pastolivre.md` na mesma tarefa.

---

## File Structure

**Prisma**
- `prisma/schema.prisma` (modificar) — 4 models novos + campos de relação em `propriedade`, `rebanho`, `pasto`, `manejoRebanho`, `manejoPasto`.
- `prisma/migrations/<ts>_add_insumos/migration.sql` (criar via CLI, editar) — tabelas + 2 índices únicos parciais.
- `prisma/seeds/catalogoSeed.js` (modificar) — semear `tipoInsumo`.

**Cálculo (lógica pura)**
- `src/service/insumo/calculoSaldo.js` (criar) — funções puras de saldo real, consumo projetado, previsão de término.
- `test/insumo/calculoSaldo.test.js` (criar).

**Recurso `insumo`**
- `src/utils/validators/schemas/zod/InsumoSchema.js` (criar)
- `src/utils/validators/schemas/zod/querys/InsumoQuerySchema.js` (criar)
- `src/repository/InsumoRepository.js` (criar)
- `src/service/InsumoService.js` (criar)
- `src/controllers/InsumoController.js` (criar)
- `src/routes/insumoRoutes.js` (criar)
- `src/repository/index.js`, `src/routes/index.js` (modificar — registrar)
- `test/services/insumoService.test.js` (criar)

**Recurso `movimentacaoInsumo`**
- `src/utils/validators/schemas/zod/MovimentacaoInsumoSchema.js` (criar)
- `src/utils/validators/schemas/zod/querys/MovimentacaoInsumoQuerySchema.js` (criar)
- `src/repository/MovimentacaoInsumoRepository.js` (criar)
- `src/service/MovimentacaoInsumoService.js` (criar)
- `src/controllers/MovimentacaoInsumoController.js` (criar)
- rotas dentro de `src/routes/insumoRoutes.js`
- `test/services/movimentacaoInsumoService.test.js` (criar)

**Recurso `regimeConsumoInsumo`**
- `src/utils/validators/schemas/zod/RegimeConsumoInsumoSchema.js` (criar)
- `src/utils/validators/schemas/zod/querys/RegimeConsumoInsumoQuerySchema.js` (criar)
- `src/repository/RegimeConsumoInsumoRepository.js` (criar)
- `src/service/RegimeConsumoInsumoService.js` (criar)
- `src/controllers/RegimeConsumoInsumoController.js` (criar)
- `src/routes/regimeConsumoRoutes.js` (criar)
- `src/routes/index.js` (modificar)
- `test/services/regimeConsumoInsumoService.test.js` (criar)

**Catálogo**
- `src/repository/CatalogoRepository.js` (modificar — nova entrada em `CATALOGO_ENTITIES`)
- `src/routes/catalogoRoutes.js` (modificar — comentário de entidades)

**Manejo (itens de insumo)**
- `src/utils/validators/schemas/zod/ManejoPastoSchema.js`, `.../ManejoRebanhoSchema.js` (modificar — campo `itens`)
- `src/service/ManejoPastoService.js`, `src/service/ManejoRebanhoService.js` (modificar — criar movimentações na transação)
- `src/repository/ManejoPastoRepository.js`, `src/repository/ManejoRebanhoRepository.js` (modificar — `MANEJO_SELECT` inclui itens; `create` usa transação)
- `test/services/manejoInsumoItens.test.js` (criar)

**Sync**
- `src/service/sync/despacho.js` (modificar)
- `src/service/sync/validacao.js` (modificar)
- `test/syncInsumos.test.js` (criar)

**Docs**
- `src/docs/paths/insumo.js`, `src/docs/schemas/insumoSchema.js` (criar)
- `src/docs/config/head.js` (modificar — importar e mesclar)
- `src/docs/paths/catalogo.js`, `.../manejoPasto.js`, `.../manejoRebanho.js` (modificar — `tipos-insumo`, `itens`)
- `documentacao/rotas/rotas_pastolivre.md` (modificar)

---

## Task 1: Schema Prisma e migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_insumos/migration.sql` (via CLI, depois editar)

**Interfaces:**
- Produces: models Prisma `tipoInsumo`, `insumo`, `movimentacaoInsumo`, `regimeConsumoInsumo` com os campos abaixo; relações reversas `propriedade.insumos`, `rebanho.regimesConsumo`, `rebanho.movimentacoesInsumo`, `pasto.movimentacoesInsumo`, `manejoRebanho.movimentacoesInsumo`, `manejoPasto.movimentacoesInsumo`.

- [ ] **Step 1: Adicionar os models ao schema**

Em `prisma/schema.prisma`, na seção de catálogos globais (depois de `tipoManejoPasto`), adicionar:

```prisma
model tipoInsumo {
  id        String   @id @default(uuid())
  nome      String   @unique
  ativo     Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  insumos   insumo[]

  @@map("tipos_insumo")
}
```

Na seção de estrutura/propriedade (depois de `pasto`), adicionar:

```prisma
// ATENÇÃO: índice único parcial em (propriedadeId, lower(nome)) WHERE ativo = true,
// criado por migration. Prisma não suporta índice parcial no schema — mesma
// ressalva de pasto/rebanho. Rode `prisma migrate dev --create-only` e confira o SQL.
model insumo {
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
}
```

Na seção de eventos (depois de `manejoPasto`), adicionar:

```prisma
/// Ledger de estoque de insumo. Evento com exclusão lógica (`ativo`): a linha
/// precisa persistir para a leitura por diferença reportar a exclusão, igual a
/// `historicoMovimentacao`. Saldo = soma (Entrada + / Saida - / Ajuste com sinal).
/// Cada item de insumo de um manejo é uma linha `Saida` com `manejoXId` preenchido.
model movimentacaoInsumo {
  id              String   @id @default(uuid())
  insumoId        String
  insumo          insumo   @relation(fields: [insumoId], references: [id], onDelete: Cascade)
  tipo            String   // enum aplicação: Entrada | Saida | Ajuste
  quantidade      Decimal  // positiva em Entrada/Saida; assinada em Ajuste
  data            DateTime
  origem          String   // enum aplicação: Compra | CadastroInicial | ManejoRebanho | ManejoPasto | ConsumoRebanho | AjusteContagem | Perda
  manejoRebanhoId String?
  manejoRebanho   manejoRebanho? @relation(fields: [manejoRebanhoId], references: [id], onDelete: Cascade)
  manejoPastoId   String?
  manejoPasto     manejoPasto?   @relation(fields: [manejoPastoId], references: [id], onDelete: Cascade)
  rebanhoId       String?
  rebanho         rebanho? @relation(fields: [rebanhoId], references: [id], onDelete: SetNull)
  pastoId         String?
  pasto           pasto?   @relation(fields: [pastoId], references: [id], onDelete: SetNull)
  observacoes     String?
  ativo           Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([insumoId])
  @@index([insumoId, data])
  @@index([insumoId, updatedAt])
  @@index([manejoRebanhoId])
  @@index([manejoPastoId])
  @@map("movimentacoes_insumo")
}

/// Consumo diário recorrente de um insumo por um rebanho. Não escreve no ledger:
/// o saldo projetado é calculado na leitura. Um regime ativo por par
/// (rebanhoId, insumoId) — índice único parcial WHERE ativo = true AND dataFim IS NULL.
model regimeConsumoInsumo {
  id            String   @id @default(uuid())
  rebanhoId     String
  rebanho       rebanho  @relation(fields: [rebanhoId], references: [id], onDelete: Cascade)
  insumoId      String
  insumo        insumo   @relation(fields: [insumoId], references: [id], onDelete: Cascade)
  quantidadeDia Decimal
  dataInicio    DateTime
  dataFim       DateTime?
  ativo         Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([rebanhoId])
  @@index([insumoId])
  @@map("regimes_consumo_insumo")
}
```

- [ ] **Step 2: Adicionar as relações reversas nos models existentes**

Em `model propriedade`, junto de `pastos`/`rebanhos`:
```prisma
  insumos  insumo[]
```
Em `model pasto`, junto das relações de movimentação:
```prisma
  movimentacoesInsumo movimentacaoInsumo[]
```
Em `model rebanho`, junto de `manejos`:
```prisma
  regimesConsumo      regimeConsumoInsumo[]
  movimentacoesInsumo movimentacaoInsumo[]
```
Em `model manejoRebanho` e `model manejoPasto`, ao fim dos campos:
```prisma
  movimentacoesInsumo movimentacaoInsumo[]
```

- [ ] **Step 3: Gerar a migration sem aplicar**

Run: `docker compose -f docker-compose.dev.yml exec api npx prisma migrate dev --create-only --name add_insumos`
Expected: cria `prisma/migrations/<ts>_add_insumos/migration.sql` com `CREATE TABLE` das 4 tabelas e os `@@index`. **Conferir que NÃO há `DROP INDEX`** dos índices parciais de `propriedades`/`pastos`/`rebanhos`. Se houver, remover essas linhas do SQL.

- [ ] **Step 4: Adicionar os índices únicos parciais ao SQL da migration**

Ao fim de `prisma/migrations/<ts>_add_insumos/migration.sql`, acrescentar:

```sql
-- Unicidade de nome de insumo por propriedade, case-insensitive, só entre ativos.
-- Mesmo padrão dos índices parciais de pastos/rebanhos (migration 20260729000000).
CREATE UNIQUE INDEX "insumos_propriedadeId_nome_ci_key"
    ON "insumos" ("propriedadeId", lower("nome"))
    WHERE ativo = true;

-- Um regime de consumo em aberto por par (rebanho, insumo).
CREATE UNIQUE INDEX "regimes_consumo_insumo_rebanhoId_insumoId_aberto_key"
    ON "regimes_consumo_insumo" ("rebanhoId", "insumoId")
    WHERE ativo = true AND "dataFim" IS NULL;
```

- [ ] **Step 5: Aplicar a migration e regenerar o client**

Run: `docker compose -f docker-compose.dev.yml exec api npx prisma migrate dev --name add_insumos`
Then: `docker compose -f docker-compose.dev.yml exec api npx prisma generate`
Expected: migration aplicada sem erro; `npx prisma generate` recria o client com `prisma.insumo`, `prisma.movimentacaoInsumo`, `prisma.regimeConsumoInsumo`, `prisma.tipoInsumo`.

- [ ] **Step 6: Verificar as tabelas**

Run: `docker compose -f docker-compose.dev.yml exec db psql -U postgres -d pasto_livre -c "\d insumos" -c "\di insumos_propriedadeId_nome_ci_key" -c "\di regimes_consumo_insumo_rebanhoId_insumoId_aberto_key"`
Expected: as tabelas existem; os dois índices parciais aparecem com a cláusula `WHERE`.

- [ ] **Step 7: Rodar a suíte para garantir que o schema não quebrou nada**

Run: `docker compose -f docker-compose.dev.yml exec api npm run test`
Expected: `test/schema.test.js` e o resto continuam passando (verde).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: adiciona schema e migration de insumos"
```

---

## Task 2: Seed do catálogo tipoInsumo

**Files:**
- Modify: `prisma/seeds/catalogoSeed.js`

**Interfaces:**
- Consumes: `prisma.tipoInsumo` (Task 1).
- Produces: `catalogos.tiposInsumo` no retorno de `seedCatalogos` (array de `{ id, nome, ... }`).

- [ ] **Step 1: Adicionar a lista e o upsert**

Em `prisma/seeds/catalogoSeed.js`, após a linha `const manejosPasto = [...]`:
```js
  const tiposInsumo = ['Ração', 'Sal mineral', 'Vacina', 'Medicamento', 'Fertilizante', 'Semente', 'Defensivo', 'Outro'];
```
Após o bloco `// Manejos Pasto` (antes do `console.log('  Catalogos globais registrados')`):
```js
  // Tipos de Insumo
  catalogos.tiposInsumo = [];
  for (const tipo of tiposInsumo) {
    const item = await prisma.tipoInsumo.upsert({
      where: { nome: tipo },
      update: {},
      create: { nome: tipo },
    });
    catalogos.tiposInsumo.push(item);
  }
```

- [ ] **Step 2: Rodar o seed**

Run: `npm run prisma:seed`
Expected: termina sem erro; log `Catalogos globais registrados`.

- [ ] **Step 3: Verificar as linhas**

Run: `docker compose -f docker-compose.dev.yml exec db psql -U postgres -d pasto_livre -c "SELECT nome FROM tipos_insumo ORDER BY nome;"`
Expected: 8 linhas (Defensivo, Fertilizante, Medicamento, Outro, Ração, Sal mineral, Semente, Vacina).

- [ ] **Step 4: Commit**

```bash
git add prisma/seeds/catalogoSeed.js
git commit -m "feat: semeia tipos de insumo no catalogo"
```

---

## Task 3: Catálogo `tipos-insumo` no CRUD existente

**Files:**
- Modify: `src/repository/CatalogoRepository.js:14-20` (objeto `CATALOGO_ENTITIES`)
- Modify: `src/routes/catalogoRoutes.js` (comentário)
- Test: `test/casosDeRegra.test.js` não cobre catálogo; verificação é via HTTP.

**Interfaces:**
- Consumes: `CatalogoService`/`CatalogoRepository` já existentes (nenhuma mudança de assinatura).
- Produces: endpoints `GET/POST/PATCH/DELETE /v1/catalogos/tipos-insumo` funcionando.

- [ ] **Step 1: Adicionar a entrada no mapa**

Em `src/repository/CatalogoRepository.js`, dentro de `CATALOGO_ENTITIES`, acrescentar:
```js
    'tipos-insumo':         { model: 'tipoInsumo',         label: 'Tipo de Insumo',            relationModel: 'insumo',        relationField: 'tipoInsumoId' },
```

- [ ] **Step 2: Atualizar o comentário de rotas**

Em `src/routes/catalogoRoutes.js`, na lista de entidades do bloco de comentário, acrescentar `tipos-insumo`.

- [ ] **Step 3: Subir a API e listar**

Run: `npm run dev` (em outro terminal), depois
`curl -s -H "Authorization: Bearer $TOKEN" http://localhost:6060/v1/catalogos/tipos-insumo | jq '.data.totalDocs, (.data.docs[0].nome)'`
(obter `$TOKEN` via `POST /api/auth/sign-in/email` com `admin@admin.com`/`admin` e o header `bearer`).
Expected: `totalDocs` = 8; primeiro nome em ordem alfabética `"Defensivo"`.

- [ ] **Step 4: Criar um tipo novo (admin)**

Run: `curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"nome":"Suplemento"}' http://localhost:6060/v1/catalogos/tipos-insumo | jq '.message'`
Expected: mensagem de criação; status 201.

- [ ] **Step 5: Commit**

```bash
git add src/repository/CatalogoRepository.js src/routes/catalogoRoutes.js
git commit -m "feat: expoe catalogo de tipos de insumo"
```

---

## Task 4: Módulo de cálculo de saldo e projeção

**Files:**
- Create: `src/service/insumo/calculoSaldo.js`
- Test: `test/insumo/calculoSaldo.test.js`

**Interfaces:**
- Produces:
  - `calcularSaldoReal(movimentacoes: {tipo: string, quantidade: number}[]): number`
  - `calcularConsumoProjetadoNaoLancado(regimes: {quantidadeDia: number, dataInicio: Date, dataFim: Date|null}[], movimentacoes: {origem: string, data: Date}[], agora: Date): number`
  - `calcularConsumoDiaTotal(regimes: {quantidadeDia: number, dataInicio: Date, dataFim: Date|null, ativo: boolean}[], agora: Date): number`
  - `calcularSaldos({ movimentacoes, regimes, agora }): { saldoReal: number, consumoProjetado: number, saldoProjetado: number, consumoDiaTotal: number, diasRestantes: number|null, previsaoTermino: string|null, esgotado: boolean }`
- Convenção: o service converte `Prisma.Decimal` para `Number` antes de chamar. Datas já são `Date`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `test/insumo/calculoSaldo.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
    calcularSaldoReal,
    calcularConsumoProjetadoNaoLancado,
    calcularConsumoDiaTotal,
    calcularSaldos,
} from '../../src/service/insumo/calculoSaldo.js';

const dia = (iso) => new Date(`${iso}T00:00:00Z`);

describe('calcularSaldoReal', () => {
    it('soma entrada, subtrai saida', () => {
        expect(calcularSaldoReal([
            { tipo: 'Entrada', quantidade: 100 },
            { tipo: 'Saida', quantidade: 30 },
            { tipo: 'Saida', quantidade: 20 },
        ])).toBe(50);
    });

    it('ajuste entra com o proprio sinal', () => {
        expect(calcularSaldoReal([
            { tipo: 'Entrada', quantidade: 100 },
            { tipo: 'Ajuste', quantidade: -12 },
            { tipo: 'Ajuste', quantidade: 5 },
        ])).toBe(93);
    });

    it('lista vazia da zero', () => {
        expect(calcularSaldoReal([])).toBe(0);
    });
});

describe('calcularConsumoProjetadoNaoLancado', () => {
    it('sem regimes, zero', () => {
        expect(calcularConsumoProjetadoNaoLancado([], [], dia('2026-08-28'))).toBe(0);
    });

    it('conta dias inteiros desde dataInicio quando nunca houve contagem', () => {
        const regimes = [{ quantidadeDia: 10, dataInicio: dia('2026-08-20'), dataFim: null }];
        // 8 dias de 20 a 28
        expect(calcularConsumoProjetadoNaoLancado(regimes, [], dia('2026-08-28'))).toBe(80);
    });

    it('a ultima contagem (AjusteContagem) reinicia o relogio', () => {
        const regimes = [{ quantidadeDia: 10, dataInicio: dia('2026-08-01'), dataFim: null }];
        const movs = [
            { origem: 'CadastroInicial', data: dia('2026-08-01') },
            { origem: 'AjusteContagem', data: dia('2026-08-25') },
        ];
        // conta de 25 a 28 = 3 dias
        expect(calcularConsumoProjetadoNaoLancado(regimes, movs, dia('2026-08-28'))).toBe(30);
    });

    it('respeita dataFim do regime', () => {
        const regimes = [{ quantidadeDia: 10, dataInicio: dia('2026-08-20'), dataFim: dia('2026-08-23') }];
        // 3 dias (20 a 23), mesmo consultando em 28
        expect(calcularConsumoProjetadoNaoLancado(regimes, [], dia('2026-08-28'))).toBe(30);
    });

    it('soma varios regimes do mesmo insumo', () => {
        const regimes = [
            { quantidadeDia: 10, dataInicio: dia('2026-08-26'), dataFim: null },
            { quantidadeDia: 2, dataInicio: dia('2026-08-26'), dataFim: null },
        ];
        // 2 dias * (10 + 2)
        expect(calcularConsumoProjetadoNaoLancado(regimes, [], dia('2026-08-28'))).toBe(24);
    });

    it('nunca negativo se a contagem e mais recente que agora', () => {
        const regimes = [{ quantidadeDia: 10, dataInicio: dia('2026-08-20'), dataFim: null }];
        const movs = [{ origem: 'AjusteContagem', data: dia('2026-08-30') }];
        expect(calcularConsumoProjetadoNaoLancado(regimes, movs, dia('2026-08-28'))).toBe(0);
    });
});

describe('calcularConsumoDiaTotal', () => {
    it('soma quantidadeDia dos regimes vigentes', () => {
        const regimes = [
            { quantidadeDia: 10, dataInicio: dia('2026-08-01'), dataFim: null, ativo: true },
            { quantidadeDia: 3, dataInicio: dia('2026-08-01'), dataFim: dia('2026-08-10'), ativo: false },
        ];
        expect(calcularConsumoDiaTotal(regimes, dia('2026-08-28'))).toBe(10);
    });
});

describe('calcularSaldos', () => {
    it('projeta saldo e previsao de termino', () => {
        const r = calcularSaldos({
            movimentacoes: [{ tipo: 'Entrada', quantidade: 100, origem: 'Compra', data: dia('2026-08-24') }],
            regimes: [{ quantidadeDia: 10, dataInicio: dia('2026-08-26'), dataFim: null, ativo: true }],
            agora: dia('2026-08-28'),
        });
        expect(r.saldoReal).toBe(100);
        expect(r.consumoProjetado).toBe(20); // 2 dias * 10
        expect(r.saldoProjetado).toBe(80);
        expect(r.consumoDiaTotal).toBe(10);
        expect(r.diasRestantes).toBe(8);
        expect(r.previsaoTermino).toBe('2026-09-05T00:00:00.000Z');
        expect(r.esgotado).toBe(false);
    });

    it('marca esgotado quando saldo projetado <= 0', () => {
        const r = calcularSaldos({
            movimentacoes: [{ tipo: 'Entrada', quantidade: 5, origem: 'Compra', data: dia('2026-08-01') }],
            regimes: [{ quantidadeDia: 10, dataInicio: dia('2026-08-20'), dataFim: null, ativo: true }],
            agora: dia('2026-08-28'),
        });
        expect(r.saldoProjetado).toBeLessThan(0);
        expect(r.esgotado).toBe(true);
        expect(r.previsaoTermino).toBeNull();
    });

    it('sem regimes, saldo projetado = saldo real e sem previsao', () => {
        const r = calcularSaldos({
            movimentacoes: [{ tipo: 'Entrada', quantidade: 40, origem: 'Compra', data: dia('2026-08-01') }],
            regimes: [],
            agora: dia('2026-08-28'),
        });
        expect(r.saldoProjetado).toBe(40);
        expect(r.consumoDiaTotal).toBe(0);
        expect(r.diasRestantes).toBeNull();
        expect(r.previsaoTermino).toBeNull();
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose -f docker-compose.dev.yml exec api npx vitest run test/insumo/calculoSaldo.test.js`
Expected: FAIL — `Failed to load .../calculoSaldo.js`.

- [ ] **Step 3: Implementar o módulo**

Criar `src/service/insumo/calculoSaldo.js`:

```js
// src/service/insumo/calculoSaldo.js
//
// Lógica pura de estoque de insumo. O service converte Prisma.Decimal para
// Number e passa Date antes de chamar qualquer função daqui.

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Dias inteiros de `de` até `ate`, nunca negativo. */
function diasEntre(de, ate) {
    return Math.max(0, Math.floor((ate.getTime() - de.getTime()) / MS_POR_DIA));
}

/** Saldo pelo ledger: Entrada soma, Saida subtrai, Ajuste entra com o sinal dado. */
export function calcularSaldoReal(movimentacoes = []) {
    return movimentacoes.reduce((total, m) => {
        if (m.tipo === 'Entrada') return total + m.quantidade;
        if (m.tipo === 'Saida') return total - m.quantidade;
        return total + m.quantidade; // Ajuste
    }, 0);
}

/**
 * Consumo dos regimes ainda não lançado no ledger, desde a última contagem
 * física (movimentação de origem `AjusteContagem`) ou desde o início de cada
 * regime, o que for mais recente.
 */
export function calcularConsumoProjetadoNaoLancado(regimes = [], movimentacoes = [], agora = new Date()) {
    const contagens = movimentacoes
        .filter((m) => m.origem === 'AjusteContagem')
        .map((m) => m.data.getTime());
    const marco = contagens.length ? new Date(Math.max(...contagens)) : null;

    return regimes.reduce((total, regime) => {
        const inicioBase = marco && marco > regime.dataInicio ? marco : regime.dataInicio;
        const fim = regime.dataFim && regime.dataFim < agora ? regime.dataFim : agora;
        return total + regime.quantidadeDia * diasEntre(inicioBase, fim);
    }, 0);
}

/** Soma de `quantidadeDia` dos regimes vigentes hoje. */
export function calcularConsumoDiaTotal(regimes = [], agora = new Date()) {
    return regimes
        .filter((r) => r.ativo !== false && (!r.dataFim || r.dataFim > agora) && r.dataInicio <= agora)
        .reduce((total, r) => total + r.quantidadeDia, 0);
}

/** Pacote completo exibido na leitura de um insumo. */
export function calcularSaldos({ movimentacoes = [], regimes = [], agora = new Date() }) {
    const saldoReal = calcularSaldoReal(movimentacoes);
    const consumoProjetado = calcularConsumoProjetadoNaoLancado(regimes, movimentacoes, agora);
    const saldoProjetado = saldoReal - consumoProjetado;
    const consumoDiaTotal = calcularConsumoDiaTotal(regimes, agora);

    let diasRestantes = null;
    let previsaoTermino = null;
    const esgotado = saldoProjetado <= 0;

    if (consumoDiaTotal > 0) {
        diasRestantes = saldoProjetado / consumoDiaTotal;
        if (!esgotado) {
            previsaoTermino = new Date(agora.getTime() + diasRestantes * MS_POR_DIA).toISOString();
        }
    }

    return { saldoReal, consumoProjetado, saldoProjetado, consumoDiaTotal, diasRestantes, previsaoTermino, esgotado };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `docker compose -f docker-compose.dev.yml exec api npx vitest run test/insumo/calculoSaldo.test.js`
Expected: PASS (todos os `describe`).

- [ ] **Step 5: Commit**

```bash
git add src/service/insumo/calculoSaldo.js test/insumo/calculoSaldo.test.js
git commit -m "feat: calculo de saldo e projecao de insumo"
```

---

## Task 5: Recurso `insumo` (6 camadas)

**Files:**
- Create: `src/utils/validators/schemas/zod/InsumoSchema.js`
- Create: `src/utils/validators/schemas/zod/querys/InsumoQuerySchema.js`
- Create: `src/repository/InsumoRepository.js`
- Create: `src/service/InsumoService.js`
- Create: `src/controllers/InsumoController.js`
- Create: `src/routes/insumoRoutes.js`
- Modify: `src/repository/index.js`, `src/routes/index.js`
- Test: `test/services/insumoService.test.js`

**Interfaces:**
- Consumes: `calcularSaldos` (Task 4); `propriedadeRepository` (existente).
- Produces:
  - `InsumoCreateSchema`, `InsumoUpdateSchema` (Zod, `.strict()`), `InsumoQuerySchema`, `InsumoIdSchema`.
  - `insumoRepository` singleton com `list(usuarioId, filters, page, limit)`, `findById(id, usuarioId)`, `findByNome(propriedadeId, nome, excludeId)`, `create(data, tx)`, `update(id, data, tx)`, `remove(id, tx)`.
  - `InsumoService` com `list(req)`, `create(parsedData, req, tx)`, `update(id, parsedData, req, tx)`, `remove(id, req, tx)`, `ensureInsumoExists(id, usuarioId)`.
  - Rotas `GET /v1/insumos`, `GET /v1/insumos/:id`, `POST /v1/insumos`, `PATCH /v1/insumos/:id`, `DELETE /v1/insumos/:id`.
  - Formato de leitura: cada insumo vem com `saldo: { saldoReal, consumoProjetado, saldoProjetado, consumoDiaTotal, diasRestantes, previsaoTermino, esgotado, estoqueBaixo }`. `estoqueBaixo` = `estoqueMinimo != null && saldoProjetado <= estoqueMinimo`.

- [ ] **Step 1: Escrever o teste de service que falha**

Criar `test/services/insumoService.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('InsumoService', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: InsumoService } = await import('../../src/service/InsumoService.js');
        service = new InsumoService();
    });

    it('recusa criar insumo em propriedade de outro usuario', async () => {
        service.propriedadeRepository = { findById: vi.fn().mockResolvedValue(null) };

        await expect(
            service.create({ propriedadeId: 'p1', tipoInsumoId: 't1', nome: 'Ração', destino: 'Rebanho', unidadeMedida: 'kg' }, req('invasor')),
        ).rejects.toMatchObject({ errorType: 'resourceNotFound', statusCode: 404 });
    });

    it('recusa tipoInsumo inexistente ou inativo', async () => {
        service.propriedadeRepository = { findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }) };
        service.repository = { findByNome: vi.fn().mockResolvedValue(null) };
        service.prisma = { tipoInsumo: { findFirst: vi.fn().mockResolvedValue(null) } };

        await expect(
            service.create({ propriedadeId: 'p1', tipoInsumoId: 'x', nome: 'Ração', destino: 'Rebanho', unidadeMedida: 'kg' }, req()),
        ).rejects.toMatchObject({ errorType: 'resourceNotFound', field: 'tipoInsumoId' });
    });

    it('recusa nome de insumo repetido na mesma propriedade', async () => {
        service.propriedadeRepository = { findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }) };
        service.prisma = { tipoInsumo: { findFirst: vi.fn().mockResolvedValue({ id: 't1' }) } };
        service.repository = { findByNome: vi.fn().mockResolvedValue({ id: 'outro' }) };

        await expect(
            service.create({ propriedadeId: 'p1', tipoInsumoId: 't1', nome: 'Ração', destino: 'Rebanho', unidadeMedida: 'kg' }, req()),
        ).rejects.toMatchObject({ errorType: 'conflict', field: 'nome' });
    });

    it('preserva o id recebido ao criar (offline-first)', async () => {
        service.propriedadeRepository = { findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }) };
        service.prisma = { tipoInsumo: { findFirst: vi.fn().mockResolvedValue({ id: 't1' }) } };
        const create = vi.fn().mockResolvedValue({ id: 'uuid-do-cliente' });
        service.repository = { findByNome: vi.fn().mockResolvedValue(null), create };

        await service.create(
            { id: 'uuid-do-cliente', propriedadeId: 'p1', tipoInsumoId: 't1', nome: 'Ração', destino: 'Rebanho', unidadeMedida: 'kg' },
            req(),
        );
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: 'uuid-do-cliente' }), undefined);
    });

    it('enriquece a leitura por id com o pacote de saldo', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({
                id: 'i1', estoqueMinimo: null,
                movimentacoes: [{ tipo: 'Entrada', quantidade: 100, origem: 'Compra', data: new Date('2026-08-01T00:00:00Z') }],
                regimesConsumo: [],
            }),
        };
        const out = await service.list({ ...req(), params: { id: 'i1' } });
        expect(out.saldo.saldoReal).toBe(100);
        expect(out.saldo.saldoProjetado).toBe(100);
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose -f docker-compose.dev.yml exec api npx vitest run test/services/insumoService.test.js`
Expected: FAIL — módulo `InsumoService.js` não existe.

- [ ] **Step 3: Criar os schemas Zod**

`src/utils/validators/schemas/zod/InsumoSchema.js`:
```js
// src/utils/validators/schemas/zod/InsumoSchema.js
import { z } from 'zod/v4';

export const DESTINOS_INSUMO = ['Pasto', 'Rebanho', 'Ambos'];
export const UNIDADES_INSUMO = ['kg', 'g', 'L', 'mL', 'dose', 'saco', 'unidade'];

export const InsumoCreateSchema = z.object({
    id:            z.string().uuid('O ID deve ser um UUID válido.').optional(),
    propriedadeId: z.string().uuid('O ID da propriedade deve ser um UUID válido.'),
    tipoInsumoId:  z.string().uuid('O ID do tipo de insumo deve ser um UUID válido.'),
    nome:          z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.').max(120, 'Máximo 120 caracteres.').trim(),
    destino:       z.enum(DESTINOS_INSUMO, { message: `destino deve ser um de: ${DESTINOS_INSUMO.join(', ')}.` }),
    unidadeMedida: z.enum(UNIDADES_INSUMO, { message: `unidadeMedida deve ser uma de: ${UNIDADES_INSUMO.join(', ')}.` }),
    estoqueMinimo: z.number().nonnegative('O estoque mínimo não pode ser negativo.').optional().nullable(),
}).strict();

export const InsumoUpdateSchema = z.object({
    tipoInsumoId:  z.string().uuid('O ID do tipo de insumo deve ser um UUID válido.').optional(),
    nome:          z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.').max(120, 'Máximo 120 caracteres.').trim().optional(),
    destino:       z.enum(DESTINOS_INSUMO).optional(),
    unidadeMedida: z.enum(UNIDADES_INSUMO).optional(),
    estoqueMinimo: z.number().nonnegative('O estoque mínimo não pode ser negativo.').optional().nullable(),
    ativo:         z.boolean().optional(),
}).strict();

export default InsumoCreateSchema;
```

`src/utils/validators/schemas/zod/querys/InsumoQuerySchema.js`:
```js
// src/utils/validators/schemas/zod/querys/InsumoQuerySchema.js
import { z } from 'zod/v4';

export const InsumoIdSchema = z.string().uuid('ID de insumo inválido. Deve ser um UUID válido.');

export const InsumoQuerySchema = z.object({
    propriedadeId: z.string().uuid('O ID da propriedade deve ser um UUID válido.').optional(),
    tipoInsumoId:  z.string().uuid('O ID do tipo de insumo deve ser um UUID válido.').optional(),
    destino:       z.enum(['Pasto', 'Rebanho', 'Ambos']).optional(),
    nome:          z.string().optional(),
    ativo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    atualizadoDesde: z.string().datetime({ message: 'atualizadoDesde deve ser uma data ISO 8601 em UTC.' })
        .transform((v) => new Date(v)).optional(),
    page:  z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { InsumoIdSchema as default };
```

- [ ] **Step 4: Criar o repository**

`src/repository/InsumoRepository.js`:
```js
// src/repository/InsumoRepository.js
import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca, contemInsensitive, igualInsensitive } from '../utils/helpers/index.js';

// A leitura carrega o ledger e os regimes para o service calcular o saldo.
const INSUMO_SELECT = {
    id: true,
    propriedadeId: true,
    tipoInsumoId: true,
    nome: true,
    destino: true,
    unidadeMedida: true,
    estoqueMinimo: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
    tipoInsumo: { select: { id: true, nome: true } },
    propriedade: { select: { id: true, nome: true } },
    movimentacoes: {
        where: { ativo: true },
        select: { tipo: true, quantidade: true, data: true, origem: true },
    },
    regimesConsumo: {
        where: { ativo: true },
        select: { quantidadeDia: true, dataInicio: true, dataFim: true, ativo: true },
    },
};

class InsumoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = { propriedade: { usuarioId } };
        aplicarAtivoOuDiferenca(where, filters);

        if (filters.tipoInsumoId) where.tipoInsumoId = filters.tipoInsumoId;
        if (filters.destino)      where.destino = filters.destino;
        if (filters.nome)         where.nome = contemInsensitive(filters.nome);
        if (filters.propriedadeId) {
            where.propriedade = { ...where.propriedade, id: filters.propriedadeId };
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.insumo.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { nome: 'asc' },
                select: INSUMO_SELECT,
            }),
            this.prisma.insumo.count({ where }),
        ]);

        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        return this.prisma.insumo.findFirst({
            where: { id, propriedade: { usuarioId } },
            select: INSUMO_SELECT,
        });
    }

    async findByNome(propriedadeId, nome, excludeId = null) {
        const where = { propriedadeId, nome: igualInsensitive(nome), ativo: true };
        if (excludeId) where.id = { not: excludeId };
        return this.prisma.insumo.findFirst({ where, select: { id: true } });
    }

    async create(data, tx) {
        return ondeEscrever(tx, this.prisma).insumo.create({ data, select: INSUMO_SELECT });
    }

    async update(id, data, tx) {
        return ondeEscrever(tx, this.prisma).insumo.update({ where: { id }, data, select: INSUMO_SELECT });
    }

    async remove(id, tx) {
        return ondeEscrever(tx, this.prisma).insumo.update({ where: { id }, data: { ativo: false } });
    }
}

export default InsumoRepository;
```

- [ ] **Step 5: Registrar o singleton**

Em `src/repository/index.js`, adicionar o import e a exportação:
```js
import InsumoRepository from './InsumoRepository.js';
// ...
export const insumoRepository = new InsumoRepository();
```

- [ ] **Step 6: Criar o service**

`src/service/InsumoService.js`:
```js
// src/service/InsumoService.js
import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import { insumoRepository, propriedadeRepository } from '../repository/index.js';
import DbConnect from '../config/dbConnect.js';
import { calcularSaldos } from './insumo/calculoSaldo.js';

class InsumoService {
    constructor() {
        this.repository = insumoRepository;
        this.propriedadeRepository = propriedadeRepository;
        this.prisma = DbConnect.prisma;
    }

    /** Converte Decimal -> Number e anexa o pacote de saldo a um insumo lido. */
    comSaldo(insumo) {
        const movimentacoes = (insumo.movimentacoes ?? []).map((m) => ({
            tipo: m.tipo,
            quantidade: Number(m.quantidade),
            origem: m.origem,
            data: m.data,
        }));
        const regimes = (insumo.regimesConsumo ?? []).map((r) => ({
            quantidadeDia: Number(r.quantidadeDia),
            dataInicio: r.dataInicio,
            dataFim: r.dataFim,
            ativo: r.ativo,
        }));
        const saldo = calcularSaldos({ movimentacoes, regimes, agora: new Date() });
        const estoqueMinimo = insumo.estoqueMinimo == null ? null : Number(insumo.estoqueMinimo);
        saldo.estoqueBaixo = estoqueMinimo != null && saldo.saldoProjetado <= estoqueMinimo;

        const { movimentacoes: _m, regimesConsumo: _r, ...limpo } = insumo;
        return { ...limpo, saldo };
    }

    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            const insumo = await this.ensureInsumoExists(id, usuarioId);
            return this.comSaldo(insumo);
        }

        const { propriedadeId, tipoInsumoId, destino, nome, ativo, atualizadoDesde, page = 1, limit = 10 } =
            req._parsedQuery ?? req.query;
        const filters = {};
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (tipoInsumoId)  filters.tipoInsumoId = tipoInsumoId;
        if (destino)       filters.destino = destino;
        if (nome)          filters.nome = nome;
        if (ativo !== undefined) filters.ativo = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        const pagina = await this.repository.list(
            usuarioId, filters, parseInt(page, 10), Math.min(parseInt(limit, 10) || 10, 100),
        );
        return { ...pagina, docs: pagina.docs.map((d) => this.comSaldo(d)) };
    }

    async create(parsedData, req, tx) {
        const usuarioId = req.user.id;
        await this.ensurePropriedadeExists(parsedData.propriedadeId, usuarioId);
        await this.ensureTipoInsumoExists(parsedData.tipoInsumoId);
        await this.ensureNomeDisponivel(parsedData.propriedadeId, parsedData.nome);
        const criado = await this.repository.create(parsedData, tx);
        return this.comSaldo(criado);
    }

    async update(id, parsedData, req, tx) {
        const usuarioId = req.user.id;
        const atual = await this.ensureInsumoExists(id, usuarioId);

        if (parsedData.tipoInsumoId) {
            await this.ensureTipoInsumoExists(parsedData.tipoInsumoId);
        }
        if (parsedData.nome && parsedData.nome.toLowerCase() !== atual.nome.toLowerCase()) {
            await this.ensureNomeDisponivel(atual.propriedadeId, parsedData.nome, id);
        }
        const atualizado = await this.repository.update(id, parsedData, tx);
        return this.comSaldo(atualizado);
    }

    async remove(id, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureInsumoExists(id, usuarioId);
        return this.repository.remove(id, tx);
    }

    // utilitários

    async ensureInsumoExists(id, usuarioId) {
        const insumo = await this.repository.findById(id, usuarioId);
        if (!insumo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Insumo',
                details: [],
                customMessage: messages.error.resourceNotFound('Insumo'),
            });
        }
        return insumo;
    }

    async ensurePropriedadeExists(propriedadeId, usuarioId) {
        const p = await this.propriedadeRepository.findById(propriedadeId, usuarioId);
        if (!p) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Propriedade',
                details: [],
                customMessage: 'Propriedade não encontrada ou não pertence ao usuário autenticado.',
            });
        }
        return p;
    }

    async ensureTipoInsumoExists(tipoInsumoId) {
        const tipo = await this.prisma.tipoInsumo.findFirst({ where: { id: tipoInsumoId, ativo: true } });
        if (!tipo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'tipoInsumoId',
                details: [{ path: 'tipoInsumoId', message: 'Tipo de insumo não encontrado ou inativo.' }],
                customMessage: 'Tipo de insumo não encontrado.',
            });
        }
        return tipo;
    }

    async ensureNomeDisponivel(propriedadeId, nome, excludeId = null) {
        const existe = await this.repository.findByNome(propriedadeId, nome, excludeId);
        if (existe) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'conflict',
                field: 'nome',
                details: [{ path: 'nome', message: 'Já existe um insumo com este nome nesta propriedade.' }],
                customMessage: 'Já existe um insumo com este nome nesta propriedade.',
            });
        }
    }
}

export default InsumoService;
```

- [ ] **Step 7: Criar o controller**

`src/controllers/InsumoController.js`:
```js
// src/controllers/InsumoController.js
import InsumoService from '../service/InsumoService.js';
import { InsumoCreateSchema, InsumoUpdateSchema } from '../utils/validators/schemas/zod/InsumoSchema.js';
import { InsumoQuerySchema, InsumoIdSchema } from '../utils/validators/schemas/zod/querys/InsumoQuerySchema.js';
import { CommonResponse, CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

class InsumoController {
    constructor() {
        this.service = new InsumoService();
    }

    async list(req, res) {
        const { id } = req.params;
        if (id) InsumoIdSchema.parse(id);

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            req._parsedQuery = await InsumoQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Insumo encontrado com sucesso.');
        }
        const totalDocs = data?.totalDocs ?? 0;
        const msg = totalDocs === 0
            ? 'Nenhum insumo cadastrado.'
            : `${totalDocs} insumo(s) encontrado(s).`;
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, msg);
    }

    async create(req, res) {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça os dados do insumo.',
            });
        }
        const parsedData = InsumoCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);
        return CommonResponse.created(res, data, 'Insumo cadastrado com sucesso.');
    }

    async update(req, res) {
        const { id } = req.params;
        InsumoIdSchema.parse(id);
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça pelo menos um campo para atualizar.',
            });
        }
        const parsedData = InsumoUpdateSchema.parse(req.body);
        const data = await this.service.update(id, parsedData, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Insumo atualizado com sucesso.');
    }

    async remove(req, res) {
        const { id } = req.params;
        InsumoIdSchema.parse(id);
        const data = await this.service.remove(id, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Insumo excluído com sucesso.');
    }
}

export default InsumoController;
```

- [ ] **Step 8: Criar as rotas e registrar**

`src/routes/insumoRoutes.js`:
```js
// src/routes/insumoRoutes.js
import express from 'express';
import InsumoController from '../controllers/InsumoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const insumoController = new InsumoController();

router
    .get('/insumos', AuthMiddleware, asyncWrapper(insumoController.list.bind(insumoController)))
    .get('/insumos/:id', AuthMiddleware, asyncWrapper(insumoController.list.bind(insumoController)))
    .post('/insumos', AuthMiddleware, asyncWrapper(insumoController.create.bind(insumoController)))
    .patch('/insumos/:id', AuthMiddleware, asyncWrapper(insumoController.update.bind(insumoController)))
    .delete('/insumos/:id', AuthMiddleware, asyncWrapper(insumoController.remove.bind(insumoController)));

export default router;
```

Em `src/routes/index.js`: importar `insumoRoutes` e incluí-lo no `app.use('/v1', ...)` **antes** de `pastoRoutes`/`rebanhoRoutes` (rota específica antes de genérica — aqui `/insumos` não colide, mas mantém o padrão do arquivo). Colocar logo após `movimentacaoRoutes`.

- [ ] **Step 9: Rodar os testes de service**

Run: `docker compose -f docker-compose.dev.yml exec api npx vitest run test/services/insumoService.test.js`
Expected: PASS.

- [ ] **Step 10: Smoke test HTTP**

Com `npm run dev` no ar e `$TOKEN`/`$PROP` (id de uma propriedade do usuário) e `$TIPO` (id de um tipoInsumo):
```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"propriedadeId\":\"$PROP\",\"tipoInsumoId\":\"$TIPO\",\"nome\":\"Ração 20%\",\"destino\":\"Rebanho\",\"unidadeMedida\":\"kg\",\"estoqueMinimo\":50}" \
  http://localhost:6060/v1/insumos | jq '.data.id, .data.saldo'
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:6060/v1/insumos?propriedadeId=$PROP" | jq '.data.totalDocs, .data.docs[0].saldo.saldoProjetado'
```
Expected: cria com `saldo.saldoReal = 0`, `saldo.esgotado = true` (sem entradas); lista traz o insumo com `saldo` embutido.

- [ ] **Step 11: Commit**

```bash
git add src/utils/validators/schemas/zod/InsumoSchema.js src/utils/validators/schemas/zod/querys/InsumoQuerySchema.js src/repository/InsumoRepository.js src/repository/index.js src/service/InsumoService.js src/controllers/InsumoController.js src/routes/insumoRoutes.js src/routes/index.js test/services/insumoService.test.js
git commit -m "feat: adiciona recurso de insumo"
```

---

## Task 6: Recurso `movimentacaoInsumo` (6 camadas)

**Files:**
- Create: `src/utils/validators/schemas/zod/MovimentacaoInsumoSchema.js`
- Create: `src/utils/validators/schemas/zod/querys/MovimentacaoInsumoQuerySchema.js`
- Create: `src/repository/MovimentacaoInsumoRepository.js`
- Create: `src/service/MovimentacaoInsumoService.js`
- Create: `src/controllers/MovimentacaoInsumoController.js`
- Modify: `src/repository/index.js`, `src/routes/insumoRoutes.js`
- Test: `test/services/movimentacaoInsumoService.test.js`

**Interfaces:**
- Consumes: `insumoRepository` (Task 5).
- Produces:
  - `MovimentacaoInsumoCreateSchema` (Zod `.strict()`), com `ORIGENS_MOVIMENTACAO` exportado. `origem` `ManejoRebanho`/`ManejoPasto` **rejeitada** neste schema (só o fluxo de manejo as cria).
  - `movimentacaoInsumoRepository` com `list(insumoId, usuarioId, filters, page, limit)`, `findById(id, usuarioId)`, `create(data, tx)`, `remove(id, tx)`.
  - `MovimentacaoInsumoService` com `list(req)`, `create(parsedData, req, tx)`, `remove(id, req, tx)`.
  - Rotas `GET /v1/insumos/movimentacoes` (filtro `insumoId` obrigatório), `POST /v1/insumos/movimentacoes`, `DELETE /v1/insumos/movimentacoes/:id`.
- Nota de ordem de rotas: registrar essas 3 linhas **antes** de `/insumos/:id` no `insumoRoutes.js`, senão `GET /insumos/:id` captura `/insumos/movimentacoes`.

- [ ] **Step 1: Teste de service que falha**

Criar `test/services/movimentacaoInsumoService.test.js`:
```js
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('MovimentacaoInsumoService', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: MovimentacaoInsumoService } = await import('../../src/service/MovimentacaoInsumoService.js');
        service = new MovimentacaoInsumoService();
    });

    it('recusa movimentacao para insumo de outro usuario', async () => {
        service.insumoRepository = { findById: vi.fn().mockResolvedValue(null) };
        await expect(
            service.create({ insumoId: 'i1', tipo: 'Entrada', quantidade: 10, data: new Date(), origem: 'Compra' }, req('invasor')),
        ).rejects.toMatchObject({ errorType: 'resourceNotFound', statusCode: 404 });
    });

    it('preserva o id ao criar', async () => {
        service.insumoRepository = { findById: vi.fn().mockResolvedValue({ id: 'i1' }) };
        const create = vi.fn().mockResolvedValue({ id: 'uuid-cli' });
        service.repository = { create };
        await service.create(
            { id: 'uuid-cli', insumoId: 'i1', tipo: 'Entrada', quantidade: 10, data: new Date(), origem: 'Compra' },
            req(),
        );
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: 'uuid-cli' }), undefined);
    });

    it('list exige insumoId', async () => {
        await expect(
            service.list({ ...req(), _parsedQuery: {} }),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'insumoId' });
    });
});
```
E no schema (validação de origem) — coberto por `test/syncValidacao`-style; verificação rápida via `safeParse` incluída no Step 4.

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose -f docker-compose.dev.yml exec api npx vitest run test/services/movimentacaoInsumoService.test.js`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Schemas**

`src/utils/validators/schemas/zod/MovimentacaoInsumoSchema.js`:
```js
// src/utils/validators/schemas/zod/MovimentacaoInsumoSchema.js
import { z } from 'zod/v4';

export const TIPOS_MOVIMENTACAO = ['Entrada', 'Saida', 'Ajuste'];
// Origens que o produtor lança direto. ManejoRebanho/ManejoPasto só nascem
// pelo fluxo de manejo, nunca por este endpoint.
export const ORIGENS_MOVIMENTACAO = ['Compra', 'CadastroInicial', 'ConsumoRebanho', 'AjusteContagem', 'Perda'];

export const MovimentacaoInsumoCreateSchema = z.object({
    id:         z.string().uuid('O ID deve ser um UUID válido.').optional(),
    insumoId:   z.string().uuid('O ID do insumo deve ser um UUID válido.'),
    tipo:       z.enum(TIPOS_MOVIMENTACAO, { message: `tipo deve ser um de: ${TIPOS_MOVIMENTACAO.join(', ')}.` }),
    quantidade: z.number({ error: 'A quantidade deve ser um número.' }).finite('Quantidade inválida.'),
    data:       z.coerce.date({ error: 'A data deve ser uma data válida.' })
                  .refine((d) => d <= new Date(), { message: 'A data não pode ser no futuro.' }),
    origem:     z.enum(ORIGENS_MOVIMENTACAO, { message: `origem deve ser uma de: ${ORIGENS_MOVIMENTACAO.join(', ')}.` }),
    rebanhoId:  z.string().uuid('O ID do rebanho deve ser um UUID válido.').optional().nullable(),
    pastoId:    z.string().uuid('O ID do pasto deve ser um UUID válido.').optional().nullable(),
    observacoes: z.string().max(500, 'Máximo 500 caracteres.').optional().nullable(),
})
    .strict()
    .refine((m) => m.tipo === 'Ajuste' || m.quantidade > 0, {
        message: 'Quantidade deve ser maior que zero para Entrada e Saída.',
        path: ['quantidade'],
    })
    .refine((m) => m.quantidade !== 0, { message: 'A quantidade não pode ser zero.', path: ['quantidade'] });

export default MovimentacaoInsumoCreateSchema;
```

`src/utils/validators/schemas/zod/querys/MovimentacaoInsumoQuerySchema.js`:
```js
// src/utils/validators/schemas/zod/querys/MovimentacaoInsumoQuerySchema.js
import { z } from 'zod/v4';

export const MovimentacaoInsumoIdSchema = z.string().uuid('ID de movimentação inválido. Deve ser um UUID válido.');

export const MovimentacaoInsumoQuerySchema = z.object({
    insumoId:   z.string().uuid('O ID do insumo deve ser um UUID válido.').optional(),
    tipo:       z.enum(['Entrada', 'Saida', 'Ajuste']).optional(),
    origem:     z.string().optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim:    z.coerce.date().optional(),
    ativo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    atualizadoDesde: z.string().datetime({ message: 'atualizadoDesde deve ser uma data ISO 8601 em UTC.' })
        .transform((v) => new Date(v)).optional(),
    page:  z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { MovimentacaoInsumoIdSchema as default };
```

- [ ] **Step 4: Verificar a regra de origem do schema**

Run:
```bash
docker compose -f docker-compose.dev.yml exec api node -e "import('./src/utils/validators/schemas/zod/MovimentacaoInsumoSchema.js').then(m=>{const r=m.default.safeParse({insumoId:'11111111-1111-1111-1111-111111111111',tipo:'Saida',quantidade:1,data:new Date().toISOString(),origem:'ManejoPasto'});console.log(r.success, r.error?.issues?.[0]?.message)})"
```
Expected: `false` e mensagem citando as origens aceitas (rejeita `ManejoPasto`).

- [ ] **Step 5: Repository**

`src/repository/MovimentacaoInsumoRepository.js`:
```js
// src/repository/MovimentacaoInsumoRepository.js
import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca, intervaloData } from '../utils/helpers/index.js';

const MOV_SELECT = {
    id: true,
    insumoId: true,
    tipo: true,
    quantidade: true,
    data: true,
    origem: true,
    manejoRebanhoId: true,
    manejoPastoId: true,
    rebanhoId: true,
    pastoId: true,
    observacoes: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
    insumo: { select: { id: true, nome: true, unidadeMedida: true } },
};

class MovimentacaoInsumoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = { insumo: { propriedade: { usuarioId } } };
        aplicarAtivoOuDiferenca(where, filters);

        if (filters.insumoId) where.insumoId = filters.insumoId;
        if (filters.tipo)     where.tipo = filters.tipo;
        if (filters.origem)   where.origem = filters.origem;
        if (filters.dataInicio || filters.dataFim) {
            where.data = intervaloData(filters.dataInicio, filters.dataFim);
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.movimentacaoInsumo.findMany({
                where, skip: (page - 1) * limit, take: limit,
                orderBy: { data: 'desc' }, select: MOV_SELECT,
            }),
            this.prisma.movimentacaoInsumo.count({ where }),
        ]);
        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        return this.prisma.movimentacaoInsumo.findFirst({
            where: { id, insumo: { propriedade: { usuarioId } } },
            select: MOV_SELECT,
        });
    }

    async create(data, tx) {
        return ondeEscrever(tx, this.prisma).movimentacaoInsumo.create({ data, select: MOV_SELECT });
    }

    async remove(id, tx) {
        return ondeEscrever(tx, this.prisma).movimentacaoInsumo.update({ where: { id }, data: { ativo: false } });
    }
}

export default MovimentacaoInsumoRepository;
```
Registrar `movimentacaoInsumoRepository` em `src/repository/index.js`.

- [ ] **Step 6: Service**

`src/service/MovimentacaoInsumoService.js`:
```js
// src/service/MovimentacaoInsumoService.js
import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import { movimentacaoInsumoRepository, insumoRepository } from '../repository/index.js';

class MovimentacaoInsumoService {
    constructor() {
        this.repository = movimentacaoInsumoRepository;
        this.insumoRepository = insumoRepository;
    }

    async list(req) {
        const usuarioId = req.user.id;
        const { id } = req.params;
        if (id) return this.ensureExists(id, usuarioId);

        const q = req._parsedQuery ?? req.query;
        if (!q.insumoId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'insumoId',
                details: [{ path: 'insumoId', message: 'Informe o insumoId para listar as movimentações.' }],
                customMessage: 'Informe o insumo.',
            });
        }
        await this.ensureInsumoDoUsuario(q.insumoId, usuarioId);

        const { insumoId, tipo, origem, dataInicio, dataFim, ativo, atualizadoDesde, page = 1, limit = 10 } = q;
        const filters = { insumoId };
        if (tipo)   filters.tipo = tipo;
        if (origem) filters.origem = origem;
        if (dataInicio) filters.dataInicio = dataInicio;
        if (dataFim)    filters.dataFim = dataFim;
        if (ativo !== undefined) filters.ativo = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        return this.repository.list(usuarioId, filters, parseInt(page, 10), Math.min(parseInt(limit, 10) || 10, 100));
    }

    async create(parsedData, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureInsumoDoUsuario(parsedData.insumoId, usuarioId);
        return this.repository.create(parsedData, tx);
    }

    async remove(id, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureExists(id, usuarioId);
        return this.repository.remove(id, tx);
    }

    async ensureExists(id, usuarioId) {
        const mov = await this.repository.findById(id, usuarioId);
        if (!mov) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Movimentação de Insumo',
                details: [],
                customMessage: messages.error.resourceNotFound('Movimentação de Insumo'),
            });
        }
        return mov;
    }

    async ensureInsumoDoUsuario(insumoId, usuarioId) {
        const insumo = await this.insumoRepository.findById(insumoId, usuarioId);
        if (!insumo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Insumo',
                details: [],
                customMessage: 'Insumo não encontrado ou não pertence ao usuário autenticado.',
            });
        }
        return insumo;
    }
}

export default MovimentacaoInsumoService;
```

- [ ] **Step 7: Controller**

`src/controllers/MovimentacaoInsumoController.js` — espelha `InsumoController` (list/create/remove; sem update). Usa `MovimentacaoInsumoCreateSchema`, `MovimentacaoInsumoQuerySchema`, `MovimentacaoInsumoIdSchema`. Mensagens: `'Movimentação registrada com sucesso.'` (created), `'Movimentação excluída com sucesso.'`, listagem `` `${totalDocs} movimentação(ões) encontrada(s).` ``.

```js
// src/controllers/MovimentacaoInsumoController.js
import MovimentacaoInsumoService from '../service/MovimentacaoInsumoService.js';
import { MovimentacaoInsumoCreateSchema } from '../utils/validators/schemas/zod/MovimentacaoInsumoSchema.js';
import {
    MovimentacaoInsumoQuerySchema,
    MovimentacaoInsumoIdSchema,
} from '../utils/validators/schemas/zod/querys/MovimentacaoInsumoQuerySchema.js';
import { CommonResponse, CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

class MovimentacaoInsumoController {
    constructor() {
        this.service = new MovimentacaoInsumoService();
    }

    async list(req, res) {
        const { id } = req.params;
        if (id) MovimentacaoInsumoIdSchema.parse(id);

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            req._parsedQuery = await MovimentacaoInsumoQuerySchema.parseAsync(query);
        }
        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Movimentação encontrada com sucesso.');
        }
        const totalDocs = data?.totalDocs ?? 0;
        const msg = totalDocs === 0
            ? 'Nenhuma movimentação encontrada.'
            : `${totalDocs} movimentação(ões) encontrada(s).`;
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, msg);
    }

    async create(req, res) {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça os dados da movimentação.',
            });
        }
        const parsedData = MovimentacaoInsumoCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);
        return CommonResponse.created(res, data, 'Movimentação registrada com sucesso.');
    }

    async remove(req, res) {
        const { id } = req.params;
        MovimentacaoInsumoIdSchema.parse(id);
        const data = await this.service.remove(id, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Movimentação excluída com sucesso.');
    }
}

export default MovimentacaoInsumoController;
```

- [ ] **Step 8: Rotas**

Em `src/routes/insumoRoutes.js`, adicionar o import e — **acima** das rotas `/insumos/:id` — registrar:
```js
import MovimentacaoInsumoController from '../controllers/MovimentacaoInsumoController.js';
// ...
const movimentacaoInsumoController = new MovimentacaoInsumoController();

router
    .get('/insumos/movimentacoes', AuthMiddleware, asyncWrapper(movimentacaoInsumoController.list.bind(movimentacaoInsumoController)))
    .get('/insumos/movimentacoes/:id', AuthMiddleware, asyncWrapper(movimentacaoInsumoController.list.bind(movimentacaoInsumoController)))
    .post('/insumos/movimentacoes', AuthMiddleware, asyncWrapper(movimentacaoInsumoController.create.bind(movimentacaoInsumoController)))
    .delete('/insumos/movimentacoes/:id', AuthMiddleware, asyncWrapper(movimentacaoInsumoController.remove.bind(movimentacaoInsumoController)));
```
(as linhas `/insumos` genéricas do controller de insumo continuam depois destas.)

- [ ] **Step 9: Rodar testes + smoke**

Run: `docker compose -f docker-compose.dev.yml exec api npx vitest run test/services/movimentacaoInsumoService.test.js`
Expected: PASS.

Smoke (com `$INSUMO` do Task 5):
```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"insumoId\":\"$INSUMO\",\"tipo\":\"Entrada\",\"quantidade\":200,\"data\":\"2026-08-24T00:00:00.000Z\",\"origem\":\"Compra\"}" \
  http://localhost:6060/v1/insumos/movimentacoes | jq '.message'
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:6060/v1/insumos/$INSUMO" | jq '.data.saldo'
```
Expected: `saldo.saldoReal = 200`; `esgotado = false` se sem regime.

- [ ] **Step 10: Commit**

```bash
git add src/utils/validators/schemas/zod/MovimentacaoInsumoSchema.js src/utils/validators/schemas/zod/querys/MovimentacaoInsumoQuerySchema.js src/repository/MovimentacaoInsumoRepository.js src/repository/index.js src/service/MovimentacaoInsumoService.js src/controllers/MovimentacaoInsumoController.js src/routes/insumoRoutes.js test/services/movimentacaoInsumoService.test.js
git commit -m "feat: adiciona ledger de movimentacao de insumo"
```

---

## Task 7: Recurso `regimeConsumoInsumo` (6 camadas)

**Files:**
- Create: `src/utils/validators/schemas/zod/RegimeConsumoInsumoSchema.js`
- Create: `src/utils/validators/schemas/zod/querys/RegimeConsumoInsumoQuerySchema.js`
- Create: `src/repository/RegimeConsumoInsumoRepository.js`
- Create: `src/service/RegimeConsumoInsumoService.js`
- Create: `src/controllers/RegimeConsumoInsumoController.js`
- Create: `src/routes/regimeConsumoRoutes.js`
- Modify: `src/repository/index.js`, `src/routes/index.js`
- Test: `test/services/regimeConsumoInsumoService.test.js`

**Interfaces:**
- Consumes: `rebanhoRepository`, `insumoRepository`; `comTransacao` de `src/utils/helpers/transacao.js`.
- Produces:
  - `RegimeConsumoInsumoCreateSchema`, `RegimeConsumoInsumoUpdateSchema` (Zod `.strict()`).
  - `regimeConsumoInsumoRepository` com `list(usuarioId, filters, page, limit)`, `findById(id, usuarioId)`, `findAbertoDoPar(rebanhoId, insumoId, tx)`, `create(data, tx)`, `update(id, data, tx)`.
  - `RegimeConsumoInsumoService` com `list(req)`, `create(parsedData, req, tx)`, `update(id, parsedData, req, tx)` (encerrar), `remove(id, req, tx)`.
  - Rotas `GET /v1/rebanhos/regimes-consumo` (filtro `rebanhoId`), `GET /v1/rebanhos/regimes-consumo/:id`, `POST /v1/rebanhos/regimes-consumo`, `PATCH /v1/rebanhos/regimes-consumo/:id`, `DELETE /v1/rebanhos/regimes-consumo/:id`.
- Regra central: `create` encerra o regime em aberto do mesmo par `(rebanhoId, insumoId)` (set `dataFim = dataInicio do novo`, `ativo = false`) e cria o novo — **na mesma transação**. `update` com `dataFim` encerra (`ativo = false`).

- [ ] **Step 1: Teste de service que falha**

Criar `test/services/regimeConsumoInsumoService.test.js`:
```js
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('RegimeConsumoInsumoService', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });
    const base = {
        rebanhoId: 'r1', insumoId: 'i1', quantidadeDia: 5,
        dataInicio: new Date('2026-08-20T00:00:00Z'), dataFim: null,
    };

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: RegimeConsumoInsumoService } = await import('../../src/service/RegimeConsumoInsumoService.js');
        service = new RegimeConsumoInsumoService();
        // comTransacao sem tx externa chama prisma.$transaction(cb) -> aqui roda cb com um "tx" fake
        service.prisma = { $transaction: (cb) => cb('TX') };
    });

    it('recusa regime em rebanho de outro usuario', async () => {
        service.rebanhoRepository = { findById: vi.fn().mockResolvedValue(null) };
        await expect(service.create(base, req('invasor')))
            .rejects.toMatchObject({ errorType: 'resourceNotFound', statusCode: 404 });
    });

    it('recusa insumo cujo destino nao serve ao rebanho', async () => {
        service.rebanhoRepository = { findById: vi.fn().mockResolvedValue({ id: 'r1', propriedadeId: 'p1' }) };
        service.insumoRepository = { findById: vi.fn().mockResolvedValue({ id: 'i1', propriedadeId: 'p1', destino: 'Pasto' }) };
        await expect(service.create(base, req()))
            .rejects.toMatchObject({ errorType: 'validationError', field: 'insumoId' });
    });

    it('recusa insumo de outra propriedade', async () => {
        service.rebanhoRepository = { findById: vi.fn().mockResolvedValue({ id: 'r1', propriedadeId: 'p1' }) };
        service.insumoRepository = { findById: vi.fn().mockResolvedValue({ id: 'i1', propriedadeId: 'p2', destino: 'Rebanho' }) };
        await expect(service.create(base, req()))
            .rejects.toMatchObject({ errorType: 'validationError', field: 'insumoId' });
    });

    it('encerra o regime em aberto do par antes de criar o novo', async () => {
        service.rebanhoRepository = { findById: vi.fn().mockResolvedValue({ id: 'r1', propriedadeId: 'p1' }) };
        service.insumoRepository = { findById: vi.fn().mockResolvedValue({ id: 'i1', propriedadeId: 'p1', destino: 'Ambos' }) };
        const update = vi.fn().mockResolvedValue({});
        const create = vi.fn().mockResolvedValue({ id: 'novo' });
        service.repository = {
            findAbertoDoPar: vi.fn().mockResolvedValue({ id: 'antigo' }),
            update, create,
        };

        await service.create({ ...base, id: 'novo' }, req());

        expect(update).toHaveBeenCalledWith('antigo', expect.objectContaining({ ativo: false, dataFim: base.dataInicio }), 'TX');
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: 'novo' }), 'TX');
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose -f docker-compose.dev.yml exec api npx vitest run test/services/regimeConsumoInsumoService.test.js`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Schemas**

`src/utils/validators/schemas/zod/RegimeConsumoInsumoSchema.js`:
```js
// src/utils/validators/schemas/zod/RegimeConsumoInsumoSchema.js
import { z } from 'zod/v4';

export const RegimeConsumoInsumoCreateSchema = z.object({
    id:            z.string().uuid('O ID deve ser um UUID válido.').optional(),
    rebanhoId:     z.string().uuid('O ID do rebanho deve ser um UUID válido.'),
    insumoId:      z.string().uuid('O ID do insumo deve ser um UUID válido.'),
    quantidadeDia: z.number({ error: 'A quantidade diária deve ser um número.' })
                     .positive('A quantidade diária deve ser maior que zero.'),
    dataInicio:    z.coerce.date({ error: 'A data de início deve ser uma data válida.' }),
    dataFim:       z.coerce.date({ error: 'A data de fim deve ser uma data válida.' }).optional().nullable(),
})
    .strict()
    .refine((r) => !r.dataFim || r.dataInicio <= r.dataFim, {
        message: 'A data de início não pode ser depois da data de fim.',
        path: ['dataFim'],
    });

export const RegimeConsumoInsumoUpdateSchema = z.object({
    quantidadeDia: z.number().positive('A quantidade diária deve ser maior que zero.').optional(),
    dataFim:       z.coerce.date({ error: 'A data de fim deve ser uma data válida.' }).optional().nullable(),
}).strict();

export default RegimeConsumoInsumoCreateSchema;
```

`src/utils/validators/schemas/zod/querys/RegimeConsumoInsumoQuerySchema.js`:
```js
// src/utils/validators/schemas/zod/querys/RegimeConsumoInsumoQuerySchema.js
import { z } from 'zod/v4';

export const RegimeConsumoInsumoIdSchema = z.string().uuid('ID de regime inválido. Deve ser um UUID válido.');

export const RegimeConsumoInsumoQuerySchema = z.object({
    rebanhoId: z.string().uuid('O ID do rebanho deve ser um UUID válido.').optional(),
    insumoId:  z.string().uuid('O ID do insumo deve ser um UUID válido.').optional(),
    // 'true' => só os em aberto (dataFim IS NULL); default: todos
    emAberto:  z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    ativo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    atualizadoDesde: z.string().datetime({ message: 'atualizadoDesde deve ser uma data ISO 8601 em UTC.' })
        .transform((v) => new Date(v)).optional(),
    page:  z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { RegimeConsumoInsumoIdSchema as default };
```

- [ ] **Step 4: Repository**

`src/repository/RegimeConsumoInsumoRepository.js`:
```js
// src/repository/RegimeConsumoInsumoRepository.js
import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca } from '../utils/helpers/index.js';

const REGIME_SELECT = {
    id: true,
    rebanhoId: true,
    insumoId: true,
    quantidadeDia: true,
    dataInicio: true,
    dataFim: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
    insumo: { select: { id: true, nome: true, unidadeMedida: true } },
    rebanho: { select: { id: true, nomeRebanho: true } },
};

class RegimeConsumoInsumoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = { rebanho: { propriedade: { usuarioId } } };
        aplicarAtivoOuDiferenca(where, filters);

        if (filters.rebanhoId) where.rebanhoId = filters.rebanhoId;
        if (filters.insumoId)  where.insumoId = filters.insumoId;
        if (filters.emAberto)  where.dataFim = null;

        const [docs, totalDocs] = await Promise.all([
            this.prisma.regimeConsumoInsumo.findMany({
                where, skip: (page - 1) * limit, take: limit,
                orderBy: { dataInicio: 'desc' }, select: REGIME_SELECT,
            }),
            this.prisma.regimeConsumoInsumo.count({ where }),
        ]);
        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        return this.prisma.regimeConsumoInsumo.findFirst({
            where: { id, rebanho: { propriedade: { usuarioId } } },
            select: REGIME_SELECT,
        });
    }

    /** O regime vigente (não encerrado) do par, se houver. Respeita a transação. */
    async findAbertoDoPar(rebanhoId, insumoId, tx) {
        return ondeEscrever(tx, this.prisma).regimeConsumoInsumo.findFirst({
            where: { rebanhoId, insumoId, ativo: true, dataFim: null },
            select: { id: true },
        });
    }

    async create(data, tx) {
        return ondeEscrever(tx, this.prisma).regimeConsumoInsumo.create({ data, select: REGIME_SELECT });
    }

    async update(id, data, tx) {
        return ondeEscrever(tx, this.prisma).regimeConsumoInsumo.update({ where: { id }, data, select: REGIME_SELECT });
    }
}

export default RegimeConsumoInsumoRepository;
```
Registrar `regimeConsumoInsumoRepository` em `src/repository/index.js`.

- [ ] **Step 5: Service**

`src/service/RegimeConsumoInsumoService.js`:
```js
// src/service/RegimeConsumoInsumoService.js
import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import { regimeConsumoInsumoRepository, rebanhoRepository, insumoRepository } from '../repository/index.js';
import { comTransacao } from '../utils/helpers/transacao.js';
import DbConnect from '../config/dbConnect.js';

class RegimeConsumoInsumoService {
    constructor() {
        this.repository = regimeConsumoInsumoRepository;
        this.rebanhoRepository = rebanhoRepository;
        this.insumoRepository = insumoRepository;
        this.prisma = DbConnect.prisma;
    }

    async list(req) {
        const usuarioId = req.user.id;
        const { id } = req.params;
        if (id) return this.ensureExists(id, usuarioId);

        const { rebanhoId, insumoId, emAberto, ativo, atualizadoDesde, page = 1, limit = 10 } =
            req._parsedQuery ?? req.query;
        const filters = {};
        if (rebanhoId) filters.rebanhoId = rebanhoId;
        if (insumoId)  filters.insumoId = insumoId;
        if (emAberto)  filters.emAberto = emAberto;
        if (ativo !== undefined) filters.ativo = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        return this.repository.list(usuarioId, filters, parseInt(page, 10), Math.min(parseInt(limit, 10) || 10, 100));
    }

    async create(parsedData, req, tx) {
        const usuarioId = req.user.id;
        const rebanho = await this.ensureRebanho(parsedData.rebanhoId, usuarioId);
        const insumo = await this.ensureInsumo(parsedData.insumoId, usuarioId);
        this.validarCompatibilidade(rebanho, insumo);

        return comTransacao(this.prisma, tx, async (trx) => {
            const aberto = await this.repository.findAbertoDoPar(parsedData.rebanhoId, parsedData.insumoId, trx);
            if (aberto) {
                await this.repository.update(aberto.id, { dataFim: parsedData.dataInicio, ativo: false }, trx);
            }
            return this.repository.create(parsedData, trx);
        });
    }

    async update(id, parsedData, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureExists(id, usuarioId);
        const dados = { ...parsedData };
        if (dados.dataFim) dados.ativo = false; // encerrar
        return this.repository.update(id, dados, tx);
    }

    async remove(id, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureExists(id, usuarioId);
        // exclusão lógica: encerra e desativa
        return this.repository.update(id, { ativo: false, dataFim: new Date() }, tx);
    }

    // utilitários

    validarCompatibilidade(rebanho, insumo) {
        if (insumo.propriedadeId !== rebanho.propriedadeId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'insumoId',
                details: [{ path: 'insumoId', message: 'O insumo pertence a outra propriedade.' }],
                customMessage: 'Insumo e rebanho são de propriedades diferentes.',
            });
        }
        if (!['Rebanho', 'Ambos'].includes(insumo.destino)) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'insumoId',
                details: [{ path: 'insumoId', message: 'Este insumo não é destinado ao rebanho.' }],
                customMessage: 'Insumo não pode ser consumido pelo rebanho.',
            });
        }
    }

    async ensureExists(id, usuarioId) {
        const regime = await this.repository.findById(id, usuarioId);
        if (!regime) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Regime de Consumo',
                details: [],
                customMessage: messages.error.resourceNotFound('Regime de Consumo'),
            });
        }
        return regime;
    }

    async ensureRebanho(rebanhoId, usuarioId) {
        const rebanho = await this.rebanhoRepository.findById(rebanhoId, usuarioId);
        if (!rebanho) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Rebanho',
                details: [],
                customMessage: 'Rebanho não encontrado ou não pertence ao usuário autenticado.',
            });
        }
        return rebanho;
    }

    async ensureInsumo(insumoId, usuarioId) {
        const insumo = await this.insumoRepository.findById(insumoId, usuarioId);
        if (!insumo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Insumo',
                details: [],
                customMessage: 'Insumo não encontrado ou não pertence ao usuário autenticado.',
            });
        }
        return insumo;
    }
}

export default RegimeConsumoInsumoService;
```
> Nota: `rebanhoRepository.findById` deve retornar `propriedadeId` no select. Conferir `src/repository/RebanhoRepository.js`; se o `REBANHO_SELECT` não trouxer `propriedadeId`, adicionar `propriedadeId: true` (mudança segura, já usada por outros consumidores).

- [ ] **Step 6: Controller + rotas**

`src/controllers/RegimeConsumoInsumoController.js` — espelha `InsumoController` (list/create/update/remove). Mensagens: created `'Regime de consumo cadastrado com sucesso.'`; update `'Regime de consumo atualizado com sucesso.'`; remove `'Regime de consumo encerrado com sucesso.'`; listagem `` `${totalDocs} regime(s) de consumo encontrado(s).` ``. Schemas: `RegimeConsumoInsumoCreateSchema`, `RegimeConsumoInsumoUpdateSchema`, `RegimeConsumoInsumoQuerySchema`, `RegimeConsumoInsumoIdSchema`.

`src/routes/regimeConsumoRoutes.js`:
```js
// src/routes/regimeConsumoRoutes.js
import express from 'express';
import RegimeConsumoInsumoController from '../controllers/RegimeConsumoInsumoController.js';
import { asyncWrapper } from '../utils/helpers/index.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';

const router = express.Router();
const controller = new RegimeConsumoInsumoController();

router
    .get('/rebanhos/regimes-consumo', AuthMiddleware, asyncWrapper(controller.list.bind(controller)))
    .get('/rebanhos/regimes-consumo/:id', AuthMiddleware, asyncWrapper(controller.list.bind(controller)))
    .post('/rebanhos/regimes-consumo', AuthMiddleware, asyncWrapper(controller.create.bind(controller)))
    .patch('/rebanhos/regimes-consumo/:id', AuthMiddleware, asyncWrapper(controller.update.bind(controller)))
    .delete('/rebanhos/regimes-consumo/:id', AuthMiddleware, asyncWrapper(controller.remove.bind(controller)));

export default router;
```
Em `src/routes/index.js`: importar `regimeConsumoRoutes` e incluí-lo no `app.use('/v1', ...)` **antes** de `rebanhoRoutes` (senão `/rebanhos/:id` engole `/rebanhos/regimes-consumo` — mesma armadilha documentada no arquivo para `manejoRebanhoRoutes`).

- [ ] **Step 7: Rodar testes + smoke**

Run: `docker compose -f docker-compose.dev.yml exec api npx vitest run test/services/regimeConsumoInsumoService.test.js`
Expected: PASS.

Smoke (com `$REBANHO` e `$INSUMO`, insumo com `destino` Rebanho/Ambos, mesma propriedade):
```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"rebanhoId\":\"$REBANHO\",\"insumoId\":\"$INSUMO\",\"quantidadeDia\":10,\"dataInicio\":\"2026-08-26T00:00:00.000Z\"}" \
  http://localhost:6060/v1/rebanhos/regimes-consumo | jq '.data.id'
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:6060/v1/insumos/$INSUMO" | jq '.data.saldo.saldoProjetado, .data.saldo.previsaoTermino'
```
Expected: `saldoProjetado` = `saldoReal - 10*dias`; `previsaoTermino` uma data ISO (se saldo positivo).

Encerrar via novo regime do mesmo par:
```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"rebanhoId\":\"$REBANHO\",\"insumoId\":\"$INSUMO\",\"quantidadeDia\":8,\"dataInicio\":\"2026-08-28T00:00:00.000Z\"}" \
  http://localhost:6060/v1/rebanhos/regimes-consumo | jq '.data.id'
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:6060/v1/rebanhos/regimes-consumo?rebanhoId=$REBANHO&insumoId=$INSUMO" | jq '[.data.docs[] | {id, dataFim, ativo}]'
```
Expected: dois regimes; o antigo com `dataFim` preenchida e `ativo=false`, o novo em aberto.

- [ ] **Step 8: Commit**

```bash
git add src/utils/validators/schemas/zod/RegimeConsumoInsumoSchema.js src/utils/validators/schemas/zod/querys/RegimeConsumoInsumoQuerySchema.js src/repository/RegimeConsumoInsumoRepository.js src/repository/index.js src/service/RegimeConsumoInsumoService.js src/controllers/RegimeConsumoInsumoController.js src/routes/regimeConsumoRoutes.js src/routes/index.js src/repository/RebanhoRepository.js test/services/regimeConsumoInsumoService.test.js
git commit -m "feat: adiciona regime de consumo de insumo do rebanho"
```

---

## Task 8: Itens de insumo nos manejos de pasto e rebanho

**Files:**
- Modify: `src/utils/validators/schemas/zod/ManejoPastoSchema.js`, `.../ManejoRebanhoSchema.js`
- Modify: `src/repository/ManejoPastoRepository.js`, `.../ManejoRebanhoRepository.js`
- Modify: `src/service/ManejoPastoService.js`, `.../ManejoRebanhoService.js`
- Test: `test/services/manejoInsumoItens.test.js`

**Interfaces:**
- Consumes: `insumoRepository`, `movimentacaoInsumoRepository`; `comTransacao`; `calcularSaldos` (para o aviso de estoque).
- Produces:
  - `ManejoPastoCreateSchema` e `ManejoRebanhoCreateSchema` ganham campo opcional `itens: { insumoId: uuid, quantidade: number > 0, observacoes?: string }[]`.
  - `ManejoPastoService.create` / `ManejoRebanhoService.create`: criam o manejo e uma `movimentacaoInsumo` `Saida` por item, **na mesma transação**; origem `ManejoPasto`/`ManejoRebanho`; preenchem `manejoPastoId`/`manejoRebanhoId` e `pastoId`/`rebanhoId`. Retornam o manejo com `itens` (as movimentações) e, quando algum insumo fica com `saldoProjetado` negativo após o débito, um array `avisos: string[]` — **não** lançam erro.
  - `MANEJO_SELECT` de leitura passa a incluir `movimentacoesInsumo` (as ativas), expostas como `itens`.

- [ ] **Step 1: Teste que falha**

Criar `test/services/manejoInsumoItens.test.js`:
```js
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ManejoPastoService — itens de insumo', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: { $transaction: (cb) => cb('TX') } } }));
        vi.resetModules();
        const { default: ManejoPastoService } = await import('../../src/service/ManejoPastoService.js');
        service = new ManejoPastoService();
        service.prisma = { $transaction: (cb) => cb('TX') };
    });

    const pasto = { id: 'past1', ativo: true, propriedadeId: 'p1' };

    function armaHappyPath({ destino = 'Pasto', saldoMovs = [{ tipo: 'Entrada', quantidade: 100 }] } = {}) {
        service.pastoRepository = { findById: vi.fn().mockResolvedValue(pasto) };
        service.ensureTipoManejoExists = vi.fn().mockResolvedValue({ id: 'tm1' });
        service.repository = { create: vi.fn().mockResolvedValue({ id: 'manejo1' }) };
        service.insumoRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'i1', propriedadeId: 'p1', destino,
                movimentacoes: saldoMovs.map((m) => ({ ...m, origem: 'Compra', data: new Date('2026-08-01T00:00:00Z') })),
                regimesConsumo: [] }),
        };
        service.movimentacaoInsumoRepository = { create: vi.fn().mockResolvedValue({ id: 'mov1' }) };
    }

    it('cria uma movimentacao Saida por item, na transacao', async () => {
        armaHappyPath();
        await service.create({
            pastoId: 'past1', tipoManejoId: 'tm1', dataAtividade: new Date('2026-08-27T00:00:00Z'),
            itens: [{ insumoId: 'i1', quantidade: 5 }],
        }, req());

        expect(service.movimentacaoInsumoRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                insumoId: 'i1', tipo: 'Saida', quantidade: 5,
                origem: 'ManejoPasto', manejoPastoId: 'manejo1', pastoId: 'past1',
            }),
            'TX',
        );
    });

    it('recusa item com insumo de destino incompativel', async () => {
        armaHappyPath({ destino: 'Rebanho' });
        await expect(service.create({
            pastoId: 'past1', tipoManejoId: 'tm1', dataAtividade: new Date('2026-08-27T00:00:00Z'),
            itens: [{ insumoId: 'i1', quantidade: 5 }],
        }, req())).rejects.toMatchObject({ errorType: 'validationError', field: 'itens' });
    });

    it('estoque insuficiente gera aviso, nao erro', async () => {
        armaHappyPath({ saldoMovs: [{ tipo: 'Entrada', quantidade: 2 }] });
        const out = await service.create({
            pastoId: 'past1', tipoManejoId: 'tm1', dataAtividade: new Date('2026-08-27T00:00:00Z'),
            itens: [{ insumoId: 'i1', quantidade: 5 }],
        }, req());
        expect(out.avisos.length).toBe(1);
        expect(service.movimentacaoInsumoRepository.create).toHaveBeenCalled();
    });

    it('sem itens, comportamento inalterado', async () => {
        armaHappyPath();
        await service.create({
            pastoId: 'past1', tipoManejoId: 'tm1', dataAtividade: new Date('2026-08-27T00:00:00Z'),
        }, req());
        expect(service.movimentacaoInsumoRepository.create).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose -f docker-compose.dev.yml exec api npx vitest run test/services/manejoInsumoItens.test.js`
Expected: FAIL — `itens` ignorado / `movimentacaoInsumoRepository` indefinido.

- [ ] **Step 3: Estender os schemas de manejo**

Em `src/utils/validators/schemas/zod/ManejoPastoSchema.js`, dentro de `ManejoPastoCreateSchema.object({...})`, adicionar:
```js
        itens: z
            .array(
                z.object({
                    insumoId: z.string().uuid('O ID do insumo deve ser um UUID válido.'),
                    quantidade: z.number({ error: 'A quantidade deve ser um número.' })
                        .positive('A quantidade deve ser maior que zero.'),
                    observacoes: z.string().max(500, 'Máximo 500 caracteres.').optional().nullable(),
                }).strict(),
            )
            .max(50, 'No máximo 50 itens de insumo por manejo.')
            .optional(),
```
(Não adicionar `itens` no `ManejoPastoUpdateSchema` — itens só entram na criação do manejo nesta fase.)
Fazer o equivalente em `ManejoRebanhoSchema.js` → `ManejoRebanhoCreateSchema`.

- [ ] **Step 4: `create` do ManejoPastoService**

Reescrever `ManejoPastoService.create` para separar `itens`, envolver tudo em transação e debitar o estoque:
```js
import { comTransacao } from '../utils/helpers/transacao.js';
import { calcularSaldos } from './insumo/calculoSaldo.js';
import { insumoRepository, movimentacaoInsumoRepository } from '../repository/index.js';
// no construtor:
//   this.insumoRepository = insumoRepository;
//   this.movimentacaoInsumoRepository = movimentacaoInsumoRepository;

async create(parsedData, req, tx) {
    const usuarioId = req.user.id;
    const { itens = [], ...dadosManejo } = parsedData;

    const pasto = await this.ensurePastoExists(dadosManejo.pastoId, usuarioId);
    if (!pasto.ativo) {
        throw new CustomError({
            statusCode: HttpStatusCodes.BAD_REQUEST.code,
            errorType: 'validationError',
            field: 'pastoId',
            details: [{ path: 'pastoId', message: 'Não é possível registrar um manejo em um pasto inativo.' }],
            customMessage: 'Pasto está inativo.',
        });
    }
    await this.ensureTipoManejoExists(dadosManejo.tipoManejoId);

    // valida os insumos ANTES de abrir a transação
    const insumosPorId = new Map();
    for (const item of itens) {
        if (insumosPorId.has(item.insumoId)) continue;
        const insumo = await this.insumoRepository.findById(item.insumoId, usuarioId);
        if (!insumo || insumo.propriedadeId !== pasto.propriedadeId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'itens',
                details: [{ path: 'itens', message: `Insumo ${item.insumoId} não encontrado nesta propriedade.` }],
                customMessage: 'Insumo do item não encontrado nesta propriedade.',
            });
        }
        if (!['Pasto', 'Ambos'].includes(insumo.destino)) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'itens',
                details: [{ path: 'itens', message: `O insumo "${insumo.nome}" não é destinado ao pasto.` }],
                customMessage: 'Um dos insumos não pode ser usado em manejo de pasto.',
            });
        }
        insumosPorId.set(item.insumoId, insumo);
    }

    return comTransacao(this.prisma, tx, async (trx) => {
        const manejo = await this.repository.create(dadosManejo, trx);

        const avisos = [];
        const movimentacoes = [];
        for (const item of itens) {
            const insumo = insumosPorId.get(item.insumoId);
            const mov = await this.movimentacaoInsumoRepository.create({
                insumoId: item.insumoId,
                tipo: 'Saida',
                quantidade: item.quantidade,
                data: dadosManejo.dataAtividade,
                origem: 'ManejoPasto',
                manejoPastoId: manejo.id,
                pastoId: pasto.id,
                observacoes: item.observacoes ?? null,
            }, trx);
            movimentacoes.push(mov);

            const movs = (insumo.movimentacoes ?? []).map((m) => ({
                tipo: m.tipo, quantidade: Number(m.quantidade), origem: m.origem, data: m.data,
            }));
            movs.push({ tipo: 'Saida', quantidade: item.quantidade, origem: 'ManejoPasto', data: dadosManejo.dataAtividade });
            const regimes = (insumo.regimesConsumo ?? []).map((r) => ({
                quantidadeDia: Number(r.quantidadeDia), dataInicio: r.dataInicio, dataFim: r.dataFim, ativo: r.ativo,
            }));
            if (calcularSaldos({ movimentacoes: movs, regimes, agora: new Date() }).saldoProjetado < 0) {
                avisos.push(`Estoque insuficiente de "${insumo.nome}" — saldo ficará negativo.`);
            }
        }

        return { ...manejo, itens: movimentacoes, ...(avisos.length ? { avisos } : {}) };
    });
}
```
Aplicar a mesma reescrita em `ManejoRebanhoService.create`, trocando: `pastoId`→`rebanhoId`, `ensurePastoExists`→`ensureRebanhoExists`, `origem: 'ManejoRebanho'`, `manejoRebanhoId`, destino aceito `['Rebanho', 'Ambos']`, mensagem "manejo de rebanho".
> Conferir `ManejoRebanhoService` para o nome exato do método que valida o rebanho (`ensureRebanhoExists` ou similar) e se ele devolve `propriedadeId`.

- [ ] **Step 5: Expor `itens` na leitura de manejo**

Em `src/repository/ManejoPastoRepository.js`, dentro de `MANEJO_SELECT`, adicionar:
```js
    movimentacoesInsumo: {
        where: { ativo: true },
        select: {
            id: true, insumoId: true, quantidade: true, observacoes: true,
            insumo: { select: { id: true, nome: true, unidadeMedida: true } },
        },
    },
```
E no `list`/`findById`, mapear cada doc para `{ ...doc, itens: doc.movimentacoesInsumo }` removendo `movimentacoesInsumo` cru (ou fazer esse remapeamento no service, seguindo o padrão do arquivo). Mesma coisa em `ManejoRebanhoRepository.js`.
> Se hoje `create` do `ManejoPastoRepository` já aceita `tx` (aceita — via `ondeEscrever`), nenhuma mudança extra ali.

- [ ] **Step 6: Rodar testes**

Run: `docker compose -f docker-compose.dev.yml exec api npx vitest run test/services/manejoInsumoItens.test.js test/services/pastoService.test.js`
Expected: PASS (o novo arquivo e o de pasto que já existia continuam verdes).
Run: `docker compose -f docker-compose.dev.yml exec api npm run test`
Expected: suíte inteira verde (checar `test/manejoSoftDelete.test.js`, `test/casosDeRegra.test.js`).

- [ ] **Step 7: Smoke HTTP**

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{
  \"pastoId\":\"$PASTO\",\"tipoManejoId\":\"$TIPO_MANEJO_PASTO\",\"dataAtividade\":\"2026-08-27T00:00:00.000Z\",
  \"itens\":[{\"insumoId\":\"$INSUMO_PASTO\",\"quantidade\":15}]
}" http://localhost:6060/v1/pastagens/manejos | jq '.data.itens, .data.avisos'
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:6060/v1/insumos/$INSUMO_PASTO" | jq '.data.saldo.saldoReal'
```
Expected: manejo criado com `itens` de 1 movimentação; `saldoReal` do insumo caiu 15.

- [ ] **Step 8: Commit**

```bash
git add src/utils/validators/schemas/zod/ManejoPastoSchema.js src/utils/validators/schemas/zod/ManejoRebanhoSchema.js src/repository/ManejoPastoRepository.js src/repository/ManejoRebanhoRepository.js src/service/ManejoPastoService.js src/service/ManejoRebanhoService.js test/services/manejoInsumoItens.test.js
git commit -m "feat: permite itens de insumo nos manejos"
```

---

## Task 9: Registro no endpoint de lote `/v1/sync`

**Files:**
- Modify: `src/service/sync/despacho.js`
- Modify: `src/service/sync/validacao.js`
- Test: `test/syncInsumos.test.js`

**Interfaces:**
- Consumes: `InsumoService`, `MovimentacaoInsumoService`, `RegimeConsumoInsumoService` (Tasks 5–7); schemas de criação/atualização respectivos.
- Produces: chaves novas em `DESPACHO` e `SCHEMAS_DE_MUTACAO`:
  - `insumos:CREATE|UPDATE|DELETE`
  - `movimentacoes_insumo:CREATE|DELETE` (sem UPDATE — evento, igual a `historico_movimentacoes`)
  - `regimes_consumo_insumo:CREATE|UPDATE|DELETE` (UPDATE = encerrar/ajustar)
- Nota: `tipos_insumo` **não** entra no sync — catálogo é gerenciado só por admin, o app o consome por leitura. Itens de insumo de um manejo viajam dentro do payload de `manejo_pastos:CREATE` / `manejo_rebanhos:CREATE` (campo `itens`), já validado pelos schemas de criação de manejo.

- [ ] **Step 1: Teste que falha**

Criar `test/syncInsumos.test.js`:
```js
import { describe, expect, it } from 'vitest';
import { DESPACHO } from '../src/service/sync/despacho.js';
import { SCHEMAS_DE_MUTACAO } from '../src/service/sync/validacao.js';

describe('sync — entidades de insumo', () => {
    it('DESPACHO cobre insumo, movimentacao e regime', () => {
        for (const chave of [
            'insumos:CREATE', 'insumos:UPDATE', 'insumos:DELETE',
            'movimentacoes_insumo:CREATE', 'movimentacoes_insumo:DELETE',
            'regimes_consumo_insumo:CREATE', 'regimes_consumo_insumo:UPDATE', 'regimes_consumo_insumo:DELETE',
        ]) {
            expect(typeof DESPACHO[chave], chave).toBe('function');
        }
    });

    it('movimentacao de insumo nao tem UPDATE no lote', () => {
        expect(DESPACHO['movimentacoes_insumo:UPDATE']).toBeUndefined();
    });

    it('SCHEMAS_DE_MUTACAO valida os corpos de create/update', () => {
        for (const chave of [
            'insumos:CREATE', 'insumos:UPDATE',
            'movimentacoes_insumo:CREATE',
            'regimes_consumo_insumo:CREATE', 'regimes_consumo_insumo:UPDATE',
        ]) {
            expect(SCHEMAS_DE_MUTACAO[chave], chave).toBeTruthy();
        }
    });

    it('o schema do lote rejeita campo estranho em insumos:CREATE', () => {
        const r = SCHEMAS_DE_MUTACAO['insumos:CREATE'].safeParse({
            propriedadeId: '11111111-1111-1111-1111-111111111111',
            tipoInsumoId: '22222222-2222-2222-2222-222222222222',
            nome: 'Ração', destino: 'Rebanho', unidadeMedida: 'kg', hackeado: true,
        });
        expect(r.success).toBe(false);
    });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `docker compose -f docker-compose.dev.yml exec api npx vitest run test/syncInsumos.test.js`
Expected: FAIL — chaves indefinidas.

- [ ] **Step 3: Estender `despacho.js`**

Em `src/service/sync/despacho.js`, adicionar os imports e instâncias:
```js
import InsumoService from '../InsumoService.js';
import MovimentacaoInsumoService from '../MovimentacaoInsumoService.js';
import RegimeConsumoInsumoService from '../RegimeConsumoInsumoService.js';
// ...
const insumo = new InsumoService();
const movimentacaoInsumo = new MovimentacaoInsumoService();
const regimeConsumoInsumo = new RegimeConsumoInsumoService();
```
E no objeto `DESPACHO`:
```js
    'insumos:CREATE': ({ entidadeId, dados, req, tx }) =>
        insumo.create({ ...dados, id: entidadeId }, req, tx),
    'insumos:UPDATE': ({ entidadeId, dados, req, tx }) =>
        insumo.update(entidadeId, dados, req, tx),
    'insumos:DELETE': ({ entidadeId, req, tx }) => insumo.remove(entidadeId, req, tx),

    'movimentacoes_insumo:CREATE': ({ entidadeId, dados, req, tx }) =>
        movimentacaoInsumo.create({ ...dados, id: entidadeId }, req, tx),
    'movimentacoes_insumo:DELETE': ({ entidadeId, req, tx }) =>
        movimentacaoInsumo.remove(entidadeId, req, tx),

    'regimes_consumo_insumo:CREATE': ({ entidadeId, dados, req, tx }) =>
        regimeConsumoInsumo.create({ ...dados, id: entidadeId }, req, tx),
    'regimes_consumo_insumo:UPDATE': ({ entidadeId, dados, req, tx }) =>
        regimeConsumoInsumo.update(entidadeId, dados, req, tx),
    'regimes_consumo_insumo:DELETE': ({ entidadeId, req, tx }) =>
        regimeConsumoInsumo.remove(entidadeId, req, tx),
```

- [ ] **Step 4: Estender `validacao.js`**

Em `src/service/sync/validacao.js`, importar:
```js
import { InsumoCreateSchema, InsumoUpdateSchema } from '../../utils/validators/schemas/zod/InsumoSchema.js';
import { MovimentacaoInsumoCreateSchema } from '../../utils/validators/schemas/zod/MovimentacaoInsumoSchema.js';
import {
    RegimeConsumoInsumoCreateSchema,
    RegimeConsumoInsumoUpdateSchema,
} from '../../utils/validators/schemas/zod/RegimeConsumoInsumoSchema.js';
```
E em `SCHEMAS_DE_MUTACAO`:
```js
    'insumos:CREATE': InsumoCreateSchema,
    'insumos:UPDATE': InsumoUpdateSchema,

    'movimentacoes_insumo:CREATE': MovimentacaoInsumoCreateSchema,

    'regimes_consumo_insumo:CREATE': RegimeConsumoInsumoCreateSchema,
    'regimes_consumo_insumo:UPDATE': RegimeConsumoInsumoUpdateSchema,
```

- [ ] **Step 5: Rodar testes**

Run: `docker compose -f docker-compose.dev.yml exec api npx vitest run test/syncInsumos.test.js test/syncValidacao.test.js test/syncService.test.js`
Expected: PASS.

- [ ] **Step 6: Smoke — lote com dependência**

`POST /v1/sync` com um insumo e uma movimentação que depende dele no mesmo lote:
```bash
IID=$(uuidgen); MID=$(uuidgen)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"mutacoes\":[
 {\"id\":\"$(uuidgen)\",\"entidade\":\"insumos\",\"acao\":\"CREATE\",\"entidadeId\":\"$IID\",\"dados\":{\"propriedadeId\":\"$PROP\",\"tipoInsumoId\":\"$TIPO\",\"nome\":\"Sal mineral lote\",\"destino\":\"Rebanho\",\"unidadeMedida\":\"kg\"}},
 {\"id\":\"$(uuidgen)\",\"entidade\":\"movimentacoes_insumo\",\"acao\":\"CREATE\",\"entidadeId\":\"$MID\",\"dependeDe\":\"$IID\",\"dados\":{\"insumoId\":\"$IID\",\"tipo\":\"Entrada\",\"quantidade\":50,\"data\":\"2026-08-25T00:00:00.000Z\",\"origem\":\"CadastroInicial\"}}
]}" http://localhost:6060/v1/sync | jq '.message, [.data.resultados[].situacao]'
```
Wait — `dependeDe` referencia o **id da mutação**, não `entidadeId`. Ajustar: usar o mesmo UUID no `id` da 1ª mutação e no `dependeDe` da 2ª. Corrigir o comando conforme `test/e2e/lote.e2e.js`.
Expected: `["aceito","aceito"]`; `GET /v1/insumos/$IID` mostra `saldo.saldoReal = 50`.

- [ ] **Step 7: Commit**

```bash
git add src/service/sync/despacho.js src/service/sync/validacao.js test/syncInsumos.test.js
git commit -m "feat: registra entidades de insumo no lote de sincronizacao"
```

---

## Task 10: Documentação (Swagger + rotas)

**Files:**
- Create: `src/docs/paths/insumo.js`, `src/docs/schemas/insumoSchema.js`
- Modify: `src/docs/config/head.js`
- Modify: `src/docs/paths/catalogo.js`, `src/docs/paths/manejoPasto.js`, `src/docs/paths/manejoRebanho.js`
- Modify: `documentacao/rotas/rotas_pastolivre.md`

**Interfaces:**
- Consumes: padrão dos arquivos `src/docs/paths/*.js` e `src/docs/schemas/*.js` existentes (objetos OpenAPI 3.0 exportados como `default`).
- Produces: entradas de path para `/v1/insumos`, `/v1/insumos/movimentacoes`, `/v1/rebanhos/regimes-consumo`, tag nova `Insumos`; schemas `Insumo`, `InsumoCreate`, `InsumoUpdate`, `MovimentacaoInsumo`, `MovimentacaoInsumoCreate`, `RegimeConsumoInsumo`, `RegimeConsumoInsumoCreate`, `SaldoInsumo`.

- [ ] **Step 1: Ler dois exemplos para copiar o formato**

Run: `sed -n '1,60p' src/docs/paths/manejoPasto.js && echo '---' && sed -n '1,40p' src/docs/schemas/manejoPastoSchema.js`
Expected: entender a forma dos objetos (par, `tags`, `security`, `requestBody`, `$ref` para `#/components/schemas/...`).

- [ ] **Step 2: Criar `src/docs/schemas/insumoSchema.js`**

Objeto `default` com os schemas OpenAPI. Campos conforme os Zod dos Tasks 5–7. Incluir `SaldoInsumo` com `saldoReal`, `consumoProjetado`, `saldoProjetado`, `consumoDiaTotal`, `diasRestantes` (`nullable`), `previsaoTermino` (`string`, `format: date-time`, `nullable`), `esgotado` (`boolean`), `estoqueBaixo` (`boolean`). O schema `Insumo` referencia `SaldoInsumo` em `saldo`. Enums: `destino` `[Pasto, Rebanho, Ambos]`, `unidadeMedida` `[kg, g, L, mL, dose, saco, unidade]`, `movimentacao.tipo` `[Entrada, Saida, Ajuste]`, `origem` `[Compra, CadastroInicial, ManejoRebanho, ManejoPasto, ConsumoRebanho, AjusteContagem, Perda]`.

- [ ] **Step 3: Criar `src/docs/paths/insumo.js`**

Documentar: `GET/POST /v1/insumos`, `GET/PATCH/DELETE /v1/insumos/{id}`, `GET/POST /v1/insumos/movimentacoes`, `DELETE /v1/insumos/movimentacoes/{id}`, `GET/POST /v1/rebanhos/regimes-consumo`, `GET/PATCH/DELETE /v1/rebanhos/regimes-consumo/{id}`. Todos com `tags: ['Insumos']` e `security: [{ bearerAuth: [] }]`. Reaproveitar `swaggerCommonResponses`.

- [ ] **Step 4: Registrar em `head.js`**

Em `src/docs/config/head.js`: adicionar `const insumoPaths = (await import(new URL("../paths/insumo.js", import.meta.url).href + t)).default;` e `const insumoSchemas = (await import(new URL("../schemas/insumoSchema.js", import.meta.url).href + t)).default;`. Incluir `...insumoPaths` em `paths` e `...insumoSchemas` em `components.schemas`. Adicionar ao array `tags`:
```js
{ name: "Insumos", description: "Estoque de insumos, movimentações (ledger) e consumo diário do rebanho" },
```

- [ ] **Step 5: Atualizar os paths tocados**

- `src/docs/paths/catalogo.js`: incluir `tipos-insumo` na descrição/enum de `:entidade`.
- `src/docs/paths/manejoPasto.js` e `manejoRebanho.js`: no `requestBody` do `POST`, documentar o array opcional `itens` (`insumoId`, `quantidade`, `observacoes`), e no response o array `itens` e o `avisos`.

- [ ] **Step 6: Atualizar `documentacao/rotas/rotas_pastolivre.md`**

Nova seção "Insumos" com: regras de negócio (estoque por ledger, saldo real vs projetado, regime encerra o anterior do par, itens de manejo debitam estoque e não bloqueiam por saldo, soft-delete, multi-tenancy), a lista de endpoints e os enums. Referenciar `docs/superpowers/specs/2026-08-28-insumos-design.md`.

- [ ] **Step 7: Verificar que o Swagger carrega e a suíte passa**

Run: `docker compose -f docker-compose.dev.yml exec api node -e "import('./src/docs/config/head.js').then(m=>m.default()).then(o=>console.log('paths insumo:', Object.keys(o.swaggerDefinition.paths).filter(p=>p.includes('insumo')||p.includes('regimes-consumo'))))"`
Expected: imprime os caminhos novos, sem erro de import.
Run: `docker compose -f docker-compose.dev.yml exec api npm run test`
Expected: suíte inteira verde.
Manual: abrir `http://localhost:6060/v1/docs`, seção **Insumos** renderiza.

- [ ] **Step 8: Commit**

```bash
git add src/docs documentacao/rotas/rotas_pastolivre.md
git commit -m "docs: documenta endpoints de insumo"
```

---

## Self-Review

**1. Spec coverage**

| Item da spec | Task |
| :--- | :--- |
| `tipoInsumo` catálogo global + seed | 1, 2, 3 |
| `insumo` (campos, destino, unidade, estoqueMinimo, soft-delete) | 1, 5 |
| `movimentacaoInsumo` ledger (tipo/origem/vínculos), soft-delete | 1, 6 |
| `regimeConsumoInsumo` (um aberto por par, encerra anterior) | 1, 7 |
| Índices únicos parciais | 1 |
| Saldo real / projetado / previsão / marco de reconciliação | 4, 5 |
| `estoqueMinimo` → `estoqueBaixo` na leitura | 5 |
| Itens de insumo nos manejos → movimentações na transação | 8 |
| Saldo insuficiente avisa, não bloqueia | 8 |
| Multi-tenancy em toda query | 5, 6, 7, 8 |
| `id` opcional nos schemas + repassar `parsedData` | 5, 6, 7 |
| Registro no `/v1/sync` + ordem de dependência | 9 |
| Campo legado `medicamentoVacina` mantido | (nenhuma mudança nele — 8 só adiciona `itens`) |
| Swagger paths+schemas + `rotas_pastolivre.md` | 10 |
| Validações (quantidadeDia>0, dataInicio<=dataFim, enums, Ajuste assinado) | 5, 6, 7 |

Sem lacunas.

**2. Placeholder scan** — sem "TBD"/"TODO"/"etc." acionáveis. Os pontos "conferir X no arquivo Y" (RebanhoRepository trazer `propriedadeId`, nome do método `ensureRebanhoExists`) são verificações locais explícitas, não trabalho adiado.

**3. Type consistency** — `calcularSaldos` retorna o mesmo objeto em Task 4 (teste) e Task 5 (`comSaldo` adiciona só `estoqueBaixo`). `movimentacaoInsumoRepository.create(data, tx)`, `insumoRepository.findById(id, usuarioId)`, `regimeConsumoInsumoRepository.findAbertoDoPar(rebanhoId, insumoId, tx)` usados com a mesma assinatura em Tasks 6–9. Chaves de `DESPACHO`/`SCHEMAS_DE_MUTACAO` batem com os `@@map` do schema (`insumos`, `movimentacoes_insumo`, `regimes_consumo_insumo`).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-28-insumos-api.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
