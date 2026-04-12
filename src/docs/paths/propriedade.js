// src/docs/paths/propriedade.js

import commonResponses from "../schemas/swaggerCommonResponses.js";
import propriedadeSchemas from "../schemas/propriedadeSchema.js";
import { generateParameters } from "./utils/generateParameters.js";

const propriedadeRoutes = {
    "/propriedades": {
        get: {
            tags: ["Propriedades"],
            summary: "Lista todas as propriedades do usuário autenticado",
            description: `
            + Caso de uso: Permite que um usuário autenticado liste todas as suas propriedades rurais com filtros opcionais.

            + Função de Negócio:
                - Retorna uma lista paginada de propriedades pertencentes ao usuário logado.
                + Aceita parâmetros de consulta opcionais:
                    • **nome**: filtrar por nome da propriedade (correspondência parcial, não sensível a maiúsculas).
                    • **localizacao**: filtrar por localização, ex: "Vilhena,RO" (correspondência parcial, não sensível a maiúsculas).
                    • **page**: número da página (padrão: 1).
                    • **limit**: registros por página (padrão: 10, máximo: 100).

            + Regras de Negócio:
                - Requer uma sessão autenticada válida (baseada em cookie via BetterAuth).
                - Apenas propriedades do usuário logado são retornadas.
                - Retorna resultados paginados com metadados totalDocs, totalPages.

            + Resultado Esperado:
                - HTTP 200 OK com **PropriedadePaginatedList** contendo array de documentos e informações de paginação.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                ...generateParameters(propriedadeSchemas.PropriedadeFilter),
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
                200: commonResponses[200]("#/components/schemas/PropriedadePaginatedList"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        },
        post: {
            tags: ["Propriedades"],
            summary: "Cria uma nova propriedade rural",
            description: `
            + Caso de uso: Permite que um usuário autenticado cadastre uma nova propriedade rural.

            + Função de Negócio:
                - Cria uma nova propriedade vinculada ao usuário logado.
                + Campos aceitos no corpo da requisição:
                    • **nome** (obrigatório): Nome da propriedade (2-150 caracteres).
                    • **localizacao** (opcional): Localização no formato "Cidade,UF", ex: "Vilhena,RO".

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - O nome da propriedade deve ser único por usuário.
                - A propriedade é automaticamente vinculada ao usuário logado.

            + Resultado Esperado:
                - HTTP 201 Created com **PropriedadeDetails** da propriedade criada.
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/PropriedadeCreate" }
                    }
                }
            },
            responses: {
                201: commonResponses[201]("#/components/schemas/PropriedadeDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        }
    },

    "/propriedades/{id}": {
        get: {
            tags: ["Propriedades"],
            summary: "Obtém detalhes de uma propriedade específica",
            description: `
            + Caso de uso: Recuperar informações detalhadas sobre uma propriedade específica.

            + Função de Negócio:
                - Retorna todos os dados da propriedade para o ID fornecido.
                + Recebe como parâmetro de caminho:
                    - **id**: UUID da propriedade.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - O ID deve estar no formato UUID válido.
                - A propriedade deve pertencer ao usuário logado.
                - Retorna 404 se a propriedade não for encontrada.

            + Resultado Esperado:
                - HTTP 200 OK com esquema **PropriedadeDetails**.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID da Propriedade"
            }],
            responses: {
                200: commonResponses[200]("#/components/schemas/PropriedadeDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        },
        patch: {
            tags: ["Propriedades"],
            summary: "Atualiza parcialmente uma propriedade",
            description: `
            + Caso de uso: Permite que o dono de uma propriedade atualize seus dados.

            + Função de Negócio:
                - Atualiza os campos da propriedade (nome, localizacao, ativo).
                + Recebe como parâmetro de caminho:
                    - **id**: UUID da propriedade.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - A propriedade deve pertencer ao usuário logado.
                - Pelo menos um campo deve ser fornecido no corpo da requisição.
                - Se o nome for alterado, deve ser único para o mesmo usuário.

            + Resultado Esperado:
                - HTTP 200 OK com **PropriedadeDetails** atualizado.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID da Propriedade"
            }],
            requestBody: {
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/PropriedadePatch" }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/PropriedadeDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        },
        delete: {
            tags: ["Propriedades"],
            summary: "Exclui uma propriedade e todos os dados relacionados",
            description: `
            + Caso de uso: Permite que o dono de uma propriedade a exclua permanentemente.

            + Função de Negócio:
                - Remove permanentemente a propriedade e todos os dados relacionados em cascata (pastos, rebanhos, manejos, movimentações).
                + Recebe como parâmetro de caminho:
                    - **id**: UUID da propriedade.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - A propriedade deve pertencer ao usuário logado.
                - A exclusão em cascata remove os pastos, rebanhos, históricos e manejos relacionados.

            + Resultado Esperado:
                - HTTP 200 OK com mensagem de confirmação.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID da Propriedade"
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

export default propriedadeRoutes;
