
import { z } from 'zod/v4';

const statusEnum = ['Ocupado', 'Vazio', 'Descanso'];

const tipoPastagemLegado = z.string().max(100).optional().nullable();

const diasDescanso = z
  .number()
  .int('Os dias de descanso devem ser um número inteiro.')
  .min(1, 'Os dias de descanso devem ser pelo menos 1.')
  .max(365, 'Os dias de descanso devem ser no máximo 365.');

export const PastoCreateSchema = z
  .object({
    id: z
      .string()
      .uuid('O id deve ser um UUID válido.')
      .optional(),
    propriedadeId: z
      .string()
      .uuid('O ID da propriedade deve ser um UUID válido.'),
    nome: z
      .string()
      .min(2, 'O nome deve ter pelo menos 2 caracteres.')
      .max(150, 'O nome deve ter no máximo 150 caracteres.'),
    extensaoHa: z
      .number()
      .positive('A extensão deve ser um número positivo.')
      .optional()
      .nullable(),
    tipoPastagemId: z
      .string()
      .uuid('O ID do tipo de pastagem deve ser um UUID válido.')
      .optional()
      .nullable(),
    diasDescanso: diasDescanso.optional().nullable(),
    tipoPastagem: tipoPastagemLegado,
    status: z
      .enum(statusEnum, {
        error: `O status deve ser um dos seguintes valores: ${statusEnum.join(', ')}.`,
      })
      .optional()
      .default('Vazio'),
  })
  .strict();

export const PastoUpdateSchema = z
  .object({
    nome: z
      .string()
      .min(2, 'O nome deve ter pelo menos 2 caracteres.')
      .max(150, 'O nome deve ter no máximo 150 caracteres.')
      .optional(),
    extensaoHa: z
      .number()
      .positive('A extensão deve ser um número positivo.')
      .optional()
      .nullable(),
    tipoPastagemId: z
      .string()
      .uuid('O ID do tipo de pastagem deve ser um UUID válido.')
      .optional()
      .nullable(),
    diasDescanso: diasDescanso.optional().nullable(),
    tipoPastagem: tipoPastagemLegado,
    status: z
      .enum(statusEnum, {
        error: `O status deve ser um dos seguintes valores: ${statusEnum.join(', ')}.`,
      })
      .optional(),
    dataUltimaSaida: z
      .coerce.date()
      .optional()
      .nullable(),
    ativo: z.boolean().optional(),
  })
  .strict();

export default PastoCreateSchema;
