// src/docs/schemas/manejoRebanhoSchema.js

const manejoRebanhoSchemas = {
    ManejoRebanhoFilter: {
        type: "object",
        properties: {
            rebanhoId:    { type: "string", format: "uuid", description: "Filtrar por ID do rebanho" },
            propriedadeId: { type: "string", format: "uuid", description: "Filtrar por ID da propriedade" },
            tipoManejoId: { type: "string", format: "uuid", description: "Filtrar por ID do tipo de manejo (catálogo global)" },
            ativo: { type: "boolean", description: "Filtrar por manejos vigentes (true) ou excluídos (false). Sem o filtro, `atualizadoDesde` traz os dois — é assim que o app fica sabendo da exclusão." },
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
            ativo:             { type: "boolean", example: true, description: "`false` quando o manejo foi excluído. Numa leitura por diferença é o que distingue a linha excluída de uma vigente." },
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
            },
            itens: {
                type: "array",
                description: "Presente apenas na resposta de criação quando o corpo enviou `itens`. Lista as movimentações de estoque (`Saida`, origem `ManejoRebanho`) geradas para o manejo.",
                items: { $ref: "#/components/schemas/MovimentacaoInsumo" }
            },
            avisos: {
                type: "array",
                description: "Presente apenas na resposta de criação quando algum item deixou o saldo projetado do insumo negativo. Lista de mensagens de estoque insuficiente — o manejo é criado mesmo assim.",
                items: { type: "string", example: "Estoque insuficiente de \"Vermífugo\" — saldo ficará negativo." }
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

    ManejoRebanhoItemInsumo: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", description: "Opcional. UUID gerado pelo cliente para a movimentação de estoque deste item (offline-first): quando presente, é preservado como `id` da movimentação criada, para o pull seguinte reconhecê-la em vez de duplicá-la.", example: "a1b2c3d4-e5f6-7890-abcd-ef0123456789" },
            insumoId: { type: "string", format: "uuid", description: "UUID de um insumo da mesma propriedade do rebanho, com `destino` `Rebanho` ou `Ambos`.", example: "d4e5f6a7-b8c9-0123-def4-234567890123" },
            quantidade: { type: "number", exclusiveMinimum: 0, description: "Quantidade consumida, na unidade do insumo. Deve ser maior que zero.", example: 3 },
            observacoes: { type: "string", nullable: true, maxLength: 500, description: "Observação opcional do item (máx 500 caracteres).", example: "Dose aplicada em 40 cabeças" },
        },
        required: ["insumoId", "quantidade"],
        description: "Item de insumo consumido no manejo. Cada item vira uma movimentação de `Saida` (origem `ManejoRebanho`) na mesma transação do manejo."
    },

    ManejoRebanhoCreate: {
        type: "object",
        properties: {
            rebanhoId:        { type: "string", format: "uuid", description: "UUID do rebanho (obrigatório)", example: "d4e5f6a7-b8c9-0123-def0-123456789012" },
            tipoManejoId:     { type: "string", format: "uuid", description: "UUID do tipo de manejo do catálogo global (obrigatório)", example: "f6a7b8c9-d0e1-2345-f012-345678901234" },
            dataAtividade:    { type: "string", format: "date-time", description: "Data da atividade (não pode ser no futuro)", example: "2026-04-15T00:00:00.000Z" },
            medicamentoVacina: { type: "string", nullable: true, description: "Campo legado (retrocompat de dados). Nome do medicamento ou vacina aplicada (máx 200 caracteres). O app novo usa o array `itens`.", example: "Vacina Aftosa" },
            pesoRegistrado:   { type: "number", nullable: true, description: "Peso registrado em kg. Se informado, atualiza automaticamente o pesoMedioAtual do rebanho.", example: 395.0 },
            observacoes:      { type: "string", nullable: true, description: "Observações adicionais (máx 500 caracteres)", example: "Vacinação semestral completa do lote" },
            itens: {
                type: "array",
                description: "Opcional. Insumos consumidos no manejo (máx 50). Cada item debita o estoque via uma movimentação de `Saida` (origem `ManejoRebanho`) criada na mesma transação. Saldo insuficiente **avisa, não bloqueia** — o saldo pode ficar negativo.",
                maxItems: 50,
                items: { $ref: "#/components/schemas/ManejoRebanhoItemInsumo" },
            },
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
