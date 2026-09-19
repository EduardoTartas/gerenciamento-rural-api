// Fábricas locais da suíte de /insumos. Gravam via Prisma o ledger de
// movimentações e os regimes de consumo — não existe rota própria para
// preparar saldo nesta suíte (a rota /insumos/movimentacoes é de outra task).
import DbConnect from '../../../src/config/dbConnect.js';

const { prisma } = DbConnect;

export async function criarMovimentacaoInsumo(insumoId, dados = {}) {
    return prisma.movimentacaoInsumo.create({
        data: {
            insumoId,
            tipo: 'Entrada',
            quantidade: 100,
            data: new Date(),
            origem: 'Compra',
            ...dados,
        },
    });
}

export async function criarRegimeConsumoInsumo(rebanhoId, insumoId, dados = {}) {
    return prisma.regimeConsumoInsumo.create({
        data: {
            rebanhoId,
            insumoId,
            quantidadeDia: 10,
            dataInicio: new Date(),
            ...dados,
        },
    });
}
