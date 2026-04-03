// src/docs/schemas/authSchema.js

const authSchemas = {
    SignUpRequest: {
        type: "object",
        properties: {
            name: {
                type: "string",
                description: "Full name of the user",
                example: "João da Silva"
            },
            email: {
                type: "string",
                format: "email",
                description: "User email address",
                example: "joao.silva@email.com"
            },
            password: {
                type: "string",
                description: "User password (minimum 8 characters)",
                example: "MinhaSenh@123"
            }
        },
        required: ["name", "email", "password"],
        description: "Schema for user registration via BetterAuth",
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
                description: "Registered user email",
                example: "joao.silva@email.com"
            },
            password: {
                type: "string",
                description: "User password",
                example: "MinhaSenh@123"
            }
        },
        required: ["email", "password"],
        description: "Schema for user authentication via BetterAuth",
        example: {
            email: "joao.silva@email.com",
            password: "MinhaSenh@123"
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
        description: "Schema for BetterAuth sign-in response containing session and user data"
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
        description: "Schema for session verification response"
    },

    ForgetPasswordRequest: {
        type: "object",
        properties: {
            email: {
                type: "string",
                format: "email",
                description: "Registered email for password recovery",
                example: "joao.silva@email.com"
            },
            redirectTo: {
                type: "string",
                description: "URL to redirect the user after clicking the recovery link (optional)",
                example: "https://myapp.com/reset-password"
            }
        },
        required: ["email"],
        description: "Schema for password recovery request",
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
                description: "New password (minimum 8 characters)",
                example: "NovaSenha@456"
            },
            token: {
                type: "string",
                description: "Recovery token received via email",
                example: "eyJhbGciOiJIUzI1NiIsInR5..."
            }
        },
        required: ["newPassword", "token"],
        description: "Schema for password reset with recovery token",
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
        description: "Generic BetterAuth success response"
    }
};

export default authSchemas;
