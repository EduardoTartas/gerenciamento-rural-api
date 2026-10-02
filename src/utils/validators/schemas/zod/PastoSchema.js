// src/utils/validators/schemas/zod/PastoSchema.js

import { z } from 'zod/v4';

/**
 * Valores válidos para o status do pasto.
 */
const statusEnum = ['Ocupado', 'Vazio', 'Descanso'];

/**
 * Ajuste do produtor para o descanso deste pasto. Nulo = usa o padrão da
 * forrageira (`tipoPastagem.diasDescanso`). Teto de um ano: acima disso o pasto
 * não está em rotação, está abandonado.
 */
/**
 * Campo antigo (texto livre), aceito só por compatibilidade: app em versão
 * anterior e mutações que já estavam na fila do aparelho quando a forrageira
 * virou catálogo. O service troca pelo `tipoPastagemId` de mesmo nome; sem
 * correspondência, o pasto fica sem tipo. Recusar travaria a fila para sempre.
 */
const tipoPastagemLegado = z.string().max(100).optional().nullable();

const diasDescanso = z
  .number()
  .int('Os dias de descanso devem ser um número inteiro.')
  .min(1, 'Os dias de descanso devem ser pelo menos 1.')
  .max(365, 'Os dias de descanso devem ser no máximo 365.');

/**
 * Schema para criar um novo pasto.
 */
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
