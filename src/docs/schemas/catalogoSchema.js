// src/docs/schemas/catalogoSchema.js

const catalogoSchemas = {
    CatalogoItem: {
        type: "object",
        properties: {
            id:        { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            nome:      { type: "string", example: "Nelore" },
            ativo:     { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time", example: "2026-04-01T12:00:00.000Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-04-01T12:00:00.000Z" },
        },
        description: "Item de catálogo global (raça, categoria, sistema de produção, etc.)"
    },

    CatalogoPaginatedList: {
        type: "object",
        properties: {
            docs:       { type: "array", items: { $ref: "#/components/schemas/CatalogoItem" } },
            totalDocs:  { type: "integer", example: 6 },
            page:       { type: "integer", example: 1 },
            limit:      { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 1 },
        },
        description: "Lista paginada de itens de catálogo"
    },

    CatalogoCreate: {
        type: "object",
        properties: {
            nome: { type: "string", description: "Nome do item de catálogo (2-100 caracteres)", example: "Nelore" },
        },
        required: ["nome"],
        example: { nome: "Nelore" }
    },

    CatalogoPatch: {
        type: "object",
        properties: {
            nome:  { type: "string", description: "Novo nome do item (2-100 caracteres)", example: "Nelore P.O." },
            ativo: { type: "boolean", description: "Status ativo/inativo", example: true },
        },
        example: { nome: "Nelore P.O." }
    },
};

export default catalogoSchemas;
