// src/docs/schemas/userSchema.js

const userSchemas = {
    UserFilter: {
        type: "object",
        properties: {
            name: { type: "string", description: "Filtrar por nome (não sensível a maiúsculas/minúsculas, correspondência parcial)" },
            email: { type: "string", format: "email", description: "Filtrar por e-mail (não sensível a maiúsculas/minúsculas, correspondência parcial)" },
        }
    },

    UserListItem: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", example: "f1e2d3c4-b5a6-7890-abcd-ef1234567890" },
            name: { type: "string", example: "João da Silva" },
            email: { type: "string", format: "email", example: "joao.silva@email.com" },
            emailVerified: { type: "boolean", example: false },
            image: { type: "string", nullable: true, example: null },
            createdAt: { type: "string", format: "date-time", example: "2026-04-02T12:00:00.000Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-04-02T12:00:00.000Z" }
        },
        description: "Esquema para item da lista de usuários"
    },

    UserDetails: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", example: "f1e2d3c4-b5a6-7890-abcd-ef1234567890" },
            name: { type: "string", example: "João da Silva" },
            email: { type: "string", format: "email", example: "joao.silva@email.com" },
            emailVerified: { type: "boolean", example: false },
            image: { type: "string", nullable: true, example: null },
            createdAt: { type: "string", format: "date-time", example: "2026-04-02T12:00:00.000Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-04-02T12:00:00.000Z" }
        },
        description: "Esquema para detalhes do usuário"
    },

    UserPaginatedList: {
        type: "object",
        properties: {
            docs: {
                type: "array",
                items: { $ref: "#/components/schemas/UserListItem" }
            },
            totalDocs: { type: "integer", example: 25 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 3 }
        },
        description: "Lista paginada de usuários"
    },

    UserPatch: {
        type: "object",
        properties: {
            name: { type: "string", description: "Nome completo (2-100 caracteres)", example: "João da Silva Pereira" },
            email: { type: "string", format: "email", description: "Novo endereço de e-mail", example: "joao.novo@email.com" },
            image: { type: "string", description: "URL da imagem de perfil", nullable: true, example: "https://example.com/photo.jpg" }
        },
        required: [],
        description: "Esquema para atualização parcial de usuário. Pelo menos um campo é obrigatório.",
        example: {
            name: "João da Silva Pereira"
        }
    }
};

export default userSchemas;
