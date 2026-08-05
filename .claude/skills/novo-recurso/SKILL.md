---
description: Cria um novo recurso de domínio (rota, controller, service, repository, schemas Zod e docs Swagger) replicando a arquitetura em camadas do projeto. Use quando o usuário pedir para adicionar uma nova entidade/rota/recurso à API.
argument-hint: <NomeEntidade>
---

Recurso a criar: **$ARGUMENTS**

Use `Pasto` (`src/routes/pastoRoutes.js`, `src/controllers/PastoController.js`,
`src/service/PastoService.js`, `src/repository/PastoRepository.js`) como referência de padrão —
leia esses quatro arquivos antes de escrever qualquer código.

Para o novo recurso, criar na mesma ordem, sem pular camada:

1. **Model** (`prisma/schema.prisma`): campo(s) necessários. Se o recurso pertence ao domínio rural,
   escopar por `usuarioId` (direto ou via relação). Gerar migration com `npm run prisma:migrate` —
   nunca editar SQL de migration existente. Ver `.claude/rules/database.md`.
2. **Repository** (`src/repository/<Entidade>Repository.js`): único lugar que toca Prisma, `select`
   explícito, registrar o singleton em `src/repository/index.js`.
3. **Schemas Zod** (`src/utils/validators/schemas/zod/`): um schema de body por operação, `.strict()`.
   Se houver listagem/filtro, schema de query em `querys/`.
4. **Service** (`src/service/<Entidade>Service.js`): regra de negócio, recebe o repository no
   construtor, nunca acessa Prisma direto. Erros via `CustomError`.
5. **Controller** (`src/controllers/<Entidade>Controller.js`): valida com Zod, atribui
   `req._parsedQuery` quando houver query, chama service, responde com `CommonResponse`.
6. **Routes** (`src/routes/<entidade>Routes.js`): só endpoints + `AuthMiddleware` + `asyncWrapper`,
   registrar em `src/routes/index.js`.
7. **Swagger** (`src/docs/paths/` e `src/docs/schemas/`, conforme padrão dos recursos existentes).
8. **Documentação de regras** (`documentacao/rotas/rotas_pastolivre.md`): descrever o novo endpoint.

Antes de declarar pronto: rodar `npm test`. Se o recurso for do domínio rural, confirmar que toda
query está escopada ao usuário autenticado (`.claude/rules/seguranca.md`) e que os schemas de criação
aceitam `id` opcional para suporte offline-first (`.claude/rules/api.md`).
