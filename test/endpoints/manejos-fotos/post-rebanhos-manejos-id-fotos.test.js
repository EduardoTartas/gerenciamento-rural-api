import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarCenario, criarFoto, criarImagem } from './apoio-local.js';

// Mock do client Garage/MinIO, igual à suíte de /uploads: só o client de
// storage é trocado; `baseUrlPublica`/`ensureGarageEnv` seguem reais.
const { putObject, removeObject, getGarageClientMock } = vi.hoisted(() => {
    const putObject = vi.fn().mockResolvedValue(undefined);
    const removeObject = vi.fn().mockResolvedValue(undefined);
    const getGarageClientMock = vi.fn().mockResolvedValue({ putObject, removeObject });
    return { putObject, removeObject, getGarageClientMock };
});

vi.mock('../../../src/config/garageConnect.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, default: getGarageClientMock, getGarageClient: getGarageClientMock };
});

const { prisma } = DbConnect;

describe('POST /v1/rebanhos/manejos/:id/fotos', () => {
    let a, cenario;

    beforeEach(async () => {
        a = await criarUsuario();
        cenario = await criarCenario(a.id);
        putObject.mockReset().mockResolvedValue(undefined);
        removeObject.mockReset().mockResolvedValue(undefined);
        getGarageClientMock.mockReset().mockResolvedValue({ putObject, removeObject });
    });

    const enviar = (usuario, manejoId, buffer, { id } = {}) => {
        const req = api().post(`/v1/rebanhos/manejos/${manejoId}/fotos`);
        if (usuario) req.set('Authorization', usuario.bearer);
        if (id) req.field('id', id);
        if (buffer) req.attach('file', buffer, { filename: 'foto.jpg', contentType: 'image/jpeg' });
        return req;
    };

    it('FOTO-REB-POST-01 envia foto do manejo de rebanho', async () => {
        const id = randomUUID();
        const r = await enviar(a, cenario.manejoRebanho.id, await criarImagem(), { id });

        expect(r.status).toBe(201);
        expect(r.body.message).toBe('Foto enviada com sucesso.');
        expect(r.body.data).toMatchObject({
            id,
            manejoPastoId: null,
            manejoRebanhoId: cenario.manejoRebanho.id,
            url: `${process.env.GARAGE_PUBLIC_URL}/atividades/${id}.jpeg`,
            ativo: true,
        });
        expect(putObject.mock.calls[0][1]).toBe(`atividades/${id}.jpeg`);
    });

    it('FOTO-REB-POST-02 reenvio do mesmo id é idempotente', async () => {
        const id = randomUUID();
        await criarFoto({ id, manejoRebanhoId: cenario.manejoRebanho.id });

        const r = await enviar(a, cenario.manejoRebanho.id, await criarImagem(), { id });
        expect(r.status).toBe(200);
        expect(r.body.data.id).toBe(id);
        expect(putObject).not.toHaveBeenCalled();
    });

    it('FOTO-REB-POST-03 mesmo id já usado em manejo de pastagem', async () => {
        const id = randomUUID();
        await criarFoto({ id, manejoPastoId: cenario.manejoPasto.id });

        const r = await enviar(a, cenario.manejoRebanho.id, await criarImagem(), { id });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
    });

    it('FOTO-REB-POST-04 manejo já tem 3 fotos ativas', async () => {
        for (let i = 0; i < 3; i++) await criarFoto({ manejoRebanhoId: cenario.manejoRebanho.id });

        const r = await enviar(a, cenario.manejoRebanho.id, await criarImagem());
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Esta atividade já tem 3 fotos.');
        expect(putObject).not.toHaveBeenCalled();
    });

    it('FOTO-REB-POST-05 limite conta só o próprio manejo', async () => {
        for (let i = 0; i < 3; i++) await criarFoto({ manejoPastoId: cenario.manejoPasto.id });

        const r = await enviar(a, cenario.manejoRebanho.id, await criarImagem());
        expect(r.status).toBe(201);
    });

    it('FOTO-REB-POST-06 multi-tenancy: B envia foto no manejo de A', async () => {
        const b = await criarUsuario();
        const r = await enviar(b, cenario.manejoRebanho.id, await criarImagem());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('FOTO-REB-POST-07 manejo excluído', async () => {
        await prisma.manejoRebanho.update({ where: { id: cenario.manejoRebanho.id }, data: { ativo: false } });
        const r = await enviar(a, cenario.manejoRebanho.id, await criarImagem());
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('FOTO-REB-POST-08 id de manejo de pastagem na rota de rebanho', async () => {
        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem());
        expect(r.status).toBe(404);
    });

    it('FOTO-REB-POST-09 :id não é UUID válido', async () => {
        const r = await enviar(a, 'nao-e-uuid', await criarImagem());
        expect(r.status).toBe(400);
    });

    it('FOTO-REB-POST-10 sem token', async () => {
        const r = await enviar(null, cenario.manejoRebanho.id, await criarImagem());
        expect(r.status).toBe(401);
    });
});
