// src/docs/paths/manejoRebanho.js

import commonResponses from "../schemas/swaggerCommonResponses.js";
import manejoRebanhoSchemas from "../schemas/manejoRebanhoSchema.js";
import { generateParameters } from "./utils/generateParameters.js";

const manejoRebanhoRoutes = {
    "/rebanhos/manejos": {
        get: {
            tags: ["Manejos de Rebanho"],
            summary: "Lista todos os manejos de rebanho do usuário autenticado",
            description: `
            + Caso de uso: Listar o histórico de atividades sanitárias e de manejo realizadas nos rebanhos.

            + Função de Negócio:
                - Retorna lista paginada ordenada por data de atividade (mais recente primeiro).
                + Filtros disponíveis:
                    • **rebanhoId**: filtrar por rebanho específico.
                    • **tipoManejoId**: filtrar por tipo (UUID do catálogo /catalogos/tipos-manejo-rebanho).
                    • **propriedadeId**: filtrar por propriedade.
                    • **dataInicio / dataFim**: filtrar por período.

            + Regras de Negócio:
                - Apenas manejos de rebanhos das propriedades do usuário logado são retornados.

            + Resultado Esperado:
                - HTTP 200 com **ManejoRebanhoPaginatedList**.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                ...generateParameters(manejoRebanhoSchemas.ManejoRebanhoFilter),
                { name: "dataInicio", in: "query", schema: { type: "string", format: "date-time" }, required: false, description: "Filtrar atividades a partir desta data" },
                { name: "dataFim",    in: "query", schema: { type: "string", format: "date-time" }, required: false, description: "Filtrar atividades até esta data" },
                { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 100 }, required: false, description: "Registros por página (máx 100)" },
                { name: "page",  in: "query", schema: { type: "integer", default: 1 }, required: false, description: "Número da página" }
            ],
            responses: {
                200: commonResponses[200]("#/components/schemas/ManejoRebanhoPaginatedList"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        },
        post: {
            tags: ["Manejos de Rebanho"],
            summary: "Registra um novo manejo de rebanho",
            description: `
            + Caso de uso: Registrar uma atividade sanitária ou de manejo em um rebanho.

            + Função de Negócio:
                - Cria o registro vinculado ao rebanho e ao tipo de manejo informados.
                - **Regra especial**: Se **pesoRegistrado** for informado (em qualquer tipo de manejo),
                  o campo \`pesoMedioAtual\` do rebanho é atualizado automaticamente.
                + Campos aceitos:
                    • **rebanhoId** (obrigatório): UUID do rebanho.
                    • **tipoManejoId** (obrigatório): UUID do tipo de manejo (de /catalogos/tipos-manejo-rebanho).
                    • **dataAtividade** (obrigatório): data da atividade (não pode ser no futuro).
                    • **medicamentoVacina** (opcional): nome do medicamento/vacina.
                    • **pesoRegistrado** (opcional): peso registrado em kg.
                    • **observacoes** (opcional): observações adicionais (máx 500 caracteres).

            + Regras de Negócio:
                - O rebanho deve existir, estar **ativo** e pertencer ao usuário.
                - O tipo de manejo deve existir e estar **ativo** no catálogo global.

            + Resultado Esperado:
                - HTTP 201 com **ManejoRebanhoListItem** do manejo registrado.
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/ManejoRebanhoCreate" } } }
            },
            responses: {
                201: commonResponses[201]("#/components/schemas/ManejoRebanhoListItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        }
    },

    "/rebanhos/manejos/{id}": {
        get: {
            tags: ["Manejos de Rebanho"],
            summary: "Obtém detalhes de um manejo de rebanho por ID",
            security: [{ bearerAuth: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "UUID do Manejo de Rebanho" }],
            responses: {
                200: commonResponses[200]("#/components/schemas/ManejoRebanhoListItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        },
        patch: {
            tags: ["Manejos de Rebanho"],
            summary: "Atualiza parcialmente um manejo de rebanho",
            description: "Atualiza campos do manejo. Pelo menos um campo deve ser fornecido.",
            security: [{ bearerAuth: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "UUID do Manejo de Rebanho" }],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/ManejoRebanhoPatch" } } }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/ManejoRebanhoListItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        },
        delete: {
            tags: ["Manejos de Rebanho"],
            summary: "Exclui permanentemente um manejo de rebanho",
            description: "Remove definitivamente o registro de manejo (hard delete). O histórico de movimentações de pastos não é afetado.",
            security: [{ bearerAuth: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "UUID do Manejo de Rebanho" }],
            responses: {
                200: commonResponses[200](),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        }
    }
};

export default manejoRebanhoRoutes;
