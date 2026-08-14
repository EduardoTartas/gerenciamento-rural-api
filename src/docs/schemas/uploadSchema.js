// src/docs/schemas/uploadSchema.js

const uploadSchemas = {
    UploadResult: {
        type: "object",
        properties: {
            url: { type: "string", format: "uri", example: "https://garage.exemplo.com/pastolivre-avatars/9b1f...jpeg" },
            fileName: { type: "string", example: "9b1f4c2e-....jpeg" }
        },
        description: "Resultado do upload de imagem"
    }
};

export default uploadSchemas;
