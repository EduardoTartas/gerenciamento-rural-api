# /notificacoes e /dispositivos

Controller `NotificacaoController` · Services `NotificacaoService`, `VerificacaoNotificacoesService` ·
Repository `NotificacaoRepository` · Regras puras `src/service/notificacao/regras.js` · Cliente
`src/utils/npaas.js` · Schemas `NotificacaoUpdateSchema`, `NotificacaoLidasSchema`,
`DispositivoRegistrarSchema`, `DispositivoDesativarSchema`, `NotificacaoQuerySchema`,
`NotificacaoIdSchema` · Regras: rotas_pastolivre.md § 14

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth. **O NPaaS nunca é
chamado de verdade**: as suítes de endpoint substituem `src/utils/npaas.js` por um falso
(`vi.mock`), que começa ligado e respondendo sucesso; `NPAAS-*` testa o cliente real com `fetch`
falso. A verificação roda pelo `POST /notificacoes/verificar` (ignora o horário de silêncio) ou
pelo service com `agora` fixo (silêncio e resumo do mês).

## GET /notificacoes e /notificacoes/:id

Arquivo: `test/endpoints/notificacoes/notificacoes.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| NOTIF-GET-01 | lista as do usuário | 2 de A, 1 de B | 200 | só as de A, mais nova primeiro; campos do contrato; sem `chaveAtiva`/`pushStatus`/`usuarioId` |
| NOTIF-GET-02 | filtro `lida` | 1 lida, 2 não lidas | 200 | 1 item; `naoLidas: 2` independe do filtro |
| NOTIF-GET-03 | `atualizadoDesde` | uma antes e uma depois do corte | 200 | só a posterior |
| NOTIF-GET-04 | `propriedadeId` + paginação | 2 da fazenda, 1 sem | 200 | `totalDocs: 2`, `totalPages: 2`, 1 item |
| NOTIF-GET-05 | query inválida ou desconhecida | `lida=talvez`, `atualizadoDesde=ontem`, `usuarioId` | 400 | `.strict()` |
| NOTIF-GET-06 | sem token | — | 401 | — |
| NOTIF-GETID-01 | detalhe | própria, de B, inexistente, id inválido | 200/404/404/400 | escopo por usuário |

## PATCH /notificacoes/:id e /notificacoes/lidas

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| NOTIF-PATCH-01 | marca como lida | não lida | 200 | `lida`, `lidaEm`, `updatedAt` avança |
| NOTIF-PATCH-02 | `lida: false` | lida | 200 | `lidaEm` nulo |
| NOTIF-PATCH-03 | notificação de B | — | 404 | nada muda |
| NOTIF-PATCH-04 | corpo vazio, campo extra, `lida` não booleana | — | 400 | — |
| NOTIF-LIDAS-01 | marca todas | 2 não lidas, 1 lida de A; 1 de B | 200 | `marcadas: 2`; a de B intacta |
| NOTIF-LIDAS-02 | com `propriedadeId` | 1 da fazenda, 1 sem | 200 | `marcadas: 1` |
| NOTIF-LIDAS-03 | campo extra | — | 400 | — |

## POST /sync — notificacoes:UPDATE

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| NOTIF-SYNC-01 | `notificacoes:UPDATE { lida: true }` | não lida de A | 200 (`aceito`) | `lida` e `lidaEm` gravados |
| NOTIF-SYNC-02 | campo além de `lida`; notificação de B | — | 200 (`recusado` ×2) | a de B intacta |
| NOTIF-SYNC-03 | `CREATE` e `DELETE` de notificação | — | 200 (`recusado` ×2) | combinação não suportada |

## POST /dispositivos/registrar e /dispositivos/desativar-token

Arquivo: `test/endpoints/notificacoes/dispositivos.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| DISP-POST-01 | registra o token | — | 200 | `{ registrado: true, pushAtivo: true }`; NPaaS chamado com o id do usuário autenticado |
| DISP-POST-02 | sem `plataforma` | — | 200 | `android` |
| DISP-POST-03 | NPaaS falha | falso responde `false` | 200 | `registrado: false` |
| DISP-POST-04 | NPaaS não configurado | `ativo: false` | 200 | `{ registrado: false, pushAtivo: false }` |
| DISP-POST-05 | sem token, token curto, plataforma inválida, campo extra | — | 400 | NPaaS não chamado |
| DISP-POST-06 | sem token de sessão | — | 401 | registrar e desativar |
| DISP-DESAT-01 | desativa | — | 200 | NPaaS chamado com o token |
| DISP-DESAT-02 | NPaaS falha; corpo vazio | — | 200 / 400 | `desativado: false` |

## Cliente NPaaS

Arquivo: `test/endpoints/notificacoes/npaas-cliente.test.js`

