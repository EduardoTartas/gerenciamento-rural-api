// src/utils/validators/schemas/zod/FotoAtividadeSchema.js

import { z } from 'zod/v4';

/**
 * Campos de texto do `multipart/form-data` do envio de foto (o arquivo vem à
 * parte, em `req.files.file`). `id` é opcional para o REST, mas o app sempre
 * manda: é ele que torna o reenvio idempotente quando a resposta se perde.
 */
export const FotoAtividadeCreateSchema = z.object({
    id: z.string().uuid('O id da foto deve ser um UUID válido.').optional(),
}).strict();

export default FotoAtividadeCreateSchema;
