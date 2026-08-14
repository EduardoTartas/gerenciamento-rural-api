// src/docs/paths/upload.js

import commonResponses from "../schemas/swaggerCommonResponses.js";

const uploadRoutes = {
    "/uploads/imagens": {
        post: {
            tags: ["Uploads"],
            summary: "Envia uma imagem para o armazenamento (Garage)",
            description: `
            + Caso de uso: Upload genérico de imagem, desacoplado de qualquer entidade. Quem chama decide depois o que fazer com a URL retornada (ex.: PATCH /usuarios/{id}/foto).

            + Função de Negócio:
                - Recebe um arquivo multipart (campo **file**).
                - Valida extensão (.jpg, .jpeg, .png) e mimetype real do binário.
                - Recomprime a imagem (redimensiona para 512x512, reencode JPEG) antes de enviar ao bucket.
                - Retorna a URL pública e o nome do arquivo gerado no bucket.

            + Regras de Negócio:
                - Requer uma sessão autenticada válida.
                - Tamanho máximo do arquivo: 5MB.
                - A imagem enviada e não registrada em nenhuma entidade fica órfã no bucket até ser limpa manualmente.

            + Resultado Esperado:
                - HTTP 201 Created com **UploadResult** (\`url\`, \`fileName\`).
            `,
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "multipart/form-data": {
                        schema: {
                            type: "object",
                            required: ["file"],
                            properties: {
                                file: { type: "string", format: "binary" }
                            }
                        }
                    }
                }
            },
            responses: {
                201: commonResponses[201]("#/components/schemas/UploadResult"),
                400: commonResponses[400](),
                401: commonResponses[401](),
                500: commonResponses[500](),
                503: commonResponses[503]()
            }
        }
    }
};

export default uploadRoutes;
