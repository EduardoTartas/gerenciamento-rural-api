// src/docs/config/head.js

// Retrieves server URLs for documentation based on the current environment
const getServersInCorrectOrder = () => {
    const defaultDevUrl = "http://localhost:6060";
    const defaultProdUrl = `${defaultDevUrl}/prod`;

    const devUrl = {
        url: process.env.SWAGGER_DEV_URL || defaultDevUrl,
        description: "Development environment"
    };

    const prodUrl = {
        url: process.env.SWAGGER_PROD_URL || defaultProdUrl,
        description: "Production environment"
    };

    return process.env.NODE_ENV === "development" ? [devUrl, prodUrl] : [prodUrl, devUrl];
};

const getSwaggerOptions = async () => {
    const t = process.env.NODE_ENV === 'development' ? `?t=${Date.now()}` : '';

    // Paths
    const authPaths = (await import(new URL("../paths/auth.js",
        import.meta.url).href + t)).default;
    const userPaths = (await import(new URL("../paths/user.js",
        import.meta.url).href + t)).default;

    // Schemas
    const authSchemas = (await import(new URL("../schemas/authSchema.js",
        import.meta.url).href + t)).default;
    const userSchemas = (await import(new URL("../schemas/userSchema.js",
        import.meta.url).href + t)).default;

    return {
        swaggerDefinition: {
            openapi: "3.0.0",
            info: {
                title: "Pasto Livre API - Gestão Rural",
                version: "1.0.0",
                description: `
### 📋 Overview
Official documentation for the **Pasto Livre API** — a backend for rural property management focused on small and mid-sized livestock operations.

This API supports multi-farm registration, pasture management, herd control, feed inventory, and offline-first mobile synchronization.

---

### 🔐 Authentication
Authentication is managed by **BetterAuth** with session-based cookies.

- **Sign Up**: \`POST /api/auth/sign-up/email\`
- **Sign In**: \`POST /api/auth/sign-in/email\`
- **Sign Out**: \`POST /api/auth/sign-out\`
- **Get Session**: \`GET /api/auth/get-session\`

After signing in, session cookies are automatically set. For Swagger UI testing, use the **Authorize** button with a Bearer token or ensure cookies are enabled.

---

### 🚀 Main Features
- **BetterAuth Session Authentication**: Secure cookie-based sessions with PostgreSQL persistence.
- **User Management**: Profile CRUD with Zod validation and UUID identifiers.
- **Password Recovery**: Forget/reset password flows (email service pending configuration).
- **Prisma ORM**: Type-safe database access with PostgreSQL.
                `,
                contact: {
                    name: "Equipe Pasto Livre",
                    email: "contato@pastolivre.com"
                },
            },
            servers: getServersInCorrectOrder(),
            tags: [
                {
                    name: "Auth",
                    description: "Authentication flows managed by BetterAuth (sign-up, sign-in, sign-out, password recovery)"
                },
                {
                    name: "Users",
                    description: "User profile management (list, view, update, delete)"
                },
                {
                    name: "Propriedades",
                    description: "Cadastro de fazendas, talhões, infraestrutura e alertas do dashboard (coming soon)"
                },
                {
                    name: "Pastagens",
                    description: "Manejo de pastos, ocupação, descanso e histórico de intervenções (coming soon)"
                },
                {
                    name: "Rebanhos (Lotes)",
                    description: "Criação de lotes, movimentação entre pastos e linha do tempo sanitária (coming soon)"
                },
                {
                    name: "Inventário",
                    description: "Entradas de insumos, unidades de medida e saldo disponível (coming soon)"
                }
            ],
            paths: {
                ...authPaths,
                ...userPaths,
            },
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT"
                    }
                },
                schemas: {
                    ...authSchemas,
                    ...userSchemas,
                }
            },
            security: [{
                bearerAuth: []
            }]
        },
        apis: ["./src/routes/*.js"]
    };
};

export default getSwaggerOptions;
