
import { z } from 'zod/v4';

export const FotoAtividadeCreateSchema = z.object({
    id: z.string().uuid('O id da foto deve ser um UUID válido.').optional(),
}).strict();

export default FotoAtividadeCreateSchema;
