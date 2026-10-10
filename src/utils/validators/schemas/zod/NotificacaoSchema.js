// src/utils/validators/schemas/zod/NotificacaoSchema.js

import { z } from 'zod/v4';

/** Marcar como lida (ou não lida). Mesmo schema no PATCH e no `notificacoes:UPDATE` do `/sync`. */
export const NotificacaoUpdateSchema = z.object({
    lida: z.boolean({ error: 'Informe se a notificação foi lida (true ou false).' }),
}).strict();

/** Marcar todas como lidas — de todas as fazendas ou só de uma. */
export const NotificacaoLidasSchema = z.object({
    propriedadeId: z.string().uuid('O ID da propriedade deve ser um UUID válido.').optional(),
}).strict();

/** Registro do aparelho para o push (token do Firebase). */
export const DispositivoRegistrarSchema = z.object({
    tokenFcm: z.string({ error: 'Informe o token do aparelho.' })
        .trim()
        .min(10, 'Token do aparelho inválido.')
        .max(4096, 'Token do aparelho inválido.'),
    plataforma: z.enum(['android', 'ios'], { error: 'A plataforma deve ser android ou ios.' }).optional().default('android'),
    versaoApp: z.string().trim().max(50, 'Versão do app muito longa.').optional(),
}).strict();

export const DispositivoDesativarSchema = z.object({
    tokenFcm: z.string({ error: 'Informe o token do aparelho.' })
        .trim()
        .min(10, 'Token do aparelho inválido.')
        .max(4096, 'Token do aparelho inválido.'),
}).strict();

export default NotificacaoUpdateSchema;
