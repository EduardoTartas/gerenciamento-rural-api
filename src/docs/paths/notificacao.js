// src/docs/paths/notificacao.js

import commonResponses from "../schemas/swaggerCommonResponses.js";

const idParam = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };

const notificacaoRoutes = {
    "/v1/notificacoes": {
        get: {
            tags: ["Notificações"],
            summary: "Lista a caixa de notificações do usuário",
            description: `
            + Caso de uso: O app lê os avisos da fazenda (pasto pronto, insumo acabando, ocupação longa, lotação alta) para a caixa de notificações.

            + Regras de Negócio:
                - Só as notificações do usuário autenticado, da mais nova para a mais antiga.
                - Por padrão só as ativas; **atualizadoDesde** devolve tudo o que mudou depois do instante (leitura por diferença, inclusive lidas).
                - **naoLidas** conta as ativas não lidas do usuário, independente dos filtros (badge do sino).
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: "lida", in: "query", schema: { type: "string", enum: ["true", "false"] }, required: false },
                { name: "propriedadeId", in: "query", schema: { type: "string", format: "uuid" }, required: false },
                { name: "atualizadoDesde", in: "query", schema: { type: "string", format: "date-time" }, required: false, description: "Leitura por diferença (ISO 8601 UTC)" },
                { name: "page", in: "query", schema: { type: "integer", default: 1 }, required: false },
                { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 100 }, required: false },
            ],
            responses: {
                200: commonResponses[200]("#/components/schemas/NotificacaoLista"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500](),
            },
        },
    },
    "/v1/notificacoes/{id}": {
        get: {
            tags: ["Notificações"],
            summary: "Detalha uma notificação",
            security: [{ bearerAuth: [] }],
            parameters: [idParam],
            responses: {
                200: commonResponses[200]("#/components/schemas/Notificacao"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
            },
        },
        patch: {
            tags: ["Notificações"],
            summary: "Marca uma notificação como lida (ou não lida)",
            description: `
            + Regras de Negócio:
                - Aceita só **lida**. Notificação de outro usuário ou inexistente: 404.
                - Avança **updatedAt**: a leitura por diferença leva a marcação aos outros aparelhos.
                - No /sync: **notificacoes:UPDATE** com { lida }.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [idParam],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/NotificacaoUpdate" } } },
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/Notificacao"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
            },
        },
    },
    "/v1/notificacoes/lidas": {
        patch: {
            tags: ["Notificações"],
            summary: "Marca todas as notificações como lidas",
            description: `
            + Regras de Negócio:
                - Marca as ativas não lidas do usuário; com **propriedadeId**, só as daquela fazenda.
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: false,
                content: { "application/json": { schema: { $ref: "#/components/schemas/NotificacaoLidas" } } },
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/NotificacaoLidasResultado"),
                400: commonResponses[400](),
                401: commonResponses[401](),
            },
        },
    },
    "/v1/notificacoes/verificar": {
        post: {
            tags: ["Notificações"],
            summary: "Roda a verificação dos avisos agora, só para o usuário autenticado",
            description: `
            + Caso de uso: disparo manual (testes e demonstração) da verificação que o servidor faz periodicamente.

            + Regras de Negócio:
                - Avalia só as fazendas do usuário autenticado. Abre as situações novas, encerra as resolvidas e envia o push das pendentes.
                - Ignora o horário de silêncio (push só entre 6h e 21h, fuso America/Cuiaba) que vale para a verificação periódica.
                - Idempotente: chamar de novo não duplica notificação nem push.
            `,
            security: [{ bearerAuth: [] }],
            responses: {
                200: commonResponses[200]("#/components/schemas/VerificacaoResultado"),
                401: commonResponses[401](),
            },
        },
    },
    "/v1/dispositivos/registrar": {
        post: {
            tags: ["Notificações"],
            summary: "Registra o aparelho para receber push",
            description: `
            + Regras de Negócio:
                - Repassa o token FCM ao NPaaS, vinculado ao usuário autenticado.
                - Falha ou ausência do NPaaS não é erro: responde 200 com **registrado: false**. Os avisos continuam na caixa.
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/DispositivoRegistrar" } } },
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/DispositivoRegistrarResultado"),
                400: commonResponses[400](),
                401: commonResponses[401](),
            },
        },
    },
    "/v1/dispositivos/desativar-token": {
        post: {
            tags: ["Notificações"],
            summary: "Desativa o token do aparelho (logout)",
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/DispositivoDesativar" } } },
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/DispositivoDesativarResultado"),
                400: commonResponses[400](),
                401: commonResponses[401](),
            },
        },
    },
};

export default notificacaoRoutes;
