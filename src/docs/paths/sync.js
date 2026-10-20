// src/docs/paths/sync.js

import commonResponses from "../schemas/swaggerCommonResponses.js";

const syncRoutes = {
    "/v1/sync": {
        post: {
            tags: ["Sincronização"],
            summary: "Aplica um lote de mutações geradas offline",
            description: `
            + Caso de uso: O app acumula criações, edições e exclusões enquanto está sem conexão e envia tudo de uma vez ao reconectar.

            + Função de Negócio:
                1. Reordena as mutações por dependência (\`dependeDe\`), respeitando a ordem em que precisam ser aplicadas dentro do próprio lote.
                2. Aplica cada mutação em sua **própria transação**, delegando ao service de domínio correspondente (propriedades, pastos, rebanhos, manejo_pastos, manejo_rebanhos, historico_movimentacoes, saidas_rebanho, insumos, movimentacoes_insumo, regimes_consumo_insumo, notificacoes, fotos_atividade).
                3. **Idempotência:** reenviar uma mutação com o mesmo \`id\` já aplicada anteriormente devolve o resultado registrado da primeira vez, sem repetir o efeito. O registro de idempotência é mantido por 30 dias.
                4. **Cascata de bloqueio:** se uma mutação é recusada ou entra em conflito, toda mutação do lote que dependia dela (direta ou indiretamente, via \`dependeDe\`) sai como \`bloqueado\` em vez de ser tentada.
                5. **Conflito de edição (issue #76):** um \`UPDATE\` pode trazer \`versaoBase\`, a \`versao\` do registro quando o app o editou. Se o registro já estiver em outra versão no servidor, a mutação **não é aplicada** e o item volta com \`situacao = conflito\`, \`versaoBase\`, \`versaoServidor\` e \`erro.tipo = conflict\`. Sem \`versaoBase\` (app antigo), a última edição vence, como antes.

            + Regras de Negócio:
                - O lote aceita de **1 a 100** mutações por requisição.
                - \`historico_movimentacoes\` não aceita \`UPDATE\` — é evento imutável, corrige-se desfazendo ou lançando outra movimentação.
                - \`saidas_rebanho\` aceita só \`CREATE\` — a saída de animais também é evento imutável.
                - \`fotos_atividade\` aceita só \`DELETE\` — o envio da foto é multipart e vai pelo REST (\`POST /pastagens/manejos/{id}/fotos\` e \`POST /rebanhos/manejos/{id}/fotos\`). Foto inexistente ou já excluída é aceita.
                - \`movimentacoes_insumo\` aceita \`CREATE\` e \`UPDATE\` (edição de quantidade, data, motivo, observações e valor pago da entrada). \`DELETE\` é sempre recusado com \`conflict\` não recuperável: lançamento sincronizado não se desfaz, se edita.
                - O identificador da entidade vem sempre em \`entidadeId\`; \`dados\` nunca pode conter a chave \`id\`.
                - \`dados\` é obrigatório em \`CREATE\`/\`UPDATE\` e ausente em \`DELETE\`.
                - **\`dados\` passa pelo mesmo schema da rota REST equivalente**, incluindo a recusa de campos fora do schema. Um \`pastos:UPDATE\` com \`propriedadeId\`, por exemplo, é recusado aqui como seria com 400 no \`PATCH /pastagens/:id\` — mudar o vínculo de propriedade não é edição de pasto. A recusa é do item, com \`erro.tipo = validationError\`, e não derruba o lote.
                - **O lote não é atômico entre itens:** uma mutação recusada não derruba as demais — só bloqueia quem dependia dela.

            + Resultado Esperado:
                - **Sempre HTTP 200**, mesmo havendo mutações recusadas ou bloqueadas — o status HTTP descreve o transporte do lote, não o resultado de cada mutação individual. Cada item do lote carrega sua própria situação em \`data.resultados[].situacao\` (\`aceito\`, \`recusado\`, \`bloqueado\` ou \`conflito\`).
                - HTTP 400 só ocorre por erro de construção do lote em si (ex.: \`dependeDe\` apontando para uma mutação fora do lote, ou ciclo de dependência) — nesse caso nenhuma mutação chega a ser tentada.
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/SyncLote" } } }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/SyncResultado"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        }
    }
};

export default syncRoutes;
