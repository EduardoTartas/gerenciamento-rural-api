// src/docs/schemas/movimentacaoSchema.js

const movimentacaoSchemas = {
    MovimentacaoFilter: {
        type: "object",
        properties: {
            rebanhoId:     { type: "string", format: "uuid", description: "Filtrar por ID do rebanho" },
            propriedadeId: { type: "string", format: "uuid", description: "Filtrar por ID da propriedade" },
            pastoOrigemId:  { type: "string", format: "uuid", description: "Filtrar por ID do pasto de origem" },
            pastoDestinoId: { type: "string", format: "uuid", description: "Filtrar por ID do pasto de destino" },
        }
    },

    MovimentacaoListItem: {
        type: "object",
        properties: {
            id:               { type: "string", format: "uuid", example: "f7a8b9c0-d1e2-3456-f012-345678901234" },
            rebanhoId:        { type: "string", format: "uuid", example: "d4e5f6a7-b8c9-0123-def0-123456789012" },
            pastoOrigemId:    { type: "string", format: "uuid", nullable: true, example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
            pastoDestinoId:   { type: "string", format: "uuid", example: "c3d4e5f6-a7b8-9012-cdef-123456789012" },
            dataMovimentacao: { type: "string", format: "date-time", example: "2026-04-20T08:00:00.000Z" },
            observacoes:      { type: "string", nullable: true, example: "Transferência para pasto de engorda" },
            createdAt:        { type: "string", format: "date-time", example: "2026-04-20T08:05:00.000Z" },
            rebanho: {
                type: "object",
                properties: {
                    id:               { type: "string", format: "uuid" },
                    nomeRebanho:      { type: "string", example: "Lote A - Nelore" },
                    quantidadeCabecas: { type: "integer", nullable: true, example: 120 },
                    propriedade: {
                        type: "object",
                        properties: {
                            id:   { type: "string", format: "uuid" },
                            nome: { type: "string", example: "Fazenda Boa Esperança" }
                        }
                    }
                }
            },
            pastoOrigem:  {
                type: "object",
                nullable: true,
                properties: {
                    id:   { type: "string", format: "uuid" },
                    nome: { type: "string", example: "Pasto Norte" }
                }
            },
            pastoDestino: {
                type: "object",
                properties: {
                    id:   { type: "string", format: "uuid" },
                    nome: { type: "string", example: "Pasto Sul" }
                }
            }
        },
        description: "Registro de movimentação de rebanho entre pastos"
    },

    MovimentacaoPaginatedList: {
        type: "object",
        properties: {
            docs:       { type: "array", items: { $ref: "#/components/schemas/MovimentacaoListItem" } },
            totalDocs:  { type: "integer", example: 8 },
            page:       { type: "integer", example: 1 },
            limit:      { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 1 }
        },
        description: "Lista paginada de movimentações de rebanho"
    },

    MovimentacaoCreate: {
        type: "object",
        properties: {
            rebanhoId:       { type: "string", format: "uuid", description: "UUID do rebanho a ser movimentado (obrigatório)", example: "d4e5f6a7-b8c9-0123-def0-123456789012" },
            pastoDestinoId:  { type: "string", format: "uuid", description: "UUID do pasto de destino (obrigatório)", example: "c3d4e5f6-a7b8-9012-cdef-123456789012" },
            dataMovimentacao: { type: "string", format: "date-time", description: "Data/hora da movimentação (opcional, padrão: agora). Não pode ser no futuro.", example: "2026-04-20T08:00:00.000Z" },
            observacoes:     { type: "string", nullable: true, description: "Observações adicionais (máx 500 caracteres)", example: "Transferência para pasto de engorda" },
        },
        required: ["rebanhoId", "pastoDestinoId"],
        description: "O pastoOrigemId é preenchido automaticamente pelo sistema com o pasto atual do rebanho.",
        example: {
            rebanhoId: "d4e5f6a7-b8c9-0123-def0-123456789012",
            pastoDestinoId: "c3d4e5f6-a7b8-9012-cdef-123456789012",
            observacoes: "Transferência para pasto de engorda"
        }
    }
};

export default movimentacaoSchemas;
