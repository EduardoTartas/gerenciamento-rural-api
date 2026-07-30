# CLAUDE.md — Pasto Livre API

Contexto e regras de trabalho para agentes de IA neste repositório.

## O que é este projeto

API REST do **Pasto Livre**, sistema de apoio ao manejo de gado de corte desenvolvido como
Trabalho de Conclusão de Curso. Atende o aplicativo mobile
(`gerenciamento-rural-mobile`, repositório separado) que opera em modo **offline-first**.

Público-alvo: pecuaristas de pequeno e médio porte em regiões com conectividade
intermitente. Toda decisão de projeto deve considerar esse cenário.

## Stack

- **Node.js 20+** com ES Modules (`"type": "module"` — use `import`, nunca `require`)
- **Express 5**
- **Prisma 7** com `@prisma/adapter-pg` sobre PostgreSQL 16
- **Zod 4** para validação (importado como `zod/v4`)
- **BetterAuth 1.5** para autenticação (sessões + plugin `bearer` para o mobile)
- **Winston** para logs, **Swagger** para documentação em `/docs`

## Arquitetura em camadas

O fluxo é sempre o mesmo. Respeite-o ao adicionar qualquer recurso:

```
routes/ → controllers/ → service/ → repository/ → Prisma
```

| Camada | Responsabilidade | Não faz |
| :--- | :--- | :--- |
| `routes/` | Define o caminho, aplica `AuthMiddleware` e `asyncWrapper` | Lógica |
| `controllers/` | Valida entrada com Zod, formata resposta com `CommonResponse` | Acessa banco |
| `service/` | Regras de negócio, validações cruzadas, transações | Formata HTTP |
| `repository/` | Queries Prisma, `select` explícito | Regras de negócio |

Repositories são singletons exportados por `src/repository/index.js`. Services os recebem
no construtor.

## Convenções obrigatórias

### Respostas HTTP

Sempre via `CommonResponse`. O envelope é fixo e o app depende dele:

```js
{ "message": "3 pastagem(ns) encontrada(s).", "data": { ... }, "errors": [] }
```

- Sucesso: `CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'mensagem')`
- Criação: `CommonResponse.created(res, data, 'mensagem')`
- Erro: lance `CustomError`, não responda diretamente — o `errorHandler` centraliza

### Erros

Sempre `throw new CustomError({ statusCode, errorType, field, details, customMessage })`.
Nunca `res.status(400).json(...)` dentro de service ou controller.

### Validação

Um schema Zod por operação, em `src/utils/validators/schemas/zod/`. Todos usam `.strict()`
— campos extras no corpo geram 400. Query params têm schemas próprios em `querys/`.

**Atenção:** o controller deve atribuir o resultado a `req._parsedQuery`, porque o service
lê `req._parsedQuery ?? req.query`. Se apenas validar sem atribuir, os valores coagidos
pelo Zod (booleanos, datas, números) são perdidos silenciosamente.

```js
// correto
req._parsedQuery = await PastoQuerySchema.parseAsync(query);
```

### Multi-tenancy

**Toda** consulta de dado do domínio rural é escopada ao usuário autenticado. O padrão:

```js
// direto
where: { id, usuarioId }
// via relação
where: { id, propriedade: { usuarioId } }
where: { id, rebanho: { propriedade: { usuarioId } } }
```

Nunca exponha um recurso sem esse filtro. `req.user` é populado pelo `AuthMiddleware`.

### Suporte offline-first

Os schemas de criação aceitam um campo `id` opcional (UUID). Quando o app cria um registro
sem internet, ele gera o UUID localmente e o envia ao sincronizar, para que o mesmo
identificador exista nos dois lados. **Ao criar um recurso novo, preserve esse `id`** —
repasse `parsedData` inteiro ao repository em vez de montar o objeto campo a campo.

### Transações

Operações que alteram mais de uma tabela usam `prisma.$transaction`. Contagens que
influenciam a decisão devem ficar **dentro** da transação, para evitar condição de corrida.
Veja `MovimentacaoRepository.createComTransacao` como referência.

### Soft-delete

`propriedades`, `pastos`, `rebanhos` e catálogos usam `ativo: false`. `DELETE /:recurso/:id`
delega para o update de `ativo`, aproveitando as travas de integridade. Manejos são
excluídos de verdade (não têm dependentes).

## Comandos

```bash
npm run dev              # sobe API + PostgreSQL via Docker Compose, com hot-reload
npm run dev:local        # nodemon direto no host (requer PostgreSQL rodando)
npm run prisma:migrate   # aplica migrations pendentes
npm run prisma:seed      # popula catálogos e dados de teste
npm run prisma:studio    # interface visual do banco
```

A API sobe em `http://localhost:6060`. Swagger em `http://localhost:6060/docs`.
Health check em `/health` (verifica conexão real com o banco).

Não há suíte de testes configurada neste repositório.

## Banco de dados

Schema em `prisma/schema.prisma`. Ao alterá-lo, gere uma migration — não edite SQL
existente. Atenção: há um índice único parcial em `propriedades (usuarioId, nome)
WHERE ativo = true` criado por migration mas **não declarado no schema**. Antes de rodar
`prisma migrate dev`, verifique se ele não será derrubado.

Entidades: `user`/`session`/`account` (BetterAuth) · `propriedade` → `pasto` → `rebanho` ·
eventos `historicoMovimentacao`, `manejoRebanho`, `manejoPasto` · catálogos globais
`raca`, `sistemaProducao`, `regimeAlimentar`, `tipoManejoRebanho`, `tipoManejoPasto`.

Catálogos são **compartilhados entre todos os usuários** — não têm `propriedadeId`.

## Documentação

- `documentacao/rotas/rotas_pastolivre.md` — regras de negócio por endpoint
- `src/docs/` — definições OpenAPI (paths e schemas separados por domínio)
- `deployment/infrastructure_diagram.md` — infraestrutura (K3s na Oracle Cloud,
  Cloudflare Tunnel, GitLab CI)

Ao alterar o comportamento de um endpoint, atualize `src/docs/paths/` **e** o documento de
rotas na mesma mudança.

## Commits

O repositório usa Conventional Commits **com escopo**, em português, sem emoji:

```
feat(schema): permite id opcional nos schemas de criacao
fix(propriedade): remover constraint unica incondicional
docs(rotas): documenta endpoints de rebanho
```

Siga esse padrão. Nunca adicione co-autoria de IA nos commits.

## Ao trabalhar aqui

1. Leia o service e o repository do domínio antes de alterar qualquer coisa — os padrões
   são consistentes e devem ser mantidos.
2. Nunca acesse `this.prisma` diretamente de um controller.
3. Ao adicionar um recurso, replique a estrutura completa: rota, controller, service,
   repository, schema Zod de body, schema Zod de query, e documentação Swagger.
4. Mensagens de erro voltam para o produtor rural na tela do celular — escreva em
   português claro, sem jargão técnico.
