// src/docs/schemas/userSchema.js

const userSchemas = {
    UserFilter: {
        type: "object",
        properties: {
            name: { type: "string", description: "Filter by name (case-insensitive, partial match)" },
            email: { type: "string", format: "email", description: "Filter by email (case-insensitive, partial match)" },
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
        description: "Schema for user list item"
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
        description: "Schema for user details"
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
        description: "Paginated list of users"
    },

    UserPatch: {
        type: "object",
        properties: {
            name: { type: "string", description: "Full name (2-100 characters)", example: "João da Silva Pereira" },
            email: { type: "string", format: "email", description: "New email address", example: "joao.novo@email.com" },
            image: { type: "string", description: "Profile image URL", nullable: true, example: "https://example.com/photo.jpg" }
        },
        required: [],
        description: "Schema for partial user update. At least one field is required.",
        example: {
            name: "João da Silva Pereira"
        }
    }
};

export default userSchemas;
