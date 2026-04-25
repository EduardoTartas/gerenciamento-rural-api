// src/docs/schemas/rebanhoSchema.js

const rebanhoSchemas = {
    RebanhoFilter: {
        type: "object",
        properties: {
            nomeRebanho:      { type: "string", description: "Filtrar por nome do rebanho (parcial, case-insensitive)" },
            propriedadeId:    { type: "string", format: "uuid", description: "Filtrar por ID da propriedade" },
            pastoAtualId:     { type: "string", format: "uuid", description: "Filtrar por ID do pasto atual" },
            racaId:           { type: "string", format: "uuid", description: "Filtrar por ID da raça" },
            sistemaProducaoId: { type: "string", format: "uuid", description: "Filtrar por ID do sistema de produção" },
            regimeAlimentarId: { type: "string", format: "uuid", description: "Filtrar por ID do regime alimentar" },
            ativo:            { type: "boolean", description: "Filtrar por status ativo/inativo (padrão: true)" },
        }
    },

    RebanhoListItem: {
        type: "object",
        properties: {
            id:                    { type: "string", format: "uuid", example: "d4e5f6a7-b8c9-0123-def0-123456789012" },
            propriedadeId:         { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            pastoAtualId:          { type: "string", format: "uuid", nullable: true, example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
            racaId:                { type: "string", format: "uuid", nullable: true, example: "c3d4e5f6-a7b8-9012-cdef-123456789012" },
            sistemaProducaoId:     { type: "string", format: "uuid", nullable: true },
            regimeAlimentarId:     { type: "string", format: "uuid", nullable: true },
            nomeRebanho:           { type: "string", example: "Lote A - Nelore" },
            quantidadeCabecas:     { type: "integer", nullable: true, example: 120 },
            pesoMedioAtual:        { type: "number", nullable: true, example: 385.5 },
            dataEntradaPastoAtual: { type: "string", format: "date-time", nullable: true, example: "2026-03-01T00:00:00.000Z" },
            ativo:                 { type: "boolean", example: true },
            createdAt:             { type: "string", format: "date-time", example: "2026-01-15T10:00:00.000Z" },
            updatedAt:             { type: "string", format: "date-time", example: "2026-04-10T08:30:00.000Z" },
            propriedade:   { type: "object", properties: { id: { type: "string", format: "uuid" }, nome: { type: "string", example: "Fazenda Boa Esperança" } } },
            pastoAtual:    { type: "object", nullable: true, properties: { id: { type: "string", format: "uuid" }, nome: { type: "string", example: "Pasto Norte" }, status: { type: "string", example: "Ocupado" } } },
            raca:          { type: "object", nullable: true, properties: { id: { type: "string", format: "uuid" }, nome: { type: "string", example: "Nelore" } } },
            sistemaProducao:  { type: "object", nullable: true, properties: { id: { type: "string", format: "uuid" }, nome: { type: "string", example: "Cria" } } },
            regimeAlimentar: { type: "object", nullable: true, properties: { id: { type: "string", format: "uuid" }, nome: { type: "string", example: "Semi-confinamento" } } },
        },
        description: "Item da lista de rebanhos"
    },

    RebanhoPaginatedList: {
        type: "object",
        properties: {
            docs:       { type: "array", items: { $ref: "#/components/schemas/RebanhoListItem" } },
            totalDocs:  { type: "integer", example: 5 },
            page:       { type: "integer", example: 1 },
            limit:      { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 1 },
        },
        description: "Lista paginada de rebanhos"
    },

    RebanhoCreate: {
        type: "object",
        properties: {
            propriedadeId:        { type: "string", format: "uuid", description: "UUID da propriedade (obrigatório)", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            nomeRebanho:          { type: "string", description: "Nome do rebanho/lote (2-150 caracteres, único por propriedade entre ativos)", example: "Lote A - Nelore" },
            quantidadeCabecas:    { type: "integer", nullable: true, description: "Quantidade de cabeças", example: 120 },
            pesoMedioAtual:       { type: "number", nullable: true, description: "Peso médio atual em kg", example: 300.0 },
            dataEntradaPastoAtual: { type: "string", format: "date-time", nullable: true, description: "Data de entrada no pasto (preenchida automaticamente se não informada)" },
            pastoAtualId:         { type: "string", format: "uuid", description: "UUID do pasto atual (atualiza status do pasto para 'Ocupado')" },
            racaId:               { type: "string", format: "uuid", nullable: true, description: "UUID da raça (catálogo global)" },
            sistemaProducaoId:    { type: "string", format: "uuid", nullable: true, description: "UUID do sistema de produção (catálogo global)" },
            regimeAlimentarId:    { type: "string", format: "uuid", nullable: true, description: "UUID do regime alimentar (catálogo global)" },
        },
        required: ["propriedadeId", "nomeRebanho", "pastoAtualId"],
        example: {
            propriedadeId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            nomeRebanho: "Lote A - Nelore",
            quantidadeCabecas: 120,
            pesoMedioAtual: 300.0,
            pastoAtualId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
            racaId: "c3d4e5f6-a7b8-9012-cdef-123456789012"
        }
    },

    RebanhoPatch: {
        type: "object",
        properties: {
            nomeRebanho:          { type: "string", description: "Novo nome do rebanho/lote", example: "Lote A - Engorda" },
            quantidadeCabecas:    { type: "integer", nullable: true, example: 115 },
            pesoMedioAtual:       { type: "number", nullable: true, example: 420.0 },
            dataEntradaPastoAtual: { type: "string", format: "date-time", nullable: true },
            pastoAtualId:         { type: "string", format: "uuid", nullable: true },
            racaId:               { type: "string", format: "uuid", nullable: true },
            sistemaProducaoId:    { type: "string", format: "uuid", nullable: true },
            regimeAlimentarId:    { type: "string", format: "uuid", nullable: true },
        },
        description: "Esquema para atualização parcial de rebanho. Pelo menos um campo é obrigatório.",
        example: { quantidadeCabecas: 115, pesoMedioAtual: 420.0 }
    }
};

export default rebanhoSchemas;
