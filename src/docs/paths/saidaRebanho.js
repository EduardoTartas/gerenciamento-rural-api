// src/docs/paths/saidaRebanho.js

import commonResponses from "../schemas/swaggerCommonResponses.js";
import saidaRebanhoSchemas from "../schemas/saidaRebanhoSchema.js";
import { generateParameters } from "./utils/generateParameters.js";

const saidaRebanhoRoutes = {
    "/v1/rebanhos/saidas": {
        get: {
            tags: ["Saídas de Animais"],
            summary: "Lista as saídas de animais dos rebanhos",
            description: `
            + Caso de uso: Consultar o histórico de vendas, mortes e abates dos rebanhos.

            + Função de Negócio:
                - Retorna lista paginada ordenada por data da saída (mais recente primeiro).
                + Filtros disponíveis:
                    • **rebanhoId**: saídas de um rebanho específico.
                    • **propriedadeId**: todas as saídas de uma propriedade.
                    • **motivo**: \`Venda\`, \`Morte\`, \`Abate\` ou \`Outro\`.
                    • **dataInicio / dataFim**: filtrar por período.
                    • **atualizadoDesde**: leitura por diferença da sincronização.

            + Regras de Negócio:
                - Apenas saídas de rebanhos das propriedades do usuário logado.
                - **Registros imutáveis**: saídas não podem ser editadas nem excluídas por esta rota.

            + Resultado Esperado:
                - HTTP 200 com **SaidaRebanhoPaginatedList**.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                ...generateParameters(saidaRebanhoSchemas.SaidaRebanhoFilter),
                { name: "dataInicio", in: "query", schema: { type: "string", format: "date-time" }, required: false, description: "Filtrar saídas a partir desta data" },
                { name: "dataFim",    in: "query", schema: { type: "string", format: "date-time" }, required: false, description: "Filtrar saídas até esta data" },
                { name: "atualizadoDesde", in: "query", schema: { type: "string", format: "date-time" }, required: false, description: "Só o que mudou depois desta marca (UTC)" },
                { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 100 }, required: false, description: "Registros por página (máx 100)" },
                { name: "page",  in: "query", schema: { type: "integer", default: 1 }, required: false, description: "Número da página" }
            ],
            responses: {
                200: commonResponses[200]("#/components/schemas/SaidaRebanhoPaginatedList"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        },
        post: {
            tags: ["Saídas de Animais"],
            summary: "Registra a saída de animais de um rebanho",
            description: `
            + Caso de uso: Lançar venda, morte, abate ou outra saída de cabeças de um rebanho.

            + Função de Negócio (operação atômica em transação):
                1. Valida o rebanho (existe, pertence ao usuário, está ativo).
                2. **Baixa** \`quantidadeCabecas\` do rebanho pela quantidade da saída.
                3. Se a saída zera o rebanho, ou se \`finalizar: true\`, **finaliza o rebanho**: \`ativo: false\`, \`pastoAtualId\` e \`dataEntradaPastoAtual\` nulos.
                4. Ao finalizar, o pasto que o rebanho ocupava tem o status recalculado contando rebanhos ativos (nunca lendo o campo \`status\`): sem outro lote, vai para \`"Descanso"\` com \`dataUltimaSaida\` = data da saída.
                5. **Cria** o registro da saída com \`finalizouRebanho\`.

            + Regras de Negócio:
                - A saída não pode passar das cabeças atuais do rebanho → HTTP 409.
                - Rebanho com \`quantidadeCabecas\` vazio só aceita saída com \`finalizar: true\` → do contrário HTTP 400.
                - A data da saída **não pode ser no futuro**.
                - **Venda** exige \`precoArroba\` e \`valorTotal\` (> 0); \`pesoTotalKg\` é opcional. Outros motivos recusam esses campos (HTTP 400). O valor total é o digitado: pode divergir de peso/15 × arroba (desconto, ágio).
                - Duas saídas simultâneas do mesmo rebanho não tiram, juntas, mais cabeças do que existem: a segunda recebe 409.

            + Resultado Esperado:
                - HTTP 201 com **SaidaRebanhoListItem** (com o rebanho já baixado).
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/SaidaRebanhoCreate" } } }
            },
            responses: {
                201: commonResponses[201]("#/components/schemas/SaidaRebanhoListItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        }
    },

    "/v1/rebanhos/saidas/{id}": {
        get: {
            tags: ["Saídas de Animais"],
            summary: "Obtém uma saída de animais por ID",
            description: `
            + Retorna a saída com o estado atual do rebanho.
            + **Saídas são imutáveis** — não há PATCH nem DELETE neste recurso.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "UUID da Saída" }],
            responses: {
                200: commonResponses[200]("#/components/schemas/SaidaRebanhoListItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        }
    }
};

export default saidaRebanhoRoutes;
