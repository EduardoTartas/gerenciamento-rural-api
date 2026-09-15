# Testes de endpoint por rota

Suíte de testes de integração HTTP da API Pasto Livre: cada rota tem seu `.md` de cenários
(esta pasta) e seus arquivos `test/endpoints/<rota>/<metodo>-<caminho>.test.js` correspondentes.
Os testes rodam contra um PostgreSQL real, com usuários BetterAuth reais (A, B e um admin).

## Como rodar

```bash
docker compose -f docker-compose.dev.yml up -d postgresql
npm run test:endpoints
```

O banco de teste é `pasto_livre_teste` — separado do banco de desenvolvimento. Por padrão a
suíte conecta em `postgresql://localhost:5432/pasto_livre_teste` (ajustado pelo setup da
Task 2); para apontar para outra instância, defina a variável de ambiente opcional:

```bash
DATABASE_URL_TESTE=postgresql://usuario:senha@host:5432/pasto_livre_teste npm run test:endpoints
```

Pré-condição comum a toda a suíte: usuário **A**, usuário **B** e um usuário **admin**
autenticados via BetterAuth antes de cada bateria de testes. Salvo indicação em contrário,
"o usuário" nos cenários é o usuário A; B aparece só nos cenários de multi-tenancy.

## Convenção de ID de cenário

```
<SIGLA>-<MÉTODO>-NN          para rotas de coleção (POST /x, GET /x)
<SIGLA>-<MÉTODO>-ID-NN       para rotas de item (GET/PATCH/DELETE /x/:id)
```

- `SIGLA`: identifica a rota (tabela abaixo).
- `MÉTODO`: `POST`, `GET`, `PATCH` ou `DELETE`.
- `ID`: literal, presente só quando o caminho tem `:id`.
- `NN`: dois dígitos, sequencial dentro da seção (`01`, `02`, ...).

Exemplos: `PROP-GET-01` (primeiro cenário de `GET /propriedades`), `PROP-GET-ID-03` (terceiro
cenário de `GET /propriedades/:id`), `MPAS-PATCH-ID-05`.

## Categorias obrigatórias por método (quando aplicáveis)

Cada seção de método+caminho deve cobrir, na medida em que fizer sentido para aquele
endpoint:

- **Sucesso** — caminho feliz, incluindo variações de campos opcionais.
- **Validação de body/query/params** — inclusive `.strict()` (campo extra rejeitado) e corpo
  vazio.
- **401** — sem token e com token inválido/expirado.
- **403 admin** — endpoints restritos a admin (ver `usuarios.md`, `catalogos.md`).
- **Multi-tenancy** — usuário B recebe 404 ao ler/alterar/remover recurso de A; B não vê
  recursos de A na listagem; B não consegue criar um filho apontando para um pai (propriedade,
  pasto, rebanho, insumo...) que pertence a A.
- **404** — recurso inexistente (UUID válido, mas sem registro).
- **Regras de negócio** — unicidade de nome, travas de integridade (ex.: não inativar com
  filhos ativos), transações multi-tabela, `id` opcional do cliente (offline-first), leitura
  por diferença (`atualizadoDesde`), paginação e limite máximo de 100 itens por página.

Cada arquivo `.md` fecha com uma seção `## Divergências` listando onde o comportamento atual
do código diverge de `documentacao/rotas/rotas_pastolivre.md` ou é claramente um bug —
citando `arquivo:linha`. Essas divergências são para o teste registrar o comportamento real,
não para corrigir o código.

## Índice de rotas

| Rota | Arquivo | Sigla |
| :--- | :--- | :--- |
| `/propriedades` | [propriedades.md](./propriedades.md) | PROP |
| `/pastagens` | [pastagens.md](./pastagens.md) | PAST |
| `/pastagens/manejos` | [pastagens-manejos.md](./pastagens-manejos.md) | MPAS |
| `/rebanhos` | [rebanhos.md](./rebanhos.md) | REB |
| `/rebanhos/manejos` | [rebanhos-manejos.md](./rebanhos-manejos.md) | MREB |
| `/rebanhos/movimentacoes` | [rebanhos-movimentacoes.md](./rebanhos-movimentacoes.md) | MOV |
| `/rebanhos/regimes-consumo` | [rebanhos-regimes-consumo.md](./rebanhos-regimes-consumo.md) | REG |
| `/insumos` | [insumos.md](./insumos.md) | INS |
| `/insumos/movimentacoes` | [insumos-movimentacoes.md](./insumos-movimentacoes.md) | MINS |
| `/catalogos/:entidade` | [catalogos.md](./catalogos.md) | CAT |
| `/usuarios` | [usuarios.md](./usuarios.md) | USR |
| `/uploads` | [uploads.md](./uploads.md) | UPL |
| `/sync` | [sync.md](./sync.md) | SYNC |
| Transversal (`/health`, 404, JSON inválido, ordem de rotas, 401) | [transversal.md](./transversal.md) | APP |

## Sigla por rota

| Sigla | Rota |
| :--- | :--- |
| PROP | `/propriedades` |
| PAST | `/pastagens` |
| MPAS | `/pastagens/manejos` |
| REB | `/rebanhos` |
| MREB | `/rebanhos/manejos` |
| MOV | `/rebanhos/movimentacoes` |
| REG | `/rebanhos/regimes-consumo` |
| INS | `/insumos` |
| MINS | `/insumos/movimentacoes` |
| CAT | `/catalogos` |
| USR | `/usuarios` |
| UPL | `/uploads` |
| SYNC | `/sync` |
| APP | transversal (`/health`, 404, JSON inválido, ordem de rotas, 401 genérico) |
