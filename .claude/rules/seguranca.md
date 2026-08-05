---
description: Segurança como requisito funcional. Sempre ativa.
---

# Segurança (security-first)

- Segurança = requisito funcional, não melhoria opcional.
- Validar 100% dos inputs (params, query, body) com Zod `.strict()` antes da camada de `service`.
- Multi-tenancy: **toda** query de dado do domínio rural escopada a `usuarioId` (direto ou via relação —
  ver `CLAUDE.md`). Nunca confiar em `propriedadeId`/`pastoId`/`rebanhoId` vindo do cliente sem validar
  que pertence ao usuário autenticado (`req.user`, populado pelo `AuthMiddleware`).
- Nunca vazar segredo, stack trace, token, cookie, hash, credencial ou detalhe interno em resposta ou log.
  Erros de domínio sempre via `CustomError` — nunca `res.status().json()` direto em service/controller.
- Sem fallback silencioso em auth/autorização — falha explícita via `CustomError`, auditável.
- Fluxos multi-tabela (ex.: BetterAuth + entidade de domínio) exigem `prisma.$transaction` — consistência
  ou compensação clara, nunca estado parcial.
- Dependências: preferir libs maduras e mantidas. Evitar abandonadas/risco conhecido.
- Mensagens de erro voltam para o produtor rural na tela do celular — nunca incluir jargão técnico ou
  detalhe de implementação nelas.
