## O que foi feito

<!-- Resumo objetivo das mudanças desta MR. -->

## Por que

<!-- Motivação: issue, bug ou requisito que originou a mudança. Linkar a issue (#id) se houver. -->

## Como testar

<!-- Passo a passo para validar. Comandos, rotas/endpoints, cenários e resultado esperado. -->

## Checklist

- [ ] `npm test` passa localmente
- [ ] Escopo focado, sem código fora do necessário
- [ ] Inputs validados (Zod `.strict()`); queries escopadas por `usuarioId`
- [ ] Sem segredo/credencial exposto em código, log ou resposta
- [ ] Swagger (`src/docs/`) e `documentacao/rotas/` atualizados se o endpoint mudou
- [ ] Target branch: `develop`
