// src/docs/paths/user.js

import commonResponses from "../schemas/swaggerCommonResponses.js";

const userRoutes = {
    "/usuarios/{id}": {
        get: {
            tags: ["Usuários"],
            summary: "Obtém detalhes do próprio usuário",
            description: `
            + Caso de uso: Recuperar informações detalhadas do usuário autenticado.

            + Função de Negócio:
                - Retorna todos os dados de perfil para o ID de usuário fornecido.
                + Recebe como parâmetro de caminho:
                    - **id**: UUID do usuário.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - O ID deve estar no formato UUID válido.
                - Um usuário só pode consultar seu próprio ID (aplicação de ação própria). Consultar outro ID retorna 403.
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
    }
};

export default userRoutes;
