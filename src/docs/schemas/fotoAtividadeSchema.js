
const fotoAtividadeSchemas = {
    FotoAtividade: {
        type: "object",
        description: "Foto de um manejo de pastagem ou de rebanho (exatamente um dos dois FKs preenchido)",
        properties: {
            id: { type: "string", format: "uuid" },
            manejoPastoId: { type: "string", format: "uuid", nullable: true },
            manejoRebanhoId: { type: "string", format: "uuid", nullable: true },
            url: { type: "string", format: "uri", example: "https://garage.exemplo.com/fotos/atividades/9b1f4c2e-....jpeg" },
            ativo: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
        },
    },
    FotoAtividadeLista: {
        type: "object",
        properties: {
            docs: { type: "array", items: { $ref: "#/components/schemas/FotoAtividade" } },
            totalDocs: { type: "integer", example: 2 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            totalPages: { type: "integer", example: 1 },
        },
    },
    FotoAtividadeEnvio: {
        type: "object",
        required: ["file"],
        additionalProperties: false,
        properties: {
            file: { type: "string", format: "binary", description: "JPG ou PNG, até 10MB" },
            id: { type: "string", format: "uuid", description: "Id gerado no aparelho; torna o reenvio idempotente" },
        },
    },
};

export default fotoAtividadeSchemas;
