// src/docs/schemas/insumoSchema.js

const destinosInsumo = ["Pasto", "Rebanho", "Ambos"];
const unidadesMedida = ["kg", "g", "L", "mL", "dose", "saco", "unidade"];
const tiposMovimentacao = ["Entrada", "Saida", "Ajuste"];
// Conjunto completo aceito pela coluna do ledger. O POST avulso de
// /v1/insumos/movimentacoes só aceita as 5 origens que não vêm de manejo
// (ManejoRebanho e ManejoPasto nascem apenas pelo fluxo de manejo).
const origensMovimentacao = ["Compra", "CadastroInicial", "ManejoRebanho", "ManejoPasto", "ConsumoRebanho", "AjusteContagem", "Perda"];
const origensMovimentacaoAvulsa = ["Compra", "CadastroInicial", "ConsumoRebanho", "AjusteContagem", "Perda"];

const insumoSchemas = {
    SaldoInsumo: {
        type: "object",
        description: "Pacote de saldo calculado na leitura do insumo a partir do ledger e dos regimes de consumo ativos. Nunca é materializado no banco.",
        properties: {
            saldoReal: { type: "number", example: 120, description: "Soma do ledger: Σ(Entrada) − Σ(Saída) + Σ(Ajuste com sinal). Número de registro." },
            consumoProjetado: { type: "number", example: 45, description: "Consumo dos regimes ainda não lançado no ledger, contado desde a última contagem física (movimentação de origem `AjusteContagem`) ou desde o início de cada regime, o que for mais recente." },
            saldoProjetado: { type: "number", example: 75, description: "`saldoReal − consumoProjetado`. É o número que o app usa para alertar estoque baixo." },
            consumoDiaTotal: { type: "number", example: 5, description: "Soma de `quantidadeDia` dos regimes vigentes hoje para este insumo." },
            diasRestantes: { type: "number", nullable: true, example: 15, description: "`saldoProjetado / consumoDiaTotal`. `null` quando não há consumo diário." },
            previsaoTermino: { type: "string", format: "date-time", nullable: true, example: "2026-09-12T00:00:00.000Z", description: "Data prevista de término do estoque. `null` quando não há consumo diário ou quando o insumo já está esgotado." },
            esgotado: { type: "boolean", example: false, description: "`true` quando `saldoProjetado <= 0`." },
            estoqueBaixo: { type: "boolean", example: false, description: "`true` quando há `estoqueMinimo` definido e `saldoProjetado <= estoqueMinimo`." },
        },
    },

    Insumo: {
        type: "object",
        description: "Insumo da propriedade com o pacote de saldo anexado na leitura.",
        properties: {
            id: { type: "string", format: "uuid", example: "d4e5f6a7-b8c9-0123-def4-234567890123" },
            propriedadeId: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            tipoInsumoId: { type: "string", format: "uuid", example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
            nome: { type: "string", example: "Ração proteinada 20%" },
            destino: { type: "string", enum: destinosInsumo, example: "Rebanho", description: "Onde o insumo pode ser consumido: `Pasto`, `Rebanho` ou `Ambos`." },
            unidadeMedida: { type: "string", enum: unidadesMedida, example: "kg" },
            estoqueMinimo: { type: "number", nullable: true, example: 50, description: "Limiar opcional de alerta. Quando definido, `saldo.estoqueBaixo` fica `true` se `saldoProjetado <= estoqueMinimo`." },
            ativo: { type: "boolean", example: true, description: "`false` quando o insumo foi excluído (soft-delete). Numa leitura por diferença é o que distingue a linha excluída de uma vigente." },
            createdAt: { type: "string", format: "date-time", example: "2026-08-01T10:00:00.000Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-08-20T14:30:00.000Z", description: "Marca d'água da sincronização: o cliente usa o maior valor recebido como próximo `atualizadoDesde`." },
            tipoInsumo: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid", example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
                    nome: { type: "string", example: "Ração" },
                },
            },
            propriedade: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
                    nome: { type: "string", example: "Fazenda Boa Esperança" },
                },
            },
            saldo: { $ref: "#/components/schemas/SaldoInsumo" },
        },
    },

    InsumoCreate: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", description: "UUID opcional gerado pelo cliente offline. Quando enviado, é preservado.", example: "d4e5f6a7-b8c9-0123-def4-234567890123" },
            propriedadeId: { type: "string", format: "uuid", description: "UUID da propriedade dona do insumo. Deve pertencer ao usuário autenticado.", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            tipoInsumoId: { type: "string", format: "uuid", description: "UUID de um item ativo do catálogo global `tipos-insumo`.", example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
            nome: { type: "string", minLength: 2, maxLength: 120, description: "Nome do insumo. Único (case-insensitive) entre os insumos ativos da mesma propriedade.", example: "Ração proteinada 20%" },
            destino: { type: "string", enum: destinosInsumo, description: "Onde o insumo pode ser consumido.", example: "Rebanho" },
            unidadeMedida: { type: "string", enum: unidadesMedida, description: "Unidade de medida do estoque.", example: "kg" },
            estoqueMinimo: { type: "number", minimum: 0, nullable: true, description: "Limiar opcional de alerta de estoque baixo.", example: 50 },
        },
        required: ["propriedadeId", "tipoInsumoId", "nome", "destino", "unidadeMedida"],
        description: "Esquema para criação de insumo. Enums: destino (Pasto, Rebanho, Ambos); unidadeMedida (kg, g, L, mL, dose, saco, unidade).",
        example: {
            propriedadeId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            tipoInsumoId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
            nome: "Ração proteinada 20%",
            destino: "Rebanho",
            unidadeMedida: "kg",
            estoqueMinimo: 50,
        },
    },

    InsumoUpdate: {
        type: "object",
        properties: {
            tipoInsumoId: { type: "string", format: "uuid", description: "Novo item do catálogo `tipos-insumo`.", example: "b2c3d4e5-f6a7-8901-bcde-f12345678901" },
            nome: { type: "string", minLength: 2, maxLength: 120, example: "Ração proteinada 24%" },
            destino: { type: "string", enum: destinosInsumo, example: "Ambos" },
            unidadeMedida: { type: "string", enum: unidadesMedida, example: "saco" },
            estoqueMinimo: { type: "number", minimum: 0, nullable: true, example: 30 },
            ativo: { type: "boolean", description: "Enviar `false` inativa o insumo (equivale ao DELETE); `true` reativa.", example: true },
        },
        required: [],
        description: "Esquema para atualização parcial de insumo. Pelo menos um campo deve ser enviado.",
        example: { nome: "Ração proteinada 24%", estoqueMinimo: 30 },
    },

    MovimentacaoInsumo: {
        type: "object",
        description: "Evento do ledger de estoque. Imutável — não há atualização.",
        properties: {
            id: { type: "string", format: "uuid", example: "e5f6a7b8-c9d0-1234-ef56-345678901234" },
            insumoId: { type: "string", format: "uuid", example: "d4e5f6a7-b8c9-0123-def4-234567890123" },
            tipo: { type: "string", enum: tiposMovimentacao, example: "Entrada", description: "`Entrada` soma, `Saida` subtrai, `Ajuste` entra com o sinal informado." },
            quantidade: { type: "number", example: 100, description: "Positiva em `Entrada`/`Saida`; assinada (+/-) em `Ajuste`. Nunca zero." },
            data: { type: "string", format: "date-time", example: "2026-08-10T00:00:00.000Z", description: "Data do evento. Não pode ser no futuro." },
            origem: { type: "string", enum: origensMovimentacao, example: "Compra", description: "Motivo do lançamento. `ManejoRebanho` e `ManejoPasto` só aparecem em movimentações geradas pelo fluxo de manejo." },
            manejoRebanhoId: { type: "string", format: "uuid", nullable: true, example: null, description: "Preenchido quando a movimentação foi gerada por um item de manejo de rebanho." },
            manejoPastoId: { type: "string", format: "uuid", nullable: true, example: null, description: "Preenchido quando a movimentação foi gerada por um item de manejo de pasto." },
            rebanhoId: { type: "string", format: "uuid", nullable: true, example: null, description: "Rebanho que consumiu o insumo, quando aplicável." },
            pastoId: { type: "string", format: "uuid", nullable: true, example: null, description: "Pasto que consumiu o insumo, quando aplicável." },
            observacoes: { type: "string", nullable: true, maxLength: 500, example: "Nota fiscal 12345" },
            ativo: { type: "boolean", example: true, description: "`false` quando a movimentação foi excluída (soft-delete)." },
            createdAt: { type: "string", format: "date-time", example: "2026-08-10T09:00:00.000Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-08-10T09:00:00.000Z" },
            insumo: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid", example: "d4e5f6a7-b8c9-0123-def4-234567890123" },
                    nome: { type: "string", example: "Ração proteinada 20%" },
                    unidadeMedida: { type: "string", enum: unidadesMedida, example: "kg" },
                },
            },
        },
    },

    MovimentacaoInsumoCreate: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", description: "UUID opcional gerado pelo cliente offline.", example: "e5f6a7b8-c9d0-1234-ef56-345678901234" },
            insumoId: { type: "string", format: "uuid", description: "UUID do insumo. Deve pertencer ao usuário autenticado.", example: "d4e5f6a7-b8c9-0123-def4-234567890123" },
            tipo: { type: "string", enum: tiposMovimentacao, description: "Tipo do evento.", example: "Entrada" },
            quantidade: { type: "number", description: "Deve ser > 0 para `Entrada`/`Saida`. Em `Ajuste` aceita valor negativo (contagem física para baixo). Nunca zero.", example: 100 },
            data: { type: "string", format: "date-time", description: "Data do evento. Não pode ser no futuro.", example: "2026-08-10T00:00:00.000Z" },
            origem: { type: "string", enum: origensMovimentacaoAvulsa, description: "Origem do lançamento avulso. `ManejoRebanho` e `ManejoPasto` não são aceitas aqui — só nascem pelo fluxo de manejo.", example: "Compra" },
            rebanhoId: { type: "string", format: "uuid", nullable: true, description: "Rebanho que consumiu o insumo (opcional).", example: null },
            pastoId: { type: "string", format: "uuid", nullable: true, description: "Pasto que consumiu o insumo (opcional).", example: null },
            observacoes: { type: "string", nullable: true, maxLength: 500, example: "Nota fiscal 12345" },
        },
        required: ["insumoId", "tipo", "quantidade", "data", "origem"],
        description: "Esquema para criação de movimentação avulsa. Enums: tipo (Entrada, Saida, Ajuste); origem (Compra, CadastroInicial, ConsumoRebanho, AjusteContagem, Perda).",
        example: {
            insumoId: "d4e5f6a7-b8c9-0123-def4-234567890123",
            tipo: "Entrada",
            quantidade: 100,
            data: "2026-08-10T00:00:00.000Z",
            origem: "Compra",
            observacoes: "Nota fiscal 12345",
        },
    },

    RegimeConsumoInsumo: {
        type: "object",
        description: "Consumo diário recorrente de um insumo por um rebanho. Nunca escreve no ledger; alimenta apenas a projeção de saldo.",
        properties: {
            id: { type: "string", format: "uuid", example: "f6a7b8c9-d0e1-2345-f678-456789012345" },
            rebanhoId: { type: "string", format: "uuid", example: "c3d4e5f6-a7b8-9012-cdef-123456789012" },
            insumoId: { type: "string", format: "uuid", example: "d4e5f6a7-b8c9-0123-def4-234567890123" },
            quantidadeDia: { type: "number", example: 5, description: "Quantidade consumida por dia, na unidade do insumo. Sempre > 0." },
            dataInicio: { type: "string", format: "date-time", example: "2026-08-01T00:00:00.000Z" },
            dataFim: { type: "string", format: "date-time", nullable: true, example: null, description: "`null` enquanto o regime está em aberto. Preenchida quando o regime é encerrado." },
            ativo: { type: "boolean", example: true, description: "`false` quando o regime foi encerrado (pelo produtor ou por um novo regime do mesmo par)." },
            createdAt: { type: "string", format: "date-time", example: "2026-08-01T08:00:00.000Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-08-01T08:00:00.000Z" },
            insumo: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid", example: "d4e5f6a7-b8c9-0123-def4-234567890123" },
                    nome: { type: "string", example: "Ração proteinada 20%" },
                    unidadeMedida: { type: "string", enum: unidadesMedida, example: "kg" },
                },
            },
            rebanho: {
                type: "object",
                properties: {
                    id: { type: "string", format: "uuid", example: "c3d4e5f6-a7b8-9012-cdef-123456789012" },
                    nomeRebanho: { type: "string", example: "Lote Recria 2026" },
                },
            },
        },
    },

    RegimeConsumoInsumoCreate: {
        type: "object",
        properties: {
            id: { type: "string", format: "uuid", description: "UUID opcional gerado pelo cliente offline.", example: "f6a7b8c9-d0e1-2345-f678-456789012345" },
            rebanhoId: { type: "string", format: "uuid", description: "UUID do rebanho que consome o insumo. Deve pertencer ao usuário autenticado.", example: "c3d4e5f6-a7b8-9012-cdef-123456789012" },
            insumoId: { type: "string", format: "uuid", description: "UUID do insumo consumido. Deve ser da mesma propriedade do rebanho e ter `destino` `Rebanho` ou `Ambos`.", example: "d4e5f6a7-b8c9-0123-def4-234567890123" },
            quantidadeDia: { type: "number", exclusiveMinimum: 0, description: "Quantidade consumida por dia, na unidade do insumo. Deve ser maior que zero.", example: 5 },
            dataInicio: { type: "string", format: "date-time", description: "Início da vigência do regime.", example: "2026-08-01T00:00:00.000Z" },
            dataFim: { type: "string", format: "date-time", nullable: true, description: "Fim opcional da vigência. Quando informada, deve ser >= `dataInicio`.", example: null },
        },
        required: ["rebanhoId", "insumoId", "quantidadeDia", "dataInicio"],
        description: "Esquema para criação de regime de consumo. Criar um regime para um par (rebanho, insumo) que já tem regime em aberto encerra o anterior (`dataFim` = `dataInicio` do novo, `ativo` = false) na mesma transação.",
        example: {
            rebanhoId: "c3d4e5f6-a7b8-9012-cdef-123456789012",
            insumoId: "d4e5f6a7-b8c9-0123-def4-234567890123",
            quantidadeDia: 5,
            dataInicio: "2026-08-01T00:00:00.000Z",
        },
    },
};

export default insumoSchemas;
