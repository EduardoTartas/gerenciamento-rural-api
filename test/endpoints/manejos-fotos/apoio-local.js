import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import DbConnect from '../../../src/config/dbConnect.js';
import {
    criarPropriedade, criarPasto, criarRebanho, criarTipoManejoPasto, criarTipoManejoRebanho,
} from '../../apoio/fabricas.js';

const { prisma } = DbConnect;

export const criarImagem = (formato = 'jpeg', largura = 800, altura = 600) =>
    sharp({
        create: { width: largura, height: altura, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })[formato]().toBuffer();

export async function criarCenario(usuarioId) {
    const propriedade = await criarPropriedade(usuarioId);
    const pasto = await criarPasto(propriedade.id);
    const rebanho = await criarRebanho(propriedade.id, pasto.id);
    const tipoPasto = await criarTipoManejoPasto();
    const tipoRebanho = await criarTipoManejoRebanho();
    const manejoPasto = await prisma.manejoPasto.create({
        data: { pastoId: pasto.id, tipoManejoId: tipoPasto.id, dataAtividade: new Date() },
    });
    const manejoRebanho = await prisma.manejoRebanho.create({
        data: { rebanhoId: rebanho.id, tipoManejoId: tipoRebanho.id, dataAtividade: new Date() },
    });
    return { propriedade, pasto, rebanho, tipoPasto, tipoRebanho, manejoPasto, manejoRebanho };
}

export async function criarFoto(dados) {
    const id = dados.id ?? randomUUID();
    return prisma.fotoAtividade.create({
        data: {
            id,
            url: `http://localhost:3900/fotos-teste/atividades/${id}.jpeg`,
            ...dados,
        },
    });
}
