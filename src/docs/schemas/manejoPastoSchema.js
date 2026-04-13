// src/docs/schemas/manejoPastoSchema.js

const tiposManejoPasto = ["Roçagem", "Adubação", "Calagem", "Aplicação de Pesticida", "Reforma de Cerca", "Limpeza Geral", "Plantio/Reforma", "Outro"];

const manejoPastoSchemas = {
    ManejoPastoFilter: {
        type: "object",
        properties: {
            pastoId: { type: "string", format: "uuid", description: "Filtrar por ID do pasto" },
            propriedadeId: { type: "string", format: "uuid", description: "Filtrar por ID da propriedade" },
            tipoManejo: { type: "string", enum: tiposManejoPasto, description: "Filtrar por tipo de manejo" },
        }
    },

    ManejoPastoListItem: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", example: "c3d4e5f6-a7b8-9012-cdef-123456789012" },
            pastoId: { type: "string", format: "uuid", example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
            tipoManejo: { type: "string", enum: tiposManejoPasto, example: "Roçagem" },
            dataAtividade: { type: "string", format: "date-time", example: "2026-04-01T00:00:00.000Z" },
            observacoes: { type: "string", nullable: true, example: "Roçagem completa do pasto norte" },
            pasto: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid", example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
                    nome: { type: "string", example: "Pasto Norte" },
                    propriedade: {
                        type: "object",
                        properties: {
                            id: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
                            nome: { type: "string", example: "Fazenda Boa Esperança" },
                        },
                    },
                },
            },
        },
        description: "Esquema para item da lista de manejos de pasto"
    },

    ManejoPastoDetails: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", example: "c3d4e5f6-a7b8-9012-cdef-123456789012" },
            pastoId: { type: "string", format: "uuid", example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
            tipoManejo: { type: "string", enum: tiposManejoPasto, example: "Roçagem" },
            dataAtividade: { type: "string", format: "date-time", example: "2026-04-01T00:00:00.000Z" },
            observacoes: { type: "string", nullable: true, example: "Roçagem completa do pasto norte" },
            pasto: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid", example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
                    nome: { type: "string", example: "Pasto Norte" },
                    propriedade: {
                        type: "object",
                        properties: {
                            id: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
                            nome: { type: "string", example: "Fazenda Boa Esperança" },
                        },
                    },
                },
            },
        },
        description: "Esquema para detalhes do manejo de pasto"
    },

    ManejoPastoPaginatedList: {
        type: "object",
        properties: {
            docs: {
                type: "array",
                items: { $ref: "#/components/schemas/ManejoPastoListItem" }
            },
            totalDocs: { type: "integer", example: 12 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 2 }
        },
        description: "Lista paginada de manejos de pasto"
    },

    ManejoPastoCreate: {
        type: "object",
        properties: {
            pastoId: { type: "string", format: "uuid", description: "UUID do pasto ao qual o manejo pertence", example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
            tipoManejo: { type: "string", enum: tiposManejoPasto, description: "Tipo de manejo realizado", example: "Roçagem" },
            dataAtividade: { type: "string", format: "date-time", description: "Data em que a atividade foi realizada", example: "2026-04-01T00:00:00.000Z" },
            observacoes: { type: "string", description: "Observações adicionais (máx 500 caracteres)", nullable: true, example: "Roçagem completa do pasto norte" },
        },
        required: ["pastoId", "tipoManejo", "dataAtividade"],
        description: "Esquema para criação de manejo de pasto. Tipos disponíveis: Roçagem, Adubação, Calagem, Aplicação de Pesticida, Reforma de Cerca, Limpeza Geral, Plantio/Reforma, Outro.",
        example: {
            pastoId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
            tipoManejo: "Roçagem",
            dataAtividade: "2026-04-01T00:00:00.000Z",
            observacoes: "Roçagem completa do pasto norte"
        }
    },

    ManejoPastoPatch: {
        type: "object",
        properties: {
            tipoManejo: { type: "string", enum: tiposManejoPasto, description: "Tipo de manejo realizado", example: "Adubação" },
            dataAtividade: { type: "string", format: "date-time", description: "Data em que a atividade foi realizada", example: "2026-04-05T00:00:00.000Z" },
            observacoes: { type: "string", description: "Observações adicionais (máx 500 caracteres)", nullable: true, example: "Adubação NPK 20-05-20" },
        },
        required: [],
        description: "Esquema para atualização parcial de manejo de pasto. Pelo menos um campo é obrigatório.",
        example: {
            tipoManejo: "Adubação",
            observacoes: "Adubação NPK 20-05-20"
        }
    }
};

export default manejoPastoSchemas;
