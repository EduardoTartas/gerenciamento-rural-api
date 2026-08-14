// src/docs/paths/user.js

import commonResponses from "../schemas/swaggerCommonResponses.js";
import userSchemas from "../schemas/userSchema.js";
import { generateParameters } from "./utils/generateParameters.js";

const userRoutes = {
    "/usuarios": {
        get: {
            tags: ["Usuários"],
            summary: "Lista todos os usuários registrados (somente admin)",
            description: `
            + Caso de uso: Permite que um administrador liste todos os usuários no sistema com filtros opcionais.

            + Função de Negócio:
                - Retorna uma lista paginada de usuários.
                + Aceita parâmetros de consulta opcionais:
                    • **name**: filtrar por nome (correspondência parcial, não sensível a maiúsculas e minúsculas).
                    • **email**: filtrar por e-mail (correspondência parcial, não sensível a maiúsculas e minúsculas).
                    • **page**: número da página (padrão: 1).
                    • **limit**: registros por página (padrão: 10, máximo: 100).

            + Regras de Negócio:
                - Requer uma sessão autenticada válida (baseada em cookie via BetterAuth).
                - Exige perfil administrativo (\`admin: true\`). Usuário comum recebe 403.
                - Retorna resultados paginados com metadados totalDocs, totalPages.

            + Resultado Esperado:
                - HTTP 200 OK com **UserPaginatedList** contendo array de documentos e informações de paginação.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                ...generateParameters(userSchemas.UserFilter),
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
                200: commonResponses[200]("#/components/schemas/UserPaginatedList"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                403: commonResponses[403](),
                500: commonResponses[500]()
            }
        }
    },

    "/usuarios/{id}": {
        get: {
            tags: ["Usuários"],
            summary: "Obtém detalhes de um usuário",
            description: `
            + Caso de uso: Recuperar informações detalhadas de um usuário.

            + Função de Negócio:
                - Retorna todos os dados de perfil para o ID de usuário fornecido.
                + Recebe como parâmetro de caminho:
                    - **id**: UUID do usuário.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - O ID deve estar no formato UUID válido.
                - Usuário com perfil administrativo pode consultar qualquer ID. Usuário comum só pode consultar o próprio ID — consultar outro retorna 403.
                - Retorna 404 se o usuário não for encontrado.

            + Resultado Esperado:
                - HTTP 200 OK com esquema **UserDetails**.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID do Usuário"
            }],
            responses: {
                200: commonResponses[200]("#/components/schemas/UserDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                403: commonResponses[403](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        },
        patch: {
            tags: ["Usuários"],
            summary: "Atualiza parcialmente o perfil de um usuário",
            description: `
            + Caso de uso: Permite que um usuário atualize seus próprios dados de perfil.

            + Função de Negócio:
                - Atualiza os campos do usuário (nome, e-mail, imagem).
                + Recebe como parâmetro de caminho:
                    - **id**: UUID do usuário.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - Um usuário só pode atualizar seu próprio perfil (aplicação de ação própria).
                - Pelo menos um campo deve ser fornecido no corpo da requisição.
                - Se o e-mail for alterado, deve ser único em todo o sistema.

            + Resultado Esperado:
                - HTTP 200 OK com **UserDetails** atualizado.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID do Usuário"
            }],
            requestBody: {
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/UserPatch" }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/UserDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                403: commonResponses[403](),
                404: commonResponses[404](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        },
        delete: {
            tags: ["Usuários"],
            summary: "Exclui uma conta de usuário",
            description: `
            + Caso de uso: Permite que um usuário exclua sua própria conta.

            + Função de Negócio:
                - Remove permanentemente o usuário e todas as sessões/contas associadas.
                + Recebe como parâmetro de caminho:
                    - **id**: UUID do usuário.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - Um usuário só pode excluir sua própria conta (aplicação de ação própria).
                - A exclusão em cascata remove as sessões e contas relacionadas.

            + Resultado Esperado:
                - HTTP 200 OK com mensagem de confirmação.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID do Usuário"
            }],
            responses: {
                200: commonResponses[200](),
                400: commonResponses[400](),
                401: commonResponses[401](),
                403: commonResponses[403](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        }
    },

    "/v1/usuarios/{id}/foto": {
        patch: {
            tags: ["Usuários"],
            summary: "Registra a foto de perfil do usuário",
            description: `
            + Caso de uso: Após enviar uma imagem via POST /uploads/imagens, associá-la ao perfil do usuário.

            + Função de Negócio:
                - Recebe a URL retornada pelo upload e grava em \`user.image\`.
                + Recebe como parâmetro de caminho:
                    - **id**: UUID do usuário.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - Um usuário só pode atualizar sua própria foto (aplicação de ação própria).
                - A URL deve pertencer ao bucket de uploads configurado — URLs externas são rejeitadas.
                - Se o cadastro falhar, a imagem recém-enviada é removida do bucket (rollback).
                - Se havia uma foto anterior, ela é descartada do bucket após o sucesso.

            + Resultado Esperado:
                - HTTP 200 OK com **UserDetails** atualizado.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
                description: "UUID do Usuário"
            }],
            requestBody: {
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["url"],
                            properties: {
                                url: { type: "string", format: "uri", description: "URL retornada por POST /uploads/imagens" }
                            }
                        }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/UserDetails"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                403: commonResponses[403](),
                404: commonResponses[404](),
                500: commonResponses[500](),
                503: commonResponses[503]()
            }
        }
    }
};

export default userRoutes;
