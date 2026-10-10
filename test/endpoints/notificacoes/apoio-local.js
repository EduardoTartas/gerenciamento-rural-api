// Apoio da suíte de notificações: o mock do NPaaS (nenhum teste fala com o
// serviço real — o `.env` carregado em `test/apoio/ambiente.js` pode ter a
// chave de verdade) e a fábrica de notificação gravada direto no banco.
import { randomUUID } from 'node:crypto';
import DbConnect from '../../../src/config/dbConnect.js';

const { prisma } = DbConnect;

/**
 * O estado do NPaaS falso nasce em `vi.hoisted` em cada arquivo (o `vi.mock`
 * sobe acima dos imports):
 *
 *     const npaasFalso = vi.hoisted(() => ({
 *         ativo: true, enviar: vi.fn(), registrarDispositivo: vi.fn(), desativarToken: vi.fn(),
 *     }));
 *
 * `ativo` simula `NPAAS_URL`/`NPAAS_API_KEY` presentes. Antes de cada teste,
 * tudo volta a responder `true` (sucesso).
 */
export function reiniciarNpaasFalso(falso) {
    falso.ativo = true;
    falso.enviar.mockReset().mockResolvedValue(true);
    falso.registrarDispositivo.mockReset().mockResolvedValue(true);
    falso.desativarToken.mockReset().mockResolvedValue(true);
}

/** Módulo que substitui `src/utils/npaas.js`. */
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
