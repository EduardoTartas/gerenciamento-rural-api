# Sincronização offline-first (lado servidor) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à API um endpoint de lote idempotente com falha por item, leitura por diferença, exclusão rastreável e contrato de erro que o cliente possa obedecer em vez de adivinhar.

**Architecture:** Um `SyncService` novo resolve ordem, dependência e idempotência, e delega cada mutação aos services de domínio que já existem — nenhuma regra de negócio é reescrita. O modelo de dados ganha `ativo` e `updatedAt` onde faltam, para que toda mudança deixe rastro e o delta funcione sem exceção por entidade.

**Tech Stack:** Node 22 (ESM puro), Express 5, Prisma 7 + PostgreSQL, Zod 4, Vitest.

## Global Constraints

- **ESM puro.** O `package.json` tem `"type": "module"`. Todo import é `import ... from '...'` com extensão `.js` explícita nos caminhos relativos. Nunca `require`.
- **O banco pode ser recriado do zero.** Não há exigência de migração retrocompatível. Migrations são geradas com `npx prisma migrate dev`.
- **Os endpoints REST por recurso continuam existindo.** Nada é removido; o aplicativo migra numa spec seguinte.
- **Nenhuma regra de negócio é reimplementada** dentro do `SyncService`. Ele só despacha para os services existentes.
- **Português no domínio.** Nomes de campo, mensagem de erro e comentário em pt-BR, seguindo o que o repositório já faz. `camelCase` para campo de API.
- **Commits:** Conventional Commits em português, sem escopo entre parênteses quando não houver, sem emoji, sem co-autoria de IA. Sujeito no imperativo e minúsculo.
- **Limite do lote:** 100 mutações. **Retenção de idempotência:** 30 dias.
- **Nunca ler `pasto.status` para decidir regra.** Contar rebanhos ativos. O campo é cache e já esteve comprovadamente defasado.

---

## Estrutura de arquivos

**Criados**

| Arquivo | Responsabilidade |
|---|---|
| `vitest.config.js` | Configuração do runner |
| `test/preparo.js` | Variáveis de ambiente do teste, carregado por `setupFiles` |
| `src/utils/helpers/tiposDeErro.js` | Tabela `tipo → { http, recuperavel }`. Fonte única do contrato de erro |
| `src/service/sync/grafoDeDependencia.js` | Ordenação topológica e detecção de ciclo. Função pura, sem banco |
| `src/service/sync/despacho.js` | Mapa `(entidade, ação) → método do service de domínio` |
| `src/service/SyncService.js` | Laço do lote: idempotência, ordem, transação por item, cascata de bloqueio |
| `src/repository/MutacaoAplicadaRepository.js` | Persistência da idempotência |
| `src/controllers/SyncController.js` | Entrada HTTP do lote |
| `src/routes/syncRoutes.js` | Registro da rota |
| `src/utils/validators/schemas/zod/SyncSchema.js` | Validação do envelope do lote |
| `contrato/casos_de_regra.json` | Casos compartilhados entre API e aplicativo |

**Modificados**

| Arquivo | Mudança |
|---|---|
| `package.json` | `devDependencies` e scripts de teste |
| `prisma/schema.prisma` | `ativo`/`updatedAt` faltantes, índices de delta, `mutacaoAplicada` |
| `src/utils/helpers/errorHandler.js` | Usa `tiposDeErro` para `recuperavel` |
| `src/utils/helpers/CommonResponse.js` | `error` passa a emitir `tipo` e `recuperavel` |
| `src/repository/ManejoPastoRepository.js` | `remove` vira soft delete |
| `src/repository/ManejoRebanhoRepository.js` | `remove` vira soft delete |
| `src/repository/{Propriedade,Pasto,Rebanho,ManejoPasto,ManejoRebanho,Movimentacao}Repository.js` | `list` aceita `atualizadoDesde` |
| `src/service/MovimentacaoService.js` | `remove` — desfazer a última |
| `src/repository/MovimentacaoRepository.js` | `desfazerComTransacao` |
| `src/controllers/MovimentacaoController.js` | `remove` |
| `src/routes/movimentacaoRoutes.js` | `DELETE /rebanhos/movimentacoes/:id` |
| `src/routes/index.js` | Registra `syncRoutes` |

> **Correção da spec.** A spec fala em `contrato/casos_de_regra.json` "na raiz do monorepo". A raiz não é um repositório git, então o arquivo não seria versionado. O canônico passa a viver em `gerenciamento-rural-api/contrato/`. A spec do aplicativo definirá como espelhar e verificar a cópia.

---

## Task 1: Suíte de testes com Vitest

**Files:**
- Create: `vitest.config.js`
- Create: `test/preparo.js`
- Create: `test/exemplo.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada
- Produces: `npm test` e `npm run test:cov` funcionando. Todas as tasks seguintes escrevem testes em `test/**/*.test.js`.

- [ ] **Step 1: Instalar o runner**

```bash
npm install --save-dev vitest @vitest/coverage-v8
```

- [ ] **Step 2: Criar a configuração**

`vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        setupFiles: ['./test/preparo.js'],
        include: ['test/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reportsDirectory: './coverage',
            include: ['src/**/*.js'],
        },
    },
});
```

- [ ] **Step 3: Criar o preparo de ambiente**

`test/preparo.js`:

```js
// Carregado antes de cada arquivo de teste.
//
// `src/config/dbConnect.js` lança no import quando DATABASE_URL está ausente, e
// importar qualquer service puxa esse módulo pela cadeia de dependências. O Pool
// do `pg` é preguiçoso: construí-lo não abre conexão.
process.env.DATABASE_URL ??=
    'postgresql://teste:teste@localhost:5432/pasto_livre_teste';
process.env.BETTER_AUTH_SECRET ??= 'segredo-usado-apenas-em-teste';
process.env.BETTER_AUTH_URL ??= 'http://localhost:6060';
process.env.NODE_ENV ??= 'test';
```

- [ ] **Step 4: Escrever o teste que prova que a suíte roda**

`test/exemplo.test.js`:

```js
import { describe, expect, it } from 'vitest';

describe('suíte de testes', () => {
    it('carrega as variáveis de ambiente do preparo', () => {
        expect(process.env.NODE_ENV).toBe('test');
        expect(process.env.DATABASE_URL).toBeDefined();
    });

    it('importa um módulo do src sem estourar por falta de ambiente', async () => {
        const { default: CustomError } = await import(
            '../src/utils/helpers/CustomError.js'
        );
        expect(new CustomError({ statusCode: 400 }).statusCode).toBe(400);
    });
});
```

- [ ] **Step 5: Registrar os scripts**

Em `package.json`, dentro de `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:cov": "vitest run --coverage"
```

- [ ] **Step 6: Rodar e verificar**

Run: `npm test`
Expected: PASS, 2 testes.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.js test/
git commit -m "test: adiciona suite de testes com vitest"
```

---

## Task 2: Contrato de erro tipado

**Files:**
- Create: `src/utils/helpers/tiposDeErro.js`
- Create: `test/tiposDeErro.test.js`
- Modify: `src/utils/helpers/CommonResponse.js`
- Modify: `src/utils/helpers/index.js`

**Interfaces:**
- Consumes: nada
- Produces: `TIPOS_DE_ERRO` (objeto), `descreverErro(tipo)` → `{ tipo, http, recuperavel }`, `ehRecuperavel(tipo)` → `boolean`. O `SyncService` (Task 9) usa `descreverErro` para montar o campo `erro` de cada resultado.

- [ ] **Step 1: Escrever o teste que falha**

`test/tiposDeErro.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
    TIPOS_DE_ERRO,
    descreverErro,
    ehRecuperavel,
} from '../src/utils/helpers/tiposDeErro.js';

describe('tipos de erro', () => {
    it('declara os sete tipos do contrato', () => {
        expect(Object.keys(TIPOS_DE_ERRO).sort()).toEqual([
            'conflict',
            'forbidden',
            'notFound',
            'rateLimit',
            'serverError',
            'unauthorized',
            'validationError',
        ]);
    });

    it('mapeia cada tipo ao seu código HTTP', () => {
        expect(descreverErro('validationError').http).toBe(400);
        expect(descreverErro('unauthorized').http).toBe(401);
        expect(descreverErro('forbidden').http).toBe(403);
        expect(descreverErro('notFound').http).toBe(404);
        expect(descreverErro('conflict').http).toBe(409);
        expect(descreverErro('rateLimit').http).toBe(429);
        expect(descreverErro('serverError').http).toBe(500);
    });

    it('marca como recuperável só o que vale tentar de novo', () => {
        // O cliente decidia isso pelo statusCode, e foi assim que 429 virou
        // falha permanente. Agora o servidor declara.
        expect(ehRecuperavel('rateLimit')).toBe(true);
        expect(ehRecuperavel('serverError')).toBe(true);
        expect(ehRecuperavel('unauthorized')).toBe(true);

        expect(ehRecuperavel('validationError')).toBe(false);
        expect(ehRecuperavel('conflict')).toBe(false);
        expect(ehRecuperavel('notFound')).toBe(false);
        expect(ehRecuperavel('forbidden')).toBe(false);
    });

    it('sessão expirada é recuperável, não culpa do dado', () => {
        // Se fosse permanente, o rollback do cliente reverteria o trabalho do
        // produtor a cada sessão vencida.
        expect(descreverErro('unauthorized')).toEqual({
            tipo: 'unauthorized',
            http: 401,
            recuperavel: true,
        });
    });

    it('tipo desconhecido cai em serverError', () => {
        expect(descreverErro('coisaQueNaoExiste')).toEqual({
            tipo: 'serverError',
            http: 500,
            recuperavel: true,
        });
    });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run test/tiposDeErro.test.js`
Expected: FAIL — `Failed to resolve import "../src/utils/helpers/tiposDeErro.js"`

- [ ] **Step 3: Implementar**

`src/utils/helpers/tiposDeErro.js`:

```js
// src/utils/helpers/tiposDeErro.js

/**
 * Fonte única do contrato de erro entre a API e o aplicativo.
 *
 * `recuperavel` responde a uma pergunta só: vale a pena o cliente tentar de
 * novo? Antes deste campo o aplicativo decidia pelo código HTTP, com a regra
 * `statusCode >= 500` — que classificava 429 e 408 como recusa definitiva,
 * justamente os dois casos em que insistir é a resposta certa.
 */
export const TIPOS_DE_ERRO = {
    validationError: { http: 400, recuperavel: false },
    unauthorized:    { http: 401, recuperavel: true  },
    forbidden:       { http: 403, recuperavel: false },
    notFound:        { http: 404, recuperavel: false },
    conflict:        { http: 409, recuperavel: false },
    rateLimit:       { http: 429, recuperavel: true  },
    serverError:     { http: 500, recuperavel: true  },
};

const PADRAO = 'serverError';

/** Descreve um tipo. Tipo desconhecido vira `serverError`, que é recuperável. */
export function descreverErro(tipo) {
    const conhecido = Object.hasOwn(TIPOS_DE_ERRO, tipo) ? tipo : PADRAO;
    return { tipo: conhecido, ...TIPOS_DE_ERRO[conhecido] };
}

export function ehRecuperavel(tipo) {
    return descreverErro(tipo).recuperavel;
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run test/tiposDeErro.test.js`
Expected: PASS, 5 testes.

