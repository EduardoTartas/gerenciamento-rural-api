// src/docs/paths/rebanho.js

import commonResponses from "../schemas/swaggerCommonResponses.js";
import rebanhoSchemas from "../schemas/rebanhoSchema.js";
import { generateParameters } from "./utils/generateParameters.js";

const rebanhoRoutes = {
    "/rebanhos": {
        get: {
            tags: ["Rebanhos"],
            summary: "Lista todos os rebanhos do usuário autenticado",
            description: `
            + Caso de uso: Permite que um usuário autenticado liste todos os rebanhos (lotes) de suas propriedades.

            + Função de Negócio:
                - Retorna lista paginada de rebanhos ativos (por padrão).
                + Filtros disponíveis:
                    • **nomeRebanho**: busca parcial, não sensível a maiúsculas.
                    • **propriedadeId**: filtrar por propriedade.
                    • **pastoAtualId**: filtrar por pasto ocupado.
                    • **racaId / sistemaProducaoId / regimeAlimentarId**: filtrar por catálogos.
                    • **ativo**: true (padrão) ou false para ver inativos.

            + Regras de Negócio:
                - Apenas rebanhos das propriedades do usuário logado são retornados.
                - O nome do rebanho é único por propriedade **apenas entre rebanhos ativos**
                  (rebanhos inativados liberam o nome para reutilização).

            + Resultado Esperado:
                - HTTP 200 com **RebanhoPaginatedList**.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                ...generateParameters(rebanhoSchemas.RebanhoFilter),
                { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 100 }, required: false, description: "Registros por página (máx 100)" },
                { name: "page",  in: "query", schema: { type: "integer", default: 1 }, required: false, description: "Número da página" }
            ],
            responses: {
                200: commonResponses[200]("#/components/schemas/RebanhoPaginatedList"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500]()
            }
        },
        post: {
            tags: ["Rebanhos"],
            summary: "Cria um novo rebanho",
            description: `
            + Caso de uso: Cadastrar um novo lote/rebanho em uma propriedade do usuário.

            + Função de Negócio:
                - Cria o rebanho vinculado à propriedade informada.
                - Se **pastoAtualId** for informado:
                    • Valida que o pasto pertence à mesma propriedade e está ativo.
                    • Atualiza o status do pasto para **"Ocupado"** automaticamente.
                    • Preenche **dataEntradaPastoAtual** com a data atual (se não informada).
                - Todos os campos de catálogo (racaId, sistemaProducaoId, etc.) são opcionais e referenciam os catálogos globais.

            + Regras de Negócio:
                - A propriedade deve existir, estar ativa e pertencer ao usuário.
                - **nomeRebanho** deve ser único na propriedade entre rebanhos ativos.

            + Resultado Esperado:
                - HTTP 201 com **RebanhoListItem** do rebanho criado.
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/RebanhoCreate" } } }
            },
            responses: {
                201: commonResponses[201]("#/components/schemas/RebanhoListItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        }
    },

    "/rebanhos/{id}": {
        get: {
            tags: ["Rebanhos"],
            summary: "Obtém detalhes de um rebanho por ID",
            description: `
            + Retorna todos os dados do rebanho incluindo raça, categoria, sistema de produção, regime alimentar e pasto atual.
            + Retorna 404 se o rebanho não for encontrado ou não pertencer ao usuário.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "UUID do Rebanho" }],
            responses: {
                200: commonResponses[200]("#/components/schemas/RebanhoListItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        },
        patch: {
            tags: ["Rebanhos"],
            summary: "Atualiza parcialmente um rebanho",
            description: `
            + Atualiza campos do rebanho como nome, quantidade de cabeças, peso médio e referências aos catálogos.
            + Para **mover o rebanho entre pastos**, utilize a rota **POST /rebanhos/movimentacoes** que garante o histórico e a consistência dos status dos pastos.
            + Pelo menos um campo deve ser fornecido.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "UUID do Rebanho" }],
            requestBody: {
                required: true,
                content: { "application/json": { schema: { $ref: "#/components/schemas/RebanhoPatch" } } }
            },
            responses: {
                200: commonResponses[200]("#/components/schemas/RebanhoListItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                409: commonResponses[409](),
                500: commonResponses[500]()
            }
        },
        delete: {
            tags: ["Rebanhos"],
            summary: "Inativa (soft-delete) um rebanho",
            description: `
            + **Soft-delete**: o rebanho é marcado como inativo (\`ativo: false\`), não é excluído fisicamente.
            + Efeitos automáticos:
                - O campo **pastoAtualId** é definido como \`null\`.
                - O **dataEntradaPastoAtual** é limpo.
                - Se o pasto de origem ficar sem outros rebanhos ativos, seu status volta para **"Vazio"** e **dataUltimaSaida** é preenchida.
            + Após a inativação, o **nomeRebanho** fica livre para ser reutilizado na mesma propriedade.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" }, description: "UUID do Rebanho" }],
            responses: {
                200: commonResponses[200]("#/components/schemas/RebanhoListItem"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500]()
            }
        }
    }
};

export default rebanhoRoutes;
