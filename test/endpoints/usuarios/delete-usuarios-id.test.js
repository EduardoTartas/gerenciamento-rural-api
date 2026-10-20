import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DbConnect from '../../../src/config/dbConnect.js';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';
import { criarPasto, criarPropriedade, criarTipoManejoPasto } from '../../apoio/fabricas.js';
import { criarMutacaoAplicada } from '../sync/apoio-local.js';

// Mock do Garage/MinIO (mesmo padrão de patch-usuarios-id-foto): a suíte não sobe
// storage real, e o descarte da foto antiga precisa ser espiado.
const { removeObject } = vi.hoisted(() => ({
    removeObject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/config/garageConnect.js', async (importOriginal) => {
    const real = await importOriginal();
    return {
        ...real,
        default: vi.fn().mockResolvedValue({ removeObject }),
    };
});

describe('DELETE /v1/usuarios/:id', () => {
    const del = (usuario, id) => api().delete(`/v1/usuarios/${id}`).set('Authorization', usuario.bearer);
    const BUCKET_URL = process.env.GARAGE_PUBLIC_URL.replace(/\/$/, '');
    beforeEach(() => { removeObject.mockClear(); });
    const esperarDescarte = () => new Promise((resolve) => { setTimeout(resolve, 0); });

    it('USR-DELETE-01 usuário exclui a própria conta', async () => {
        const a = await criarUsuario();
        const r = await del(a, a.id);
        expect(r.status).toBe(200);
        expect(r.body.errors).toEqual([]);
        expect(r.body.data).toMatchObject({ id: a.id, name: 'Produtor Teste', email: a.email });
        expect(r.body.message).toBe('Usuário removido com sucesso.');
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: a.id } });
        expect(salvo).toBeNull();
    });

    it('USR-DELETE-02 sessões do usuário são revogadas antes da exclusão', async () => {
        const a = await criarUsuario();
        const r = await del(a, a.id);
        expect(r.status).toBe(200);

        const sessoes = await DbConnect.prisma.session.findMany({ where: { userId: a.id } });
        expect(sessoes).toHaveLength(0);

        const semAcesso = await api().get(`/v1/usuarios/${a.id}`).set('Authorization', a.bearer);
        expect(semAcesso.status).toBe(401);
    });

    it('USR-DELETE-03 exclusão em cascata remove dados do domínio do usuário', async () => {
        const a = await criarUsuario();
        const propriedade = await criarPropriedade(a.id);
        const r = await del(a, a.id);
        expect(r.status).toBe(200);
        const salvo = await DbConnect.prisma.propriedade.findUnique({ where: { id: propriedade.id } });
        expect(salvo).toBeNull();
    });

    it('USR-DELETE-03b excluir a conta apaga a foto do bucket', async () => {
        const a = await criarUsuario();
        const foto = `${BUCKET_URL}/${randomUUID()}.jpeg`;
        await DbConnect.prisma.user.update({ where: { id: a.id }, data: { image: foto } });

        const r = await del(a, a.id);

        expect(r.status).toBe(200);
        await esperarDescarte();
        expect(removeObject).toHaveBeenCalledTimes(1);
        expect(removeObject.mock.calls[0][1]).toBe(foto.split('/').pop());
    });

    it('USR-DELETE-03c excluir a conta apaga as mutações do sync, só as dela', async () => {
        const a = await criarUsuario();
        const b = await criarUsuario();
        await criarMutacaoAplicada(a.id, { id: randomUUID() });
        await criarMutacaoAplicada(b.id, { id: randomUUID() });

        const r = await del(a, a.id);

        expect(r.status).toBe(200);
        expect(await DbConnect.prisma.mutacaoAplicada.count({ where: { usuarioId: a.id } })).toBe(0);
        expect(await DbConnect.prisma.mutacaoAplicada.count({ where: { usuarioId: b.id } })).toBe(1);
    });

    it('USR-DELETE-03d excluir a conta apaga do bucket as fotos das atividades', async () => {
        const a = await criarUsuario();
        const propriedade = await criarPropriedade(a.id);
        const pasto = await criarPasto(propriedade.id);
        const tipo = await criarTipoManejoPasto();
        const manejo = await DbConnect.prisma.manejoPasto.create({
            data: { pastoId: pasto.id, tipoManejoId: tipo.id, dataAtividade: new Date() },
        });
        const ativa = `${BUCKET_URL}/atividades/${randomUUID()}.jpeg`;
        const removida = `${BUCKET_URL}/atividades/${randomUUID()}.jpeg`;
        await DbConnect.prisma.fotoAtividade.createMany({
            data: [
                { manejoPastoId: manejo.id, url: ativa },
                { manejoPastoId: manejo.id, url: removida, ativo: false },
            ],
        });

        const r = await del(a, a.id);

        expect(r.status).toBe(200);
        await esperarDescarte();
        expect(removeObject).toHaveBeenCalledTimes(2);
        const apagados = removeObject.mock.calls.map((chamada) => chamada[1]).sort();
        expect(apagados).toEqual([ativa, removida].map((u) => u.slice(BUCKET_URL.length + 1)).sort());
    });

    it('USR-DELETE-04 usuário comum tenta excluir outro usuário', async () => {
        const a = await criarUsuario();
        const b = await criarUsuario();
        const r = await del(a, b.id);
        expect(r.status).toBe(403);
        expect(r.body.tipo).toBe('forbidden');
        expect(r.body.message).toBe('Você não tem permissão para excluir a conta de outro usuário.');
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: b.id } });
        expect(salvo).not.toBeNull();
    });

    it('USR-DELETE-05 admin exclui outro usuário (bypass)', async () => {
        const admin = await criarUsuario({ admin: true });
        const a = await criarUsuario();
        const r = await del(admin, a.id);
        expect(r.status).toBe(200);
        const salvo = await DbConnect.prisma.user.findUnique({ where: { id: a.id } });
        expect(salvo).toBeNull();
    });

    it('USR-DELETE-06 ID em formato inválido', async () => {
        const a = await criarUsuario();
        const r = await del(a, 'abc');
        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
    });

    it('USR-DELETE-07 UUID válido mas inexistente', async () => {
        const a = await criarUsuario();
        const r = await del(a, randomUUID());
        expect(r.status).toBe(404);
        expect(r.body.tipo).toBe('resourceNotFound');
    });

    it('USR-DELETE-08 401 sem token', async () => {
        const r = await api().delete(`/v1/usuarios/${randomUUID()}`);
        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
    });
});
