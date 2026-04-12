// src/docs/paths/auth.js

import commonResponses from "../schemas/swaggerCommonResponses.js";

const authRoutes = {
    "/api/auth/sign-up/email": {
        post: {
            tags: ["Auth"],
            summary: "Registra uma nova conta de usuário",
            description: `
            + Caso de uso: Autocadastro de usuário via e-mail e senha.

            + Função de Negócio:
                - Permite que novos usuários criem uma conta no sistema.
                + Recebe no corpo da requisição:
                    - **name**: nome completo do usuário.
                    - **email**: endereço de e-mail válido.
                    - **password**: senha (mínimo de 8 caracteres).

            + Regras de Negócio:
                - Todos os campos (nome, e-mail, senha) são obrigatórios.
                - O e-mail deve ser único no sistema.
                - A senha é criptografada automaticamente pelo BetterAuth.
                - Em caso de sucesso, uma sessão é criada e os cookies de sessão são definidos.

            + Resultado Esperado:
                - HTTP 200 OK com dados da sessão e do usuário.
                - O cookie de sessão é definido automaticamente na resposta.
            `,
            requestBody: {
                content: {
                    "application/json": {
                        schema: {
                            "$ref": "#/components/schemas/SignUpRequest"
                        }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/SignInResponse"),
                400: commonResponses[400](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/sign-in/email": {
        post: {
            tags: ["Auth"],
            summary: "Autentica um usuário e cria uma sessão",
            description: `
            + Caso de uso: Autenticação de usuário via e-mail e senha.

            + Função de Negócio:
                - Autentica o usuário e cria uma sessão no servidor.
                + Recebe no corpo da requisição:
                    - **email**: endereço de e-mail registrado.
                    - **password**: senha do usuário.

            + Regras de Negócio:
                - E-mail e senha são obrigatórios.
                - As credenciais são validadas em relação aos hashes armazenados.
                - Em caso de sucesso, uma sessão é criada no banco de dados e os cookies são definidos.
                - Em caso de falha, retorna 401 Unauthorized.

            + Resultado Esperado:
                - HTTP 200 OK com **SignInResponse** contendo os dados da sessão e do usuário.
                - O cookie de sessão é definido automaticamente para chamadas autenticadas subsequentes.
            `,
            requestBody: {
                content: {
                    "application/json": {
                        schema: {
                            "$ref": "#/components/schemas/SignInRequest"
                        }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/SignInResponse"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/sign-out": {
        post: {
            tags: ["Auth"],
            summary: "Desloga o usuário e invalida a sessão",
            description: `
            + Caso de uso: Logout do usuário e invalidação da sessão.

            + Função de Negócio:
                - Encerra a sessão atual e a remove do banco de dados.
                - Limpa os cookies de sessão do cliente.

            + Autenticação:
                - Requer um cookie de sessão válido na requisição.

            + Regras de Negócio:
                - A sessão é excluída do banco de dados.
                - Os cookies de sessão são limpos da resposta.
                - Idempotente: se a sessão já estiver expirada, ainda retorna 200.

            + Resultado Esperado:
                - HTTP 200 OK com uma mensagem de sucesso.
            `,
            responses: {
                200: commonResponses[200]("#/components/schemas/MessageResponse"),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/get-session": {
        get: {
            tags: ["Auth"],
            summary: "Retorna a sessão de usuário atual",
            description: `
            + Caso de uso: Verificar se o usuário está autenticado e recuperar os dados da sessão.

            + Função de Negócio:
                - Retorna a sessão ativa e os dados do usuário associado.
                - Usado pelo frontend para verificar o estado da autenticação.

            + Autenticação:
                - Requer um cookie de sessão válido na requisição.

            + Resultado Esperado:
                - HTTP 200 OK com **SessionResponse** contendo dados de sessão e usuário.
                - Retorna nulo/vazio se não existir nenhuma sessão válida.
            `,
            responses: {
                200: commonResponses[200]("#/components/schemas/SessionResponse"),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/forget-password": {
        post: {
            tags: ["Auth"],
            summary: "Solicita a recuperação de senha via e-mail",
            description: `
            + Caso de uso: Recuperação de senha quando o usuário esqueceu suas credenciais.

            + Função de Negócio:
                - Gera um token de recuperação e o armazena na tabela de verificações.
                + Recebe no corpo da requisição:
                    - **email**: endereço de e-mail registrado.
                    - **redirectTo** (opcional): URL para redirecionar após clicar no link de recuperação.

            + Regras de Negócio:
                - O e-mail deve estar cadastrado no sistema.
                - Um token de recuperação temporário é gerado com tempo de expiração.
                - **NOTA**: O envio de e-mail ainda não está configurado (TODO). O token é gerado e armazenado, mas nenhum e-mail é disparado.

            + Resultado Esperado:
                - HTTP 200 OK com confirmação de sucesso.
            `,
            requestBody: {
                content: {
                    "application/json": {
                        schema: {
                            "$ref": "#/components/schemas/ForgetPasswordRequest"
                        }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/MessageResponse"),
                400: commonResponses[400](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/reset-password": {
        post: {
            tags: ["Auth"],
            summary: "Redefine a senha utilizando o token de recuperação",
            description: `
            + Caso de uso: Redefinição de senha utilizando um token recebido por e-mail.

            + Função de Negócio:
                - Permite que o usuário defina uma nova senha usando um token de recuperação válido.
                + Recebe no corpo da requisição:
                    - **newPassword**: a nova senha a ser definida.
                    - **token**: o token de recuperação recebido por e-mail.

            + Regras de Negócio:
                - O token de recuperação deve ser válido e não expirado.
                - A nova senha é criptografada automaticamente pelo BetterAuth.
                - Após a redefinição, o token é invalidado.

            + Resultado Esperado:
                - HTTP 200 OK com confirmação de sucesso.
            `,
            requestBody: {
                content: {
                    "application/json": {
                        schema: {
                            "$ref": "#/components/schemas/ResetPasswordRequest"
                        }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/MessageResponse"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/ok": {
        get: {
            tags: ["Auth"],
            summary: "Health check do BetterAuth",
            description: `
            + Caso de uso: Verificar se o processador do BetterAuth está em execução corretamente.

            + Resultado Esperado:
                - HTTP 200 OK com uma resposta de status simples.
            `,
            responses: {
                200: {
                    description: "O BetterAuth está em execução",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    ok: { type: "boolean", example: true }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

export default authRoutes;
