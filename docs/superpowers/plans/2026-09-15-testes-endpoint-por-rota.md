# Suíte de testes de endpoint por rota — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Documentar e testar, via HTTP e banco real, todos os cenários de cada rota da API.

**Architecture:** `supertest` sobre `src/app.js` apontado para um Postgres de teste (`pasto_livre_teste*`). Um projeto vitest `endpoints` roda arquivos em série, limpando o banco antes de cada teste; o projeto `unidade` mantém os testes puros restantes. Cada rota tem um `.md` em `documentacao/testes/` com uma tabela por método; cada cenário tem ID citado no `it(...)`.

**Tech Stack:** Node 22 (ESM), Express 5, Prisma 7 + `@prisma/adapter-pg`, BetterAuth 1.5 (bearer), Vitest 4, supertest.

Spec: `docs/superpowers/specs/2026-09-15-testes-endpoint-por-rota-design.md` · Issue #41

## Global Constraints

- Branch `41-test-endpoints-por-rota`; commits `tipo: descrição` **sem escopo**, sem emoji, máx. 4 palavras, sem co-autoria de IA.
- Documentação de teste: **um `.md` por rota** em `documentacao/testes/`, **uma tabela por método HTTP**.
- Código de teste: `test/endpoints/<rota>/<metodo>-<caminho>.test.js` (um arquivo por endpoint).
- ID de cenário: `<SIGLA>-<MÉTODO>[-ID]-NN`, e o `it` começa pelo ID.
- Não mudar comportamento de endpoint. Divergência encontrada = linha na seção "Divergências" do `.md` + `it.fails` com o ID e comentário; nunca ajustar o teste para "passar" o bug.
- Nunca ler `.env` diretamente (hook bloqueia). O `dotenv` carrega em runtime.
- Nunca apontar os testes para o banco de desenvolvimento `pasto_livre`: `ambiente.js` aborta se o nome do banco não começar com `pasto_livre_teste`.

Siglas: `PROP` propriedades · `PAST` pastagens · `MPAS` pastagens/manejos · `REB` rebanhos · `MREB` rebanhos/manejos · `MOV` rebanhos/movimentacoes · `REG` rebanhos/regimes-consumo · `INS` insumos · `MINS` insumos/movimentacoes · `CAT` catalogos · `USR` usuarios · `UPL` uploads · `SYNC` sync · `APP` transversal (health, 404, rate limit, ordem de rotas).

---

### Task 1: Documentação das rotas (`documentacao/testes/`)

**Files:**
- Create: `documentacao/testes/README.md`
- Create: `documentacao/testes/{propriedades,pastagens,pastagens-manejos,rebanhos,rebanhos-manejos,rebanhos-movimentacoes,rebanhos-regimes-consumo,insumos,insumos-movimentacoes,catalogos,usuarios,uploads,sync,transversal}.md`

**Interfaces:**
- Produces: tabela de cenários com IDs, consumida pelas Tasks 3–15.

Fontes por rota: `src/routes/<x>Routes.js`, controller, service, repository, schemas Zod (body e `querys/`), `documentacao/rotas/rotas_pastolivre.md`, `src/docs/paths/`, testes unitários existentes (cenários que eles cobrem precisam existir na tabela).

- [ ] **Step 1: Escrever `README.md`** — como rodar (Task 2), convenções de ID, categorias obrigatórias, índice com link para cada `.md`.
- [ ] **Step 2: Escrever um `.md` por rota no formato:**

```markdown
# /propriedades

Controller `PropriedadeController` · Service `PropriedadeService` · Schemas `PropriedadeCreateSchema`,
`PropriedadeUpdateSchema`, `PropriedadeQuerySchema`, `PropriedadeIdSchema` · Regras: rotas_pastolivre.md § 2

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth.

## POST /propriedades

Arquivo: `test/endpoints/propriedades/post-propriedades.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| PROP-POST-01 | cria com dados válidos | — | 201 | envelope; `data.id`; `usuarioId` = A |
| PROP-POST-02 | aceita `id` gerado pelo cliente | — | 201 | `data.id` igual ao enviado |
| ... | | | | |

