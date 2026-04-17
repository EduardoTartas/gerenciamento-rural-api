// src/docs/paths/pasto.js

import commonResponses from "../schemas/swaggerCommonResponses.js";
import pastoSchemas from "../schemas/pastoSchema.js";
import { generateParameters } from "./utils/generateParameters.js";

const pastoRoutes = {
    "/pastagens": {
        get: {
            tags: ["Pastagens"],
            summary: "Lista todas as pastagens do usuário autenticado",
            description: `
            + Caso de uso: Permite que um usuário autenticado liste todas as pastagens de suas propriedades com filtros opcionais.

            + Função de Negócio:
                - Retorna uma lista paginada de pastagens pertencentes às propriedades do usuário logado.
                + Aceita parâmetros de consulta opcionais:
                    • **nome**: filtrar por nome da pastagem (correspondência parcial, não sensível a maiúsculas).
                    • **propriedadeId**: filtrar por ID da propriedade (UUID).
                    • **status**: filtrar por status da pastagem (Ocupado, Vazio, Descanso).
                    • **tipoPastagem**: filtrar por tipo de pastagem (correspondência parcial, não sensível a maiúsculas).
                    • **page**: número da página (padrão: 1).
                    • **limit**: registros por página (padrão: 10, máximo: 100).

            + Regras de Negócio:
                - Requer uma sessão autenticada válida (baseada em cookie via BetterAuth).
                - Apenas pastagens das propriedades do usuário logado são retornadas.
                - Retorna resultados paginados com metadados totalDocs, totalPages.

            + Resultado Esperado:
                - HTTP 200 OK com **PastoPaginatedList** contendo array de documentos e informações de paginação.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                ...generateParameters(pastoSchemas.PastoFilter),
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
                200: commonResponses[200]("#/components/schemas/PastoPaginatedList"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        },
        post: {
            tags: ["Pastagens"],
            summary: "Cria uma nova pastagem",
            description: `
            + Caso de uso: Permite que um usuário autenticado cadastre uma nova pastagem em uma de suas propriedades.

            + Função de Negócio:
                - Cria uma nova pastagem vinculada a uma propriedade do usuário logado.
                + Campos aceitos no corpo da requisição:
                    • **propriedadeId** (obrigatório): UUID da propriedade à qual a pastagem pertence.
                    • **nome** (obrigatório): Nome da pastagem (2-150 caracteres).
                    • **extensaoHa** (opcional): Extensão da pastagem em hectares.
                    • **tipoPastagem** (opcional): Tipo de forrageira (2-100 caracteres), ex: "Brachiaria Brizantha".
                    • **status** (opcional): Status inicial (Ocupado, Vazio, Descanso). Padrão: "Vazio".

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - A propriedade informada deve existir e pertencer ao usuário logado.
                - O nome da pastagem deve ser único dentro da mesma propriedade.
                - A pastagem é automaticamente vinculada à propriedade informada.

            + Resultado Esperado:
                - HTTP 201 Created com **PastoDetails** da pastagem criada.
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/PastoCreate" }
                    }
                }
            },
            responses: {
                201: commonResponses[201]("#/components/schemas/PastoDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        }
    },

    "/pastagens/{id}": {
        get: {
            tags: ["Pastagens"],
            summary: "Obtém detalhes de uma pastagem específica",
            description: `
            + Caso de uso: Recuperar informações detalhadas sobre uma pastagem específica.

            + Função de Negócio:
                - Retorna todos os dados da pastagem para o ID fornecido.
                + Recebe como parâmetro de caminho:
                    - **id**: UUID da pastagem.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - O ID deve estar no formato UUID válido.
                - A pastagem deve pertencer a uma propriedade do usuário logado.
                - Retorna 404 se a pastagem não for encontrada.

            + Resultado Esperado:
                - HTTP 200 OK com esquema **PastoDetails**.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID da Pastagem"
            }],
            responses: {
                200: commonResponses[200]("#/components/schemas/PastoDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        },
        patch: {
            tags: ["Pastagens"],
            summary: "Atualiza parcialmente uma pastagem",
            description: `
            + Caso de uso: Permite que o dono de uma propriedade atualize os dados de uma pastagem.

            + Função de Negócio:
                - Atualiza os campos da pastagem (nome, extensaoHa, tipoPastagem, status, dataUltimaSaida, ativo).
                + Recebe como parâmetro de caminho:
                    - **id**: UUID da pastagem.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - A pastagem deve pertencer a uma propriedade do usuário logado.
                - Pelo menos um campo deve ser fornecido no corpo da requisição.
                - Se o nome for alterado, deve ser único dentro da mesma propriedade.

            + Resultado Esperado:
                - HTTP 200 OK com **PastoDetails** atualizado.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID da Pastagem"
            }],
            requestBody: {
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/PastoPatch" }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/PastoDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        },
        delete: {
            tags: ["Pastagens"],
            summary: "Exclui uma pastagem e todos os dados relacionados",
            description: `
            + Caso de uso: Permite que o dono de uma propriedade exclua permanentemente uma pastagem.

            + Função de Negócio:
                - Remove permanentemente a pastagem e todos os dados relacionados em cascata.
                + Recebe como parâmetro de caminho:
                    - **id**: UUID da pastagem.

            + Exclusão em Cascata:
                - **manejoPasto**: Todos os registros de manejo do pasto são excluídos (onDelete: Cascade).
                - **rebanho.pastoAtualId**: Rebanhos vinculados têm o campo pastoAtualId definido como null (onDelete: SetNull).
                - **historicoMovimentacao**: Movimentações de origem/destino têm os campos de pasto definidos como null (onDelete: SetNull).

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - A pastagem deve pertencer a uma propriedade do usuário logado.

            + Resultado Esperado:
                - HTTP 200 OK com mensagem de confirmação.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID da Pastagem"
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

export default pastoRoutes;
