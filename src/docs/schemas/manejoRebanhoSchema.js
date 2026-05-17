// src/docs/schemas/manejoRebanhoSchema.js

const manejoRebanhoSchemas = {
    ManejoRebanhoFilter: {
        type: "object",
        properties: {
            rebanhoId:    { type: "string", format: "uuid", description: "Filtrar por ID do rebanho" },
            propriedadeId: { type: "string", format: "uuid", description: "Filtrar por ID da propriedade" },
            tipoManejoId: { type: "string", format: "uuid", description: "Filtrar por ID do tipo de manejo (catálogo global)" },
        }
    },

    ManejoRebanhoListItem: {
        type: "object",
        properties: {
            id:                { type: "string", format: "uuid", example: "e5f6a7b8-c9d0-1234-ef01-234567890123" },
            rebanhoId:         { type: "string", format: "uuid", example: "d4e5f6a7-b8c9-0123-def0-123456789012" },
            tipoManejoId:      { type: "string", format: "uuid", example: "f6a7b8c9-d0e1-2345-f012-345678901234" },
            medicamentoVacina: { type: "string", nullable: true, example: "Vacina Aftosa" },
            pesoRegistrado:    { type: "number", nullable: true, example: 395.0 },
            dataAtividade:     { type: "string", format: "date-time", example: "2026-04-15T00:00:00.000Z" },
            observacoes:       { type: "string", nullable: true, example: "Vacinação semestral do lote" },
            createdAt:         { type: "string", format: "date-time", example: "2026-04-15T10:30:00.000Z" },
            updatedAt:         { type: "string", format: "date-time", example: "2026-04-15T10:30:00.000Z" },
            tipoManejo: {
                type: "object",
                properties: {
                    id:   { type: "string", format: "uuid" },
                    nome: { type: "string", example: "Vacinação" }
                }
            },
            rebanho: {
                type: "object",
                properties: {
                    id:          { type: "string", format: "uuid" },
                    nomeRebanho: { type: "string", example: "Lote A - Nelore" },
                    propriedade: {
                        type: "object",
                        properties: {
                            id:   { type: "string", format: "uuid" },
                            nome: { type: "string", example: "Fazenda Boa Esperança" }
                        }
                    }
                }
            }
        },
        description: "Item de manejo de rebanho"
    },

    ManejoRebanhoPaginatedList: {
        type: "object",
        properties: {
            docs:       { type: "array", items: { $ref: "#/components/schemas/ManejoRebanhoListItem" } },
            totalDocs:  { type: "integer", example: 12 },
            page:       { type: "integer", example: 1 },
            limit:      { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 2 }
        },
        description: "Lista paginada de manejos de rebanho"
    },

    ManejoRebanhoCreate: {
        type: "object",
        properties: {
            rebanhoId:        { type: "string", format: "uuid", description: "UUID do rebanho (obrigatório)", example: "d4e5f6a7-b8c9-0123-def0-123456789012" },
            tipoManejoId:     { type: "string", format: "uuid", description: "UUID do tipo de manejo do catálogo global (obrigatório)", example: "f6a7b8c9-d0e1-2345-f012-345678901234" },
            dataAtividade:    { type: "string", format: "date-time", description: "Data da atividade (não pode ser no futuro)", example: "2026-04-15T00:00:00.000Z" },
            medicamentoVacina: { type: "string", nullable: true, description: "Nome do medicamento ou vacina aplicada (máx 200 caracteres)", example: "Vacina Aftosa" },
            pesoRegistrado:   { type: "number", nullable: true, description: "Peso registrado em kg. Se informado, atualiza automaticamente o pesoMedioAtual do rebanho.", example: 395.0 },
            observacoes:      { type: "string", nullable: true, description: "Observações adicionais (máx 500 caracteres)", example: "Vacinação semestral completa do lote" },
        },
        required: ["rebanhoId", "tipoManejoId", "dataAtividade"],
        example: {
            rebanhoId: "d4e5f6a7-b8c9-0123-def0-123456789012",
            tipoManejoId: "f6a7b8c9-d0e1-2345-f012-345678901234",
            dataAtividade: "2026-04-15T00:00:00.000Z",
            pesoRegistrado: 395.0,
            observacoes: "Pesagem pré-abate"
        }
    },

    ManejoRebanhoPatch: {
        type: "object",
        properties: {
            tipoManejoId:     { type: "string", format: "uuid", description: "UUID do tipo de manejo" },
            dataAtividade:    { type: "string", format: "date-time" },
            medicamentoVacina: { type: "string", nullable: true },
            pesoRegistrado:   { type: "number", nullable: true },
            observacoes:      { type: "string", nullable: true },
        },
        description: "Atualização parcial de manejo de rebanho. Pelo menos um campo é obrigatório.",
        example: { observacoes: "Corrigida a data do registro" }
    }
};

export default manejoRebanhoSchemas;
