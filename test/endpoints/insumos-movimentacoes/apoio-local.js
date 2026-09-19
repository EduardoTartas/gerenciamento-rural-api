// Fábrica local da suíte de /insumos/movimentacoes. Grava direto via Prisma
// para preparar movimentações pré-existentes nos cenários de leitura e
// exclusão (a criação em si é exercitada pelos testes de POST).
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