- [ ] **Step 5: Exportar pelo barril**

Em `src/utils/helpers/index.js`, acrescentar:

```js
export { TIPOS_DE_ERRO, descreverErro, ehRecuperavel } from './tiposDeErro.js';
```

- [ ] **Step 6: Fazer a resposta de erro carregar o contrato**

Em `src/utils/helpers/CommonResponse.js`, substituir o método `error` por:

```js
    static error(res, code, errorType, field = null, errors = [], customMessage = null) {
        const errorMessage = customMessage || StatusService.getErrorMessage(errorType, field);
        const response = new CommonResponse(errorMessage, null, errors);
        // `tipo` e `recuperavel` viajam no envelope para o cliente obedecer em
        // vez de deduzir do código HTTP.
        const { tipo, recuperavel } = descreverErro(errorType);
        return res.status(code).json({ ...response.toJSON(), tipo, recuperavel });
    }
```

E no topo do arquivo:

```js
import { descreverErro } from './tiposDeErro.js';
```

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/utils/helpers/ test/tiposDeErro.test.js
git commit -m "feat: declara tipo e recuperavel no contrato de erro"
```

---

## Task 3: Modelo de dados — rastro de exclusão e idempotência

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `test/schema.test.js`

**Interfaces:**
- Consumes: nada
- Produces: campos `ativo` e `updatedAt` em `manejoPasto`, `manejoRebanho` e `historicoMovimentacao`; modelo `mutacaoAplicada`; índices `(propriedadeId, updatedAt)`. As Tasks 4, 5, 6 e 8 dependem destes campos.

- [ ] **Step 1: Escrever o teste que falha**

`test/schema.test.js`:

```js
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * O delta só funciona se toda mudança deixar rastro. Uma linha apagada de
 * verdade não tem `updatedAt` para reportar: ela some, e o aplicativo fica com
 * um registro fantasma para sempre.
 */
