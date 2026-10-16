import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
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

describe('POST /v1/pastagens/manejos/:id/fotos', () => {
    let a, cenario;

    beforeEach(async () => {
        a = await criarUsuario();
        cenario = await criarCenario(a.id);
        putObject.mockReset().mockResolvedValue(undefined);
        removeObject.mockReset().mockResolvedValue(undefined);
        getGarageClientMock.mockReset().mockResolvedValue({ putObject, removeObject });
    });

    const enviar = (usuario, manejoId, buffer, { id, filename = 'foto.jpg', contentType = 'image/jpeg', extra } = {}) => {
        const req = api().post(`/v1/pastagens/manejos/${manejoId}/fotos`);
        if (usuario) req.set('Authorization', usuario.bearer);
        if (id) req.field('id', id);
        if (extra) req.field(extra[0], extra[1]);
        if (buffer) req.attach('file', buffer, { filename, contentType });
        return req;
    };

    it('FOTO-PAS-POST-01 envia foto com id do aparelho', async () => {
        const id = randomUUID();
        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem(), { id });

        expect(r.status).toBe(201);
        expect(r.body.message).toBe('Foto enviada com sucesso.');
        expect(r.body.errors).toEqual([]);
        expect(r.body.data).toMatchObject({
            id,
            manejoPastoId: cenario.manejoPasto.id,
            manejoRebanhoId: null,
            url: `${process.env.GARAGE_PUBLIC_URL}/atividades/${id}.jpeg`,
            ativo: true,
        });
        expect(Object.keys(r.body.data).sort()).toEqual(
            ['ativo', 'createdAt', 'id', 'manejoPastoId', 'manejoRebanhoId', 'updatedAt', 'url'],
        );
        expect(putObject).toHaveBeenCalledTimes(1);
        const [bucket, chave, , , meta] = putObject.mock.calls[0];
        expect(bucket).toBe(process.env.GARAGE_BUCKET_FOTOS);
        expect(chave).toBe(`atividades/${id}.jpeg`);
        expect(meta).toMatchObject({ 'Content-Type': 'image/jpeg' });

        const salva = await prisma.fotoAtividade.findUnique({ where: { id } });
        expect(salva.ativo).toBe(true);
    });

    it('FOTO-PAS-POST-02 sem id gera um no servidor', async () => {
        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem('png'), {
            filename: 'foto.png', contentType: 'image/png',
        });

        expect(r.status).toBe(201);
        expect(r.body.data.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(putObject.mock.calls[0][1]).toBe(`atividades/${r.body.data.id}.jpeg`);
    });

    it('FOTO-PAS-POST-03 reduz o lado maior a 1600 sem cortar', async () => {
        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem('jpeg', 4000, 2000));

        expect(r.status).toBe(201);
        const meta = await sharp(putObject.mock.calls[0][2]).metadata();
        expect(meta.format).toBe('jpeg');
        expect(meta.width).toBe(1600);
        expect(meta.height).toBe(800);
    });

    it('FOTO-PAS-POST-04 imagem pequena não é ampliada', async () => {
        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem('jpeg', 300, 200));

        expect(r.status).toBe(201);
        const meta = await sharp(putObject.mock.calls[0][2]).metadata();
        expect(meta.width).toBe(300);
        expect(meta.height).toBe(200);
    });

    it('FOTO-PAS-POST-05 reenvio do mesmo id no mesmo manejo é idempotente', async () => {
        const id = randomUUID();
        const primeira = await enviar(a, cenario.manejoPasto.id, await criarImagem(), { id });
        expect(primeira.status).toBe(201);

        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem(), { id });
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Foto já enviada.');
        expect(r.body.data.id).toBe(id);
        expect(r.body.data.url).toBe(primeira.body.data.url);
        expect(putObject).toHaveBeenCalledTimes(1);
        expect(await prisma.fotoAtividade.count()).toBe(1);
    });

    it('FOTO-PAS-POST-06 reenvio idempotente não esbarra no limite de 3', async () => {
        const id = randomUUID();
        await criarFoto({ id, manejoPastoId: cenario.manejoPasto.id });
        await criarFoto({ manejoPastoId: cenario.manejoPasto.id });
        await criarFoto({ manejoPastoId: cenario.manejoPasto.id });

        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem(), { id });
        expect(r.status).toBe(200);
        expect(r.body.data.id).toBe(id);
    });

    it('FOTO-PAS-POST-07 mesmo id já usado em outro manejo', async () => {
        const id = randomUUID();
        await criarFoto({ id, manejoRebanhoId: cenario.manejoRebanho.id });

        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem(), { id });
        expect(r.status).toBe(409);
        expect(r.body.tipo).toBe('conflict');
        expect(putObject).not.toHaveBeenCalled();
    });

    it('FOTO-PAS-POST-08 manejo já tem 3 fotos ativas', async () => {
        for (let i = 0; i < 3; i++) await criarFoto({ manejoPastoId: cenario.manejoPasto.id });

        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem(), { id: randomUUID() });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.message).toBe('Esta atividade já tem 3 fotos.');
        expect(putObject).not.toHaveBeenCalled();
    });

    it('FOTO-PAS-POST-09 foto excluída libera a vaga', async () => {
        await criarFoto({ manejoPastoId: cenario.manejoPasto.id });
        await criarFoto({ manejoPastoId: cenario.manejoPasto.id });
        await criarFoto({ manejoPastoId: cenario.manejoPasto.id, ativo: false });

        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem());
        expect(r.status).toBe(201);
    });

    it('FOTO-PAS-POST-10 manejo inexistente', async () => {
        const r = await enviar(a, randomUUID(), await criarImagem());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(putObject).not.toHaveBeenCalled();
    });

    it('FOTO-PAS-POST-11 multi-tenancy: B envia foto no manejo de A', async () => {
        const b = await criarUsuario();
        const r = await enviar(b, cenario.manejoPasto.id, await criarImagem());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
        expect(putObject).not.toHaveBeenCalled();
    });

    it('FOTO-PAS-POST-12 manejo excluído', async () => {
        await prisma.manejoPasto.update({ where: { id: cenario.manejoPasto.id }, data: { ativo: false } });
        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem());
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(putObject).not.toHaveBeenCalled();
    });

    it('FOTO-PAS-POST-13 sem arquivo', async () => {
        const r = await enviar(a, cenario.manejoPasto.id, null, { id: randomUUID() });
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Nenhum arquivo enviado.');
    });

    it('FOTO-PAS-POST-14 extensão fora da whitelist', async () => {
        const r = await enviar(a, cenario.manejoPasto.id, Buffer.from('gif'), {
            filename: 'foto.gif', contentType: 'image/gif',
        });
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Extensão inválida (.gif). Permitido: jpg, jpeg, png.');
    });

    it('FOTO-PAS-POST-15 arquivo acima de 10MB', async () => {
        const r = await enviar(a, cenario.manejoPasto.id, Buffer.alloc(11 * 1024 * 1024, 1));
        expect(r.status).toBe(400);
        expect(r.body.message).toBe('Arquivo excede o tamanho máximo de 10MB.');
        expect(putObject).not.toHaveBeenCalled();
    });

    it('FOTO-PAS-POST-16 id do corpo não é UUID', async () => {
        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem(), { id: 'nao-e-uuid' });
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('O id da foto deve ser um UUID válido.');
    });

    it('FOTO-PAS-POST-17 campo extra no corpo', async () => {
        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem(), { extra: ['legenda', 'x'] });
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('FOTO-PAS-POST-18 :id não é UUID válido', async () => {
        const r = await enviar(a, 'nao-e-uuid', await criarImagem());
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('ID de manejo de pasto inválido. Deve ser um UUID válido.');
    });

    it('FOTO-PAS-POST-19 falha do storage não grava a foto', async () => {
        putObject.mockRejectedValueOnce(new Error('garage fora'));
        const id = randomUUID();
        const r = await enviar(a, cenario.manejoPasto.id, await criarImagem(), { id });
        expect(r.status).toBe(503);
        expect(r.body.tipo).toBe('storageError');
        expect(await prisma.fotoAtividade.findUnique({ where: { id } })).toBeNull();
    });

    it('FOTO-PAS-POST-20 sem token', async () => {
        const r = await enviar(null, cenario.manejoPasto.id, await criarImagem());
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
