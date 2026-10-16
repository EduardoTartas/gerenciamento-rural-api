// Apoio local à suíte de fotos de atividade (/pastagens/manejos/:id/fotos,
// /rebanhos/manejos/:id/fotos, /manejos/fotos). Monta um cenário completo
// (propriedade, pasto, rebanho e um manejo de cada tipo) e grava fotos direto
// via Prisma para pré-condições que o POST não cobre (foto excluída, data
// antiga, foto de outro usuário).
//
// O mock do Garage fica em cada arquivo de teste: `vi.mock` só é içado no
// arquivo onde é chamado.
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

/** Propriedade com um pasto, um rebanho e um manejo de cada tipo, do usuário. */
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

/** Grava uma foto direto no banco. Informe `manejoPastoId` ou `manejoRebanhoId` em `dados`. */
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
