---
description: Padrão de entrega — MRs e pipeline. Sempre ativo.
---

# Entrega — MR e Pipeline

## Todo MR deve conter (template `.gitlab/merge_request_templates/Default.md`)

- **O que foi feito**: resumo objetivo das mudanças.
- **Por que**: motivação (issue, bug ou requisito). Linkar a issue se houver.
- **Como testar**: passo a passo, comandos, cenários e resultado esperado.

## Pipeline

- Pipeline SEMPRE verde antes de pedir review. MR com pipeline vermelho não se abre para review nem se
  mergeia.
- O `.gitlab-ci.yml` atual só valida manifests Kubernetes (`kubeconform`) — **não** roda `npm test` no CI.
  Isso não dispensa a validação local: antes de push, rodar `npm test` e conferir os fluxos críticos do
  domínio alterado manualmente.
- Falha de pipeline = corrigir na hora, não empurrar para o revisor.

## Gitflow

- Branch semântica a partir de `develop` → MR para `develop`.
- Nunca commit direto em `develop` sem autorização explícita. Nunca `main` — `main` só recebe release.
