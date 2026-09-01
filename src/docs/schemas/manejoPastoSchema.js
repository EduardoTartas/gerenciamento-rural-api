// src/docs/schemas/manejoPastoSchema.js

const tiposManejoPasto = ["Roçagem", "Adubação", "Calagem", "Aplicação de Pesticida", "Reforma de Cerca", "Limpeza Geral", "Plantio/Reforma", "Outro"];

const manejoPastoSchemas = {
    ManejoPastoFilter: {
        type: "object",
        properties: {
            pastoId: { type: "string", format: "uuid", description: "Filtrar por ID do pasto" },
            propriedadeId: { type: "string", format: "uuid", description: "Filtrar por ID da propriedade" },
            tipoManejo: { type: "string", enum: tiposManejoPasto, description: "Filtrar por tipo de manejo" },
            ativo: { type: "boolean", description: "Filtrar por manejos vigentes (true) ou excluídos (false). Sem o filtro, `atualizadoDesde` traz os dois — é assim que o app fica sabendo da exclusão." },
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
            ativo: { type: "boolean", example: true, description: "`false` quando o manejo foi excluído. Numa leitura por diferença é o que distingue a linha excluída de uma vigente." },
            updatedAt: { type: "string", format: "date-time", example: "2026-04-01T10:30:00.000Z", description: "Marca d'água da sincronização: o cliente usa o maior valor recebido como próximo `atualizadoDesde`." },
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
            itens: {
                type: "array",
                description: "Presente apenas na resposta de criação quando o corpo enviou `itens`. Lista as movimentações de estoque (`Saida`, origem `ManejoPasto`) geradas para o manejo.",
                items: { $ref: "#/components/schemas/MovimentacaoInsumo" },
            },
            avisos: {
                type: "array",
                description: "Presente apenas na resposta de criação quando algum item deixou o saldo projetado do insumo negativo. Lista de mensagens de estoque insuficiente — o manejo é criado mesmo assim.",
                items: { type: "string", example: "Estoque insuficiente de \"Ração proteinada 20%\" — saldo ficará negativo." },
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

    ManejoPastoItemInsumo: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", description: "Opcional. UUID gerado pelo cliente para a movimentação de estoque deste item (offline-first): quando presente, é preservado como `id` da movimentação criada, para o pull seguinte reconhecê-la em vez de duplicá-la.", example: "a1b2c3d4-e5f6-7890-abcd-ef0123456789" },
            insumoId: { type: "string", format: "uuid", description: "UUID de um insumo da mesma propriedade do pasto, com `destino` `Pasto` ou `Ambos`.", example: "d4e5f6a7-b8c9-0123-def4-234567890123" },
            quantidade: { type: "number", exclusiveMinimum: 0, description: "Quantidade consumida, na unidade do insumo. Deve ser maior que zero.", example: 25 },
            observacoes: { type: "string", nullable: true, maxLength: 500, description: "Observação opcional do item (máx 500 caracteres).", example: "Adubo aplicado no talhão leste" },
        },
        required: ["insumoId", "quantidade"],
        description: "Item de insumo consumido no manejo. Cada item vira uma movimentação de `Saida` (origem `ManejoPasto`) na mesma transação do manejo."
    },

    ManejoPastoCreate: {
        type: "object",
        properties: {
            pastoId: { type: "string", format: "uuid", description: "UUID do pasto ao qual o manejo pertence", example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
            tipoManejo: { type: "string", enum: tiposManejoPasto, description: "Tipo de manejo realizado", example: "Roçagem" },
            dataAtividade: { type: "string", format: "date-time", description: "Data em que a atividade foi realizada", example: "2026-04-01T00:00:00.000Z" },
            observacoes: { type: "string", description: "Observações adicionais (máx 500 caracteres)", nullable: true, example: "Roçagem completa do pasto norte" },
            itens: {
                type: "array",
                description: "Opcional. Insumos consumidos no manejo (máx 50). Cada item debita o estoque via uma movimentação de `Saida` (origem `ManejoPasto`) criada na mesma transação. Saldo insuficiente **avisa, não bloqueia** — o saldo pode ficar negativo.",
                maxItems: 50,
                items: { $ref: "#/components/schemas/ManejoPastoItemInsumo" },
            },
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
