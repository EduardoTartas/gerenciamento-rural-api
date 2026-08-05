---
description: Princípios de engenharia obrigatórios em qualquer alteração de código.
---

# Princípios de Engenharia

## DRY — Don't Repeat Yourself

- Lógica de negócio repetida em ≥2 lugares: extrair para o `service` ou util em `src/utils/`.
- Regra de negócio duplicada = fonte única de verdade. Nunca copiar-colar validação entre schemas Zod.
- Duplicação incidental (2 trechos parecidos com razões diferentes) NÃO é violação — não abstrair cedo demais.

## KISS — Keep It Simple

- Solução mais simples que resolve o requisito. Sem camadas especulativas.
- Preferir código legível a "esperto". Se precisa de comentário p/ explicar o quê, simplificar.

## YAGNI — You Aren't Gonna Need It

- Implementar só o que a issue/spec pede. Sem hooks de extensão "pro futuro".
- Sem generalização sem 2+ casos de uso reais.

## SOLID (subset pragmático — não dogmático)

- **SRP**: cada controller/service/repository = 1 responsabilidade. Arquivo grande = sinal de quebra.
- **DIP**: service depende de abstração do repository (métodos), nunca do Prisma Client direto.
- OCP/ISP: aplicar só onde services/repositories se beneficiam de fato.
- LSP: pouco relevante aqui — evitar herança, preferir composição.

**Prioridade em conflito:** KISS/YAGNI vencem SOLID. Nunca adicionar abstração SOLID que YAGNI condena.
