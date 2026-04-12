// src/docs/schemas/propriedadeSchema.js

const propriedadeSchemas = {
    PropriedadeFilter: {
        type: "object",
        properties: {
            nome: { type: "string", description: "Filtrar por nome da propriedade (correspondência parcial, não sensível a maiúsculas)" },
            localizacao: { type: "string", description: "Filtrar por localização (ex: 'Vilhena,RO', correspondência parcial)" },
        }
    },

    PropriedadeListItem: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            nome: { type: "string", example: "Fazenda Boa Esperança" },
            localizacao: { type: "string", nullable: true, example: "Vilhena,RO" },
            ativo: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time", example: "2026-04-10T12:00:00.000Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-04-10T12:00:00.000Z" }
        },
        description: "Esquema para item da lista de propriedades"
    },

    PropriedadeDetails: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            usuarioId: { type: "string", format: "uuid", example: "f1e2d3c4-b5a6-7890-abcd-ef1234567890" },
            nome: { type: "string", example: "Fazenda Boa Esperança" },
            localizacao: { type: "string", nullable: true, example: "Vilhena,RO" },
            ativo: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time", example: "2026-04-10T12:00:00.000Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-04-10T12:00:00.000Z" }
        },
        description: "Esquema para detalhes da propriedade"
    },

    PropriedadePaginatedList: {
        type: "object",
        properties: {
            docs: {
                type: "array",
                items: { $ref: "#/components/schemas/PropriedadeListItem" }
            },
            totalDocs: { type: "integer", example: 5 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 1 }
        },
        description: "Lista paginada de propriedades"
    },

    PropriedadeCreate: {
        type: "object",
        properties: {
            nome: { type: "string", description: "Nome da propriedade (2-150 caracteres)", example: "Fazenda Boa Esperança" },
            localizacao: { type: "string", description: "Localização (cidade,estado)", nullable: true, example: "Vilhena,RO" },
        },
        required: ["nome"],
        description: "Esquema para criação de propriedade.",
        example: {
            nome: "Fazenda Boa Esperança",
            localizacao: "Vilhena,RO"
        }
    },

    PropriedadePatch: {
        type: "object",
        properties: {
            nome: { type: "string", description: "Nome da propriedade (2-150 caracteres)", example: "Fazenda Nova Esperança" },
            localizacao: { type: "string", description: "Localização (cidade,estado)", nullable: true, example: "Vilhena,RO" },
            ativo: { type: "boolean", description: "Status ativo/inativo da propriedade", example: true },
        },
        required: [],
        description: "Esquema para atualização parcial de propriedade. Pelo menos um campo é obrigatório.",
        example: {
            nome: "Fazenda Nova Esperança"
        }
    }
};

export default propriedadeSchemas;