## GET /propriedades
...

## Divergências
- (cenário) — comportamento atual × documentado.
```

Categorias obrigatórias por método (quando aplicáveis): sucesso · validação de body/query/params (inclui `.strict()` e corpo vazio) · 401 sem token/token inválido · 403 admin · multi-tenancy (B recebe 404 ao ler/alterar/remover recurso de A; B não vê A na listagem; B não cria filho em pai de A) · 404 inexistente · regras de negócio (unicidade, travas de integridade, soft-delete, transações, offline-first `id`, delta `atualizadoDesde`, paginação/limite 100).

- [ ] **Step 3: `transversal.md`** — `GET /health`, rota inexistente 404, JSON inválido 400, `GET /pastagens/manejos` e `/rebanhos/{manejos,movimentacoes,regimes-consumo}` e `/insumos/movimentacoes` não caem no `/:id` (substitui `ordemDeRotas.test.js`).
- [ ] **Step 4: Commit**

```bash
git add documentacao/testes
git commit -m "docs: suites de teste por rota"
```

---

### Task 2: Infraestrutura de testes de endpoint

**Files:**
- Modify: `package.json` (devDependency `supertest`, scripts)
- Modify: `vitest.config.js`
- Modify: `src/middlewares/RateLimitMiddleware.js` (skip em teste)
- Modify: `test/preparo.js` (env Garage fictícia)
- Create: `test/apoio/banco.js`, `test/apoio/globalSetup.js`, `test/apoio/ambiente.js`, `test/apoio/cliente.js`, `test/apoio/auth.js`, `test/apoio/fabricas.js`
- Create: `test/endpoints/transversal/app.test.js`
- Move: todos os `test/**/*.test.js` atuais → `test/unidade/` (mesma árvore relativa; corrigir imports `../src` → `../../src` etc.)

**Interfaces:**
- Produces:
  - `api()` → instância `supertest` do app (`test/apoio/cliente.js`)
  - `criarUsuario({ admin = false } = {})` → `Promise<{ id, email, token, bearer: string }>`; `bearer` = `'Bearer <token>'` (`test/apoio/auth.js`)
  - `prisma` → `DbConnect.prisma` (reexport em `test/apoio/banco.js`)
  - `limparBanco()` → trunca todas as tabelas exceto `_prisma_migrations` (`test/apoio/banco.js`)
  - Fábricas (`test/apoio/fabricas.js`), todas gravam via Prisma e aceitam `dados` parciais sobrescrevendo defaults: `criarPropriedade(usuarioId, dados)`, `criarPasto(propriedadeId, dados)`, `criarRebanho(propriedadeId, pastoId, dados)`, `criarRaca(dados)`, `criarSistemaProducao(dados)`, `criarRegimeAlimentar(dados)`, `criarTipoManejoRebanho(dados)`, `criarTipoManejoPasto(dados)`, `criarTipoInsumo(dados)`, `criarInsumo(propriedadeId, dados)`. Campos obrigatórios conforme `prisma/schema.prisma`.

- [ ] **Step 1: Instalar supertest**

Run: `npm install -D supertest`

- [ ] **Step 2: Rate limit pulado em teste** — em `RateLimitMiddleware.js`, nos três limitadores:

```js
    skip: () => process.env.NODE_ENV === 'test',
```

- [ ] **Step 3: `test/apoio/banco.js`**

```js
// URL do banco de teste. Nunca o banco de desenvolvimento.
import { existsSync } from 'node:fs';

