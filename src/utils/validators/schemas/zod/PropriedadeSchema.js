// src/utils/validators/schemas/zod/PropriedadeSchema.js

import { z } from 'zod/v4';

/**
 * Formata a string de localização para o padrão "Cidade,UF".
 * Ex: "vilhena,ro" -> "Vilhena,RO"
 * Ex: "são paulo, sp" -> "São Paulo,SP"
 */
const formatLocalizacao = (val) => {
  if (!val) return val;
  const parts = val.split(',');
  if (parts.length !== 2) return val;

  const cidade = parts[0]
    .trim()
    .toLowerCase()
    .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());

  const uf = parts[1].trim().toUpperCase();

  return `${cidade},${uf}`;
};

/**
 * Regex para validar o formato "Cidade,UF".
 **/
const localizacaoRegex = /^[A-Za-zÀ-ÿ\s'-]{2,100},\s?[A-Za-z]{2}$/;
const localizacaoErrorMessage = 'A localização deve seguir o formato "Cidade,UF". Exemplo: "Vilhena,RO".';

/**
 * Schema para criar uma nova propriedade.
 */
export const PropriedadeCreateSchema = z
  .object({
    nome: z
      .string()
      .min(2, 'O nome deve ter pelo menos 2 caracteres.')
      .max(150, 'O nome deve ter no máximo 150 caracteres.'),
    localizacao: z
      .string()
      .max(200, 'A localização deve ter no máximo 200 caracteres.')
      .regex(localizacaoRegex, localizacaoErrorMessage)
      .transform(formatLocalizacao)
      .optional()
      .nullable(),
  })
  .strict();

/**
 * Schema para atualizar propriedade.
 */
export const PropriedadeUpdateSchema = z
  .object({
    nome: z
      .string()
      .min(2, 'O nome deve ter pelo menos 2 caracteres.')
      .max(150, 'O nome deve ter no máximo 150 caracteres.')
      .optional(),
    localizacao: z
      .string()
      .max(200, 'A localização deve ter no máximo 200 caracteres.')
      .regex(localizacaoRegex, localizacaoErrorMessage)
      .transform(formatLocalizacao)
      .optional()
      .nullable(),
    ativo: z.boolean().optional(),
  })
  .strict();

export default PropriedadeCreateSchema;
