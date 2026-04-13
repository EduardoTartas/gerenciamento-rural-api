// src/utils/validators/schemas/zod/PastoSchema.js

import { z } from 'zod/v4';

/**
 * Valores válidos para o status do pasto.
 */
const statusEnum = ['Ocupado', 'Vazio', 'Descanso'];

/**
 * Schema para criar um novo pasto.
 */
export const PastoCreateSchema = z
  .object({
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
    tipoPastagem: z
      .string()
      .min(2, 'O tipo de pastagem deve ter pelo menos 2 caracteres.')
      .max(100, 'O tipo de pastagem deve ter no máximo 100 caracteres.')
      .optional()
      .nullable(),
    status: z
      .enum(statusEnum, {
        error: `O status deve ser um dos seguintes valores: ${statusEnum.join(', ')}.`,
      })
      .optional()
      .default('Vazio'),
  })
  .strict();

/**
 * Schema para atualizar um pasto existente.
 */
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
    tipoPastagem: z
      .string()
      .min(2, 'O tipo de pastagem deve ter pelo menos 2 caracteres.')
      .max(100, 'O tipo de pastagem deve ter no máximo 100 caracteres.')
      .optional()
      .nullable(),
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