export function urlDoBancoDeTeste() {
    if (process.env.DATABASE_URL_TESTE) return process.env.DATABASE_URL_TESTE;

    const url = new URL(process.env.DATABASE_URL);
    url.pathname = '/pasto_livre_teste';
    // No host, o nome de serviço do compose não resolve: o Postgres do
    // docker-compose.dev.yml fica exposto em localhost:5433.
    if (url.hostname === 'postgresql' && !existsSync('/.dockerenv')) {
        url.hostname = 'localhost';
        url.port = '5433';
    }
    return url.toString();
}

export async function limparBanco(prisma) {
    const tabelas = await prisma.$queryRaw`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    const lista = tabelas.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
}
```

- [ ] **Step 4: `test/apoio/globalSetup.js`** — cria o banco se não existir e aplica migrations.

```js
import 'dotenv/config';
import { execSync } from 'node:child_process';
import pg from 'pg';
import { urlDoBancoDeTeste } from './banco.js';

export default async function preparar() {
    const url = new URL(urlDoBancoDeTeste());
    const nome = url.pathname.slice(1);
    if (!nome.startsWith('pasto_livre_teste')) {
        throw new Error(`Banco de teste precisa começar com pasto_livre_teste: ${nome}`);
    }

    const admin = new URL(url);
    admin.pathname = '/postgres';
    const cliente = new pg.Client({ connectionString: admin.toString() });
    await cliente.connect();
    const { rowCount } = await cliente.query('SELECT 1 FROM pg_database WHERE datname = $1', [nome]);
    if (rowCount === 0) await cliente.query(`CREATE DATABASE "${nome}"`);
    await cliente.end();

    execSync('npx prisma migrate deploy', {
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: 'inherit',
    });
}
```

- [ ] **Step 5: `test/apoio/ambiente.js`** (setupFile do projeto endpoints; roda antes dos imports do arquivo de teste)

```js
import 'dotenv/config';
import { beforeEach, afterAll } from 'vitest';
import { urlDoBancoDeTeste } from './banco.js';

process.env.DATABASE_URL = urlDoBancoDeTeste();
if (!new URL(process.env.DATABASE_URL).pathname.startsWith('/pasto_livre_teste')) {
    throw new Error('Testes de endpoint recusam banco que não seja pasto_livre_teste*.');
}

const { default: DbConnect } = await import('../../src/config/dbConnect.js');
const { limparBanco } = await import('./banco.js');

beforeEach(() => limparBanco(DbConnect.prisma));
afterAll(() => DbConnect.disconnect());
```

- [ ] **Step 6: `test/preparo.js`** — acrescentar env fictícia do Garage (o boot do app exige):

```js
process.env.GARAGE_ENDPOINT ??= 'localhost';
process.env.GARAGE_PORT ??= '3900';
process.env.GARAGE_ACCESS_KEY ??= 'teste';
process.env.GARAGE_SECRET_KEY ??= 'teste';
process.env.GARAGE_BUCKET_FOTOS ??= 'fotos-teste';
```

- [ ] **Step 7: `test/apoio/cliente.js` e `test/apoio/auth.js`**

```js
// cliente.js
import request from 'supertest';
import app from '../../src/app.js';

export const api = () => request(app);
```

```js
// auth.js
import { randomUUID } from 'node:crypto';
import DbConnect from '../../src/config/dbConnect.js';
import { api } from './cliente.js';

export const SENHA_PADRAO = 'SenhaTeste1';

export async function criarUsuario({ admin = false, nome = 'Produtor Teste' } = {}) {
    const email = `teste-${randomUUID()}@pastolivre.test`;
    const r = await api()
        .post('/api/auth/sign-up/email')
        .send({ name: nome, email, password: SENHA_PADRAO });
    if (r.status !== 200) throw new Error(`sign-up falhou: ${r.status} ${JSON.stringify(r.body)}`);

    const token = r.body.token ?? r.headers['set-auth-token'];
    const id = r.body.user.id;
    if (admin) await DbConnect.prisma.user.update({ where: { id }, data: { admin: true } });

    return { id, email, token, bearer: `Bearer ${token}` };
}
```

- [ ] **Step 8: `test/apoio/fabricas.js`** — uma função por entidade listada em Interfaces, lendo campos obrigatórios do `prisma/schema.prisma`, com nomes únicos via `randomUUID().slice(0, 8)`.

- [ ] **Step 9: `vitest.config.js` com dois projetos**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reportsDirectory: './coverage',
            include: ['src/**/*.js'],
        },
        projects: [
            {
                test: {
                    name: 'unidade',
                    environment: 'node',
                    env: { NODE_ENV: 'test' },
                    setupFiles: ['./test/preparo.js'],
                    include: ['test/unidade/**/*.test.js'],
                },
            },
            {
                test: {
                    name: 'endpoints',
                    environment: 'node',
                    env: { NODE_ENV: 'test' },
                    globalSetup: ['./test/apoio/globalSetup.js'],
                    setupFiles: ['./test/preparo.js', './test/apoio/ambiente.js'],
                    include: ['test/endpoints/**/*.test.js'],
                    fileParallelism: false,
                    testTimeout: 30_000,
                    hookTimeout: 60_000,
                },
            },
        ],
    },
});
```

Scripts em `package.json`:

```json
"test": "vitest run",
"test:unidade": "vitest run --project unidade",
"test:endpoints": "vitest run --project endpoints",
```

- [ ] **Step 10: Mover unitários** para `test/unidade/` (`git mv`), ajustar caminhos relativos; apagar `exemplo.test.js` e `ordemDeRotas.test.js` (este último é absorvido por APP-*).

Run: `npm run test:unidade` · Expected: mesma contagem de testes verdes de antes.

- [ ] **Step 11: `test/endpoints/transversal/app.test.js`** com os cenários APP-* do `transversal.md`. Exemplo de padrão para todas as suítes:

```js
import { describe, expect, it } from 'vitest';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';

