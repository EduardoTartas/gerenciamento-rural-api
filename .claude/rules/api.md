---
description: Convenções de back-end. Arquitetura em camadas, erros, respostas HTTP.
paths:
  - "src/routes/**/*.js"
  - "src/controllers/**/*.js"
  - "src/service/**/*.js"
---

# Convenções API (Express 5 + Prisma + BetterAuth)

## Arquitetura em camadas (fluxo obrigatório)

routes → controllers → service → repository → Prisma

- **routes/** (`<entidade>Routes.js`): só define endpoints, `AuthMiddleware` e `asyncWrapper`. Zero lógica.
- **controllers/** (`<Entidade>Controller.js`): valida com Zod, atribui a `req._parsedQuery` quando for
  query, chama service, formata resposta com `CommonResponse`. Nunca acessa `this.prisma`.
- **service/** (`<Entidade>Service.js`): regra de negócio, validações cruzadas, transações. Único lugar
  com lógica de domínio (SRP). Lê `req._parsedQuery ?? req.query` — nunca query bruta.
- **repository/** (`<Entidade>Repository.js`): único lugar que toca Prisma. Singleton exportado por
  `src/repository/index.js`, recebido pelo service via construtor.
- NUNCA pular camada (controller→repository direto = proibido).

## Respostas HTTP

Sempre via `CommonResponse`, envelope fixo (`{ message, data, errors }`), o app mobile depende dele:

- Sucesso: `CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'mensagem')`
- Criação: `CommonResponse.created(res, data, 'mensagem')`
- Erro: lance `CustomError({ statusCode, errorType, field, details, customMessage })` — nunca responda
  diretamente, o `errorHandler` centraliza.

## Nomenclatura

- Classes PascalCase + sufixo de camada: `PastoController.js`, `PastoService.js`.
- Routes camelCase + `Routes`: `pastoRoutes.js`. Seguir padrão existente.

## Validação

- Um schema Zod por operação em `src/utils/validators/schemas/zod/`, todos `.strict()`.
- Query params têm schema próprio em `querys/`. Atribuir resultado a `req._parsedQuery` — se só validar
  sem atribuir, valores coagidos pelo Zod (booleano, data, número) somem silenciosamente.

## Multi-tenancy e offline-first

- Ver `rules/seguranca.md` para escopo por `usuarioId`.
- Schemas de criação aceitam `id` (UUID) opcional para o app offline-first. Ao criar, repassar
  `parsedData` inteiro ao repository — nunca montar objeto campo a campo, perde o `id` preservado.

## Logging

- winston para logs. Nunca `console.log` fora de seeds/scripts. Nunca logar segredo/token/senha/hash.
