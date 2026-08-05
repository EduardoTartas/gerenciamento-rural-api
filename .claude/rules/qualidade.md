---
description: Qualidade, performance, consistência e postura frente a specs.
---

# Qualidade, Performance e Consistência

## Implementação

- Pequena, coesa, focada no escopo da issue.
- Refatorar quando corrigir bug/risco/perf/complexidade/consistência exigir. Refatoração ampla fora de
  escopo = pedir autorização.
- Ler o service e o repository do domínio antes de alterar qualquer coisa — os padrões são consistentes
  e devem ser mantidos.
- Preservar contratos públicos (`CommonResponse`, forma dos schemas) salvo se a issue exigir mudança.
- Toda entrega inclui validação prática: `npm test` passando + smoke dos fluxos críticos do domínio
  alterado.

## Performance (alvo do TCC)

- Normal: 1-3 usuários simultâneos. Máx resiliência: 100 req/min, 10 usuários, sem crash.
- Evitar N+1 — usar `include`/`select` do Prisma, nunca loop de queries.
- Paginação e filtros no banco, não em memória.
- Reduzir payload: `select` explícito, nunca `select *` implícito.
- Isolar chamadas externas (nodemailer) para não degradar a transação principal.

## Consistência global

- Código, validação Zod, contrato de API (`CommonResponse`) e Swagger sempre 100% consistentes.
- Padronizar nomenclatura e formato de erro (`CustomError`) nos módulos afetados.
- A API é fonte de verdade sobre nomes/tipos de campo — não o texto da spec ou o app mobile.

## Specs são base, não teto

- Cumprir 100% dos contratos, campos, validações e checklists da spec.
- Verificar contrato real (`prisma/schema.prisma`, Swagger em `src/docs/`) antes de confiar na spec.
- Divergência spec×API: corrigir na implementação, documentar em `documentacao/rotas/`.
- Liberdade acima da spec: guards defensivos, seguir padrão do codebase, suporte offline-first mais
  robusto quando fizer sentido.
- Aceite final: funciona, contrato coerente, seguro, performático, escopado por usuário, robusto offline.
