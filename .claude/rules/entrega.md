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
- O `.gitlab-ci.yml` roda `test_job` (Postgres real + `npm test`) em todo `merge_request_event`, além do
  lint de manifests Kubernetes (`kubeconform`). Ainda assim, rodar `npm test` local antes do push agiliza
  o feedback e evita pipeline vermelho.
- Falha de pipeline = corrigir na hora, não empurrar para o revisor.

## Gitflow

- Branch semântica a partir de `develop` → MR para `develop`.
- Nunca commit direto em `develop` sem autorização explícita. Nunca `main` — `main` só recebe release.