describe('transversal', () => {
    it('APP-GET-01 health responde healthy com banco conectado', async () => {
        const r = await api().get('/health');
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ status: 'healthy', database: 'connected' });
    });

    it('APP-GET-02 rota inexistente responde 404 no envelope', async () => {
        const r = await api().get('/v1/nao-existe');
        expect(r.status).toBe(404);
        expect(r.body).toMatchObject({ data: null });
    });

    it('APP-GET-03 /pastagens/manejos não é capturada por /pastagens/:id', async () => {
        const a = await criarUsuario();
        const r = await api().get('/v1/pastagens/manejos').set('Authorization', a.bearer);
        expect(r.status).toBe(200);
    });
});
```

Run: `npm run test:endpoints` · Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add -A package.json package-lock.json vitest.config.js src/middlewares/RateLimitMiddleware.js test
git commit -m "test: infraestrutura de endpoint"
```

---

### Tasks 3–15: Suíte de endpoint por rota

Uma task por rota, na ordem: 3 propriedades · 4 pastagens · 5 pastagens-manejos · 6 rebanhos · 7 rebanhos-manejos · 8 rebanhos-movimentacoes · 9 rebanhos-regimes-consumo · 10 insumos · 11 insumos-movimentacoes · 12 catalogos · 13 usuarios · 14 uploads · 15 sync.

**Files (por rota `<r>`):**
- Create: `test/endpoints/<r>/<metodo>-<caminho>.test.js` — um por seção do `.md`
- Modify: `documentacao/testes/<r>.md` (ajustes de cenário descobertos ao implementar)
- Modify (se necessário): `test/apoio/fabricas.js` (só adicionar funções)
- Delete: unitários de `test/unidade/` cujos cenários ficaram 100% cobertos (listar no corpo do commit)

**Interfaces:**
- Consumes: `api`, `criarUsuario`, fábricas, `DbConnect.prisma` (para verificar estado persistido)

- [ ] **Step 1:** Para cada linha da tabela do `.md`, escrever um `it('<ID> <cenário>')`. Exemplo real (`post-propriedades.test.js`):

