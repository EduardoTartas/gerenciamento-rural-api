// src/docs/schemas/authSchema.js

const authSchemas = {
    SignUpRequest: {
        type: "object",
        properties: {
            name: {
                type: "string",
                description: "Nome completo do usuário",
                example: "João da Silva"
            },
            email: {
                type: "string",
                format: "email",
                description: "Endereço de e-mail do usuário",
                example: "joao.silva@email.com"
            },
            password: {
                type: "string",
                description: "Senha do usuário (mínimo de 8 caracteres)",
                example: "MinhaSenh@123"
            }
        },
        required: ["name", "email", "password"],
        description: "Esquema para registro de usuário via BetterAuth",
        example: {
            name: "João da Silva",
            email: "joao.silva@email.com",
            password: "MinhaSenh@123"
        }
    },

    SignInRequest: {
        type: "object",
        properties: {
            email: {
                type: "string",
                format: "email",
                description: "E-mail de usuário registrado",
                example: "admin@admin.com"
            },
            password: {
                type: "string",
                description: "Senha do usuário",
                example: "admin"
            }
        },
        required: ["email", "password"],
        description: "Esquema para autenticação de usuário via BetterAuth. Use admin@admin.com / admin para testes.",
        example: {
            email: "admin@admin.com",
            password: "admin"
        }
    },

    SignInResponse: {
        type: "object",
        properties: {
            session: {
                type: "object",
                properties: {
                    id: { type: "string", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
                    token: { type: "string", example: "session_token_string..." },
                    userId: { type: "string", example: "f1e2d3c4-b5a6-7890-abcd-ef1234567890" },
                    expiresAt: { type: "string", format: "date-time", example: "2026-04-09T12:00:00.000Z" },
                    ipAddress: { type: "string", example: "192.168.1.1" },
                    userAgent: { type: "string", example: "Mozilla/5.0..." }
                }
            },
            user: {
                type: "object",
                properties: {
                    id: { type: "string", example: "f1e2d3c4-b5a6-7890-abcd-ef1234567890" },
                    name: { type: "string", example: "João da Silva" },
                    email: { type: "string", example: "joao.silva@email.com" },
                    emailVerified: { type: "boolean", example: false },
                    image: { type: "string", nullable: true, example: null },
                    createdAt: { type: "string", format: "date-time", example: "2026-04-02T12:00:00.000Z" },
                    updatedAt: { type: "string", format: "date-time", example: "2026-04-02T12:00:00.000Z" }
                }
            }
        },
        description: "Esquema para resposta de login do BetterAuth contendo dados da sessão e do usuário"
    },

    SessionResponse: {
        type: "object",
        properties: {
            session: {
                type: "object",
                properties: {
                    id: { type: "string", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
                    token: { type: "string", example: "session_token_string..." },
                    userId: { type: "string", example: "f1e2d3c4-b5a6-7890-abcd-ef1234567890" },
                    expiresAt: { type: "string", format: "date-time", example: "2026-04-09T12:00:00.000Z" }
                }
            },
            user: {
                type: "object",
                properties: {
                    id: { type: "string", example: "f1e2d3c4-b5a6-7890-abcd-ef1234567890" },
                    name: { type: "string", example: "João da Silva" },
                    email: { type: "string", example: "joao.silva@email.com" },
                    emailVerified: { type: "boolean", example: false },
                    image: { type: "string", nullable: true, example: null }
                }
            }
        },
        description: "Esquema para resposta de verificação de sessão"
    },

    ForgetPasswordRequest: {
        type: "object",
        properties: {
            email: {
                type: "string",
                format: "email",
                description: "E-mail registrado para recuperação de senha",
                example: "joao.silva@email.com"
            },
            redirectTo: {
                type: "string",
                description: "URL para redirecionar o usuário após clicar no link de recuperação (opcional)",
                example: "https://myapp.com/reset-password"
            }
        },
        required: ["email"],
        description: "Esquema para solicitação de recuperação de senha",
        example: {
            email: "joao.silva@email.com",
            redirectTo: "https://myapp.com/reset-password"
        }
    },

    ResetPasswordRequest: {
        type: "object",
        properties: {
            newPassword: {
                type: "string",
                description: "Nova senha (mínimo de 8 caracteres)",
                example: "NovaSenha@456"
            },
            token: {
                type: "string",
                description: "Token de recuperação recebido por e-mail",
                example: "eyJhbGciOiJIUzI1NiIsInR5..."
            }
        },
        required: ["newPassword", "token"],
        description: "Esquema para redefinição de senha com token de recuperação",
        example: {
            newPassword: "NovaSenha@456",
            token: "eyJhbGciOiJIUzI1NiIsInR5..."
        }
    },

    MessageResponse: {
        type: "object",
        properties: {
            status: {
                type: "boolean",
                example: true
            }
        },
        description: "Resposta de sucesso genérica do BetterAuth"
    }
};

export default authSchemas;