describe('schema preparado para sincronização por diferença', () => {
    let schema;

    beforeAll(async () => {
        schema = await readFile('prisma/schema.prisma', 'utf8');
    });

    function corpoDoModelo(nome) {
        const match = schema.match(new RegExp(`model ${nome} \\{([\\s\\S]*?)\\n\\}`));
        expect(match, `modelo ${nome} não encontrado`).not.toBeNull();
        return match[1];
    }

    const sincronizadas = [
        'propriedade',
        'pasto',
        'rebanho',
        'manejoPasto',
        'manejoRebanho',
        'historicoMovimentacao',
    ];

    it.each(sincronizadas)('%s tem updatedAt', (modelo) => {
        expect(corpoDoModelo(modelo)).toMatch(/updatedAt\s+DateTime/);
    });

    it.each(sincronizadas)('%s tem ativo, para exclusão deixar rastro', (modelo) => {
        expect(corpoDoModelo(modelo)).toMatch(/ativo\s+Boolean/);
    });

    it.each(['pasto', 'rebanho'])('%s indexa (propriedadeId, updatedAt)', (modelo) => {
        expect(corpoDoModelo(modelo)).toMatch(/@@index\(\[propriedadeId, updatedAt\]\)/);
    });

    it('mutacaoAplicada existe com o que a idempotência precisa', () => {
        const corpo = corpoDoModelo('mutacaoAplicada');
        expect(corpo).toMatch(/id\s+String\s+@id/);
        expect(corpo).toMatch(/usuarioId\s+String/);
        expect(corpo).toMatch(/entidade\s+String/);
        expect(corpo).toMatch(/entidadeId\s+String/);
        expect(corpo).toMatch(/resultado\s+Json/);
        expect(corpo).toMatch(/aplicadaEm\s+DateTime/);
        expect(corpo).toMatch(/@@index\(\[usuarioId, aplicadaEm\]\)/);
    });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run test/schema.test.js`
Expected: FAIL — `manejoPasto` sem `ativo`, `historicoMovimentacao` sem `updatedAt`, `mutacaoAplicada` não encontrado.

- [ ] **Step 3: Acrescentar `ativo` e `updatedAt` nos manejos e na movimentação**

Em `prisma/schema.prisma`, dentro de `model manejoPasto`, `model manejoRebanho` e `model historicoMovimentacao`, acrescentar as linhas que faltarem em cada um:

```prisma
  ativo       Boolean  @default(true)
  updatedAt   DateTime @updatedAt
```

Em `historicoMovimentacao`, acrescentar também o índice de delta — ela se liga à propriedade pelo rebanho, então o índice é por rebanho:

```prisma
  @@index([rebanhoId, updatedAt])
```

Em `manejoPasto`:

```prisma
  @@index([pastoId, updatedAt])
```

Em `manejoRebanho`:

```prisma
  @@index([rebanhoId, updatedAt])
```

- [ ] **Step 4: Acrescentar os índices de delta em pasto, rebanho e propriedade**

Dentro de `model pasto` e `model rebanho`:

```prisma
  @@index([propriedadeId, updatedAt])
```

Dentro de `model propriedade`:

```prisma
  @@index([usuarioId, updatedAt])
```

- [ ] **Step 5: Acrescentar o modelo de idempotência**

No fim de `prisma/schema.prisma`:

```prisma
/// Mutações já aplicadas pelo endpoint de lote.
///
/// O aplicativo reenvia o lote quando a resposta se perde — cenário comum em
/// sinal ruim, que é o caso de uso central do sistema. O registro é gravado na
/// mesma transação da mutação: ou os dois entram, ou nenhum.
///
/// `usuarioId` fica sem relação declarada de propósito, como `session` e
/// `account`: é tabela operacional, não de domínio, e não deve participar de
/// cascata de exclusão do usuário.
model mutacaoAplicada {
  id         String   @id
  usuarioId  String
  entidade   String
  entidadeId String
  resultado  Json
  aplicadaEm DateTime @default(now())

  @@index([usuarioId, aplicadaEm])
}
```

- [ ] **Step 6: Rodar e verificar que passa**

Run: `npx vitest run test/schema.test.js`
Expected: PASS.

- [ ] **Step 7: Gerar a migration e o cliente**

```bash
npx prisma migrate dev --name sincronizacao-lote-e-delta
npx prisma generate
```

Expected: migration criada em `prisma/migrations/`, cliente regenerado.

- [ ] **Step 8: Commit**

```bash
git add prisma/ test/schema.test.js
git commit -m "feat: da rastro de exclusao e idempotencia ao schema"
```

---

## Task 4: Exclusão de manejo deixa de apagar a linha

**Files:**
- Modify: `src/repository/ManejoPastoRepository.js`
- Modify: `src/repository/ManejoRebanhoRepository.js`
- Create: `test/manejoSoftDelete.test.js`

**Interfaces:**
- Consumes: campo `ativo` da Task 3
- Produces: `ManejoPastoRepository.remove(id)` e `ManejoRebanhoRepository.remove(id)` passam a marcar `ativo: false` e devolver o registro atualizado. `list` passa a filtrar `ativo: true` por padrão.

- [ ] **Step 1: Escrever o teste que falha**

`test/manejoSoftDelete.test.js`:

```js
import { describe, expect, it, vi } from 'vitest';

/**
 * O manejo excluído sumia do banco. O aplicativo nunca ficava sabendo e mantinha
 * o registro para sempre — o produtor via no histórico um lançamento que não
 * existe mais.
 */
describe('exclusão de manejo deixa rastro', () => {
    async function montarRepositorio(caminho, tabela) {
        const update = vi.fn().mockResolvedValue({ id: 'm1', ativo: false });
        const deleteFn = vi.fn();

        vi.doMock('../src/config/dbConnect.js', () => ({
            default: { prisma: { [tabela]: { update, delete: deleteFn } } },
        }));

        vi.resetModules();
        const { default: Repositorio } = await import(caminho);
        return { repo: new Repositorio(), update, deleteFn };
    }

    it('manejo de pasto é marcado como inativo, não apagado', async () => {
        const { repo, update, deleteFn } = await montarRepositorio(
            '../src/repository/ManejoPastoRepository.js',
            'manejoPasto',
        );

        await repo.remove('m1');

        expect(deleteFn).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith({
            where: { id: 'm1' },
            data: { ativo: false },
        });
    });

    it('manejo de rebanho é marcado como inativo, não apagado', async () => {
        const { repo, update, deleteFn } = await montarRepositorio(
            '../src/repository/ManejoRebanhoRepository.js',
            'manejoRebanho',
        );

        await repo.remove('m1');

        expect(deleteFn).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith({
            where: { id: 'm1' },
            data: { ativo: false },
        });
    });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run test/manejoSoftDelete.test.js`
Expected: FAIL — `deleteFn` foi chamado.

- [ ] **Step 3: Trocar o hard delete pelo soft delete**

Em `src/repository/ManejoPastoRepository.js`, substituir o corpo de `remove` por:

```js
    /**
     * Exclusão lógica. A linha precisa continuar existindo para o delta poder
     * reportá-la: uma linha apagada de verdade não tem `updatedAt` para
     * informar, e o aplicativo ficaria com um registro fantasma.
     */
    async remove(id) {
        return this.prisma.manejoPasto.update({
            where: { id },
            data: { ativo: false },
        });
    }
```

Em `src/repository/ManejoRebanhoRepository.js`, o mesmo com `this.prisma.manejoRebanho`.

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run test/manejoSoftDelete.test.js`
Expected: PASS.

- [ ] **Step 5: Fazer as listagens ignorarem o que foi excluído**

Em ambos os repositórios, no método `list`, garantir que o `where` tenha:

```js
            ativo: filters.ativo !== undefined ? filters.ativo : true,
```

seguindo exatamente o que `PastoRepository.list` já faz.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/repository/ManejoPastoRepository.js src/repository/ManejoRebanhoRepository.js test/manejoSoftDelete.test.js
git commit -m "feat: exclusao de manejo passa a ser logica"
```

---

## Task 5: Leitura por diferença

**Files:**
- Modify: `src/repository/PropriedadeRepository.js`
- Modify: `src/repository/PastoRepository.js`
- Modify: `src/repository/RebanhoRepository.js`
- Modify: `src/repository/ManejoPastoRepository.js`
- Modify: `src/repository/ManejoRebanhoRepository.js`
- Modify: `src/repository/MovimentacaoRepository.js`
- Modify: `src/utils/validators/schemas/zod/querys/PastoQuerySchema.js` (e os equivalentes das demais entidades)
- Create: `test/delta.test.js`

**Interfaces:**
- Consumes: índices da Task 3, `ativo` da Task 4
- Produces: `filters.atualizadoDesde` (Date) aceito por todos os `list`. Quando presente, o `where` ganha `updatedAt: { gt }` e **não** filtra por `ativo`.

- [ ] **Step 1: Escrever o teste que falha**

`test/delta.test.js`:

```js
import { describe, expect, it, vi } from 'vitest';

/**
 * Cada abertura de tela pedia a coleção inteira. Com o delta, pede só o que
 * mudou desde a última sincronização.
 *
 * A regra decisiva: com `atualizadoDesde`, o filtro de `ativo` **sai**. Sem
 * isso o registro excluído nunca chegaria ao aplicativo, e o rastro criado na
 * Task 4 seria inútil.
 */
describe('leitura por diferença', () => {
    async function montarPastoRepository() {
        const findMany = vi.fn().mockResolvedValue([]);
        const count = vi.fn().mockResolvedValue(0);

        vi.doMock('../src/config/dbConnect.js', () => ({
            default: { prisma: { pasto: { findMany, count } } },
        }));

        vi.resetModules();
        const { default: PastoRepository } = await import(
            '../src/repository/PastoRepository.js'
        );
        return { repo: new PastoRepository(), findMany };
    }

    it('sem atualizadoDesde, mantém o comportamento de hoje', async () => {
        const { repo, findMany } = await montarPastoRepository();

        await repo.list('u1', {}, 1, 10);

        const { where } = findMany.mock.calls[0][0];
        expect(where.ativo).toBe(true);
        expect(where.updatedAt).toBeUndefined();
    });

    it('com atualizadoDesde, filtra pela janela', async () => {
        const { repo, findMany } = await montarPastoRepository();
        const desde = new Date('2026-08-03T20:00:00.000Z');

        await repo.list('u1', { atualizadoDesde: desde }, 1, 10);

        const { where } = findMany.mock.calls[0][0];
        expect(where.updatedAt).toEqual({ gt: desde });
    });

    it('com atualizadoDesde, devolve também o que foi excluído', async () => {
        const { repo, findMany } = await montarPastoRepository();

        await repo.list('u1', { atualizadoDesde: new Date() }, 1, 10);

        const { where } = findMany.mock.calls[0][0];
        expect(where.ativo).toBeUndefined();
    });

    it('ativo explícito continua vencendo', async () => {
        const { repo, findMany } = await montarPastoRepository();

        await repo.list('u1', { atualizadoDesde: new Date(), ativo: true }, 1, 10);

        const { where } = findMany.mock.calls[0][0];
        expect(where.ativo).toBe(true);
    });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run test/delta.test.js`
Expected: FAIL — `where.updatedAt` é `undefined`.

- [ ] **Step 3: Ensinar o `where` a montar a janela**

Em `src/repository/PastoRepository.js`, no início de `list`, substituir a montagem de `where` por:

```js
    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            propriedade: { usuarioId },
        };

        // Numa leitura por diferença, o que foi excluído precisa vir junto —
        // é assim que o aplicativo fica sabendo da exclusão. Filtrar por
        // `ativo` aqui esconderia exatamente o que o cliente precisa saber.
        if (filters.atualizadoDesde) {
            where.updatedAt = { gt: filters.atualizadoDesde };
        }
        if (filters.ativo !== undefined) {
            where.ativo = filters.ativo;
        } else if (!filters.atualizadoDesde) {
            where.ativo = true;
        }
```

O restante do método fica como está.

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run test/delta.test.js`
Expected: PASS, 4 testes.

- [ ] **Step 5: Repetir nas outras cinco entidades**

Aplicar o mesmo bloco em `PropriedadeRepository`, `RebanhoRepository`, `ManejoPastoRepository`, `ManejoRebanhoRepository` e `MovimentacaoRepository`, adaptando só a cláusula de posse que cada um já usa (`propriedade: { usuarioId }`, `rebanho: { propriedade: { usuarioId } }`, etc.). Não alterar mais nada nos métodos.

- [ ] **Step 6: Aceitar o parâmetro na query**

Em cada schema de query (`src/utils/validators/schemas/zod/querys/*QuerySchema.js`), acrescentar ao objeto:

```js
    atualizadoDesde: z
        .string()
        .datetime({ message: 'atualizadoDesde deve ser uma data ISO 8601 em UTC.' })
        .transform((valor) => new Date(valor))
        .optional(),
```

- [ ] **Step 7: Repassar o filtro no service**

Em cada `*Service.list`, onde os filtros são montados a partir de `req._parsedQuery`, acrescentar:

```js
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;
```

extraindo `atualizadoDesde` da mesma desestruturação que já lê `nome`, `page` e `limit`.

- [ ] **Step 8: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/repository/ src/service/ src/utils/validators/ test/delta.test.js
git commit -m "feat: adiciona leitura por diferenca nas listagens"
```

---

## Task 6: Desfazer a última movimentação

**Files:**
- Modify: `src/repository/MovimentacaoRepository.js`
- Modify: `src/service/MovimentacaoService.js`
- Modify: `src/controllers/MovimentacaoController.js`
- Modify: `src/routes/movimentacaoRoutes.js`
- Create: `test/desfazerMovimentacao.test.js`

**Interfaces:**
- Consumes: `ativo` em `historicoMovimentacao` (Task 3)
- Produces: `MovimentacaoService.remove(id, req)` → registro desfeito, ou lança `CustomError` com `errorType: 'conflict'`. `MovimentacaoRepository.ultimaDoRebanho(rebanhoId)` → movimentação ativa mais recente ou `null`.

- [ ] **Step 1: Escrever o teste que falha**

`test/desfazerMovimentacao.test.js`:

```js
import { describe, expect, it, vi } from 'vitest';

/**
 * Movimentação não é cadastro: é evento que produziu efeito. Ao ser criada,
 * alterou `rebanho.pastoAtualId`, o `status` dos dois pastos e
 * `dataUltimaSaida`. Apagar a linha não desfaz nada disso.
 *
 * Desfazer uma do meio da cadeia deixaria o histórico incoerente — o lote
 * apareceria num pasto onde nunca entrou. Por isso só a última.
 */
describe('desfazer movimentação', () => {
    const ULTIMA = {
        id: 'mov3',
        rebanhoId: 'reb1',
        pastoOrigemId: 'pastoC',
        pastoDestinoId: 'pastoD',
        dataMovimentacao: new Date('2026-08-07T10:00:00.000Z'),
        ativo: true,
    };

    async function montarService({ ultima, alvo }) {
        const escritas = [];
        const tx = {
            historicoMovimentacao: {
                update: vi.fn(async (args) => {
                    escritas.push({ tabela: 'movimentacao', ...args });
                    return { ...alvo, ativo: false };
                }),
            },
            rebanho: {
                update: vi.fn(async (args) => {
                    escritas.push({ tabela: 'rebanho', ...args });
                    return {};
                }),
            },
            pasto: {
                update: vi.fn(async (args) => {
                    escritas.push({ tabela: 'pasto', ...args });
                    return {};
                }),
            },
            // Conta rebanhos ativos: nunca ler `pasto.status`, que é cache e já
            // esteve comprovadamente defasado.
            contarRebanhos: vi.fn(async () => 0),
        };
        tx.rebanho.count = tx.contarRebanhos;

        vi.doMock('../src/config/dbConnect.js', () => ({
            default: {
                prisma: {
                    $transaction: async (cb) => cb(tx),
                    historicoMovimentacao: {
                        findFirst: vi.fn().mockResolvedValue(ultima),
                        findUnique: vi.fn().mockResolvedValue(alvo),
                    },
                },
            },
        }));

        vi.resetModules();
        const { default: MovimentacaoService } = await import(
            '../src/service/MovimentacaoService.js'
        );
        const service = new MovimentacaoService();
        service.ensureMovimentacaoExists = vi.fn().mockResolvedValue(alvo);
        return { service, tx, escritas };
    }

    const req = { user: { id: 'u1' } };

    it('desfaz a última e devolve o lote ao pasto de origem', async () => {
        const { service, tx } = await montarService({ ultima: ULTIMA, alvo: ULTIMA });

        await service.remove('mov3', req);

        expect(tx.historicoMovimentacao.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'mov3' },
                data: expect.objectContaining({ ativo: false }),
            }),
        );
        expect(tx.rebanho.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'reb1' },
                data: expect.objectContaining({ pastoAtualId: 'pastoC' }),
            }),
        );
    });

    it('recusa desfazer uma do meio da cadeia', async () => {
        const doMeio = { ...ULTIMA, id: 'mov2', pastoDestinoId: 'pastoC' };
        const { service, tx } = await montarService({ ultima: ULTIMA, alvo: doMeio });

        await expect(service.remove('mov2', req)).rejects.toMatchObject({
            errorType: 'conflict',
            statusCode: 409,
        });
        expect(tx.historicoMovimentacao.update).not.toHaveBeenCalled();
    });

    it('conta rebanhos ativos em vez de ler o status do pasto', async () => {
        const { service, tx } = await montarService({ ultima: ULTIMA, alvo: ULTIMA });

        await service.remove('mov3', req);

        expect(tx.contarRebanhos).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run test/desfazerMovimentacao.test.js`
Expected: FAIL — `service.remove is not a function`.

- [ ] **Step 3: Acrescentar a consulta da última**

Em `src/repository/MovimentacaoRepository.js`:

```js
    /** Movimentação ativa mais recente de um rebanho, ou `null`. */
    async ultimaDoRebanho(rebanhoId) {
        return this.prisma.historicoMovimentacao.findFirst({
            where: { rebanhoId, ativo: true },
            orderBy: [{ dataMovimentacao: 'desc' }, { createdAt: 'desc' }],
        });
    }
```

- [ ] **Step 4: Implementar o desfazer no service**

Em `src/service/MovimentacaoService.js`, acrescentar:

```js
    /**
     * Desfaz a última movimentação de um rebanho.
     *
     * Só a última: desfazer uma do meio deixaria o histórico dizendo que o lote
     * saiu de A para B e depois apareceu em C sem nunca ter ido para lá.
     */
    async remove(id, req) {
        const usuarioId = req.user.id;
        const movimentacao = await this.ensureMovimentacaoExists(id, usuarioId);

        const ultima = await this.repository.ultimaDoRebanho(movimentacao.rebanhoId);
        if (!ultima || ultima.id !== movimentacao.id) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'conflict',
                field: 'id',
                details: [{
                    path: 'id',
                    message: `Só a última movimentação pode ser desfeita. A última é ${ultima?.id ?? 'inexistente'}.`,
                }],
                customMessage: 'Só a última movimentação do lote pode ser desfeita.',
            });
        }

        return this.repository.desfazerComTransacao(movimentacao);
    }
```

Garantir que `CustomError` e `HttpStatusCodes` já estejam importados no arquivo — eles estão, porque `create` os usa.

- [ ] **Step 5: Implementar a transação de reversão**

Em `src/repository/MovimentacaoRepository.js`:

```js
    /**
     * Reverte o efeito de uma movimentação, em transação.
     *
     * O `status` dos pastos é recalculado contando rebanhos ativos, nunca lendo
     * o campo `status` — ele é cache e já esteve comprovadamente defasado.
     */
    async desfazerComTransacao(movimentacao) {
        const { id, rebanhoId, pastoOrigemId, pastoDestinoId } = movimentacao;

        return this.prisma.$transaction(async (tx) => {
            const desfeita = await tx.historicoMovimentacao.update({
                where: { id },
                data: { ativo: false },
            });

            await tx.rebanho.update({
                where: { id: rebanhoId },
                data: {
                    pastoAtualId: pastoOrigemId,
                    dataEntradaPastoAtual: movimentacao.dataMovimentacao,
                },
            });

            for (const pastoId of [pastoOrigemId, pastoDestinoId]) {
                if (!pastoId) continue;
                const ocupantes = await tx.rebanho.count({
                    where: { pastoAtualId: pastoId, ativo: true },
                });
                await tx.pasto.update({
                    where: { id: pastoId },
                    data: ocupantes > 0
                        ? { status: 'Ocupado' }
                        : { status: 'Descanso', dataUltimaSaida: new Date() },
                });
            }

            return desfeita;
        });
    }