| ID | Cenário | Verifica |
| :--- | :--- | :--- |
| NPAAS-01 | envio do push | URL `/notificacoes/enviar`, `x-api-key`, usuário `<id>_mobile`, `dados` só string (nulos removidos) |
| NPAAS-02 | registro do aparelho | URL `/dispositivos`, `plataforma` padrão `android` |
| NPAAS-03 | sem `NPAAS_URL`/`NPAAS_API_KEY` | desligado, nenhuma chamada de rede |
| NPAAS-04 | erro de rede, 500, 401 | `false`, nunca exceção |

## Verificação — POST /notificacoes/verificar

Arquivo: `test/endpoints/notificacoes/verificacao.test.js`

| ID | Cenário | Pré-condição | Verifica |
| :--- | :--- | :--- | :--- |
| VERIF-01 | `PASTO_PRONTO` | pasto em descanso há 40 dias | aviso com rota `/pastos/{id}`; push com `notificacaoId`, `tipo`, `rota`, `propriedadeId`, `entidadeId` |
| VERIF-02 | descanso do pasto e exclusões | 45 dias de ajuste, ocupado, sem data, inativo | só o pasto pronto |
| VERIF-03 | `OCUPACAO_LONGA` | lotes há 10 e 7 dias | só o de 10; rota `/rebanhos/{id}` |
| VERIF-04 | `LOTACAO_ALTA` com peso estimado | Recria em 1 ha: 3 e depois 4 cabeças | 2,0 UA/ha não avisa; 2,7 avisa; rota `/pastos` |
| VERIF-05 | `INSUMO_ABAIXO_MINIMO` | 10 com mínimo 20 | rota `/insumos/{id}` |
| VERIF-06 | `INSUMO_ACABANDO` | 100 com consumo 20/dia | "5 dias" |
| VERIF-07 | `INSUMO_ESGOTADO` prevalece; sem entrada não avisa | — | um aviso só |
| VERIF-08 | fazenda inativa | — | nada |
| VERIF-09 | verificar duas vezes | — | 1 notificação, 1 push |
| VERIF-10 | resolução e reaparecimento | pasto ocupado e depois em descanso de novo | `chaveAtiva` nula, segue na caixa; nasce outra |
| VERIF-11 | insumo piora | abaixo do mínimo → esgotado | antigo encerrado, novo aberto |
| VERIF-12 | escopo | pasto pronto de B | A não verifica B |
| VERIF-13 | NPaaS não configurado | — | `pushStatus: desligado`, sem push |
| VERIF-14 | NPaaS falhando | falso responde `false` | volta para `pendente`; 3 tentativas → `falhou`; não tenta mais |
| VERIF-15 | mais de 3 pendentes | 4 pastos prontos | 1 push de resumo (`RESUMO`, rota `/notificacoes`) |
| VERIF-16 | janela 6h–21h em Cuiabá | 05:59, 06:00, 20:59, 21:00 | fora, dentro, dentro, fora |
| VERIF-17 | silêncio | verificação às 23h e depois às 10h | entra na caixa às 23h; push só às 10h |
| VERIF-18 | resolvida antes do horário | — | push `descartado` |
| VERIF-19 | `verificarTodos` | A e B; push de A preso em `enviando` | passa pelos dois; o preso volta para a fila e sai |

## Verificação — avisos adicionais

Arquivo: `test/endpoints/notificacoes/verificacao-novos-avisos.test.js`

| ID | Cenário | Pré-condição | Verifica |
| :--- | :--- | :--- | :--- |
| NOVO-01 | `PASTO_PRONTO_AMANHA` | descanso a meio dia do fim; depois concluído | véspera com push; ao concluir, encerra e nasce `PASTO_PRONTO` |
| NOVO-02 | véspera cedo demais | faltam 2 dias | nada |
| NOVO-03 | `LOTE_SEM_PASTO` | lote ativo sem pasto, com pasto, inativo | só o ativo sem pasto, com push |
| NOVO-04 | `LOTE_SEM_PESAGEM` | nunca pesado (70 dias), pesado há 65, pesado há 10, novo; manejo sem peso | só os dois primeiros; títulos "nunca foi pesado" / "sem pesagem há 65 dias" |
| NOVO-05 | `PASTO_SEM_AREA` | pasto sem área; depois preenche; depois apaga | `somenteCaixa`, sem push; resolvido não reabre |
| NOVO-06 | `LOTE_SEM_VALOR_COMPRA` | vendido, finalizado (inativo), com valor, só morte | só vendido e finalizado; preencher resolve |
| NOVO-07 | `INSUMO_SEM_PRECO` | consumo sem entrada com valor; com valor; só perda | só o primeiro, `somenteCaixa` |
| NOVO-08 | `RESUMO_MES` | 1º/11 10h; saídas de outubro, de 31/10 23h e de 30/09 23h (Cuiabá); outra fazenda sem saída | um resumo; rota `/home/relatorio`; chave `RESUMO_MES:2026-10`; texto com vendas, receita e outras saídas |
| NOVO-09 | resumo sem duplicar | três verificações (dia 1 duas vezes, dia 2) | 1 notificação, 1 push; chave não liberada no dia 2 |
| NOVO-10 | sem saídas ou fora do dia 1 | — | nada |
