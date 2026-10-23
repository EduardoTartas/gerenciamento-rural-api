
import commonResponses from "../schemas/swaggerCommonResponses.js";

const idParam = (descricao) => ({
    name: "id", in: "path", required: true, description: descricao, schema: { type: "string", format: "uuid" },
});

const envio = (rotulo, idDescricao) => ({
    tags: ["Fotos de Atividade"],
    summary: `Envia uma foto do ${rotulo}`,
    description: `
            + Caso de uso: O produtor fotografa a atividade (no formulário ou na ficha) e o app sobe a foto quando o manejo já está sincronizado.

            + Função de Negócio:
                - Recebe multipart com **file** (jpg, jpeg ou png, até 10MB) e **id** opcional (UUID gerado no aparelho).
                - Recomprime: aplica a orientação do EXIF, limita o lado maior a 1600px sem cortar nem ampliar e reencoda em JPEG.
                - Grava o arquivo no bucket de fotos em \`atividades/<id>.jpeg\`.

            + Regras de Negócio:
                - Até **3 fotos ativas** por atividade: a quarta recebe 400 "Esta atividade já tem 3 fotos." (\`field: file\`).
                - Manejo inexistente ou de outro usuário: 404. Manejo excluído: 400.
                - **Idempotente:** o mesmo **id** já enviado para este manejo devolve **200** com a foto existente, sem subir de novo. O mesmo **id** em outra atividade: 409.
                - Falha do armazenamento: 503, nada é gravado.

            + Resultado Esperado:
                - HTTP 201 com **FotoAtividade** (ou 200 no reenvio).
            `,
    security: [{ bearerAuth: [] }],
    parameters: [idParam(idDescricao)],
    requestBody: {
        required: true,
        content: { "multipart/form-data": { schema: { $ref: "#/components/schemas/FotoAtividadeEnvio" } } },
    },
    responses: {
        200: commonResponses[200]("#/components/schemas/FotoAtividade", "Foto já enviada (reenvio idempotente)"),
        201: commonResponses[201]("#/components/schemas/FotoAtividade"),
        400: commonResponses[400](),
        401: commonResponses[401](),
        404: commonResponses[404](),
        409: commonResponses[409](),
        500: commonResponses[500](),
        503: commonResponses[503](),
    },
});

const fotoAtividadeRoutes = {
    "/v1/pastagens/manejos/{id}/fotos": {
        post: envio("manejo de pastagem", "ID do manejo de pastagem"),
    },
    "/v1/rebanhos/manejos/{id}/fotos": {
        post: envio("manejo de rebanho", "ID do manejo de rebanho"),
    },
    "/v1/manejos/fotos": {
        get: {
            tags: ["Fotos de Atividade"],
            summary: "Lista as fotos das atividades do usuário",
            description: `
            + Caso de uso: O app baixa as fotos da atividade ao abrir a ficha, e acompanha exclusões feitas em outro aparelho.

            + Regras de Negócio:
                - Só fotos de manejos do usuário autenticado, da mais antiga para a mais nova (\`createdAt\`).
                - Por padrão só as ativas; **ativo=false** lista as excluídas.
                - **atualizadoDesde** (leitura por diferença) devolve vigentes e excluídas alteradas depois do instante; cada item traz \`ativo\` e \`updatedAt\`.
            `,
            security: [{ bearerAuth: [] }],
            parameters: [
                { name: "manejoPastoId", in: "query", schema: { type: "string", format: "uuid" }, required: false },
                { name: "manejoRebanhoId", in: "query", schema: { type: "string", format: "uuid" }, required: false },
                { name: "pastoId", in: "query", schema: { type: "string", format: "uuid" }, required: false },
                { name: "rebanhoId", in: "query", schema: { type: "string", format: "uuid" }, required: false },
                { name: "propriedadeId", in: "query", schema: { type: "string", format: "uuid" }, required: false },
                { name: "ativo", in: "query", schema: { type: "string", enum: ["true", "false"] }, required: false },
                { name: "atualizadoDesde", in: "query", schema: { type: "string", format: "date-time" }, required: false, description: "Leitura por diferença (ISO 8601 UTC)" },
                { name: "page", in: "query", schema: { type: "integer", default: 1 }, required: false },
                { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 100 }, required: false },
            ],
            responses: {
                200: commonResponses[200]("#/components/schemas/FotoAtividadeLista"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500](),
            },
        },
    },
    "/v1/manejos/fotos/{id}": {
        delete: {
            tags: ["Fotos de Atividade"],
            summary: "Exclui uma foto de atividade",
            description: `
            + Regras de Negócio:
                - Exclusão lógica (\`ativo: false\`): a leitura por diferença leva a exclusão aos outros aparelhos.
                - O arquivo é removido do armazenamento em melhor esforço — falha na remoção não falha a exclusão.
                - Foto já excluída: 200 com o registro como está. Inexistente ou de outro usuário: 404.
                - No /sync: **fotos_atividade:DELETE** (foto inexistente também é aceita).
            `,
            security: [{ bearerAuth: [] }],
            parameters: [idParam("ID da foto")],
            responses: {
                200: commonResponses[200]("#/components/schemas/FotoAtividade"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                404: commonResponses[404](),
                500: commonResponses[500](),
            },
        },
    },
};

export default fotoAtividadeRoutes;
