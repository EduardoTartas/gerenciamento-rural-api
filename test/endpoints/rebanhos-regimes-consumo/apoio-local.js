// Fábrica local para a suíte de rebanhos/regimes-consumo. Não altera
// test/apoio/fabricas.js (outros agentes rodam em paralelo).
import DbConnect from '../../../src/config/dbConnect.js';

const { prisma } = DbConnect;

/**
 * Cria um regime de consumo direto no banco (sem passar pela transação de
 * encerramento automático do service). Cuidado ao criar dois regimes em
 * aberto para o mesmo par (rebanhoId, insumoId): bate no índice único
 * parcial `regimes_consumo_insumo_rebanhoId_insumoId_aberto_key`.
 */
export async function criarRegimeConsumo(rebanhoId, insumoId, dados = {}) {
    return prisma.regimeConsumoInsumo.create({
        data: {
            rebanhoId,
            insumoId,
            quantidadeDia: 5,
            dataInicio: new Date('2026-01-01T00:00:00.000Z'),
            ...dados,
        },
    });
}
