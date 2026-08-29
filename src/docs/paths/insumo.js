// src/docs/paths/insumo.js

import commonResponses from "../schemas/swaggerCommonResponses.js";

// Envelope paginado no mesmo formato de CommonResponse ({ message, data, errors }),
// com `data` carregando os documentos e os metadados de paginação.
const listaPaginada = (itemRef, description = "Lista paginada") => ({
    description,
    content: {
        "application/json": {
            schema: {
                type: "object",
                properties: {
                    data: {
                        type: "object",
                        properties: {
                            docs: { type: "array", items: { $ref: itemRef } },
                            totalDocs: { type: "integer", example: 12 },
                            page: { type: "integer", example: 1 },
                            limit: { type: "integer", example: 10 },
                            totalPages: { type: "integer", example: 2 },
                        },
                    },
                    message: { type: "string", example: "Recursos encontrados." },
                    errors: { type: "array", example: [] },
                },
            },
        },
    },
});

const paginacaoParams = [
    { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 100 }, required: false, description: "Registros por página (máx 100)" },
    { name: "page", in: "query", schema: { type: "integer", default: 1 }, required: false, description: "Número da página" },
];

const atualizadoDesdeParam = {
    name: "atualizadoDesde", in: "query", schema: { type: "string", format: "date-time" }, required: false,
    description: "Leitura por diferença (ISO 8601 UTC): retira o filtro padrão de `ativo` e devolve registros vigentes e excluídos juntos, para o app detectar exclusões.",
};

const idParam = (nome) => ({
    name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: `UUID d${nome}`,
});

