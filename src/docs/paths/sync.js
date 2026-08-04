// src/docs/paths/sync.js

import commonResponses from "../schemas/swaggerCommonResponses.js";

const syncRoutes = {
    "/sync": {
        post: {
            tags: ["Sincronização"],
            summary: "Aplica um lote de mutações geradas offline",
            description: `
            + Caso de uso: O app acumula criações, edições e exclusões enquanto está sem conexão e envia tudo de uma vez ao reconectar.

            + Função de Negócio:
                1. Reordena as mutações por dependência (\`dependeDe\`), respeitando a ordem em que precisam ser aplicadas dentro do próprio lote.
                2. Aplica cada mutação em sua **própria transação**, delegando ao service de domínio correspondente (propriedades, pastos, rebanhos, manejo_pastos, manejo_rebanhos, historico_movimentacoes).
                3. **Idempotência:** reenviar uma mutação com o mesmo \`id\` já aplicada anteriormente devolve o resultado registrado da primeira vez, sem repetir o efeito. O registro de idempotência é mantido por 30 dias.
                4. **Cascata de bloqueio:** se uma mutação é recusada, toda mutação do lote que dependia dela (direta ou indiretamente, via \`dependeDe\`) sai como \`bloqueado\` em vez de ser tentada.

            + Regras de Negócio:
                - O lote aceita de **1 a 100** mutações por requisição.
                - \`historico_movimentacoes\` não aceita \`UPDATE\` — é evento imutável, corrige-se desfazendo ou lançando outra movimentação.
                - O identificador da entidade vem sempre em \`entidadeId\`; \`dados\` nunca pode conter a chave \`id\`.
                - \`dados\` é obrigatório em \`CREATE\`/\`UPDATE\` e ausente em \`DELETE\`.
                - **O lote não é atômico entre itens:** uma mutação recusada não derruba as demais — só bloqueia quem dependia dela.

            + Resultado Esperado:
                - **Sempre HTTP 200**, mesmo havendo mutações recusadas ou bloqueadas — o status HTTP descreve o transporte do lote, não o resultado de cada mutação individual. Cada item do lote carrega sua própria situação em \`data.resultados[].situacao\` (\`aceito\`, \`recusado\` ou \`bloqueado\`).
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
