import { randomUUID } from 'node:crypto';
import DbConnect from '../../../src/config/dbConnect.js';

const { prisma } = DbConnect;

export function reiniciarNpaasFalso(falso) {
    falso.ativo = true;
    falso.enviar.mockReset().mockResolvedValue(true);
    falso.registrarDispositivo.mockReset().mockResolvedValue(true);
    falso.desativarToken.mockReset().mockResolvedValue(true);
}

/** módulo que substitui `src/utils/npaas.js`. */
export function moduloNpaasFalso(falso) {
    return {
        default: {
            enviar: (...args) => falso.enviar(...args),
            registrarDispositivo: (...args) => falso.registrarDispositivo(...args),
            desativarToken: (...args) => falso.desativarToken(...args),
        },
        npaasAtivo: () => falso.ativo,
        usuarioNoNpaas: (id) => `${id}_mobile`,
    };
}

export async function criarNotificacao(usuarioId, dados = {}) {
    const entidadeId = dados.entidadeId ?? randomUUID();
    return prisma.notificacao.create({
        data: {
            usuarioId,
            tipo: 'PASTO_PRONTO',
            titulo: 'Pasto pronto para receber gado',
            mensagem: 'O descanso de 30 dias terminou.',
            entidade: 'pasto',
            entidadeId,
            rota: `/pastos/${entidadeId}`,
            pushStatus: 'enviado',
            ...dados,
        },
    });
}

export const diasAtras = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
