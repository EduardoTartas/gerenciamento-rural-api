// src/docs/schemas/pastoSchema.js

const pastoSchemas = {
    PastoFilter: {
        type: "object",
        properties: {
            nome: { type: "string", description: "Filtrar por nome da pastagem (correspondência parcial, não sensível a maiúsculas)" },
            propriedadeId: { type: "string", format: "uuid", description: "Filtrar por ID da propriedade" },
            status: { type: "string", enum: ["Ocupado", "Vazio", "Descanso"], description: "Filtrar por status da pastagem" },
            tipoPastagem: { type: "string", description: "Filtrar por tipo de pastagem (correspondência parcial, não sensível a maiúsculas)" },
        }
    },

    PastoListItem: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
            propriedadeId: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            nome: { type: "string", example: "Pasto Norte" },
            extensaoHa: { type: "number", nullable: true, example: 15.5 },
            tipoPastagem: { type: "string", nullable: true, example: "Brachiaria Brizantha" },
            status: { type: "string", enum: ["Ocupado", "Vazio", "Descanso"], example: "Vazio" },
            dataUltimaSaida: { type: "string", format: "date-time", nullable: true, example: "2026-03-15T00:00:00.000Z" },
            ativo: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time", example: "2026-04-10T12:00:00.000Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-04-10T12:00:00.000Z" },
            propriedade: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
                    nome: { type: "string", example: "Fazenda Boa Esperança" },
                },
            },
        },
        description: "Esquema para item da lista de pastagens"
    },

    PastoDetails: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
            propriedadeId: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            nome: { type: "string", example: "Pasto Norte" },
            extensaoHa: { type: "number", nullable: true, example: 15.5 },
            tipoPastagem: { type: "string", nullable: true, example: "Brachiaria Brizantha" },
            status: { type: "string", enum: ["Ocupado", "Vazio", "Descanso"], example: "Vazio" },
            dataUltimaSaida: { type: "string", format: "date-time", nullable: true, example: "2026-03-15T00:00:00.000Z" },
            ativo: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time", example: "2026-04-10T12:00:00.000Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-04-10T12:00:00.000Z" },
            propriedade: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
                    nome: { type: "string", example: "Fazenda Boa Esperança" },
                },
            },
        },
        description: "Esquema para detalhes da pastagem"
    },

    PastoPaginatedList: {
        type: "object",
        properties: {
            docs: {
                type: "array",
                items: { $ref: "#/components/schemas/PastoListItem" }
            },
            totalDocs: { type: "integer", example: 8 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 1 }
        },
        description: "Lista paginada de pastagens"
    },

    PastoCreate: {
        type: "object",
        properties: {
            propriedadeId: { type: "string", format: "uuid", description: "UUID da propriedade à qual a pastagem pertence", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            nome: { type: "string", description: "Nome da pastagem (2-150 caracteres)", example: "Pasto Norte" },
            extensaoHa: { type: "number", description: "Extensão em hectares", nullable: true, example: 15.5 },
            tipoPastagem: { type: "string", description: "Tipo de pastagem/forrageira (2-100 caracteres)", nullable: true, example: "Brachiaria Brizantha" },
            status: { type: "string", enum: ["Ocupado", "Vazio", "Descanso"], description: "Status inicial da pastagem (padrão: Vazio)", example: "Vazio" },
        },
        required: ["propriedadeId", "nome"],
        description: "Esquema para criação de pastagem.",
        example: {
            propriedadeId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            nome: "Pasto Norte",
            extensaoHa: 15.5,
            tipoPastagem: "Brachiaria Brizantha",
            status: "Vazio"
        }
    },

    PastoPatch: {
        type: "object",
        properties: {
            nome: { type: "string", description: "Nome da pastagem (2-150 caracteres)", example: "Pasto Sul" },
            extensaoHa: { type: "number", description: "Extensão em hectares", nullable: true, example: 20.0 },
            tipoPastagem: { type: "string", description: "Tipo de pastagem/forrageira", nullable: true, example: "Panicum Maximum" },
            status: { type: "string", enum: ["Ocupado", "Vazio", "Descanso"], description: "Status da pastagem", example: "Descanso" },
            dataUltimaSaida: { type: "string", format: "date-time", description: "Data da última saída de animais", nullable: true, example: "2026-04-01T00:00:00.000Z" },
            ativo: { type: "boolean", description: "Status ativo/inativo da pastagem", example: true },
        },
        required: [],
        description: "Esquema para atualização parcial de pastagem. Pelo menos um campo é obrigatório.",
        example: {
            nome: "Pasto Sul",
            status: "Descanso"
        }
    }
};

export default pastoSchemas;