```js
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPropriedade } from '../../apoio/fabricas.js';

describe('POST /v1/propriedades', () => {
    let a;
    beforeEach(async () => { a = await criarUsuario(); });

    const post = (usuario, corpo) =>
        api().post('/v1/propriedades').set('Authorization', usuario.bearer).send(corpo);

    it('PROP-POST-01 cria com dados válidos', async () => {
        const r = await post(a, { nome: 'Fazenda Boa Vista', localizacao: 'vilhena,ro' });
        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data).toMatchObject({ nome: 'Fazenda Boa Vista', localizacao: 'Vilhena,RO' });
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: r.body.data.id } });
        expect(salvo.usuarioId).toBe(a.id);
    });

    it('PROP-POST-02 aceita id gerado pelo cliente', async () => {
        const id = randomUUID();
        const r = await post(a, { id, nome: 'Offline' });
        expect(r.status).toBe(201);
        expect(r.body.data.id).toBe(id);
    });

    it('PROP-POST-03 recusa campo fora do schema', async () => {
        const r = await post(a, { nome: 'Fazenda', extra: 1 });
        expect(r.status).toBe(400);
    });

    it('PROP-POST-04 recusa sem token', async () => {
        const r = await api().post('/v1/propriedades').send({ nome: 'Fazenda' });
        expect(r.status).toBe(401);
    });

    it('PROP-POST-05 recusa nome duplicado entre ativas do mesmo usuário', async () => {
        await criarPropriedade(a.id, { nome: 'Repetida' });
        const r = await post(a, { nome: 'Repetida' });
        expect(r.status).toBe(409);
    });

    it('PROP-POST-06 permite o mesmo nome para outro usuário', async () => {
        const b = await criarUsuario();
        await criarPropriedade(a.id, { nome: 'Repetida' });
        const r = await post(b, { nome: 'Repetida' });
        expect(r.status).toBe(201);
    });
});
```

Regras: verificar status **e** efeito persistido (Prisma) nos cenários de escrita; em multi-tenancy verificar que o recurso de A não mudou; nada de mock além do Garage (Task 14: `vi.mock('../../../src/config/garageConnect.js', ...)` mantendo `ensureGarageEnv`).

- [ ] **Step 2: Rodar**

Run: `npx vitest run --project endpoints test/endpoints/<r>` · Expected: todos PASS (exceto `it.fails` documentados em Divergências).

- [ ] **Step 3: Conferir `.md` × código** — todo ID do `.md` existe em um `it` e vice-versa:

Run: `grep -ohE "<SIGLA>-[A-Z]+(-ID)?-[0-9]+" documentacao/testes/<r>.md | sort -u` comparado com o mesmo grep em `test/endpoints/<r>`. Expected: listas iguais.

- [ ] **Step 4: Apagar unitários cobertos** e rodar `npm test`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A documentacao/testes/<r>.md test
git commit -m "test: endpoints de <r>"
```

---

### Task 16: Limpeza final e documentação do repositório

**Files:**
- Delete: `test/e2e/lote.e2e.js` (coberto por SYNC-*), script `test:e2e` do `package.json`
- Modify: `CLAUDE.md` (substituir "Não há suíte de testes configurada" por seção de testes), `README.md` (seção Testes), `documentacao/testes/README.md` (lista final dos unitários mantidos e por quê)

- [ ] **Step 1:** Remover `lote.e2e.js` e script; revisar `test/unidade/` restante — cada arquivo mantido precisa de justificativa no README de testes (lógica pura sem rota equivalente).
- [ ] **Step 2:** Atualizar `CLAUDE.md` e `README.md`: `docker compose -f docker-compose.dev.yml up -d postgresql`, `npm run test:endpoints`, `DATABASE_URL_TESTE`, regra "ao alterar endpoint, atualizar `documentacao/testes/<r>.md` e a suíte".
- [ ] **Step 3:** Verificação completa.

Run: `npm test` · Expected: todos os projetos PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: guia da suite de testes"
```
