import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarCenario, criarFoto } from './apoio-local.js';

// mock do client Garage/MinIO, igual à suíte de /uploads.
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

let a, cenario;

beforeEach(async () => {
    a = await criarUsuario();
    cenario = await criarCenario(a.id);
    putObject.mockReset().mockResolvedValue(undefined);
    removeObject.mockReset().mockResolvedValue(undefined);
    getGarageClientMock.mockReset().mockResolvedValue({ putObject, removeObject });
});

const removeuArquivo = (chave) =>
    vi.waitFor(() => expect(removeObject).toHaveBeenCalledWith(process.env.GARAGE_BUCKET_FOTOS, chave));

describe('DELETE /v1/manejos/fotos/:id', () => {
    const del = (usuario, id) =>
        api().delete(`/v1/manejos/fotos/${id}`).set('Authorization', usuario.bearer);

    it('FOTO-DELETE-01 exclui a foto e remove o arquivo', async () => {
        const foto = await criarFoto({ manejoPastoId: cenario.manejoPasto.id });

        const r = await del(a, foto.id);
        expect(r.status).toBe(200);
        expect(r.body.message).toBe('Foto excluída com sucesso.');
        expect(r.body.data).toMatchObject({ id: foto.id, ativo: false });

        const salva = await prisma.fotoAtividade.findUnique({ where: { id: foto.id } });
        expect(salva.ativo).toBe(false);
        expect(salva.updatedAt.getTime()).toBeGreaterThan(foto.updatedAt.getTime());
        await removeuArquivo(`atividades/${foto.id}.jpeg`);
    });

    it('FOTO-DELETE-02 foto de manejo de rebanho', async () => {
        const foto = await criarFoto({ manejoRebanhoId: cenario.manejoRebanho.id });
        const r = await del(a, foto.id);
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);
    });

    it('FOTO-DELETE-03 falha ao remover o arquivo não falha a exclusão', async () => {
        removeObject.mockRejectedValue(new Error('garage fora'));
        const foto = await criarFoto({ manejoPastoId: cenario.manejoPasto.id });

        const r = await del(a, foto.id);
        expect(r.status).toBe(200);
        expect((await prisma.fotoAtividade.findUnique({ where: { id: foto.id } })).ativo).toBe(false);
    });

    it('FOTO-DELETE-04 foto já excluída responde 200 sem mexer no arquivo', async () => {
        const foto = await criarFoto({ manejoPastoId: cenario.manejoPasto.id, ativo: false });
        const r = await del(a, foto.id);
        expect(r.status).toBe(200);
        expect(r.body.data.ativo).toBe(false);
        expect(removeObject).not.toHaveBeenCalled();
    });

    it('FOTO-DELETE-05 id inexistente', async () => {
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('FOTO-DELETE-06 multi-tenancy: B tenta excluir foto de A', async () => {
        const foto = await criarFoto({ manejoPastoId: cenario.manejoPasto.id });
        const b = await criarUsuario();

        const r = await del(b, foto.id);
        expect(r.status).toBe(404);
        expect((await prisma.fotoAtividade.findUnique({ where: { id: foto.id } })).ativo).toBe(true);
        expect(removeObject).not.toHaveBeenCalled();
    });

    it('FOTO-DELETE-07 :id não é UUID válido', async () => {
        const r = await del(a, 'nao-e-uuid');
        expect(r.status).toBe(400);
        expect(r.body.errors[0].message).toBe('ID de foto inválido. Deve ser um UUID válido.');
    });

    it('FOTO-DELETE-08 sem token', async () => {
        const r = await api().delete(`/v1/manejos/fotos/${randomUUID()}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});

describe('Exclusão do manejo desativa as fotos', () => {
    it('FOTO-MANEJO-01 DELETE /pastagens/manejos/:id desativa as fotos do manejo', async () => {
        const foto = await criarFoto({ manejoPastoId: cenario.manejoPasto.id });
        const outra = await criarFoto({ manejoRebanhoId: cenario.manejoRebanho.id });

        const r = await api().delete(`/v1/pastagens/manejos/${cenario.manejoPasto.id}`).set('Authorization', a.bearer);
        expect(r.status).toBe(200);

        expect((await prisma.fotoAtividade.findUnique({ where: { id: foto.id } })).ativo).toBe(false);
        expect((await prisma.fotoAtividade.findUnique({ where: { id: outra.id } })).ativo).toBe(true);
    });

    it('FOTO-MANEJO-02 DELETE /rebanhos/manejos/:id desativa as fotos do manejo', async () => {
        const foto = await criarFoto({ manejoRebanhoId: cenario.manejoRebanho.id });

        const r = await api().delete(`/v1/rebanhos/manejos/${cenario.manejoRebanho.id}`).set('Authorization', a.bearer);
        expect(r.status).toBe(200);

        expect((await prisma.fotoAtividade.findUnique({ where: { id: foto.id } })).ativo).toBe(false);
    });

    it('FOTO-MANEJO-03 o banco recusa foto sem manejo ou com os dois', async () => {
        await expect(prisma.fotoAtividade.create({ data: { url: 'x' } })).rejects.toThrow();
        await expect(prisma.fotoAtividade.create({
            data: { url: 'x', manejoPastoId: cenario.manejoPasto.id, manejoRebanhoId: cenario.manejoRebanho.id },
        })).rejects.toThrow();
    });
});

describe('POST /v1/sync — fotos_atividade', () => {
    const sync = (usuario, mutacoes) =>
        api().post('/v1/sync').set('Authorization', usuario.bearer).send({ mutacoes });

    it('FOTO-SYNC-01 fotos_atividade:DELETE exclui a foto', async () => {
        const foto = await criarFoto({ manejoPastoId: cenario.manejoPasto.id });

        const r = await sync(a, [{ id: randomUUID(), entidade: 'fotos_atividade', acao: 'DELETE', entidadeId: foto.id }]);
        expect(r.status).toBe(200);
        expect(r.body.data.resultados[0].situacao).toBe('aceito');
        expect((await prisma.fotoAtividade.findUnique({ where: { id: foto.id } })).ativo).toBe(false);
        await removeuArquivo(`atividades/${foto.id}.jpeg`);
    });

    it('FOTO-SYNC-02 foto inexistente ou já excluída é aceita', async () => {
        const excluida = await criarFoto({ manejoPastoId: cenario.manejoPasto.id, ativo: false });

        const r = await sync(a, [
            { id: randomUUID(), entidade: 'fotos_atividade', acao: 'DELETE', entidadeId: randomUUID() },
            { id: randomUUID(), entidade: 'fotos_atividade', acao: 'DELETE', entidadeId: excluida.id },
        ]);
        expect(r.body.data.resultados.map((x) => x.situacao)).toEqual(['aceito', 'aceito']);
    });

    it('FOTO-SYNC-03 multi-tenancy: B não exclui foto de A pelo lote', async () => {
        const foto = await criarFoto({ manejoPastoId: cenario.manejoPasto.id });
        const b = await criarUsuario();

        await sync(b, [{ id: randomUUID(), entidade: 'fotos_atividade', acao: 'DELETE', entidadeId: foto.id }]);
        expect((await prisma.fotoAtividade.findUnique({ where: { id: foto.id } })).ativo).toBe(true);
        expect(removeObject).not.toHaveBeenCalled();
    });

    it('FOTO-SYNC-04 fotos_atividade:CREATE não é suportado no lote', async () => {
        const r = await sync(a, [{
            id: randomUUID(), entidade: 'fotos_atividade', acao: 'CREATE', entidadeId: randomUUID(),
            dados: { manejoPastoId: cenario.manejoPasto.id },
        }]);
        const [res] = r.body.data.resultados;
        expect(res.situacao).toBe('recusado');
        expect(res.erro.tipo).toBe('validationError');
    });
});
