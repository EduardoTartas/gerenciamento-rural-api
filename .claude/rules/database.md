---
description: Convenções de banco e Prisma ORM.
paths:
  - "prisma/**"
  - "src/repository/**/*.js"
---

# Banco de Dados (Prisma 7 + PostgreSQL)

- Acesso ao banco SÓ via repository. Service/controller nunca importam `prisma` direto.
- `select` explícito em toda query — nunca retornar objeto Prisma completo pra fora do repository.
- Evitar N+1: usar `include`/`select` aninhado do Prisma, nunca loop de queries.
- Paginação e filtros no banco (`where`, `skip`, `take`), não em memória.
- Migrations via `npm run prisma:migrate`. Nunca editar SQL de migration já aplicada nem alterar o
  schema manualmente sem gerar migration.
- **Atenção**: há um índice único parcial em `propriedades (usuarioId, nome) WHERE ativo = true` criado
  por migration mas não declarado no `schema.prisma`. Verificar antes de rodar `prisma migrate dev` que
  ele não será derrubado.
- Transações (`prisma.$transaction`) para fluxos multi-tabela. Contagens que influenciam a decisão devem
  ficar **dentro** da transação (evita condição de corrida). Ver `MovimentacaoRepository.createComTransacao`.
  Ao usar `$transaction`, delegar as queries a métodos de repository recebendo o `tx`.
- Soft-delete: `propriedades`, `pastos`, `rebanhos` e catálogos usam `ativo: false`. `DELETE` delega para
  update de `ativo`. Manejos são exclusão real (sem dependentes).
- Catálogos globais (`raca`, `sistemaProducao`, `regimeAlimentar`, `tipoManejoRebanho`, `tipoManejoPasto`)
  são compartilhados entre todos os usuários — não têm `propriedadeId`, não escopar por usuário.
- Repositories são singletons exportados por `src/repository/index.js`.
