
import { z } from 'zod/v4';

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

const localizacaoRegex = /^[A-Za-zÀ-ÿ\s'-]{2,100},\s?[A-Za-z]{2}$/;
const localizacaoErrorMessage = 'A localização deve seguir o formato "Cidade,UF". Exemplo: "Vilhena,RO".';

export const PropriedadeCreateSchema = z
  .object({
    id: z
      .string()
      .uuid('O id deve ser um UUID válido.')
      .optional(),
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
    areaTotalHa: z
      .number()
      .positive('A área total deve ser um número positivo.')
      .optional()
      .nullable(),
  })
  .strict();

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
    areaTotalHa: z
      .number()
      .positive('A área total deve ser um número positivo.')
      .optional()
      .nullable(),
    ativo: z.boolean().optional(),
  })
  .strict();

export default PropriedadeCreateSchema;
