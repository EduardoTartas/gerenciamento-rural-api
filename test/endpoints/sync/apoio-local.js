// Fábricas locais à suíte de /sync — gravam direto via Prisma para montar
// pré-condições (manejo já existente, movimentação de insumo já existente,
// regime já existente, registro de idempotência expirado) que o próprio
// endpoint de lote não precisa cobrir para existir. Não editar
// test/apoio/fabricas.js (outros agentes rodam em paralelo); o controller de
// tasks consolida depois.
import { randomUUID } from 'node:crypto';
import DbConnect from '../../../src/config/dbConnect.js';

const { prisma } = DbConnect;

export async function criarManejoPasto(pastoId, tipoManejoId, dados = {}) {
    return prisma.manejoPasto.create({
        data: {
            pastoId,
            tipoManejoId,
            dataAtividade: new Date(),
            ...dados,
        },
    });
}

export async function criarManejoRebanho(rebanhoId, tipoManejoId, dados = {}) {
    return prisma.manejoRebanho.create({
        data: {
            rebanhoId,
            tipoManejoId,
            dataAtividade: new Date(),
            ...dados,
        },
    });
}

export async function criarMovimentacaoInsumo(insumoId, dados = {}) {
    return prisma.movimentacaoInsumo.create({
        data: {
            insumoId,
            tipo: 'Entrada',
            quantidade: 10,
            data: new Date(),
            origem: 'Compra',
            ...dados,
        },
    });
}

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

/**
 * Insere um registro de idempotência diretamente no banco, simulando uma
 * mutação aplicada há `diasAtras` dias — usado para testar a expiração da
 * janela de retenção (`limparAntigas`, 30 dias) sem esperar o tempo real.
 */
export async function criarMutacaoAplicada(usuarioId, dados = {}) {
    const { diasAtras, ...resto } = dados;
    const aplicadaEm = diasAtras != null
        ? new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)
        : new Date();
    return prisma.mutacaoAplicada.create({
        data: {
            usuarioId,
            entidade: 'pastos',
            entidadeId: randomUUID(),
            resultado: { situacao: 'aceito' },
            ...resto,
            aplicadaEm,
        },
    });
}
