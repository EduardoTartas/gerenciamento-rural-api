// src/docs/paths/manejoPasto.js

import commonResponses from "../schemas/swaggerCommonResponses.js";
import manejoPastoSchemas from "../schemas/manejoPastoSchema.js";
import { generateParameters } from "./utils/generateParameters.js";

const manejoPastoRoutes = {
    "/pastagens/manejos": {
        get: {
            tags: ["Manejos de Pastagem"],
            summary: "Lista todos os manejos de pasto do usuário autenticado",
            description: `
            + Caso de uso: Permite que um usuário autenticado liste todos os manejos realizados nos pastos de suas propriedades.

            + Função de Negócio:
                - Retorna uma lista paginada de manejos de pasto, ordenados por data de atividade (mais recente primeiro).
                + Aceita parâmetros de consulta opcionais:
                    • **pastoId**: filtrar por ID do pasto (UUID).
                    • **propriedadeId**: filtrar por ID da propriedade (UUID).
                    • **tipoManejo**: filtrar por tipo de manejo (Roçagem, Adubação, Calagem, Aplicação de Pesticida, Reforma de Cerca, Limpeza Geral, Plantio/Reforma, Outro).
                    • **page**: número da página (padrão: 1).
                    • **limit**: registros por página (padrão: 10, máximo: 100).

            + Regras de Negócio:
                - Requer uma sessão autenticada válida (baseada em cookie via BetterAuth).
                - Apenas manejos de pastos pertencentes às propriedades do usuário logado são retornados.
                - Retorna resultados paginados com metadados totalDocs, totalPages.

            + Resultado Esperado:
                - HTTP 200 OK com **ManejoPastoPaginatedList** contendo array de documentos e informações de paginação.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                ...generateParameters(manejoPastoSchemas.ManejoPastoFilter),
                {
                    name: "limit",
                    in: "query",
                    schema: { type: "integer", default: 10, maximum: 100 },
                    required: false,
                    description: "Número de registros por página (máx 100)"
                },
                {
                    name: "page",
                    in: "query",
                    schema: { type: "integer", default: 1 },
                    required: false,
                    description: "Número da página"
                }
            ],
            responses: {
                200: commonResponses[200]("#/components/schemas/ManejoPastoPaginatedList"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        },
        post: {
            tags: ["Manejos de Pastagem"],
            summary: "Registra um novo manejo de pasto",
            description: `
            + Caso de uso: Permite que um usuário autenticado registre uma atividade de manejo realizada em um de seus pastos.

            + Função de Negócio:
                - Cria um novo registro de manejo vinculado a um pasto do usuário logado.
                + Campos aceitos no corpo da requisição:
                    • **pastoId** (obrigatório): UUID do pasto onde o manejo foi realizado.
                    • **tipoManejo** (obrigatório): Tipo de manejo (Roçagem, Adubação, Calagem, Aplicação de Pesticida, Reforma de Cerca, Limpeza Geral, Plantio/Reforma, Outro).
                    • **dataAtividade** (obrigatório): Data em que a atividade foi realizada.
                    • **observacoes** (opcional): Observações adicionais (máx 500 caracteres). Recomendado quando tipoManejo for "Outro".

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - O pasto informado deve existir e pertencer a uma propriedade do usuário logado.
                - O tipo de manejo deve ser um dos valores pré-definidos.

            + Resultado Esperado:
                - HTTP 201 Created com **ManejoPastoDetails** do manejo registrado.
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/ManejoPastoCreate" }
                    }
                }
            },
            responses: {
                201: commonResponses[201]("#/components/schemas/ManejoPastoDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        }
    },

    "/pastagens/manejos/{id}": {
        get: {
            tags: ["Manejos de Pastagem"],
            summary: "Obtém detalhes de um manejo de pasto específico",
            description: `
            + Caso de uso: Recuperar informações detalhadas sobre um manejo de pasto específico.

            + Função de Negócio:
                - Retorna todos os dados do manejo para o ID fornecido, incluindo dados do pasto e propriedade.
                + Recebe como parâmetro de caminho:
                    - **id**: UUID do manejo de pasto.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - O ID deve estar no formato UUID válido.
                - O manejo deve pertencer a um pasto de uma propriedade do usuário logado.
                - Retorna 404 se o manejo não for encontrado.

            + Resultado Esperado:
                - HTTP 200 OK com esquema **ManejoPastoDetails**.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID do Manejo de Pasto"
            }],
            responses: {
                200: commonResponses[200]("#/components/schemas/ManejoPastoDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        },
        patch: {
            tags: ["Manejos de Pastagem"],
            summary: "Atualiza parcialmente um manejo de pasto",
            description: `
            + Caso de uso: Permite que o dono de uma propriedade atualize os dados de um manejo de pasto.

            + Função de Negócio:
                - Atualiza os campos do manejo (tipoManejo, dataAtividade, observacoes).
                + Recebe como parâmetro de caminho:
                    - **id**: UUID do manejo de pasto.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - O manejo deve pertencer a um pasto de uma propriedade do usuário logado.
                - Pelo menos um campo deve ser fornecido no corpo da requisição.
                - O tipo de manejo, se alterado, deve ser um dos valores pré-definidos.

            + Resultado Esperado:
                - HTTP 200 OK com **ManejoPastoDetails** atualizado.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID do Manejo de Pasto"
            }],
            requestBody: {
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/ManejoPastoPatch" }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/ManejoPastoDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        },
        delete: {
            tags: ["Manejos de Pastagem"],
            summary: "Exclui um registro de manejo de pasto",
            description: `
            + Caso de uso: Permite que o dono de uma propriedade exclua permanentemente um registro de manejo de pasto.

            + Função de Negócio:
                - Remove permanentemente o registro de manejo.
                + Recebe como parâmetro de caminho:
                    - **id**: UUID do manejo de pasto.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - O manejo deve pertencer a um pasto de uma propriedade do usuário logado.

            + Resultado Esperado:
                - HTTP 200 OK com mensagem de confirmação.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID do Manejo de Pasto"
            }],
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

export default manejoPastoRoutes;
