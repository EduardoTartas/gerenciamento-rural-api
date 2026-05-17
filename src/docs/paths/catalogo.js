// src/docs/paths/catalogo.js

import commonResponses from "../schemas/swaggerCommonResponses.js";
import catalogoSchemas from "../schemas/catalogoSchema.js";
import { generateParameters } from "./utils/generateParameters.js";

const entidadesDisponiveis = "racas | sistemas-producao | regimes-alimentares | tipos-manejo-rebanho | tipos-manejo-pasto";

const catalogoRoutes = {
    "/catalogos/{entidade}": {
        get: {
            tags: ["Catálogos Globais"],
            summary: "Lista itens de um catálogo global",
            description: `
            + **Entidades disponíveis para :entidade**:
                - \`racas\` — Raças de gado (ex: Nelore, Angus, Brahman)
                - \`sistemas-producao\` — Sistemas de produção (ex: Cria, Recria, Engorda)
                - \`regimes-alimentares\` — Regimes alimentares (ex: Pasto, Confinamento, Semi-confinamento)
                - \`tipos-manejo-rebanho\` — Tipos de manejo de rebanho (ex: Vacinação, Pesagem)
                - \`tipos-manejo-pasto\` — Tipos de manejo de pasto (ex: Roçagem, Adubação)

            + Regras de Negócio:
                - Requer sessão autenticada válida.
                - Retorna apenas itens **ativos** por padrão (filtre com ativo=false para ver inativos).
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: "entidade",
                    in: "path",
                    required: true,
                    schema: { type: "string", enum: entidadesDisponiveis.split(" | ") },
                    description: "Nome da entidade de catálogo"
                },
                {
                    name: "nome", in: "query",
                    schema: { type: "string" },
                    required: false, description: "Filtrar por nome"
                },
                {
                    name: "ativo", in: "query",
                    schema: { type: "boolean" },
                    required: false, description: "Filtrar por status ativo/inativo"
                },
                {
                    name: "limit", in: "query",
                    schema: { type: "integer", default: 10, maximum: 100 },
                    required: false, description: "Registros por página (máx 100)"
                },
                {
                    name: "page", in: "query",
                    schema: { type: "integer", default: 1 },
                    required: false, description: "Número da página"
                }
            ],
            responses: {
                200: commonResponses[200]("#/components/schemas/CatalogoPaginatedList"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        },
        post: {
            tags: ["Catálogos Globais"],
            summary: "Cria um novo item de catálogo global",
            description: `
            + Cria um novo item no catálogo especificado em **:entidade**.
            + Entidades: ${entidadesDisponiveis}
            + O nome deve ser único (case-insensitive) dentro do catálogo.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{
                name: "entidade", in: "path", required: true,
                schema: { type: "string", enum: entidadesDisponiveis.split(" | ") }, description: "Nome da entidade de catálogo"
            }],
            requestBody: {
                content: { "application/json": { schema: { $ref: "#/components/schemas/CatalogoCreate" } } }
            },
            responses: {
                201: commonResponses[201]("#/components/schemas/CatalogoItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        }
    },

    "/catalogos/{entidade}/{id}": {
        get: {
            tags: ["Catálogos Globais"],
            summary: "Obtém um item de catálogo por ID",
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: "entidade", in: "path", required: true, schema: { type: "string", enum: entidadesDisponiveis.split(" | ") }, description: "Nome da entidade de catálogo" },
                { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "UUID do item" }
            ],
            responses: {
                200: commonResponses[200]("#/components/schemas/CatalogoItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        },
        patch: {
            tags: ["Catálogos Globais"],
            summary: "Atualiza um item de catálogo",
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: "entidade", in: "path", required: true, schema: { type: "string", enum: entidadesDisponiveis.split(" | ") }, description: "Nome da entidade de catálogo" },
                { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
            ],
            requestBody: {
                content: { "application/json": { schema: { $ref: "#/components/schemas/CatalogoPatch" } } }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/CatalogoItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        },
        delete: {
            tags: ["Catálogos Globais"],
            summary: "Remove (inativa) um item de catálogo",
            description: "Soft-delete. Falha com 409 se o item estiver vinculado a rebanhos ou manejos.",
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: "entidade", in: "path", required: true, schema: { type: "string", enum: entidadesDisponiveis.split(" | ") }, description: "Nome da entidade de catálogo" },
                { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }
            ],
            responses: {
                200: commonResponses[200](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        }
    }
};

export default catalogoRoutes;
