// src/docs/schemas/notificacaoSchema.js

const TIPOS = [
    "PASTO_PRONTO", "PASTO_PRONTO_AMANHA", "OCUPACAO_LONGA", "LOTACAO_ALTA", "LOTE_SEM_PASTO", "LOTE_SEM_PESAGEM",
    "INSUMO_ACABANDO", "INSUMO_ABAIXO_MINIMO", "INSUMO_ESGOTADO", "RESUMO_MES",
    // Dados faltando: só caixa, sem push.
    "PASTO_SEM_AREA", "LOTE_SEM_VALOR_COMPRA", "INSUMO_SEM_PRECO",
];

const notificacaoSchemas = {
    Notificacao: {
        type: "object",
        description: "Aviso da fazenda gerado pela verificação periódica do servidor",
        properties: {
            id: { type: "string", format: "uuid" },
            tipo: { type: "string", enum: TIPOS, example: "PASTO_PRONTO" },
            titulo: { type: "string", example: "Piquete 3 pronto para receber gado" },
            mensagem: { type: "string", example: "O descanso de 30 dias terminou. O pasto já pode receber um lote." },
            lida: { type: "boolean", example: false },
            lidaEm: { type: "string", format: "date-time", nullable: true },
            entidade: { type: "string", enum: ["pasto", "rebanho", "insumo", "propriedade"], nullable: true, example: "pasto" },
            entidadeId: { type: "string", format: "uuid", nullable: true },
            propriedadeId: { type: "string", format: "uuid", nullable: true },
            rota: { type: "string", nullable: true, example: "/pastos/2f6c1a9e-7d1b-4c3e-9a51-0f3b2d1e8c77", description: "Rota do app a abrir ao tocar no aviso" },
            ativo: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
        },
    },
    NotificacaoLista: {
        type: "object",
        properties: {
            docs: { type: "array", items: { $ref: "#/components/schemas/Notificacao" } },
            totalDocs: { type: "integer", example: 4 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 1 },
            naoLidas: { type: "integer", example: 2, description: "Notificações ativas não lidas do usuário (independe dos filtros)" },
        },
    },
    NotificacaoUpdate: {
        type: "object",
        required: ["lida"],
        additionalProperties: false,
        properties: { lida: { type: "boolean", example: true } },
    },
    NotificacaoLidas: {
        type: "object",
        additionalProperties: false,
        properties: { propriedadeId: { type: "string", format: "uuid", description: "Só as dessa fazenda; sem ele, todas" } },
    },
    NotificacaoLidasResultado: {
        type: "object",
        properties: { marcadas: { type: "integer", example: 3 } },
    },
    VerificacaoResultado: {
        type: "object",
        properties: {
            abertas: { type: "integer", example: 2, description: "Notificações novas" },
            resolvidas: { type: "integer", example: 1, description: "Situações que deixaram de valer" },
            enviadas: { type: "integer", example: 2, description: "Pushes enviados" },
            foraDoHorario: { type: "boolean", example: false },
        },
    },
    DispositivoRegistrar: {
        type: "object",
        required: ["tokenFcm"],
        additionalProperties: false,
        properties: {
            tokenFcm: { type: "string", example: "fcm-token-do-aparelho" },
            plataforma: { type: "string", enum: ["android", "ios"], default: "android" },
            versaoApp: { type: "string", example: "1.4.0" },
        },
    },
    DispositivoDesativar: {
        type: "object",
        required: ["tokenFcm"],
        additionalProperties: false,
        properties: { tokenFcm: { type: "string", example: "fcm-token-do-aparelho" } },
    },
    DispositivoRegistrarResultado: {
        type: "object",
        properties: {
            registrado: { type: "boolean", example: true },
            pushAtivo: { type: "boolean", example: true, description: "false quando o servidor está sem NPaaS configurado" },
        },
    },
    DispositivoDesativarResultado: {
        type: "object",
        properties: { desativado: { type: "boolean", example: true } },
    },
};

export default notificacaoSchemas;
