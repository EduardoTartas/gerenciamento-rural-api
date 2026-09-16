// Fábricas de dados de teste. Gravam via Prisma e aceitam `dados` parciais
// sobrescrevendo os defaults. Campos obrigatórios conforme prisma/schema.prisma.
import { randomUUID } from 'node:crypto';
import DbConnect from '../../src/config/dbConnect.js';

const { prisma } = DbConnect;

const sufixo = () => randomUUID().slice(0, 8);

export async function criarPropriedade(usuarioId, dados = {}) {
    return prisma.propriedade.create({
        data: {
            usuarioId,
            nome: `Fazenda Teste ${sufixo()}`,
            localizacao: 'Vilhena,RO',
            ...dados,
        },
    });
}

export async function criarPasto(propriedadeId, dados = {}) {
    return prisma.pasto.create({
        data: {
            propriedadeId,
            nome: `Pasto Teste ${sufixo()}`,
            ...dados,
        },
    });
}

export async function criarRebanho(propriedadeId, pastoId, dados = {}) {
    return prisma.rebanho.create({
        data: {
            propriedadeId,
            pastoAtualId: pastoId,
            nomeRebanho: `Lote Teste ${sufixo()}`,
            ...dados,
        },
    });
}

export async function criarRaca(dados = {}) {
    return prisma.raca.create({
        data: {
            nome: `Raça Teste ${sufixo()}`,
            ...dados,
        },
    });
}

export async function criarSistemaProducao(dados = {}) {
    return prisma.sistemaProducao.create({
        data: {
            nome: `Sistema Teste ${sufixo()}`,
            ...dados,
        },
    });
}

export async function criarRegimeAlimentar(dados = {}) {
    return prisma.regimeAlimentar.create({
        data: {
            nome: `Regime Teste ${sufixo()}`,
            ...dados,
        },
    });
}

export async function criarTipoManejoRebanho(dados = {}) {
    return prisma.tipoManejoRebanho.create({
        data: {
            nome: `Manejo Rebanho Teste ${sufixo()}`,
            ...dados,
        },
    });
}

export async function criarTipoManejoPasto(dados = {}) {
    return prisma.tipoManejoPasto.create({
        data: {
            nome: `Manejo Pasto Teste ${sufixo()}`,
            ...dados,
        },
    });
}

export async function criarTipoInsumo(dados = {}) {
    return prisma.tipoInsumo.create({
        data: {
            nome: `Tipo Insumo Teste ${sufixo()}`,
            ...dados,
        },
    });
}

export async function criarInsumo(propriedadeId, dados = {}) {
    const tipoInsumoId = dados.tipoInsumoId ?? (await criarTipoInsumo()).id;
    return prisma.insumo.create({
        data: {
            propriedadeId,
            tipoInsumoId,
            nome: `Insumo Teste ${sufixo()}`,
            destino: 'Ambos',
            unidadeMedida: 'kg',
            ...dados,
        },
    });
}
