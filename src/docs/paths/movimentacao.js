// src/docs/paths/movimentacao.js

import commonResponses from "../schemas/swaggerCommonResponses.js";
import movimentacaoSchemas from "../schemas/movimentacaoSchema.js";
import { generateParameters } from "./utils/generateParameters.js";

const movimentacaoRoutes = {
    "/rebanhos/movimentacoes": {
        get: {
            tags: ["Movimentações"],
            summary: "Lista o histórico de movimentações de rebanhos",
            description: `
            + Caso de uso: Consultar o histórico de transferências de rebanhos entre pastos.

            + Função de Negócio:
                - Retorna lista paginada ordenada por data de movimentação (mais recente primeiro).
                + Filtros disponíveis:
                    • **rebanhoId**: histórico de um rebanho específico.
                    • **propriedadeId**: todas as movimentações de uma propriedade.
                    • **pastoOrigemId**: movimentações que saíram de um pasto.
                    • **pastoDestinoId**: movimentações que chegaram em um pasto.
                    • **dataInicio / dataFim**: filtrar por período.

            + Regras de Negócio:
                - Apenas movimentações de rebanhos das propriedades do usuário logado.
                - **Registros imutáveis**: movimentações não podem ser editadas ou excluídas.

            + Resultado Esperado:
                - HTTP 200 com **MovimentacaoPaginatedList**.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                ...generateParameters(movimentacaoSchemas.MovimentacaoFilter),
                { name: "dataInicio", in: "query", schema: { type: "string", format: "date-time" }, required: false, description: "Filtrar movimentações a partir desta data" },
                { name: "dataFim",    in: "query", schema: { type: "string", format: "date-time" }, required: false, description: "Filtrar movimentações até esta data" },
                { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 100 }, required: false, description: "Registros por página (máx 100)" },
                { name: "page",  in: "query", schema: { type: "integer", default: 1 }, required: false, description: "Número da página" }
            ],
            responses: {
                200: commonResponses[200]("#/components/schemas/MovimentacaoPaginatedList"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        },
        post: {
            tags: ["Movimentações"],
            summary: "Registra a movimentação de um rebanho para outro pasto",
            description: `
            + Caso de uso: Transferir um rebanho do seu pasto atual para um pasto de destino.

            + Função de Negócio (operação atômica em transação):
                1. Valida o rebanho (ativo, pertence ao usuário).
                2. Valida o pasto de destino (ativo, pertence ao usuário, ≠ pasto atual).
                3. **Cria** o registro em \`historicoMovimentacao\` com:
                    - **pastoOrigemId** = pasto atual do rebanho (preenchido automaticamente).
                    - **pastoDestinoId** = pasto de destino informado.
                4. **Atualiza** o rebanho: \`pastoAtualId\` e \`dataEntradaPastoAtual\`.
                5. **Pasto de Destino** → status \`"Ocupado"\`.
                6. **Pasto de Origem** → se não houver mais rebanhos ativos, status \`"Vazio"\` e \`dataUltimaSaida\` preenchida.

            + Regras de Negócio:
                - O rebanho deve estar **ativo**.
                - O pasto de destino deve estar **ativo** e pertencer ao usuário.
                - O pasto de destino **não pode ser o mesmo** que o pasto atual.
                - A data da movimentação **não pode ser no futuro**.
                - Toda a operação é executada em uma **transação atômica** — se qualquer etapa falhar, nada é persistido.

            + Resultado Esperado:
                - HTTP 201 com **MovimentacaoListItem** da movimentação registrada.
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/MovimentacaoCreate" } } }
            },
            responses: {
                201: commonResponses[201]("#/components/schemas/MovimentacaoListItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        }
    },

    "/rebanhos/movimentacoes/{id}": {
        get: {
            tags: ["Movimentações"],
            summary: "Obtém detalhes de uma movimentação por ID",
            description: `
            + Retorna todos os dados da movimentação incluindo rebanho, pasto de origem e pasto de destino.
            + **Movimentações são imutáveis** — não há PATCH nem DELETE neste recurso.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "UUID da Movimentação" }],
            responses: {
                200: commonResponses[200]("#/components/schemas/MovimentacaoListItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        }
    }
};

export default movimentacaoRoutes;