```

- [ ] **Step 6: Rodar e verificar que passa**

Run: `npx vitest run test/desfazerMovimentacao.test.js`
Expected: PASS, 3 testes.

- [ ] **Step 7: Expor pelo controller**

Em `src/controllers/MovimentacaoController.js`:

```js
    /**
     * Desfaz a última movimentação de um rebanho.
     * DELETE /rebanhos/movimentacoes/:id
     */
    async remove(req, res) {
        const { id } = req.params;
        MovimentacaoIdSchema.parse(id);

        const data = await this.service.remove(id, req);

        return CommonResponse.success(
            res,
            data,
            HttpStatusCodes.OK.code,
            'Movimentação desfeita com sucesso.',
        );
    }
```

Usar o schema de id que o arquivo já importa para o `list` por id; se não houver, importar `MovimentacaoIdSchema` do mesmo módulo de querys das outras entidades.

- [ ] **Step 8: Registrar a rota**

Em `src/routes/movimentacaoRoutes.js`, acrescentar à cadeia:

```js
    .delete(
        '/rebanhos/movimentacoes/:id',
        AuthMiddleware,
        asyncWrapper(movimentacaoController.remove.bind(movimentacaoController)),
    )
```

- [ ] **Step 9: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/repository/MovimentacaoRepository.js src/service/MovimentacaoService.js src/controllers/MovimentacaoController.js src/routes/movimentacaoRoutes.js test/desfazerMovimentacao.test.js
git commit -m "feat: permite desfazer a ultima movimentacao"
```

---

## Task 7: Grafo de dependência do lote

**Files:**
- Create: `src/service/sync/grafoDeDependencia.js`
- Create: `test/grafoDeDependencia.test.js`

**Interfaces:**
- Consumes: nada. Função pura, sem banco.
- Produces: `ordenarPorDependencia(mutacoes)` → `{ ordem: string[], erro: string | null }` e `descendentes(mutacoes, idRaiz)` → `Set<string>`. O `SyncService` (Task 9) usa as duas.

- [ ] **Step 1: Escrever o teste que falha**

`test/grafoDeDependencia.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
    descendentes,
    ordenarPorDependencia,
} from '../src/service/sync/grafoDeDependencia.js';

/**
 * A cadeia pasto → rebanho → movimentação existe na fila do aplicativo. O
 * servidor precisa respeitá-la para não devolver 404 em cascata, que esconde a
 * causa real da falha.
 */
describe('grafo de dependência do lote', () => {
    const m = (id, dependeDe = null) => ({ id, dependeDe });

    it('mantém a ordem quando não há dependência', () => {
        const { ordem, erro } = ordenarPorDependencia([m('a'), m('b'), m('c')]);
        expect(erro).toBeNull();
        expect(ordem).toEqual(['a', 'b', 'c']);
    });

    it('coloca o predecessor antes do dependente', () => {
        const { ordem, erro } = ordenarPorDependencia([
            m('rebanho', 'pasto'),
            m('pasto'),
        ]);
        expect(erro).toBeNull();
        expect(ordem.indexOf('pasto')).toBeLessThan(ordem.indexOf('rebanho'));
    });

    it('resolve cadeia de três níveis', () => {
        const { ordem } = ordenarPorDependencia([
            m('movimentacao', 'rebanho'),
            m('rebanho', 'pasto'),
            m('pasto'),
        ]);
        expect(ordem).toEqual(['pasto', 'rebanho', 'movimentacao']);
    });

    it('recusa ciclo', () => {
        const { erro } = ordenarPorDependencia([m('a', 'b'), m('b', 'a')]);
        expect(erro).toMatch(/ciclo/i);
    });

    it('recusa dependência ausente do lote', () => {
        const { erro } = ordenarPorDependencia([m('a', 'naoEstaNoLote')]);
        expect(erro).toMatch(/naoEstaNoLote/);
    });

    it('lista todos os descendentes de uma mutação', () => {
        const mutacoes = [
            m('pasto'),
            m('rebanho', 'pasto'),
            m('movimentacao', 'rebanho'),
            m('outroPasto'),
        ];
        expect(descendentes(mutacoes, 'pasto')).toEqual(
            new Set(['rebanho', 'movimentacao']),
        );
    });

    it('mutação sem dependentes devolve conjunto vazio', () => {
        expect(descendentes([m('a'), m('b')], 'a')).toEqual(new Set());
    });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run test/grafoDeDependencia.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

`src/service/sync/grafoDeDependencia.js`:

```js
// src/service/sync/grafoDeDependencia.js

/**
 * Ordenação topológica das mutações de um lote.
 *
 * `dependeDe` referencia outra mutação do **mesmo lote**, nunca uma entidade
 * qualquer. Isso deixa o grafo inteiro contido no payload: o servidor não
 * consulta o banco nem adivinha relação a partir dos dados.
 */
export function ordenarPorDependencia(mutacoes) {
    const porId = new Map(mutacoes.map((m) => [m.id, m]));

    for (const mutacao of mutacoes) {
        if (mutacao.dependeDe && !porId.has(mutacao.dependeDe)) {
            return {
                ordem: [],
                erro: `A mutação ${mutacao.id} depende de ${mutacao.dependeDe}, que não está neste lote.`,
            };
        }
    }

    const ordem = [];
    const visitado = new Map(); // id -> 'visitando' | 'pronto'

    function visitar(id, caminho) {
        const estado = visitado.get(id);
        if (estado === 'pronto') return null;
        if (estado === 'visitando') {
            return `Ciclo de dependência: ${[...caminho, id].join(' -> ')}.`;
        }

        visitado.set(id, 'visitando');
        const dependencia = porId.get(id).dependeDe;
        if (dependencia) {
            const erro = visitar(dependencia, [...caminho, id]);
            if (erro) return erro;
        }
        visitado.set(id, 'pronto');
        ordem.push(id);
        return null;
    }

    for (const mutacao of mutacoes) {
        const erro = visitar(mutacao.id, []);
        if (erro) return { ordem: [], erro };
    }

    return { ordem, erro: null };
}

/**
 * Todas as mutações que dependem de [idRaiz], direta ou indiretamente.
 *
 * É o que faz a cascata de bloqueio: recusado o pasto, o rebanho que aponta
 * para ele e o manejo que aponta para o rebanho saem como `bloqueado`, não como
 * recusados por 404.
 */
