// src/utils/validators/schemas/zod/InsumoSchema.js
import { z } from 'zod/v4';

export const DESTINOS_INSUMO = ['Pasto', 'Rebanho', 'Ambos'];
export const UNIDADES_INSUMO = ['kg', 'g', 'L', 'mL', 'dose', 'saco', 'unidade'];

export const InsumoCreateSchema = z.object({
    id:            z.string().uuid('O ID deve ser um UUID válido.').optional(),
    propriedadeId: z.string().uuid('O ID da propriedade deve ser um UUID válido.'),
    tipoInsumoId:  z.string().uuid('O ID do tipo de insumo deve ser um UUID válido.'),
    nome:          z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.').max(120, 'Máximo 120 caracteres.').trim(),
    destino:       z.enum(DESTINOS_INSUMO, { message: `destino deve ser um de: ${DESTINOS_INSUMO.join(', ')}.` }),
    unidadeMedida: z.enum(UNIDADES_INSUMO, { message: `unidadeMedida deve ser uma de: ${UNIDADES_INSUMO.join(', ')}.` }),
    estoqueMinimo: z.number().nonnegative('O estoque mínimo não pode ser negativo.').optional().nullable(),
}).strict();

export const InsumoUpdateSchema = z.object({
    tipoInsumoId:  z.string().uuid('O ID do tipo de insumo deve ser um UUID válido.').optional(),
    nome:          z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.').max(120, 'Máximo 120 caracteres.').trim().optional(),
    destino:       z.enum(DESTINOS_INSUMO).optional(),
    unidadeMedida: z.enum(UNIDADES_INSUMO).optional(),
    estoqueMinimo: z.number().nonnegative('O estoque mínimo não pode ser negativo.').optional().nullable(),
    ativo:         z.boolean().optional(),
}).strict();

export default InsumoCreateSchema;
