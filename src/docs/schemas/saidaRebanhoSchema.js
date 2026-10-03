// src/docs/schemas/saidaRebanhoSchema.js

const MOTIVOS = ["Venda", "Morte", "Abate", "Outro"];

const saidaRebanhoSchemas = {
    SaidaRebanhoFilter: {
        type: "object",
        properties: {
            rebanhoId:     { type: "string", format: "uuid", description: "Filtrar por ID do rebanho" },
            propriedadeId: { type: "string", format: "uuid", description: "Filtrar por ID da propriedade" },
            motivo:        { type: "string", enum: MOTIVOS, description: "Filtrar pelo motivo da saída" },
            ativo:         { type: "boolean", description: "Filtrar por saídas válidas (true) ou desfeitas (false). Sem o filtro, `atualizadoDesde` traz as duas." },
        }
    },

    SaidaRebanhoListItem: {
        type: "object",
        properties: {
            id:                { type: "string", format: "uuid", example: "0a1b2c3d-4e5f-4789-8abc-def012345678" },
            rebanhoId:         { type: "string", format: "uuid", example: "d4e5f6a7-b8c9-0123-def0-123456789012" },
            motivo:            { type: "string", enum: MOTIVOS, example: "Venda" },
            quantidadeCabecas: { type: "integer", minimum: 1, example: 20 },
            dataSaida:         { type: "string", format: "date-time", example: "2026-09-20T08:00:00.000Z" },
            finalizouRebanho:  { type: "boolean", example: false, description: "`true` quando esta saída encerrou o ciclo do rebanho." },
            precoArroba:       { type: "string", nullable: true, example: "310.5", description: "Preço da arroba (R$) na venda. Decimal serializado como texto; nulo fora de Venda." },
            pesoTotalKg:       { type: "string", nullable: true, example: "5400", description: "Peso total vendido (kg), opcional. Nulo fora de Venda." },
            valorTotal:        { type: "string", nullable: true, example: "110000", description: "Valor total recebido (R$). Nulo fora de Venda." },
            observacoes:       { type: "string", nullable: true, example: "Venda para o frigorífico" },
            ativo:             { type: "boolean", example: true },
            createdAt:         { type: "string", format: "date-time", example: "2026-09-20T08:05:00.000Z" },
            updatedAt:         { type: "string", format: "date-time", example: "2026-09-20T08:05:00.000Z", description: "Marca d'água da sincronização: o cliente usa o maior valor recebido como próximo `atualizadoDesde`." },
            rebanho: {
                type: "object",
                description: "Estado do rebanho **depois** da saída.",
                properties: {
                    id:                { type: "string", format: "uuid" },
                    nomeRebanho:       { type: "string", example: "Lote A - Nelore" },
                    quantidadeCabecas: { type: "integer", nullable: true, example: 100 },
                    pastoAtualId:      { type: "string", format: "uuid", nullable: true },
                    ativo:             { type: "boolean", example: true },
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
        description: "Saída de animais de um rebanho (venda, morte, abate ou outro motivo)"
    },

    SaidaRebanhoPaginatedList: {
        type: "object",
        properties: {
            docs:       { type: "array", items: { $ref: "#/components/schemas/SaidaRebanhoListItem" } },
            totalDocs:  { type: "integer", example: 3 },
            page:       { type: "integer", example: 1 },
            limit:      { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 1 }
        },
        description: "Lista paginada de saídas de animais"
    },

    SaidaRebanhoCreate: {
        type: "object",
        properties: {
            id:                { type: "string", format: "uuid", description: "UUID gerado pelo cliente (offline-first, opcional)" },
            rebanhoId:         { type: "string", format: "uuid", description: "UUID do rebanho (obrigatório)", example: "d4e5f6a7-b8c9-0123-def0-123456789012" },
            motivo:            { type: "string", enum: MOTIVOS, description: "Motivo da saída (obrigatório)", example: "Venda" },
            quantidadeCabecas: { type: "integer", minimum: 1, description: "Cabeças que saíram (obrigatório). Não pode passar das cabeças atuais do rebanho.", example: 20 },
            dataSaida:         { type: "string", format: "date-time", description: "Data da saída (opcional, padrão: agora). Não pode ser no futuro.", example: "2026-09-20T08:00:00.000Z" },
            observacoes:       { type: "string", nullable: true, description: "Observações (máx 500 caracteres)" },
            finalizar:         { type: "boolean", default: false, description: "Encerra o rebanho mesmo que sobrem cabeças no cadastro. A saída da quantidade inteira finaliza sem este campo." },
            precoArroba:       { type: "number", minimum: 0, exclusiveMinimum: true, nullable: true, description: "Preço da arroba (R$). **Obrigatório em Venda**; recusado nos outros motivos.", example: 310.5 },
            pesoTotalKg:       { type: "number", minimum: 0, exclusiveMinimum: true, nullable: true, description: "Peso total vendido (kg). Opcional, só em Venda.", example: 5400 },
            valorTotal:        { type: "number", minimum: 0, exclusiveMinimum: true, nullable: true, description: "Valor total recebido (R$). **Obrigatório em Venda**; recusado nos outros motivos. É o valor real do negócio — pode divergir de peso/15 × arroba.", example: 110000 },
        },
        required: ["rebanhoId", "motivo", "quantidadeCabecas"],
        example: {
            rebanhoId: "d4e5f6a7-b8c9-0123-def0-123456789012",
            motivo: "Venda",
            quantidadeCabecas: 20,
            precoArroba: 310.5,
            pesoTotalKg: 5400,
            valorTotal: 110000,
            observacoes: "Venda para o frigorífico"
        }
    }
};

export default saidaRebanhoSchemas;