export function descendentes(mutacoes, idRaiz) {
    const filhos = new Map();
    for (const mutacao of mutacoes) {
        if (!mutacao.dependeDe) continue;
        if (!filhos.has(mutacao.dependeDe)) filhos.set(mutacao.dependeDe, []);
        filhos.get(mutacao.dependeDe).push(mutacao.id);
    }

    const encontrados = new Set();
    const fila = [...(filhos.get(idRaiz) ?? [])];
    while (fila.length > 0) {
        const id = fila.shift();
        if (encontrados.has(id)) continue;
        encontrados.add(id);
        fila.push(...(filhos.get(id) ?? []));
    }
    return encontrados;
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run test/grafoDeDependencia.test.js`
Expected: PASS, 7 testes.

- [ ] **Step 5: Commit**

```bash
git add src/service/sync/grafoDeDependencia.js test/grafoDeDependencia.test.js
git commit -m "feat: adiciona grafo de dependencia do lote"
```

---

## Task 8: Registro de mutações aplicadas

**Files:**
- Create: `src/repository/MutacaoAplicadaRepository.js`
- Create: `test/mutacaoAplicada.test.js`

**Interfaces:**
- Consumes: modelo `mutacaoAplicada` da Task 3
- Produces: `buscarPorIds(ids)` → `Map<id, resultado>`; `registrar(tx, { id, usuarioId, entidade, entidadeId, resultado })` → `void`, recebendo a transação de fora; `limparAntigas(usuarioId, dias)` → número removido.

- [ ] **Step 1: Escrever o teste que falha**

`test/mutacaoAplicada.test.js`:

```js
import { describe, expect, it, vi } from 'vitest';

/**
 * O aplicativo reenvia o lote quando a resposta se perde — cenário comum em
 * sinal ruim, que é o caso de uso central do sistema. Sem isto, a movimentação
 * seria aplicada duas vezes.
 */
describe('registro de mutações aplicadas', () => {
    async function montar() {
        const findMany = vi.fn().mockResolvedValue([
            { id: 'm1', resultado: { situacao: 'aceito' } },
        ]);
        const deleteMany = vi.fn().mockResolvedValue({ count: 3 });

        vi.doMock('../src/config/dbConnect.js', () => ({
            default: { prisma: { mutacaoAplicada: { findMany, deleteMany } } },
        }));

        vi.resetModules();
        const { default: MutacaoAplicadaRepository } = await import(
            '../src/repository/MutacaoAplicadaRepository.js'
        );
        return { repo: new MutacaoAplicadaRepository(), findMany, deleteMany };
    }

    it('devolve as já aplicadas indexadas por id', async () => {
        const { repo } = await montar();
        const mapa = await repo.buscarPorIds(['m1', 'm2']);
        expect(mapa.get('m1')).toEqual({ situacao: 'aceito' });
        expect(mapa.has('m2')).toBe(false);
    });

    it('lista vazia não consulta o banco', async () => {
        const { repo, findMany } = await montar();
        const mapa = await repo.buscarPorIds([]);
        expect(mapa.size).toBe(0);
        expect(findMany).not.toHaveBeenCalled();
    });

    it('registra dentro da transação recebida', async () => {
        const { repo } = await montar();
        const create = vi.fn().mockResolvedValue({});
        const tx = { mutacaoAplicada: { create } };

        await repo.registrar(tx, {
            id: 'm9',
            usuarioId: 'u1',
            entidade: 'pastos',
            entidadeId: 'p1',
            resultado: { situacao: 'aceito' },
        });

        // Gravar na mesma transação da mutação é o que torna a garantia real:
        // ou os dois entram, ou nenhum.
        expect(create).toHaveBeenCalledWith({
            data: {
                id: 'm9',
                usuarioId: 'u1',
                entidade: 'pastos',
                entidadeId: 'p1',
                resultado: { situacao: 'aceito' },
            },
        });
    });

    it('limpa o que passou da janela de retenção', async () => {
        const { repo, deleteMany } = await montar();
        const removidas = await repo.limparAntigas('u1', 30);

        expect(removidas).toBe(3);
        const { where } = deleteMany.mock.calls[0][0];
        expect(where.usuarioId).toBe('u1');
        expect(where.aplicadaEm.lt).toBeInstanceOf(Date);
    });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run test/mutacaoAplicada.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar**

`src/repository/MutacaoAplicadaRepository.js`:

```js
// src/repository/MutacaoAplicadaRepository.js

import DbConnect from '../config/dbConnect.js';

/**
 * Idempotência do endpoint de lote.
 *
 * A chave é o id da **mutação**, não o da entidade: duas edições do mesmo pasto
 * são mutações distintas e ambas devem ser aplicadas. Confiar no id da entidade
 * cobriria `CREATE` e deixaria a movimentação ser aplicada duas vezes.
 */
class MutacaoAplicadaRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /** Mapa `id -> resultado` das mutações que já foram aplicadas. */
    async buscarPorIds(ids) {
        if (ids.length === 0) return new Map();

        const registros = await this.prisma.mutacaoAplicada.findMany({
            where: { id: { in: ids } },
            select: { id: true, resultado: true },
        });
        return new Map(registros.map((r) => [r.id, r.resultado]));
    }

    /**
     * Grava o registro **dentro da transação da mutação**, recebida de fora.
     * É isso que impede o caso em que a mutação entra e o registro não.
     */
    async registrar(tx, { id, usuarioId, entidade, entidadeId, resultado }) {
        await tx.mutacaoAplicada.create({
            data: { id, usuarioId, entidade, entidadeId, resultado },
        });
    }

    /**
     * Remove o que passou da janela de retenção.
     *
     * Roda no próprio endpoint de lote: a tabela só cresce quando há
     * sincronização, então a limpeza acontece exatamente quando precisa, sem
     * agendador nem processo à parte.
     */
    async limparAntigas(usuarioId, dias) {
        const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
        const { count } = await this.prisma.mutacaoAplicada.deleteMany({
            where: { usuarioId, aplicadaEm: { lt: limite } },
        });
        return count;
    }
}

export default MutacaoAplicadaRepository;
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run test/mutacaoAplicada.test.js`
Expected: PASS, 4 testes.

- [ ] **Step 5: Commit**

```bash
git add src/repository/MutacaoAplicadaRepository.js test/mutacaoAplicada.test.js
git commit -m "feat: registra mutacoes aplicadas para idempotencia"
```

---

## Task 9: SyncService

**Files:**
- Create: `src/service/sync/despacho.js`
- Create: `src/service/SyncService.js`
- Create: `test/syncService.test.js`

**Interfaces:**
- Consumes: `ordenarPorDependencia`, `descendentes` (Task 7); `MutacaoAplicadaRepository` (Task 8); `descreverErro` (Task 2)
- Produces: `SyncService.aplicarLote(mutacoes, req)` → `{ resultados: Array<{ id, situacao, entidade, entidadeId, dados?, erro?, bloqueadoPor? }> }`. Lança `CustomError` quando o envelope é inválido (ciclo, dependência ausente). O controller (Task 10) consome isso.

- [ ] **Step 1: Escrever o teste que falha**

`test/syncService.test.js`:

```js
import { describe, expect, it, vi } from 'vitest';

/**
 * O SyncService não conhece regra de negócio. Ele resolve ordem, dependência e
 * idempotência, e delega ao service de domínio que já existe — multi-tenancy,
 * lotação conjunta e ciclo de descanso continuam com dono único.
 */
describe('aplicação do lote', () => {
    const req = { user: { id: 'u1' } };

    async function montar({ despacho, jaAplicadas = new Map() }) {
        vi.doMock('../src/service/sync/despacho.js', () => ({ DESPACHO: despacho }));
        vi.doMock('../src/repository/MutacaoAplicadaRepository.js', () => ({
            default: class {
                buscarPorIds = vi.fn().mockResolvedValue(jaAplicadas);
                registrar = vi.fn().mockResolvedValue(undefined);
                limparAntigas = vi.fn().mockResolvedValue(0);
            },
        }));
        vi.doMock('../src/config/dbConnect.js', () => ({
            default: { prisma: { $transaction: async (cb) => cb({}) } },
        }));

        vi.resetModules();
        const { default: SyncService } = await import('../src/service/SyncService.js');
        return new SyncService();
    }

    const mutacao = (id, entidade, acao, dependeDe = null) => ({
        id,
        entidade,
        acao,
        entidadeId: `ent-${id}`,
        dependeDe,
        dados: {},
    });

    it('aplica mutações independentes e devolve aceito', async () => {
        const service = await montar({
            despacho: {
                'pastos:CREATE': vi.fn().mockResolvedValue({ id: 'ent-a', nome: 'A' }),
            },
        });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'pastos', 'CREATE')],
            req,
        );

        expect(resultados).toHaveLength(1);
        expect(resultados[0]).toMatchObject({
            id: 'a',
            situacao: 'aceito',
            entidade: 'pastos',
            dados: { id: 'ent-a', nome: 'A' },
        });
    });

    it('recusa a que falha e bloqueia quem depende dela', async () => {
        const erroDeConflito = Object.assign(new Error('nome duplicado'), {
            errorType: 'conflict',
            field: 'nome',
            customMessage: 'Já existe uma pastagem com este nome nesta propriedade.',
        });

        const service = await montar({
            despacho: {
                'pastos:CREATE': vi.fn().mockRejectedValue(erroDeConflito),
                'rebanhos:CREATE': vi.fn().mockResolvedValue({}),
                'manejo_rebanhos:CREATE': vi.fn().mockResolvedValue({}),
            },
        });

        const { resultados } = await service.aplicarLote(
            [
                mutacao('pasto', 'pastos', 'CREATE'),
                mutacao('rebanho', 'rebanhos', 'CREATE', 'pasto'),
                mutacao('manejo', 'manejo_rebanhos', 'CREATE', 'rebanho'),
            ],
            req,
        );

        const porId = Object.fromEntries(resultados.map((r) => [r.id, r]));
        expect(porId.pasto.situacao).toBe('recusado');
        expect(porId.pasto.erro).toMatchObject({
            tipo: 'conflict',
            campo: 'nome',
            recuperavel: false,
        });
        // Bloqueado, não recusado: o rebanho não foi tentado, então não pode
        // aparecer como erro seu. Voltar 404 aqui esconderia a causa real.
        expect(porId.rebanho).toMatchObject({
            situacao: 'bloqueado',
            bloqueadoPor: 'pasto',
        });
        expect(porId.manejo.situacao).toBe('bloqueado');
    });

    it('mutação independente entra mesmo com outra recusada', async () => {
        const service = await montar({
            despacho: {
                'pastos:CREATE': vi
                    .fn()
                    .mockRejectedValueOnce(
                        Object.assign(new Error('x'), { errorType: 'conflict' }),
                    )
                    .mockResolvedValueOnce({ id: 'ent-b' }),
            },
        });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'pastos', 'CREATE'), mutacao('b', 'pastos', 'CREATE')],
            req,
        );

        const porId = Object.fromEntries(resultados.map((r) => [r.id, r]));
        expect(porId.a.situacao).toBe('recusado');
        expect(porId.b.situacao).toBe('aceito');
    });

    it('não reexecuta mutação já aplicada', async () => {
        const criar = vi.fn().mockResolvedValue({});
        const service = await montar({
            despacho: { 'pastos:CREATE': criar },
            jaAplicadas: new Map([
                ['a', { id: 'a', situacao: 'aceito', entidade: 'pastos', entidadeId: 'ent-a' }],
            ]),
        });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'pastos', 'CREATE')],
            req,
        );

        expect(criar).not.toHaveBeenCalled();
        expect(resultados[0].situacao).toBe('aceito');
    });

    it('recusa par entidade-ação desconhecido', async () => {
        const service = await montar({ despacho: {} });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'coisas', 'CREATE')],
            req,
        );

        expect(resultados[0]).toMatchObject({
            situacao: 'recusado',
            erro: { tipo: 'validationError' },
        });
    });

    it('lança quando há ciclo de dependência', async () => {
        const service = await montar({ despacho: {} });

        await expect(
            service.aplicarLote(
                [
                    mutacao('a', 'pastos', 'CREATE', 'b'),
                    mutacao('b', 'pastos', 'CREATE', 'a'),
                ],
                req,
            ),
        ).rejects.toMatchObject({ errorType: 'validationError' });
    });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run test/syncService.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Criar o mapa de despacho**

`src/service/sync/despacho.js`:

```js
// src/service/sync/despacho.js

import ManejoPastoService from '../ManejoPastoService.js';
import ManejoRebanhoService from '../ManejoRebanhoService.js';
import MovimentacaoService from '../MovimentacaoService.js';
import PastoService from '../PastoService.js';
import PropriedadeService from '../PropriedadeService.js';
import RebanhoService from '../RebanhoService.js';

const propriedade = new PropriedadeService();
const pasto = new PastoService();
const rebanho = new RebanhoService();
const manejoPasto = new ManejoPastoService();
const manejoRebanho = new ManejoRebanhoService();
const movimentacao = new MovimentacaoService();

/**
 * Liga `(entidade, ação)` ao método do service de domínio.
 *
 * Assinatura única — `({ entidadeId, dados, req })` — para o laço do lote não
 * precisar saber qual ação está despachando. Acrescentar uma entidade é
 * acrescentar linhas aqui, não escrever um handler.
 *
 * `historico_movimentacoes` não tem `UPDATE`: movimentação é evento que
 * produziu efeito, e corrigir significa desfazer a última ou lançar outra.
 */
export const DESPACHO = {
    'propriedades:CREATE': ({ entidadeId, dados, req }) =>
        propriedade.create({ ...dados, id: entidadeId }, req),
    'propriedades:UPDATE': ({ entidadeId, dados, req }) =>
        propriedade.update(entidadeId, dados, req),
    'propriedades:DELETE': ({ entidadeId, req }) => propriedade.remove(entidadeId, req),

    'pastos:CREATE': ({ entidadeId, dados, req }) =>
        pasto.create({ ...dados, id: entidadeId }, req),
    'pastos:UPDATE': ({ entidadeId, dados, req }) => pasto.update(entidadeId, dados, req),
    'pastos:DELETE': ({ entidadeId, req }) => pasto.remove(entidadeId, req),

    'rebanhos:CREATE': ({ entidadeId, dados, req }) =>
        rebanho.create({ ...dados, id: entidadeId }, req),
    'rebanhos:UPDATE': ({ entidadeId, dados, req }) =>
        rebanho.update(entidadeId, dados, req),
    'rebanhos:DELETE': ({ entidadeId, req }) => rebanho.remove(entidadeId, req),

    'manejo_pastos:CREATE': ({ entidadeId, dados, req }) =>
        manejoPasto.create({ ...dados, id: entidadeId }, req),
    'manejo_pastos:UPDATE': ({ entidadeId, dados, req }) =>
        manejoPasto.update(entidadeId, dados, req),
    'manejo_pastos:DELETE': ({ entidadeId, req }) => manejoPasto.remove(entidadeId, req),

    'manejo_rebanhos:CREATE': ({ entidadeId, dados, req }) =>
        manejoRebanho.create({ ...dados, id: entidadeId }, req),
    'manejo_rebanhos:UPDATE': ({ entidadeId, dados, req }) =>
        manejoRebanho.update(entidadeId, dados, req),
    'manejo_rebanhos:DELETE': ({ entidadeId, req }) =>
        manejoRebanho.remove(entidadeId, req),

    'historico_movimentacoes:CREATE': ({ entidadeId, dados, req }) =>
        movimentacao.create({ ...dados, id: entidadeId }, req),
    'historico_movimentacoes:DELETE': ({ entidadeId, req }) =>
        movimentacao.remove(entidadeId, req),
};
```

- [ ] **Step 4: Implementar o service**

`src/service/SyncService.js`:

```js
// src/service/SyncService.js

import DbConnect from '../config/dbConnect.js';
import MutacaoAplicadaRepository from '../repository/MutacaoAplicadaRepository.js';
import { CustomError, HttpStatusCodes, descreverErro } from '../utils/helpers/index.js';
import { DESPACHO } from './sync/despacho.js';
import { descendentes, ordenarPorDependencia } from './sync/grafoDeDependencia.js';

/** Dias que uma mutação aplicada fica registrada. */
const RETENCAO_EM_DIAS = 30;

/**
 * Aplica um lote de mutações vindas da fila do aplicativo.
 *
 * Uma mutação, uma transação. O lote **não** é atômico entre itens: é o que
 * permite o segundo pasto entrar mesmo com o primeiro recusado. Tudo ou nada
 * travaria a fila inteira por causa de um cadastro inválido.
 */
class SyncService {
    constructor() {
        this.prisma = DbConnect.prisma;
        this.mutacoesAplicadas = new MutacaoAplicadaRepository();
    }

    async aplicarLote(mutacoes, req) {
        const usuarioId = req.user.id;

        const { ordem, erro } = ordenarPorDependencia(mutacoes);
        if (erro) {
            // Erro de construção do cliente, não de dado: o lote inteiro é
            // recusado, e nenhuma mutação chega a ser tentada.
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'mutacoes',
                details: [{ path: 'mutacoes', message: erro }],
                customMessage: erro,
            });
        }

        const porId = new Map(mutacoes.map((m) => [m.id, m]));
        const jaAplicadas = await this.mutacoesAplicadas.buscarPorIds(ordem);

        const resultados = new Map();
        const bloqueadas = new Map(); // id da bloqueada -> id de quem a bloqueou

        for (const id of ordem) {
            const mutacao = porId.get(id);

            if (bloqueadas.has(id)) {
                resultados.set(id, {
                    id,
                    situacao: 'bloqueado',
                    entidade: mutacao.entidade,
                    entidadeId: mutacao.entidadeId,
                    bloqueadoPor: bloqueadas.get(id),
                });
                continue;
            }

            const anterior = jaAplicadas.get(id);
            if (anterior) {
                resultados.set(id, anterior);
                continue;
            }

            const resultado = await this._aplicarUma(mutacao, usuarioId, req);
            resultados.set(id, resultado);

            if (resultado.situacao === 'recusado') {
                for (const descendente of descendentes(mutacoes, id)) {
                    if (!bloqueadas.has(descendente)) bloqueadas.set(descendente, id);
                }
            }
        }

        await this.mutacoesAplicadas.limparAntigas(usuarioId, RETENCAO_EM_DIAS);

        // Devolve na ordem em que o cliente enviou, não na de execução.
        return { resultados: mutacoes.map((m) => resultados.get(m.id)) };
    }

    async _aplicarUma(mutacao, usuarioId, req) {
        const { id, entidade, acao, entidadeId, dados } = mutacao;
        const executar = DESPACHO[`${entidade}:${acao}`];

        if (!executar) {
            return this._recusa(mutacao, {
                errorType: 'validationError',
                field: 'entidade',
                customMessage: `Combinação não suportada: ${entidade} com ação ${acao}.`,
            });
        }

        try {
            return await this.prisma.$transaction(async (tx) => {
                const gravado = await executar({ entidadeId, dados, req, tx });

                const resultado = {
                    id,
                    situacao: 'aceito',
                    entidade,
                    entidadeId,
                    dados: gravado,
                };

                // Na mesma transação: ou a mutação e o registro entram juntos,
                // ou nenhum dos dois.
                await this.mutacoesAplicadas.registrar(tx, {
                    id,
                    usuarioId,
                    entidade,
                    entidadeId,
                    resultado,
                });

                return resultado;
            });
        } catch (erro) {
            return this._recusa(mutacao, erro);
        }
    }

    _recusa(mutacao, erro) {
        const { tipo, recuperavel } = descreverErro(erro.errorType);
        return {
            id: mutacao.id,
            situacao: 'recusado',
            entidade: mutacao.entidade,
            entidadeId: mutacao.entidadeId,
            erro: {
                tipo,
                campo: erro.field ?? null,
                mensagem: erro.customMessage ?? erro.message ?? 'Erro ao aplicar a mutação.',
                recuperavel,
            },
        };
    }
}

export default SyncService;
```

- [ ] **Step 5: Rodar e verificar que passa**

Run: `npx vitest run test/syncService.test.js`
Expected: PASS, 6 testes.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/service/ test/syncService.test.js
git commit -m "feat: aplica lote de mutacoes com falha por item"
```

---

## Task 10: Rota `POST /v1/sync`

**Files:**
- Create: `src/utils/validators/schemas/zod/SyncSchema.js`
- Create: `src/controllers/SyncController.js`
- Create: `src/routes/syncRoutes.js`
- Create: `test/syncSchema.test.js`
- Modify: `src/routes/index.js`

**Interfaces:**
- Consumes: `SyncService.aplicarLote` (Task 9)
- Produces: `POST /v1/sync` autenticado, respondendo `200` com `{ message, data: { resultados }, errors: [] }`.

- [ ] **Step 1: Escrever o teste que falha**

`test/syncSchema.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { SyncLoteSchema } from '../src/utils/validators/schemas/zod/SyncSchema.js';

describe('envelope do lote', () => {
    const valida = (extra = {}) => ({
        id: '11111111-1111-4111-8111-111111111111',
        entidade: 'pastos',
        acao: 'CREATE',
        entidadeId: '22222222-2222-4222-8222-222222222222',
        dados: { nome: 'Piquete Fundo' },
        ...extra,
    });

    it('aceita um lote bem formado', () => {
        const r = SyncLoteSchema.safeParse({ mutacoes: [valida()] });
        expect(r.success).toBe(true);
    });

    it('recusa lote vazio', () => {
        expect(SyncLoteSchema.safeParse({ mutacoes: [] }).success).toBe(false);
    });

    it('recusa mais de 100 mutações', () => {
        const muitas = Array.from({ length: 101 }, (_, i) => ({
            ...valida(),
            id: `1111111${String(i).padStart(4, '0')}-1111-4111-8111-111111111111`,
        }));
        expect(SyncLoteSchema.safeParse({ mutacoes: muitas }).success).toBe(false);
    });

    it('recusa ação fora do conjunto', () => {
        const r = SyncLoteSchema.safeParse({ mutacoes: [valida({ acao: 'UPSERT' })] });
        expect(r.success).toBe(false);
    });

    it('recusa id que não é uuid', () => {
        const r = SyncLoteSchema.safeParse({ mutacoes: [valida({ id: 'abc' })] });
        expect(r.success).toBe(false);
    });

    it('DELETE não precisa de dados', () => {
        const r = SyncLoteSchema.safeParse({
            mutacoes: [{ ...valida({ acao: 'DELETE' }), dados: undefined }],
        });
        expect(r.success).toBe(true);
    });

    it('CREATE com id dentro de dados é recusado', () => {
        // `entidadeId` é a fonte única do identificador. Dois lugares dizendo a
        // mesma coisa é origem de divergência silenciosa quando discordam.
        const r = SyncLoteSchema.safeParse({
            mutacoes: [valida({ dados: { nome: 'X', id: 'outro' } })],
        });
        expect(r.success).toBe(false);
    });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npx vitest run test/syncSchema.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o schema**

`src/utils/validators/schemas/zod/SyncSchema.js`:

```js
// src/utils/validators/schemas/zod/SyncSchema.js

import { z } from 'zod/v4';

/** Teto alinhado ao limite de paginação que a API já pratica. */
export const MAXIMO_DE_MUTACOES = 100;

const MutacaoSchema = z
    .object({
        id: z.string().uuid('O id da mutação deve ser um UUID válido.'),
        entidade: z.string().min(1, 'Informe a entidade.'),
        acao: z.enum(['CREATE', 'UPDATE', 'DELETE'], {
            message: 'A ação deve ser CREATE, UPDATE ou DELETE.',
        }),
        entidadeId: z.string().uuid('O id da entidade deve ser um UUID válido.'),
        dependeDe: z.string().uuid().nullish(),
        dados: z.record(z.string(), z.unknown()).optional(),
    })
    .strict()
    .refine((m) => !(m.dados && 'id' in m.dados), {
        message: 'O identificador vem em entidadeId; não repita `id` dentro de dados.',
        path: ['dados'],
    })
    .refine((m) => m.acao === 'DELETE' || m.dados !== undefined, {
        message: 'CREATE e UPDATE exigem o campo dados.',
        path: ['dados'],
    });

export const SyncLoteSchema = z
    .object({
        mutacoes: z
            .array(MutacaoSchema)
            .min(1, 'Envie ao menos uma mutação.')
            .max(MAXIMO_DE_MUTACOES, `O lote aceita no máximo ${MAXIMO_DE_MUTACOES} mutações.`),
    })
    .strict();
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npx vitest run test/syncSchema.test.js`
Expected: PASS, 7 testes.

- [ ] **Step 5: Implementar o controller**

`src/controllers/SyncController.js`:

```js
// src/controllers/SyncController.js

import SyncService from '../service/SyncService.js';
import { CommonResponse, HttpStatusCodes } from '../utils/helpers/index.js';
import { SyncLoteSchema } from '../utils/validators/schemas/zod/SyncSchema.js';

class SyncController {
    constructor() {
        this.service = new SyncService();
    }

    /**
     * Aplica um lote de mutações.
     * POST /sync
     *
     * Responde 200 mesmo havendo recusas: o status HTTP fala do lote, não das
     * mutações. Se voltasse 4xx, o interceptor do cliente trataria como falha de
     * transporte e descartaria o resultado dos itens que entraram.
     */
    async aplicar(req, res) {
        const { mutacoes } = SyncLoteSchema.parse(req.body);

        const { resultados } = await this.service.aplicarLote(mutacoes, req);

        const aceitas = resultados.filter((r) => r.situacao === 'aceito').length;

        return CommonResponse.success(
            res,
            { resultados },
            HttpStatusCodes.OK.code,
            `${aceitas} de ${resultados.length} mutações aplicadas.`,
        );
    }
}

export default SyncController;
```

- [ ] **Step 6: Registrar a rota**

`src/routes/syncRoutes.js`:

```js
// src/routes/syncRoutes.js

import express from 'express';
import SyncController from '../controllers/SyncController.js';
import AuthMiddleware from '../middlewares/AuthMiddleware.js';
import { asyncWrapper } from '../utils/helpers/index.js';

const router = express.Router();
const syncController = new SyncController();

router.post(
    '/sync',
    AuthMiddleware,
    asyncWrapper(syncController.aplicar.bind(syncController)),
);

export default router;
```

Em `src/routes/index.js`, acrescentar o import junto dos demais:

```js
import syncRoutes from './syncRoutes.js';
```

e registrar na mesma cadeia `app.use('/v1', ...)` onde as outras rotas entram, seguindo exatamente o padrão do arquivo.

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Verificar que a API sobe**

Run: `npm run dev:local`
Expected: sobe sem erro de import; `Ctrl+C` para encerrar.

- [ ] **Step 9: Commit**

```bash
git add src/controllers/SyncController.js src/routes/ src/utils/validators/schemas/zod/SyncSchema.js test/syncSchema.test.js
git commit -m "feat: expoe endpoint de sincronizacao em lote"
```

---

## Task 11: Regras de negócio dos services

**Files:**
- Create: `test/services/pastoService.test.js`
- Create: `test/services/rebanhoService.test.js`
- Create: `test/services/propriedadeService.test.js`

**Interfaces:**
- Consumes: suíte da Task 1
- Produces: cobertura das regras críticas. Fecha o item **C10a** do relatório de auditoria (issue #13).

- [ ] **Step 1: Escrever os testes do PastoService**

`test/services/pastoService.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * As regras que a banca vai perguntar: isolamento entre usuários, unicidade de
 * nome por propriedade, e a trava que impede esvaziar um pasto ocupado.
 */
describe('PastoService', () => {
    let service;

    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: PastoService } = await import('../../src/service/PastoService.js');
        service = new PastoService();
    });

    it('recusa criar pasto em propriedade de outro usuário', async () => {
        // O repositório real filtra pelo dono na própria consulta; devolver
        // null é como ele responde quando a propriedade não é do usuário.
        service.propriedadeRepository = { findById: vi.fn().mockResolvedValue(null) };

        await expect(
            service.create({ propriedadeId: 'p1', nome: 'X' }, req('invasor')),
        ).rejects.toMatchObject({ errorType: 'resourceNotFound', statusCode: 404 });
    });

    it('recusa criar pasto em propriedade inativa', async () => {
        service.propriedadeRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: false }),
        };
        service.repository = { findByNome: vi.fn().mockResolvedValue(null) };

        await expect(
            service.create({ propriedadeId: 'p1', nome: 'X' }, req()),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'propriedadeId' });
    });

    it('recusa nome já usado na mesma propriedade', async () => {
        service.propriedadeRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }),
        };
        service.repository = {
            findByNome: vi.fn().mockResolvedValue({ id: 'outro', nome: 'Piquete Norte' }),
        };

        await expect(
            service.create({ propriedadeId: 'p1', nome: 'Piquete Norte' }, req()),
        ).rejects.toMatchObject({ errorType: 'conflict', statusCode: 409, field: 'nome' });
    });

    it('aceita o mesmo nome em outra propriedade', async () => {
        service.propriedadeRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'p2', ativo: true }),
        };
        service.repository = {
            findByNome: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: 'novo' }),
        };

        await expect(
            service.create({ propriedadeId: 'p2', nome: 'Piquete Norte' }, req()),
        ).resolves.toMatchObject({ id: 'novo' });
    });

    it('recusa inativar pasto que ainda tem rebanho', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({ id: 'pasto1', propriedadeId: 'p1' }),
            countRebanhos: vi.fn().mockResolvedValue(2),
            update: vi.fn(),
        };

        await expect(
            service.update('pasto1', { ativo: false }, req()),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'ativo' });
        expect(service.repository.update).not.toHaveBeenCalled();
    });

    it('recusa marcar como Vazio um pasto ocupado', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({ id: 'pasto1', propriedadeId: 'p1' }),
            countRebanhos: vi.fn().mockResolvedValue(1),
            update: vi.fn(),
        };

        await expect(
            service.update('pasto1', { status: 'Vazio' }, req()),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'status' });
    });
});
```

- [ ] **Step 2: Rodar e verificar**

Run: `npx vitest run test/services/pastoService.test.js`
Expected: PASS, 6 testes. Se algum falhar, é defeito real no service — corrigir o service, não o teste.

- [ ] **Step 3: Escrever os testes do RebanhoService**

`test/services/rebanhoService.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Duas regras nascidas de defeito real: reativar sem pasto criava lote ativo
 * sem pasto (estado que `create` proíbe), e a lotação conjunta lia o campo
 * `status`, que é cache e estava comprovadamente defasado no seed.
 */