const insumoRoutes = {
    "/v1/insumos": {
        get: {
            tags: ["Insumos"],
            summary: "Lista os insumos do usuário autenticado",
            description: `
            + Caso de uso: Popular a tela de estoque de insumos da propriedade.

            + Função de Negócio:
                - Retorna lista paginada ordenada por nome.
                - Cada item traz \`tipoInsumo\`, \`propriedade\` e o pacote \`saldo\` (saldoReal, consumoProjetado, saldoProjetado, consumoDiaTotal, diasRestantes, previsaoTermino, esgotado, estoqueBaixo), calculado na leitura a partir do ledger e dos regimes ativos.
                + Filtros: **propriedadeId**, **tipoInsumoId**, **destino** (Pasto, Rebanho, Ambos), **nome**, **ativo**, **atualizadoDesde**.

            + Regras de Negócio:
                - Apenas insumos de propriedades do usuário logado.
                - Por padrão devolve só \`ativo: true\`; \`?ativo=false\` lista os excluídos.

            + Resultado Esperado:
                - HTTP 200 com lista paginada de **Insumo**.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: "propriedadeId", in: "query", schema: { type: "string", format: "uuid" }, required: false, description: "Filtrar por propriedade" },
                { name: "tipoInsumoId", in: "query", schema: { type: "string", format: "uuid" }, required: false, description: "Filtrar por tipo de insumo" },
                { name: "destino", in: "query", schema: { type: "string", enum: ["Pasto", "Rebanho", "Ambos"] }, required: false, description: "Filtrar por destino" },
                { name: "nome", in: "query", schema: { type: "string" }, required: false, description: "Filtrar por nome (case-insensitive, contém)" },
                { name: "ativo", in: "query", schema: { type: "boolean" }, required: false, description: "Filtrar por insumos vigentes (true) ou excluídos (false)" },
                atualizadoDesdeParam,
                ...paginacaoParams,
            ],
            responses: {
                200: listaPaginada("#/components/schemas/Insumo", "Lista paginada de insumos"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500](),
            },
        },
        post: {
            tags: ["Insumos"],
            summary: "Cadastra um novo insumo",
            description: `
            + Caso de uso: Registrar um insumo (ração, sal mineral, vacina, medicamento, fertilizante, semente, defensivo) da propriedade.

            + Regras de Negócio:
                - A propriedade informada deve existir e pertencer ao usuário logado.
                - O \`tipoInsumoId\` deve referenciar um item **ativo** do catálogo global \`tipos-insumo\`.
                - O \`nome\` é único (case-insensitive) entre os insumos **ativos** da mesma propriedade — conflito retorna 409.
                - \`destino\` deve ser um de: Pasto, Rebanho, Ambos. \`unidadeMedida\` um de: kg, g, L, mL, dose, saco, unidade.
                - Aceita \`id\` (UUID) opcional gerado pelo cliente offline; quando enviado, é preservado.
                - O estoque começa em zero — a quantidade inicial entra como uma movimentação de origem \`CadastroInicial\`.

            + Resultado Esperado:
                - HTTP 201 com o **Insumo** criado (já com o pacote \`saldo\`).
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/InsumoCreate" } } },
            },
            responses: {
                201: commonResponses[201]("#/components/schemas/Insumo"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                409: commonResponses[409](),
                500: commonResponses[500](),
            },
        },
    },

    "/v1/insumos/{id}": {
        get: {
            tags: ["Insumos"],
            summary: "Obtém um insumo por ID",
            description: "Retorna o **Insumo** com `tipoInsumo`, `propriedade` e o pacote `saldo` calculado na leitura.",
            security: [{ bearerAuth: [] }],
            parameters: [idParam("o Insumo")],
            responses: {
                200: commonResponses[200]("#/components/schemas/Insumo"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500](),
            },
        },
        patch: {
            tags: ["Insumos"],
            summary: "Atualiza parcialmente um insumo",
            description: `
            + Atualiza campos do insumo (\`tipoInsumoId\`, \`nome\`, \`destino\`, \`unidadeMedida\`, \`estoqueMinimo\`, \`ativo\`).
            + Pelo menos um campo deve ser enviado.
            + Trocar o \`nome\` revalida a unicidade por propriedade (409 em conflito).
            + Enviar \`ativo: false\` inativa o insumo (equivale ao DELETE); \`ativo: true\` reativa.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [idParam("o Insumo")],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/InsumoUpdate" } } },
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/Insumo"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                409: commonResponses[409](),
                500: commonResponses[500](),
            },
        },
        delete: {
            tags: ["Insumos"],
            summary: "Exclui (inativa) um insumo",
            description: "Soft-delete: marca `ativo: false`. A linha permanece no banco para a leitura por diferença reportar a exclusão. O ledger de movimentações não é afetado.",
            security: [{ bearerAuth: [] }],
            parameters: [idParam("o Insumo")],
            responses: {
                200: commonResponses[200](),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500](),
            },
        },
    },

    "/v1/insumos/movimentacoes": {
        get: {
            tags: ["Insumos"],
            summary: "Lista as movimentações de estoque de um insumo",
            description: `
            + Caso de uso: Consultar o extrato (ledger) de um insumo.

            + Regras de Negócio:
                - **\`insumoId\` é obrigatório** na query — sem ele retorna 400.
                - O insumo deve pertencer ao usuário logado.
                - Lista paginada ordenada por \`data\` decrescente.
                + Filtros: **insumoId** (obrigatório), **tipo** (Entrada, Saida, Ajuste), **origem**, **dataInicio**, **dataFim**, **ativo**, **atualizadoDesde**.

            + Resultado Esperado:
                - HTTP 200 com lista paginada de **MovimentacaoInsumo**.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: "insumoId", in: "query", required: true, schema: { type: "string", format: "uuid" }, description: "UUID do insumo (obrigatório)" },
                { name: "tipo", in: "query", schema: { type: "string", enum: ["Entrada", "Saida", "Ajuste"] }, required: false, description: "Filtrar por tipo" },
                { name: "origem", in: "query", schema: { type: "string" }, required: false, description: "Filtrar por origem" },
                { name: "dataInicio", in: "query", schema: { type: "string", format: "date-time" }, required: false, description: "Movimentações a partir desta data" },
                { name: "dataFim", in: "query", schema: { type: "string", format: "date-time" }, required: false, description: "Movimentações até esta data" },
                { name: "ativo", in: "query", schema: { type: "boolean" }, required: false, description: "Filtrar por movimentações vigentes (true) ou excluídas (false)" },
                atualizadoDesdeParam,
                ...paginacaoParams,
            ],
            responses: {
                200: listaPaginada("#/components/schemas/MovimentacaoInsumo", "Lista paginada de movimentações de insumo"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500](),
            },
        },
        post: {
            tags: ["Insumos"],
            summary: "Registra uma movimentação avulsa de estoque",
            description: `
            + Caso de uso: Lançar entrada (compra, cadastro inicial), saída (consumo, perda) ou ajuste (contagem física) de estoque.

            + Regras de Negócio:
                - O insumo deve pertencer ao usuário logado.
                - \`tipo\`: Entrada, Saida ou Ajuste.
                - \`origem\` **restrita** neste endpoint a: Compra, CadastroInicial, ConsumoRebanho, AjusteContagem, Perda. As origens **ManejoRebanho** e **ManejoPasto** não são aceitas aqui — só nascem pelo fluxo de manejo (itens de insumo no POST de manejo).
                - \`quantidade\` > 0 para Entrada/Saida; em Ajuste aceita valor negativo (contagem para baixo); nunca zero.
                - \`data\` não pode ser no futuro.
                - Uma movimentação de origem \`AjusteContagem\` funciona como marco de reconciliação: a projeção de consumo dos regimes zera a partir dessa data.
                - Recurso **imutável**: não há PATCH; a exclusão é soft-delete.
                - Aceita \`id\` (UUID) opcional gerado pelo cliente offline.

            + Resultado Esperado:
                - HTTP 201 com a **MovimentacaoInsumo** criada.
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/MovimentacaoInsumoCreate" } } },
            },
            responses: {
                201: commonResponses[201]("#/components/schemas/MovimentacaoInsumo"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500](),
            },
        },
    },

    "/v1/insumos/movimentacoes/{id}": {
        get: {
            tags: ["Insumos"],
            summary: "Obtém uma movimentação de insumo por ID",
            security: [{ bearerAuth: [] }],
            parameters: [idParam("a Movimentação de Insumo")],
            responses: {
                200: commonResponses[200]("#/components/schemas/MovimentacaoInsumo"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500](),
            },
        },
        delete: {
            tags: ["Insumos"],
            summary: "Exclui (inativa) uma movimentação de insumo",
            description: "Soft-delete: marca `ativo: false`. A movimentação deixa de contar no saldo, mas a linha permanece no banco para a leitura por diferença.",
            security: [{ bearerAuth: [] }],
            parameters: [idParam("a Movimentação de Insumo")],
            responses: {
                200: commonResponses[200](),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500](),
            },
        },
    },

    "/v1/rebanhos/regimes-consumo": {
        get: {
            tags: ["Insumos"],
            summary: "Lista os regimes de consumo diário de insumo",
            description: `
            + Caso de uso: Ver o consumo diário recorrente de insumos por rebanho.

            + Regras de Negócio:
                - Apenas regimes de rebanhos de propriedades do usuário logado.
                - Lista paginada ordenada por \`dataInicio\` decrescente.
                + Filtros: **rebanhoId**, **insumoId**, **emAberto** (\`true\` = só os com \`dataFim\` nula), **ativo**, **atualizadoDesde**.

            + Resultado Esperado:
                - HTTP 200 com lista paginada de **RegimeConsumoInsumo**.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: "rebanhoId", in: "query", schema: { type: "string", format: "uuid" }, required: false, description: "Filtrar por rebanho" },
                { name: "insumoId", in: "query", schema: { type: "string", format: "uuid" }, required: false, description: "Filtrar por insumo" },
                { name: "emAberto", in: "query", schema: { type: "boolean" }, required: false, description: "`true` devolve só os regimes em aberto (sem `dataFim`)" },
                { name: "ativo", in: "query", schema: { type: "boolean" }, required: false, description: "Filtrar por regimes vigentes (true) ou encerrados (false)" },
                atualizadoDesdeParam,
                ...paginacaoParams,
            ],
            responses: {
                200: listaPaginada("#/components/schemas/RegimeConsumoInsumo", "Lista paginada de regimes de consumo"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500](),
            },
        },
        post: {
            tags: ["Insumos"],
            summary: "Cria um regime de consumo diário de insumo",
            description: `
            + Caso de uso: Registrar que um rebanho consome uma quantidade fixa de um insumo por dia.

            + Regras de Negócio:
                - O rebanho deve existir e pertencer ao usuário logado.
                - O insumo deve ser da **mesma propriedade** do rebanho e ter \`destino\` \`Rebanho\` ou \`Ambos\`.
                - \`quantidadeDia\` > 0. \`dataInicio\` <= \`dataFim\` quando \`dataFim\` for informada.
                - **Um regime em aberto por par (rebanho, insumo)**: criar um novo para um par que já tem regime em aberto **encerra o anterior** (\`dataFim\` = \`dataInicio\` do novo, \`ativo\` = false) na mesma transação.
                - O regime **nunca escreve no ledger**; ele só alimenta o cálculo de \`saldoProjetado\` e \`previsaoTermino\` na leitura do insumo.
                - Aceita \`id\` (UUID) opcional gerado pelo cliente offline.

            + Resultado Esperado:
                - HTTP 201 com o **RegimeConsumoInsumo** criado.
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/RegimeConsumoInsumoCreate" } } },
            },
            responses: {
                201: commonResponses[201]("#/components/schemas/RegimeConsumoInsumo"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500](),
            },
        },
    },

    "/v1/rebanhos/regimes-consumo/{id}": {
        get: {
            tags: ["Insumos"],
            summary: "Obtém um regime de consumo por ID",
            security: [{ bearerAuth: [] }],
            parameters: [idParam("o Regime de Consumo")],
            responses: {
                200: commonResponses[200]("#/components/schemas/RegimeConsumoInsumo"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500](),
            },
        },
        patch: {
            tags: ["Insumos"],
            summary: "Atualiza parcialmente um regime de consumo",
            description: "Aceita `quantidadeDia` e `dataFim`. Enviar `dataFim` encerra o regime (`ativo: false`).",
            security: [{ bearerAuth: [] }],
            parameters: [idParam("o Regime de Consumo")],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                quantidadeDia: { type: "number", exclusiveMinimum: 0, description: "Nova quantidade diária (> 0)", example: 6 },
                                dataFim: { type: "string", format: "date-time", nullable: true, description: "Data de encerramento do regime. Enviar encerra o regime (`ativo: false`).", example: "2026-09-30T00:00:00.000Z" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/RegimeConsumoInsumo"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500](),
            },
        },
        delete: {
            tags: ["Insumos"],
            summary: "Encerra e inativa um regime de consumo",
            description: "Exclusão lógica: marca `ativo: false` e preenche `dataFim` com o momento atual. A partir daí o regime deixa de contar no `consumoDiaTotal` e na projeção.",
            security: [{ bearerAuth: [] }],
            parameters: [idParam("o Regime de Consumo")],
            responses: {
                200: commonResponses[200](),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500](),
            },
        },
    },
};

export default insumoRoutes;
