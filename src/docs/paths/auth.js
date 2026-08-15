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

    "/api/auth/email-otp/request-password-reset": {
        post: {
            tags: ["Auth"],
            summary: "Solicita código OTP de recuperação de senha",
            description: `
            + Caso de uso: Recuperação de senha quando o usuário esqueceu suas credenciais. Fluxo usado pelo aplicativo (sem link, sem redirect).

            + Função de Negócio:
                - Gera um código numérico de 6 dígitos e envia por e-mail (plugin emailOTP do BetterAuth).
                + Recebe no corpo da requisição:
                    - **email**: endereço de e-mail registrado.

            + Regras de Negócio:
                - O código expira em 5 minutos.
                - Resposta idêntica independente de o e-mail existir ou não, para não vazar quais e-mails estão cadastrados.

            + Resultado Esperado:
                - HTTP 200 OK com confirmação de envio.
            `,
            requestBody: {
                content: {
                    "application/json": {
                        schema: {
                            "$ref": "#/components/schemas/RequestPasswordResetOTPRequest"
                        }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/MessageResponse"),
                400: commonResponses[400](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/email-otp/reset-password": {
        post: {
            tags: ["Auth"],
            summary: "Redefine a senha utilizando o código OTP",
            description: `
            + Caso de uso: Conclusão da recuperação de senha com o código recebido por e-mail.

            + Função de Negócio:
                - Valida o código OTP e define a nova senha do usuário.
                + Recebe no corpo da requisição:
                    - **email**: e-mail do usuário que solicitou a recuperação.
                    - **otp**: código de 6 dígitos recebido por e-mail.
                    - **password**: nova senha (8 a 32 caracteres, 1 maiúscula, 1 dígito).

            + Regras de Negócio:
                - O código deve ser válido e não expirado.
                - Após o uso, o código é invalidado (uso único).

            + Resultado Esperado:
                - HTTP 200 OK com confirmação de sucesso.
            `,
            requestBody: {
                content: {
                    "application/json": {
                        schema: {
                            "$ref": "#/components/schemas/ResetPasswordOTPRequest"
                        }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/MessageResponse"),
                400: commonResponses[400](),
                500: commonResponses[500]()
            }
        }
    },

    "/api/auth/sign-in/social": {
        post: {
            tags: ["Auth"],
            summary: "Login com Google via idToken nativo",
            description: `
            + Caso de uso: Login/cadastro via conta Google, usado pelo app mobile.

            + Função de Negócio:
                - Recebe o \`idToken\` obtido pelo SDK nativo do Google no dispositivo (não é o fluxo de redirect web).
                - Verifica o token contra os Client IDs configurados (\`GOOGLE_WEB_CLIENT_ID\`, \`GOOGLE_ANDROID_CLIENT_ID\`).
                - Cria o usuário automaticamente no primeiro login (e-mail já vem verificado pelo Google).

            + Regras de Negócio:
                - **provider**: sempre \`"google"\`.
                - **idToken.token**: obrigatório — o app deve solicitar o token ao SDK do Google com \`serverClientId\` = Client ID **Web** (é ele que aparece como \`aud\` no token, não o Android).
                - Conta Google vinculada a e-mail já cadastrado localmente é associada automaticamente (comportamento nativo do BetterAuth).

            + Resultado Esperado:
                - HTTP 200 OK com dados da sessão e do usuário.
                - HTTP 401 se o \`idToken\` for inválido, expirado ou de audience não reconhecida.
            `,
            requestBody: {
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["provider", "idToken"],
                            properties: {
                                provider: { type: "string", example: "google" },
                                idToken: {
                                    type: "object",
                                    required: ["token"],
                                    properties: {
                                        token: { type: "string", description: "ID token retornado pelo SDK nativo do Google" }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/SignInResponse"),
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