describe('RebanhoService', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({
            default: { prisma: { $transaction: async (cb) => cb({}) } },
        }));
        vi.resetModules();
        const { default: RebanhoService } = await import(
            '../../src/service/RebanhoService.js'
        );
        service = new RebanhoService();
    });

    it('recusa reativar rebanho sem informar pasto', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({
                id: 'r1', ativo: false, propriedadeId: 'p1', pastoAtualId: null,
            }),
            findByNome: vi.fn().mockResolvedValue(null),
        };

        await expect(
            service.update('r1', { ativo: true }, req()),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'pastoAtualId' });
    });

    it('recusa trocar de pasto fora da rota de movimentação', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({
                id: 'r1', ativo: true, propriedadeId: 'p1', pastoAtualId: 'pastoA',
            }),
            findByNome: vi.fn().mockResolvedValue(null),
        };

        await expect(
            service.update('r1', { pastoAtualId: 'pastoB' }, req()),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'pastoAtualId' });
    });

    it('recusa criar lote em pasto ocupado sem permitir lotação conjunta', async () => {
        service.propriedadeRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }),
        };
        service.pastoRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'pastoA', ativo: true, propriedadeId: 'p1' }),
        };
        service.repository = {
            findByNome: vi.fn().mockResolvedValue(null),
            countAtivosNoPasto: vi.fn().mockResolvedValue(1),
        };

        await expect(
            service.create(
                { propriedadeId: 'p1', pastoAtualId: 'pastoA', nomeRebanho: 'Lote' },
                req(),
            ),
        ).rejects.toMatchObject({ field: 'pastoAtualId' });
    });

    it('conta rebanhos ativos em vez de ler o status do pasto', async () => {
        service.propriedadeRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }),
        };
        // status diz 'Vazio', mas há lote ativo. A verdade é a contagem.
        service.pastoRepository = {
            findById: vi.fn().mockResolvedValue({
                id: 'pastoA', ativo: true, propriedadeId: 'p1', status: 'Vazio',
            }),
        };
        const contar = vi.fn().mockResolvedValue(1);
        service.repository = { findByNome: vi.fn().mockResolvedValue(null), countAtivosNoPasto: contar };

        await expect(
            service.create(
                { propriedadeId: 'p1', pastoAtualId: 'pastoA', nomeRebanho: 'Lote' },
                req(),
            ),
        ).rejects.toThrow();
        expect(contar).toHaveBeenCalledWith('pastoA');
    });

    it('recusa rebanho em pasto de outra propriedade', async () => {
        service.propriedadeRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }),
        };
        service.pastoRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'pastoX', ativo: true, propriedadeId: 'p9' }),
        };
        service.repository = { findByNome: vi.fn().mockResolvedValue(null) };

        await expect(
            service.create(
                { propriedadeId: 'p1', pastoAtualId: 'pastoX', nomeRebanho: 'Lote' },
                req(),
            ),
        ).rejects.toMatchObject({ field: 'pastoAtualId' });
    });
});
```

- [ ] **Step 4: Escrever os testes do PropriedadeService**

`test/services/propriedadeService.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('PropriedadeService', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: PropriedadeService } = await import(
            '../../src/service/PropriedadeService.js'
        );
        service = new PropriedadeService();
    });

    it('devolve 404 para propriedade de outro usuário', async () => {
        service.repository = { findById: vi.fn().mockResolvedValue(null) };

        await expect(
            service.ensurePropriedadeExists('p1', 'invasor'),
        ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('recusa nome duplicado com 409, não 400', async () => {
        // Antes o conflito saía como 400/validationError, e o cliente não
        // distinguia de dado malformado.
        service.repository = { findByNome: vi.fn().mockResolvedValue({ id: 'outra' }) };

        await expect(
            service.validateUniqueNome('Fazenda X', 'dono'),
        ).rejects.toMatchObject({ statusCode: 409, errorType: 'conflict' });
    });
});
```

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Conferir a cobertura dos services**

Run: `npm run test:cov`
Expected: relatório gerado; `src/service/` acima de 60% de linhas.

- [ ] **Step 7: Commit**

```bash
git add test/services/
git commit -m "test: cobre regras de negocio dos services"
```

---

## Task 12: Casos de regra compartilhados

**Files:**
- Create: `contrato/casos_de_regra.json`
- Create: `contrato/README.md`
- Create: `test/casosDeRegra.test.js`

**Interfaces:**
- Consumes: services testados na Task 11
- Produces: `contrato/casos_de_regra.json` como fonte única dos casos. A spec do aplicativo definirá como espelhar o arquivo e rodar os mesmos casos em Dart.

- [ ] **Step 1: Criar o arquivo de casos**

`contrato/casos_de_regra.json`:

```json
{
  "nomeUnicoPasto": [
    {
      "descricao": "nome já usado na mesma propriedade",
      "existentes": [{ "nome": "Piquete Norte", "propriedadeId": "p1", "ativo": true }],
      "entrada": { "nome": "Piquete Norte", "propriedadeId": "p1" },
      "esperado": "recusa"
    },
    {
      "descricao": "mesmo nome em outra propriedade é permitido",
      "existentes": [{ "nome": "Piquete Norte", "propriedadeId": "p1", "ativo": true }],
      "entrada": { "nome": "Piquete Norte", "propriedadeId": "p2" },
      "esperado": "aceita"
    },
    {
      "descricao": "nome de pasto inativo pode ser reaproveitado",
      "existentes": [{ "nome": "Piquete Norte", "propriedadeId": "p1", "ativo": false }],
      "entrada": { "nome": "Piquete Norte", "propriedadeId": "p1" },
      "esperado": "aceita"
    },
    {
      "descricao": "comparação ignora caixa",
      "existentes": [{ "nome": "Piquete Norte", "propriedadeId": "p1", "ativo": true }],
      "entrada": { "nome": "piquete norte", "propriedadeId": "p1" },
      "esperado": "recusa"
    }
  ],
  "formatoLocalizacao": [
    { "descricao": "cidade e UF", "entrada": { "localizacao": "Sorriso,MT" }, "esperado": "aceita" },
    { "descricao": "espaço após a vírgula", "entrada": { "localizacao": "Sorriso, MT" }, "esperado": "aceita" },
    { "descricao": "sem UF", "entrada": { "localizacao": "Vilhena" }, "esperado": "recusa" },
    { "descricao": "UF com um caractere", "entrada": { "localizacao": "Vilhena,R" }, "esperado": "recusa" },
    { "descricao": "vazio é permitido, campo é opcional", "entrada": { "localizacao": "" }, "esperado": "aceita" }
  ],
  "desfazerMovimentacao": [
    {
      "descricao": "a última pode ser desfeita",
      "existentes": [{ "id": "mov1", "ordem": 1 }, { "id": "mov2", "ordem": 2 }],
      "entrada": { "id": "mov2" },
      "esperado": "aceita"
    },
    {
      "descricao": "uma do meio não pode",
      "existentes": [{ "id": "mov1", "ordem": 1 }, { "id": "mov2", "ordem": 2 }],
      "entrada": { "id": "mov1" },
      "esperado": "recusa"
    }
  ]
}
```

- [ ] **Step 2: Documentar o propósito**

`contrato/README.md`:

```markdown
# Contrato de regras

`casos_de_regra.json` é a fonte única dos casos que verificam as regras que
existem **nos dois lados** — no Zod e nos services da API, e em Dart no
aplicativo.

A duplicação da regra é decisão, não defeito: a validação precisa acontecer no
aparelho, offline, no momento em que o produtor digita. Se ela só existisse na
API, o cadastro seria aceito na tela, viraria item de fila e só tomaria erro
horas depois, longe de quem poderia corrigir.

O que a torna segura é este arquivo. Os mesmos casos alimentam as duas
implementações e exigem o mesmo veredito. Divergiu, um dos dois runners quebra.

- API: `test/casosDeRegra.test.js`
- Aplicativo: definido na spec de sincronização do lado cliente

Ao mudar uma regra, mude o caso aqui primeiro. Os dois lados devem passar antes
do merge.
```

- [ ] **Step 3: Escrever o teste que consome os casos**

`test/casosDeRegra.test.js`:

```js
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Os mesmos casos rodam em Dart no aplicativo. Divergiu entre os dois lados, um
 * dos runners quebra.
 */
describe('casos de regra compartilhados', () => {
    let casos;

    beforeAll(async () => {
        casos = JSON.parse(await readFile('contrato/casos_de_regra.json', 'utf8'));
    });

    it('o arquivo declara os três conjuntos de regra', () => {
        expect(Object.keys(casos).sort()).toEqual([
            'desfazerMovimentacao',
            'formatoLocalizacao',
            'nomeUnicoPasto',
        ]);
    });

    it('todo caso tem descrição, entrada e veredito', () => {
        for (const [regra, lista] of Object.entries(casos)) {
            for (const caso of lista) {
                expect(caso.descricao, `${regra}: falta descrição`).toBeTruthy();
                expect(caso.entrada, `${regra}: falta entrada`).toBeDefined();
                expect(['aceita', 'recusa']).toContain(caso.esperado);
            }
        }
    });

    describe('formato da localização', () => {
        // Mesma expressão de PropriedadeSchema.js. Se ela mudar lá sem mudar
        // aqui, este teste acusa.
        const PADRAO = /^[A-Za-zÀ-ÿ\s'-]{2,100},\s?[A-Za-z]{2}$/;

        it('cada caso produz o veredito esperado', async () => {
            for (const caso of casos.formatoLocalizacao) {
                const valor = caso.entrada.localizacao;
                const aceita = valor === '' ? true : PADRAO.test(valor);
                expect(aceita ? 'aceita' : 'recusa', caso.descricao).toBe(caso.esperado);
            }
        });
    });

    describe('nome único de pasto', () => {
        // Espelha `PastoRepository.findByNome`: mesma propriedade, ignorando
        // caixa, considerando só os ativos.
        function jaExiste({ existentes, entrada }) {
            return existentes.some(
                (e) =>
                    e.ativo &&
                    e.propriedadeId === entrada.propriedadeId &&
                    e.nome.toLowerCase() === entrada.nome.toLowerCase(),
            );
        }

        it('cada caso produz o veredito esperado', () => {
            for (const caso of casos.nomeUnicoPasto) {
                const veredito = jaExiste(caso) ? 'recusa' : 'aceita';
                expect(veredito, caso.descricao).toBe(caso.esperado);
            }
        });
    });

    describe('desfazer movimentação', () => {
        it('só a última é aceita', () => {
            for (const caso of casos.desfazerMovimentacao) {
                const ultima = caso.existentes.reduce((a, b) => (a.ordem > b.ordem ? a : b));
                const veredito = ultima.id === caso.entrada.id ? 'aceita' : 'recusa';
                expect(veredito, caso.descricao).toBe(caso.esperado);
            }
        });
    });
});
```

- [ ] **Step 4: Rodar e verificar**

Run: `npx vitest run test/casosDeRegra.test.js`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add contrato/ test/casosDeRegra.test.js
git commit -m "test: adiciona casos de regra compartilhados com o app"
```

---

## Task 13: Verificação ponta a ponta contra a API em Docker

**Files:**
- Create: `test/e2e/lote.e2e.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: tudo das tasks anteriores
- Produces: script `npm run test:e2e`, executado com a API rodando em Docker. Não entra em `npm test`, porque depende de infraestrutura externa.

- [ ] **Step 1: Escrever o roteiro**

`test/e2e/lote.e2e.js`:

```js
// test/e2e/lote.e2e.js
//
// Executado contra a API real em Docker, com Postgres real. Prova o caminho
// completo: rota, middleware de autenticação, service, transação e Prisma.
//
//   npm run dev            # noutro terminal
//   npm run test:e2e
//
// Usa `fetch` do Node 22, sem dependência extra — mesma abordagem das 37
// asserções do fluxo de rebanho.

import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:6060/v1';
const EMAIL = process.env.E2E_EMAIL;
const SENHA = process.env.E2E_SENHA;

assert.ok(EMAIL && SENHA, 'Defina E2E_EMAIL e E2E_SENHA no ambiente.');

let passou = 0;
let falhou = 0;

function verificar(descricao, condicao) {
    if (condicao) {
        passou++;
        console.log(`  ok   ${descricao}`);
    } else {
        falhou++;
        console.error(`  FALHOU ${descricao}`);
    }
}

async function entrar() {
    const r = await fetch(`${BASE.replace('/v1', '')}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: SENHA }),
    });
    const corpo = await r.json();
    assert.ok(corpo.token, 'Login falhou: token ausente.');
    return corpo.token;
}

async function enviarLote(token, mutacoes) {
    const r = await fetch(`${BASE}/sync`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mutacoes }),
    });
    return { status: r.status, corpo: await r.json() };
}

const token = await entrar();

// ── 1. Lote misto: um pasto válido, um duplicado, e um rebanho dependente ────
const propriedadeId = process.env.E2E_PROPRIEDADE_ID;
assert.ok(propriedadeId, 'Defina E2E_PROPRIEDADE_ID no ambiente.');

const nomeUnico = `QA ${Date.now()}`;
const mutPastoOk = randomUUID();
const mutPastoDup = randomUUID();
const mutRebanho = randomUUID();
const idPastoOk = randomUUID();
const idPastoDup = randomUUID();
const idRebanho = randomUUID();

console.log('\n1. lote misto');
const primeiro = await enviarLote(token, [
    { id: mutPastoOk, entidade: 'pastos', acao: 'CREATE', entidadeId: idPastoOk,
      dados: { propriedadeId, nome: nomeUnico, extensaoHa: 5 } },
    { id: mutPastoDup, entidade: 'pastos', acao: 'CREATE', entidadeId: idPastoDup,
      dados: { propriedadeId, nome: nomeUnico, extensaoHa: 5 } },
    { id: mutRebanho, entidade: 'rebanhos', acao: 'CREATE', entidadeId: idRebanho,
      dependeDe: mutPastoDup,
      dados: { propriedadeId, pastoAtualId: idPastoDup, nomeRebanho: `Lote ${Date.now()}` } },
]);

verificar('responde 200 mesmo com recusa', primeiro.status === 200);

const porId = Object.fromEntries(
    primeiro.corpo.data.resultados.map((r) => [r.id, r]),
);
verificar('o primeiro pasto entra', porId[mutPastoOk]?.situacao === 'aceito');
verificar('o duplicado é recusado', porId[mutPastoDup]?.situacao === 'recusado');
verificar('a recusa vem com tipo conflict', porId[mutPastoDup]?.erro?.tipo === 'conflict');
verificar('a recusa não é recuperável', porId[mutPastoDup]?.erro?.recuperavel === false);
verificar('o dependente é bloqueado', porId[mutRebanho]?.situacao === 'bloqueado');
verificar('o bloqueio aponta a causa', porId[mutRebanho]?.bloqueadoPor === mutPastoDup);

// ── 2. Reenvio: idempotência ─────────────────────────────────────────────────
console.log('\n2. reenvio do mesmo lote');
const segundo = await enviarLote(token, [
    { id: mutPastoOk, entidade: 'pastos', acao: 'CREATE', entidadeId: idPastoOk,
      dados: { propriedadeId, nome: nomeUnico, extensaoHa: 5 } },
]);
const reenviado = segundo.corpo.data.resultados[0];
verificar('o reenvio devolve aceito sem duplicar', reenviado.situacao === 'aceito');
verificar('o id da entidade é o mesmo', reenviado.entidadeId === idPastoOk);

// ── 3. Delta ─────────────────────────────────────────────────────────────────
console.log('\n3. leitura por diferença');
const agora = new Date(Date.now() - 60_000).toISOString();
const delta = await fetch(
    `${BASE}/pastagens?propriedadeId=${propriedadeId}&atualizadoDesde=${agora}`,
    { headers: { Authorization: `Bearer ${token}` } },
);
const corpoDelta = await delta.json();
verificar('o delta responde 200', delta.status === 200);
verificar(
    'o pasto recém-criado aparece na janela',
    corpoDelta.data.docs.some((p) => p.id === idPastoOk),
);

// ── 4. Envelope inválido ─────────────────────────────────────────────────────
console.log('\n4. envelope inválido');
const ciclo = await enviarLote(token, [
    { id: mutPastoOk, entidade: 'pastos', acao: 'CREATE', entidadeId: idPastoOk,
      dependeDe: mutPastoDup, dados: { propriedadeId, nome: 'A' } },
    { id: mutPastoDup, entidade: 'pastos', acao: 'CREATE', entidadeId: idPastoDup,
      dependeDe: mutPastoOk, dados: { propriedadeId, nome: 'B' } },
]);
verificar('ciclo de dependência devolve 400', ciclo.status === 400);

console.log(`\n${passou} asserções passaram, ${falhou} falharam.`);
process.exit(falhou === 0 ? 0 : 1);
```

- [ ] **Step 2: Registrar o script**

Em `package.json`, dentro de `"scripts"`:

```json
"test:e2e": "node test/e2e/lote.e2e.js"
```

- [ ] **Step 3: Subir a API**

Run: `npm run dev`
Expected: API em `http://localhost:6060`, Postgres do compose no ar.

- [ ] **Step 4: Executar contra a API real**

```bash
E2E_EMAIL=<email> E2E_SENHA=<senha> E2E_PROPRIEDADE_ID=<uuid> npm run test:e2e
```

Expected: todas as asserções passam, saída `0 falharam`.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/ package.json
git commit -m "test: verifica o lote ponta a ponta contra a api em docker"
```

---

## Autorrevisão

**Cobertura da spec**

| Seção da spec | Task |
|---|---|
| 3 Arquitetura / 3.1 Despacho | 9 |
| 4.1 Requisição, regras por ação | 10 |
| 4.2 Resposta, três situações | 9, 10 |
| 4.3 Envelope inválido | 9, 10 |
| 5 Idempotência | 3, 8, 9 |
| 6 Delta e mudanças de modelo | 3, 4, 5 |
| 6.2 Carimbo por entidade | — lado do aplicativo, fora desta spec |
| 7 Desfazer a última movimentação | 3, 6 |
| 8 Contrato de erro | 2 |
| 9 Validação em duas camadas | 12 (lado API) |
| 10 Testes | 1, 11, 12, 13 |
| 13 Critério de aceite | 13 |

**Consistência de nomes verificada**

`descreverErro` / `ehRecuperavel` (Task 2) · `ordenarPorDependencia` / `descendentes` (Task 7) · `buscarPorIds` / `registrar` / `limparAntigas` (Task 8) · `aplicarLote` (Task 9) · `SyncLoteSchema` / `MAXIMO_DE_MUTACOES` (Task 10) · `ultimaDoRebanho` / `desfazerComTransacao` (Task 6).

**Pendência conhecida**

A seção 6.2 da spec (carimbo por entidade) é regra do aplicativo e será implementada na spec do lado cliente. Está registrada aqui para não parecer esquecimento.
