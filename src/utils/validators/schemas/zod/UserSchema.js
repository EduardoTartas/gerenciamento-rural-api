
import { z } from 'zod/v4';

export const UserUpdateSchema = z.object({
    name: z
        .string()
        .min(2, 'O nome deve ter no mínimo 2 caracteres.')
        .max(100, 'O nome deve ter no máximo 100 caracteres.')
        .optional(),
    email: z
        .email('Formato de e-mail inválido.')
        .optional(),
    image: z
        .string()
        .url('A imagem deve ser uma URL válida.')
        .optional()
        .nullable(),
}).strict();

export const UserFotoSchema = z.object({
    url: z.string().url('A URL da imagem é inválida.'),
}).strict();

export default UserUpdateSchema;
